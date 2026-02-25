import { Router } from "express";
import { storage } from "../storage";
import { DEFAULT_UC_WORKFLOW_RULES } from "@shared/schema";
import { fetchTaskStories, findAllStatusChangesInStories } from "../asana";

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
    const projectMap = new Map(projects.map(p => [p.id, p]));

    const ucRequiredProjects = projects.filter(p =>
      p.installType?.toLowerCase() === 'install' &&
      (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
      p.ucStatus?.toLowerCase() !== 'not required'
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

    const submitTimes: number[] = [];
    const submitTimeDetails: { projectName: string; projectId: string; createdDate: string; submittedDate: string; days: number; month: string }[] = [];
    const decisionTimes: number[] = [];
    const decisionTimeDetails: { projectName: string; projectId: string; submittedDate: string; decisionDate: string; decision: string; days: number; month: string }[] = [];
    const rejectTimes: number[] = [];
    const closeOffTimes: number[] = [];
    const rejectionsByUtility: Record<string, number> = {};

    for (const p of ucRequiredProjects) {
      const effectiveStart = p.lastUnpausedDate || p.projectCreatedDate;
      if (effectiveStart && p.ucSubmittedDate) {
        const days = Math.round(((new Date(p.ucSubmittedDate).getTime() - new Date(effectiveStart).getTime()) / 86400000) * 10) / 10;
        if (days >= 0 && days < 365) {
          submitTimes.push(days);
          const subDate = new Date(p.ucSubmittedDate);
          submitTimeDetails.push({
            projectName: p.name || 'Unknown',
            projectId: p.id,
            createdDate: effectiveStart,
            submittedDate: p.ucSubmittedDate,
            days,
            month: `${subDate.getFullYear()}-${String(subDate.getMonth() + 1).padStart(2, '0')}`,
          });
        }
      }

      const projCompletions = completions.filter(c => c.projectId === p.id);
      const submitEntry = projCompletions.find(c => c.toStatus?.toLowerCase() === 'submitted');
      const approveEntry = projCompletions.find(c => c.actionType === 'status_change' && c.toStatus?.toLowerCase()?.includes('approved'));
      const rejectEntry = projCompletions.find(c => c.actionType === 'status_change' && c.toStatus?.toLowerCase()?.includes('reject'));
      const closeOffEntry = projCompletions.find(c => c.actionType === 'status_change' && c.toStatus?.toLowerCase()?.includes('close off'));
      const closedEntry = projCompletions.find(c => c.actionType === 'status_change' && c.toStatus?.toLowerCase() === 'closed');

      if (submitEntry?.completedAt) {
        const decisionEntry = approveEntry || rejectEntry;
        if (decisionEntry?.completedAt) {
          const days = Math.round(((new Date(decisionEntry.completedAt).getTime() - new Date(submitEntry.completedAt).getTime()) / 86400000) * 10) / 10;
          if (days >= 0 && days < 365) {
            decisionTimes.push(days);
            const decDate = new Date(decisionEntry.completedAt);
            const isApproved = decisionEntry === approveEntry;
            decisionTimeDetails.push({
              projectName: p.name || 'Unknown',
              projectId: p.id,
              submittedDate: new Date(submitEntry.completedAt).toISOString().split('T')[0],
              decisionDate: decDate.toISOString().split('T')[0],
              decision: isApproved ? 'Approved' : 'Rejected',
              days,
              month: `${decDate.getFullYear()}-${String(decDate.getMonth() + 1).padStart(2, '0')}`,
            });
          }
        }
      }
      if (submitEntry?.completedAt && rejectEntry?.completedAt) {
        const days = (new Date(rejectEntry.completedAt).getTime() - new Date(submitEntry.completedAt).getTime()) / 86400000;
        if (days >= 0) rejectTimes.push(days);
      }
      if (closeOffEntry?.completedAt && closedEntry?.completedAt) {
        const days = (new Date(closedEntry.completedAt).getTime() - new Date(closeOffEntry.completedAt).getTime()) / 86400000;
        if (days >= 0) closeOffTimes.push(days);
      }
      if (rejectEntry) {
        const utility = p.ucTeam || 'Unknown';
        rejectionsByUtility[utility] = (rejectionsByUtility[utility] || 0) + 1;
      }
    }

    const closeOffPending = ucRequiredProjects.filter(p =>
      p.ucStatus?.toLowerCase().includes('close off')
    ).length;

    const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
    const activeDays = Object.keys(dailyCounts).length || 1;

    res.json({
      dailyCounts,
      recentCompletions: recentCompletions.sort((a, b) => b.date.localeCompare(a.date)),
      completionsThisWeek,
      completionsThisMonth,
      avgTasksPerDay: Math.round((completions.length / activeDays) * 10) / 10,
      avgDaysToSubmit: avg(submitTimes),
      submitTimeDetails: submitTimeDetails.sort((a, b) => b.submittedDate.localeCompare(a.submittedDate)),
      avgDaysToDecision: avg(decisionTimes),
      decisionTimeDetails: decisionTimeDetails.sort((a, b) => b.decisionDate.localeCompare(a.decisionDate)),
      avgDaysToApprove: avg(decisionTimes.length > 0 ? decisionTimes : []),
      avgDaysToReject: avg(rejectTimes),
      avgDaysToClose: avg(closeOffTimes),
      closeOffPending,
      rejectionsByUtility,
      totalCompletions: completions.length,
      totalUcProjects: ucRequiredProjects.length,
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

ucWorkflowRouter.post("/backfill", async (req, res) => {
  try {
    const projects = await storage.getProjects();
    const ucProjects = projects.filter(p =>
      p.asanaGid &&
      p.installType?.toLowerCase() === "install" &&
      (!p.propertySector || p.propertySector.toLowerCase() === "residential")
    );

    const existingCompletions = await storage.getUcCompletions({});
    const existingProjectIds = new Set(existingCompletions.map(c => c.projectId));

    let created = 0;
    let skipped = 0;
    let errors = 0;
    const batchSize = 5;

    for (let i = 0; i < ucProjects.length; i += batchSize) {
      const batch = ucProjects.slice(i, i + batchSize);
      await Promise.all(batch.map(async (project) => {
        if (existingProjectIds.has(project.id)) {
          skipped++;
          return;
        }

        try {
          const stories = await fetchTaskStories(project.asanaGid!);
          const changes = findAllStatusChangesInStories(stories, 'UC TEAM STATUS');

          for (const change of changes) {
            await storage.createUcCompletion({
              projectId: project.id,
              staffName: change.user,
              actionType: "status_change",
              fromStatus: change.fromStatus,
              toStatus: change.toStatus,
              notes: `Backfilled from Asana: ${change.text}`,
              hideDays: null,
              completedAt: change.date ? new Date(change.date) : undefined,
            });
            created++;
          }

          if (changes.length === 0 && project.ucStatus && !["not required", "n/a"].includes(project.ucStatus.toLowerCase())) {
            await storage.createUcCompletion({
              projectId: project.id,
              staffName: "System",
              actionType: "status_change",
              fromStatus: null,
              toStatus: project.ucStatus,
              notes: `Backfilled: current status from Asana sync`,
              hideDays: null,
            });
            created++;
          }
        } catch (err: unknown) {
          errors++;
          console.error(`[UC Backfill] Error for project ${project.name}:`, err instanceof Error ? err.message : String(err));
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    res.json({
      message: "UC backfill complete",
      totalProjects: ucProjects.length,
      created,
      skipped,
      errors,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[UC Backfill] Error:", msg);
    res.status(500).json({ message: msg });
  }
});
