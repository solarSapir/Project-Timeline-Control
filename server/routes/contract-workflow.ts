import { Router } from "express";
import { storage } from "../storage";
import { DEFAULT_CONTRACT_WORKFLOW_RULES } from "@shared/schema";

export const contractWorkflowRouter = Router();

contractWorkflowRouter.post("/complete-action", async (req, res) => {
  try {
    const { projectId, staffName, actionType, fromStatus, toStatus, notes, hideDays } = req.body;
    if (!projectId || !staffName || !actionType) {
      return res.status(400).json({ message: "projectId, staffName, and actionType are required" });
    }
    const completion = await storage.createContractCompletion({
      projectId, staffName, actionType,
      fromStatus: fromStatus || null,
      toStatus: toStatus || null,
      notes: notes || null,
      hideDays: hideDays ?? 0,
    });
    res.json(completion);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

contractWorkflowRouter.get("/completions", async (req, res) => {
  try {
    const { staffName, startDate, endDate } = req.query as Record<string, string | undefined>;
    const completions = await storage.getContractCompletions({ staffName, startDate, endDate });
    res.json(completions);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

contractWorkflowRouter.get("/completions/:projectId", async (req, res) => {
  try {
    const completions = await storage.getContractCompletionsByProject(req.params.projectId);
    res.json(completions);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

contractWorkflowRouter.get("/kpi-stats", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as Record<string, string | undefined>;
    const completions = await storage.getContractCompletions({ startDate, endDate });
    const projects = await storage.getProjects();
    const projectMap = new Map(projects.map(p => [p.id, p]));

    const contractProjects = projects.filter(p =>
      p.installType?.toLowerCase() === 'install' &&
      (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
      p.installTeamStage &&
      !['complete', 'project paused', 'project lost'].includes(p.pmStatus?.toLowerCase() || '')
    );

    const dailyCounts: Record<string, Record<string, number>> = {};
    const recentCompletions: { date: string; time: string; staffName: string; actionType: string; projectName: string; toStatus: string | null; notes: string | null }[] = [];

    for (const c of completions) {
      const ts = c.completedAt ? new Date(c.completedAt) : null;
      const day = ts ? ts.toISOString().split('T')[0] : '';
      if (!day) continue;
      if (!dailyCounts[day]) dailyCounts[day] = {};
      dailyCounts[day][c.staffName] = (dailyCounts[day][c.staffName] || 0) + 1;

      const proj = projectMap.get(c.projectId);
      recentCompletions.push({
        date: day,
        time: ts ? ts.toISOString() : '',
        staffName: c.staffName,
        actionType: c.actionType,
        projectName: proj?.name || 'Unknown Project',
        toStatus: c.toStatus,
        notes: c.notes || null,
      });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    const completionsThisWeek = completions.filter(c => c.completedAt && new Date(c.completedAt) >= weekAgo).length;
    const completionsThisMonth = completions.filter(c => c.completedAt && new Date(c.completedAt) >= monthAgo).length;

    const uploadTimes: number[] = [];
    const reviewTimes: number[] = [];
    const signTimes: number[] = [];
    const depositTimes: number[] = [];

    for (const p of contractProjects) {
      const projCompletions = completions.filter(c => c.projectId === p.id);

      const firstUpload = projCompletions
        .filter(c => c.actionType === 'document_upload')
        .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime())[0];

      const readyEntry = projCompletions.find(c => c.actionType === 'ready_for_review');
      const approvedEntry = projCompletions.find(c => c.actionType === 'contract_approved');
      const signedEntry = projCompletions.find(c => c.actionType === 'signed');
      const depositEntry = projCompletions.find(c => c.actionType === 'deposit_collected');

      if (readyEntry?.completedAt && approvedEntry?.completedAt) {
        const days = Math.round(((new Date(approvedEntry.completedAt).getTime() - new Date(readyEntry.completedAt).getTime()) / 86400000) * 10) / 10;
        if (days >= 0 && days < 365) reviewTimes.push(days);
      }

      if (firstUpload?.completedAt && p.ucApprovedDate) {
        const days = Math.round(((new Date(firstUpload.completedAt).getTime() - new Date(p.ucApprovedDate).getTime()) / 86400000) * 10) / 10;
        if (days >= 0 && days < 365) uploadTimes.push(days);
      }

      const contractSentDate = projCompletions.find(c => c.actionType === 'contract_sent')?.completedAt;
      if (contractSentDate && signedEntry?.completedAt) {
        const days = Math.round(((new Date(signedEntry.completedAt).getTime() - new Date(contractSentDate).getTime()) / 86400000) * 10) / 10;
        if (days >= 0 && days < 365) signTimes.push(days);
      }

      if (signedEntry?.completedAt && depositEntry?.completedAt) {
        const days = Math.round(((new Date(depositEntry.completedAt).getTime() - new Date(signedEntry.completedAt).getTime()) / 86400000) * 10) / 10;
        if (days >= 0 && days < 365) depositTimes.push(days);
      }
    }

    const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
    const activeDays = Object.keys(dailyCounts).length || 1;

    res.json({
      dailyCounts,
      recentCompletions: recentCompletions.sort((a, b) => b.date.localeCompare(a.date)),
      completionsThisWeek,
      completionsThisMonth,
      avgTasksPerDay: Math.round((completions.length / activeDays) * 10) / 10,
      avgDaysToUpload: avg(uploadTimes),
      avgDaysToReview: avg(reviewTimes),
      avgDaysToSign: avg(signTimes),
      avgDaysToDeposit: avg(depositTimes),
      totalCompletions: completions.length,
      totalContractProjects: contractProjects.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

contractWorkflowRouter.get("/workflow-rules", async (req, res) => {
  try {
    let rules = await storage.getContractWorkflowRules();
    if (rules.length === 0) {
      for (const rule of DEFAULT_CONTRACT_WORKFLOW_RULES) {
        await storage.upsertContractWorkflowRule(rule);
      }
      rules = await storage.getContractWorkflowRules();
    }
    res.json(rules);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

contractWorkflowRouter.put("/workflow-rules", async (req, res) => {
  try {
    const rulesData = req.body;
    if (!Array.isArray(rulesData)) {
      return res.status(400).json({ message: "Expected array of workflow rules" });
    }
    const results = [];
    for (const rule of rulesData) {
      const updated = await storage.upsertContractWorkflowRule(rule);
      results.push(updated);
    }
    res.json(results);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

contractWorkflowRouter.post("/backfill", async (req, res) => {
  try {
    const taskActions = await storage.getTaskActionsByView('contracts');
    const existingCompletions = await storage.getContractCompletions({});
    const existingKeys = new Set(existingCompletions.map(c => `${c.projectId}|${c.actionType}|${c.completedAt?.toISOString()?.split('T')[0]}`));

    let created = 0;
    let skipped = 0;

    for (const action of taskActions) {
      const key = `${action.projectId}|${action.actionType}|${action.actionDate?.split('T')[0]}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      await storage.createContractCompletion({
        projectId: action.projectId,
        staffName: action.staffName || 'System',
        actionType: action.actionType,
        fromStatus: null,
        toStatus: action.notes || null,
        notes: `Backfilled from task_actions`,
        hideDays: 0,
        completedAt: action.actionDate ? new Date(action.actionDate) : undefined,
      });
      created++;
    }

    res.json({
      message: "Contract backfill complete",
      totalActions: taskActions.length,
      created,
      skipped,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
