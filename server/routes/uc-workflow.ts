import { Router } from "express";
import { storage } from "../storage";
import { DEFAULT_UC_WORKFLOW_RULES } from "@shared/schema";

export const ucWorkflowRouter = Router();

ucWorkflowRouter.post("/complete-action", async (req, res) => {
  try {
    const { projectId, staffName, actionType, fromStatus, toStatus, notes, hideDays } = req.body;
    if (!projectId || !staffName || !actionType) {
      return res.status(400).json({ message: "projectId, staffName, and actionType are required" });
    }
    const completion = await storage.createUcCompletion({
      projectId, staffName, actionType,
      fromStatus: fromStatus || null,
      toStatus: toStatus || null,
      notes: notes || null,
      hideDays: hideDays ?? null,
    });
    res.json(completion);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

ucWorkflowRouter.get("/completions", async (req, res) => {
  try {
    const { staffName, startDate, endDate } = req.query as Record<string, string | undefined>;
    const completions = await storage.getUcCompletions({ staffName, startDate, endDate });
    res.json(completions);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

ucWorkflowRouter.get("/completions/:projectId", async (req, res) => {
  try {
    const completions = await storage.getUcCompletionsByProject(req.params.projectId);
    res.json(completions);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

ucWorkflowRouter.get("/kpi-stats", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as Record<string, string | undefined>;
    const completions = await storage.getUcCompletions({ startDate, endDate });
    const projects = await storage.getProjects();

    const installProjects = projects.filter(p =>
      p.installType?.toLowerCase() === 'install' &&
      (!p.propertySector || p.propertySector.toLowerCase() === 'residential')
    );

    const dailyCounts: Record<string, Record<string, number>> = {};
    for (const c of completions) {
      const day = c.completedAt ? new Date(c.completedAt).toISOString().split('T')[0] : '';
      if (!day) continue;
      if (!dailyCounts[day]) dailyCounts[day] = {};
      dailyCounts[day][c.staffName] = (dailyCounts[day][c.staffName] || 0) + 1;
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    const completionsThisWeek = completions.filter(c => c.completedAt && new Date(c.completedAt) >= weekAgo).length;
    const completionsThisMonth = completions.filter(c => c.completedAt && new Date(c.completedAt) >= monthAgo).length;

    const submitTimes: number[] = [];
    const approveTimes: number[] = [];
    const rejectTimes: number[] = [];
    const rejectionsByUtility: Record<string, number> = {};

    for (const p of installProjects) {
      const effectiveStart = p.lastUnpausedDate || p.projectCreatedDate;
      if (effectiveStart && p.ucSubmittedDate) {
        const days = (new Date(p.ucSubmittedDate).getTime() - new Date(effectiveStart).getTime()) / 86400000;
        if (days >= 0 && days < 365) submitTimes.push(days);
      }

      const projCompletions = completions.filter(c => c.projectId === p.id);
      const submitEntry = projCompletions.find(c => c.toStatus?.toLowerCase() === 'submitted');
      const approveEntry = projCompletions.find(c => c.toStatus?.toLowerCase() === 'approved');
      const rejectEntry = projCompletions.find(c => c.actionType === 'status_change' && c.toStatus?.toLowerCase()?.includes('reject'));

      if (submitEntry?.completedAt && approveEntry?.completedAt) {
        const days = (new Date(approveEntry.completedAt).getTime() - new Date(submitEntry.completedAt).getTime()) / 86400000;
        if (days >= 0) approveTimes.push(days);
      }
      if (submitEntry?.completedAt && rejectEntry?.completedAt) {
        const days = (new Date(rejectEntry.completedAt).getTime() - new Date(submitEntry.completedAt).getTime()) / 86400000;
        if (days >= 0) rejectTimes.push(days);
      }
      if (rejectEntry) {
        const utility = p.ucTeam || 'Unknown';
        rejectionsByUtility[utility] = (rejectionsByUtility[utility] || 0) + 1;
      }
    }

    const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
    const activeDays = Object.keys(dailyCounts).length || 1;

    res.json({
      dailyCounts,
      completionsThisWeek,
      completionsThisMonth,
      avgTasksPerDay: Math.round((completions.length / activeDays) * 10) / 10,
      avgDaysToSubmit: avg(submitTimes),
      avgDaysToApprove: avg(approveTimes),
      avgDaysToReject: avg(rejectTimes),
      rejectionsByUtility,
      totalCompletions: completions.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

ucWorkflowRouter.get("/workflow-rules", async (req, res) => {
  try {
    let rules = await storage.getUcWorkflowRules();
    if (rules.length === 0) {
      for (const rule of DEFAULT_UC_WORKFLOW_RULES) {
        await storage.upsertUcWorkflowRule(rule);
      }
      rules = await storage.getUcWorkflowRules();
    }
    res.json(rules);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

ucWorkflowRouter.put("/workflow-rules", async (req, res) => {
  try {
    const rulesData = req.body;
    if (!Array.isArray(rulesData)) {
      return res.status(400).json({ message: "Expected array of workflow rules" });
    }
    const results = [];
    for (const rule of rulesData) {
      const updated = await storage.upsertUcWorkflowRule(rule);
      results.push(updated);
    }
    res.json(results);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
