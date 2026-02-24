import { Router } from "express";
import { storage } from "../storage";
import { PROJECT_STAGES } from "@shared/schema";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", async (_req, res) => {
  try {
    const allProjects = await storage.getProjects();
    const allDeadlines = await storage.getAllDeadlines();
    const today = new Date();

    const excludedPmStatuses = ['complete', 'project paused', 'project lost'];
    const installProjects = allProjects.filter(p =>
      p.installType?.toLowerCase() === 'install' &&
      (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
      !excludedPmStatuses.includes(p.pmStatus?.toLowerCase() || '')
    );

    const totalProjects = installProjects.length;
    const installProjectIds = new Set(installProjects.map(p => p.id));
    const installDeadlines = allDeadlines.filter(d => installProjectIds.has(d.projectId));

    const projectsWithOverdue = new Set<string>();
    for (const d of installDeadlines) {
      if (d.status === 'pending' && d.targetDate && new Date(d.targetDate) < today) {
        projectsWithOverdue.add(d.projectId);
      }
    }
    const overdueProjectCount = projectsWithOverdue.size;
    const onTrackProjectCount = totalProjects - overdueProjectCount;

    const stageBreakdown: Record<string, { total: number; overdue: number; onTrack: number }> = {};
    for (const stage of PROJECT_STAGES) {
      const deadlinesForStage = installDeadlines.filter(d => d.stage === stage);
      stageBreakdown[stage] = {
        total: deadlinesForStage.length,
        overdue: deadlinesForStage.filter(d => d.status === 'pending' && d.targetDate && new Date(d.targetDate) < today).length,
        onTrack: deadlinesForStage.filter(d => d.status === 'completed' || (d.targetDate && new Date(d.targetDate) >= today)).length,
      };
    }

    const ucBreakdown: Record<string, number> = {};
    const ahjBreakdown: Record<string, number> = {};
    for (const p of installProjects) {
      const ucKey = p.ucStatus || 'Unknown';
      ucBreakdown[ucKey] = (ucBreakdown[ucKey] || 0) + 1;
      const ahjKey = p.ahjStatus || 'Unknown';
      ahjBreakdown[ahjKey] = (ahjBreakdown[ahjKey] || 0) + 1;
    }

    res.json({
      totalProjects,
      totalInstallProjects: installProjects.length,
      overdueCount: overdueProjectCount,
      onTrackCount: onTrackProjectCount,
      stageBreakdown,
      ucBreakdown,
      ahjBreakdown,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
