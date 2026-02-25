import { Router } from "express";
import { storage } from "../storage";
import { format, addDays } from "date-fns";
import { DEFAULT_REBATE_WORKFLOW_RULES } from "@shared/schema";

export const rebateWorkflowRouter = Router();

rebateWorkflowRouter.get("/workflow-rules", async (req, res) => {
  try {
    let rules = await storage.getRebateWorkflowRules();
    if (rules.length === 0) {
      for (const rule of DEFAULT_REBATE_WORKFLOW_RULES) {
        await storage.upsertRebateWorkflowRule(rule);
      }
      rules = await storage.getRebateWorkflowRules();
    }
    res.json(rules);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

rebateWorkflowRouter.put("/workflow-rules", async (req, res) => {
  try {
    const rulesData = req.body;
    if (!Array.isArray(rulesData)) {
      return res.status(400).json({ message: "Expected array of workflow rules" });
    }
    const results = [];
    for (const rule of rulesData) {
      const updated = await storage.upsertRebateWorkflowRule(rule);
      results.push(updated);
    }
    res.json(results);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

rebateWorkflowRouter.post("/complete-action", async (req, res) => {
  try {
    const { projectId, staffName, actionType, fromStatus, toStatus, notes, hideDays, followUpDate } = req.body;
    if (!projectId || !staffName || !actionType) {
      return res.status(400).json({ message: "projectId, staffName, and actionType are required" });
    }
    const completion = await storage.createRebateCompletion({
      projectId, staffName, actionType,
      fromStatus: fromStatus || null,
      toStatus: toStatus || null,
      notes: notes || null,
      hideDays: hideDays ?? null,
      followUpDate: followUpDate || null,
    });
    res.json(completion);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

rebateWorkflowRouter.post("/push-followup", async (req, res) => {
  try {
    const { projectId, staffName, actionDone, nextSteps, pushDays } = req.body;
    if (!projectId || !staffName || !actionDone || !nextSteps) {
      return res.status(400).json({ message: "projectId, staffName, actionDone, and nextSteps are required" });
    }
    let defaultPush = 2;
    try {
      const rules = await storage.getRebateWorkflowRules();
      const followUpRule = rules.find(r => r.enabled && r.triggerAction === 'follow_up_submitted');
      if (followUpRule) defaultPush = followUpRule.hideDays;
    } catch { /* use default */ }
    const days = pushDays || defaultPush;
    const newFollowUpDate = format(addDays(new Date(), days), "yyyy-MM-dd");
    const notes = `Action Taken:\n${actionDone}\n\nNext Steps:\n${nextSteps}`;

    const completion = await storage.createRebateCompletion({
      projectId, staffName,
      actionType: "follow_up_push",
      fromStatus: null,
      toStatus: null,
      notes,
      hideDays: days,
      followUpDate: newFollowUpDate,
    });
    res.json({ completion, followUpDate: newFollowUpDate });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

rebateWorkflowRouter.get("/completions", async (req, res) => {
  try {
    const { staffName, startDate, endDate } = req.query as Record<string, string | undefined>;
    const completions = await storage.getRebateCompletions({ staffName, startDate, endDate });
    res.json(completions);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

rebateWorkflowRouter.get("/completions/:projectId", async (req, res) => {
  try {
    const completions = await storage.getRebateCompletionsByProject(req.params.projectId);
    res.json(completions);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

rebateWorkflowRouter.get("/kpi-stats", async (req, res) => {
  try {
    const completions = await storage.getRebateCompletions({});
    const projects = await storage.getProjects();
    const projectMap = new Map(projects.map(p => [p.id, p]));

    const rebateProjects = projects.filter(p =>
      p.installType?.toLowerCase() === "install" &&
      (!p.propertySector || p.propertySector.toLowerCase() === "residential") &&
      p.rebateStatus?.toLowerCase() !== "not required"
    );

    const dailyCounts: Record<string, Record<string, number>> = {};
    const recentCompletions: { date: string; time: string; staffName: string; actionType: string; projectName: string; toStatus: string | null; notes: string | null }[] = [];

    for (const c of completions) {
      const ts = c.completedAt ? new Date(c.completedAt) : null;
      const day = ts ? ts.toISOString().split("T")[0] : "";
      if (!day) continue;
      if (!dailyCounts[day]) dailyCounts[day] = {};
      dailyCounts[day][c.staffName] = (dailyCounts[day][c.staffName] || 0) + 1;

      const proj = projectMap.get(c.projectId);
      recentCompletions.push({
        date: day,
        time: ts ? ts.toISOString() : "",
        staffName: c.staffName,
        actionType: c.actionType,
        projectName: proj?.name || "Unknown Project",
        toStatus: c.toStatus,
        notes: c.notes || null,
      });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    const completionsThisWeek = completions.filter(c => c.completedAt && new Date(c.completedAt) >= weekAgo).length;
    const completionsThisMonth = completions.filter(c => c.completedAt && new Date(c.completedAt) >= monthAgo).length;

    const submitTimes: number[] = [];
    const approvalTimes: number[] = [];
    const closeOffSubmitTimes: number[] = [];
    let rejectionCount = 0;
    let submittedCount = 0;

    for (const p of rebateProjects) {
      const projCompletions = completions.filter(c => c.projectId === p.id);
      const submitEntry = projCompletions.find(c => c.toStatus?.toLowerCase() === "submitted");
      const approveEntry = projCompletions.find(c => c.toStatus?.toLowerCase()?.includes("complete") || c.toStatus?.toLowerCase()?.includes("pre-approved"));
      const rejectEntry = projCompletions.find(c => c.actionType === "status_change" && c.toStatus?.toLowerCase()?.includes("revision"));
      const closeOffEntry = projCompletions.find(c => c.actionType === "status_change" && c.toStatus?.toLowerCase()?.includes("close-off") && !c.toStatus?.toLowerCase()?.includes("submitted"));
      const closeOffSubmitEntry = projCompletions.find(c => c.actionType === "status_change" && (c.toStatus?.toLowerCase() === "close-off - submitted" || c.toStatus?.toLowerCase() === "close-off submitted"));

      if (submitEntry) submittedCount++;

      if (p.projectCreatedDate && submitEntry?.completedAt) {
        const days = (new Date(submitEntry.completedAt).getTime() - new Date(p.projectCreatedDate).getTime()) / 86400000;
        if (days >= 0 && days < 365) submitTimes.push(days);
      }

      if (submitEntry?.completedAt && approveEntry?.completedAt) {
        const days = (new Date(approveEntry.completedAt).getTime() - new Date(submitEntry.completedAt).getTime()) / 86400000;
        if (days >= 0) approvalTimes.push(days);
      }

      if (closeOffEntry?.completedAt && closeOffSubmitEntry?.completedAt) {
        const days = (new Date(closeOffSubmitEntry.completedAt).getTime() - new Date(closeOffEntry.completedAt).getTime()) / 86400000;
        if (days >= 0 && days < 365) closeOffSubmitTimes.push(days);
      } else if (p.rebateCloseOffDate && closeOffSubmitEntry?.completedAt) {
        const days = (new Date(closeOffSubmitEntry.completedAt).getTime() - new Date(p.rebateCloseOffDate).getTime()) / 86400000;
        if (days >= 0 && days < 365) closeOffSubmitTimes.push(days);
      }

      if (rejectEntry) rejectionCount++;
    }

    const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
    const activeDays = Object.keys(dailyCounts).length || 1;
    const rejectionRate = submittedCount > 0 ? Math.round((rejectionCount / submittedCount) * 100) : null;

    res.json({
      dailyCounts,
      recentCompletions: recentCompletions.sort((a, b) => b.date.localeCompare(a.date)),
      completionsThisWeek,
      completionsThisMonth,
      avgTasksPerDay: Math.round((completions.length / activeDays) * 10) / 10,
      avgDaysToSubmit: avg(submitTimes),
      avgDaysToApproval: avg(approvalTimes),
      avgDaysCloseOffToSubmit: avg(closeOffSubmitTimes),
      rejectionCount,
      rejectionRate,
      totalCompletions: completions.length,
      totalRebateProjects: rebateProjects.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
