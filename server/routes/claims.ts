import { Router } from "express";
import { storage } from "../storage";
import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "../db";
import { taskClaims } from "@shared/schema";

export const claimsRouter = Router();

claimsRouter.get("/", async (_req, res) => {
  try {
    const claims = await storage.getActiveClaims();
    res.json(claims);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

claimsRouter.post("/", async (req, res) => {
  try {
    const { projectId, viewType, staffName } = req.body;
    if (!projectId || !viewType || !staffName) {
      return res.status(400).json({ message: "projectId, viewType, and staffName are required" });
    }

    const existingStaffClaim = await storage.getActiveClaimByStaff(staffName);
    if (existingStaffClaim) {
      return res.status(409).json({
        message: `${staffName} is already working on another task`,
        existingClaim: existingStaffClaim,
      });
    }

    const existingProjectClaim = await storage.getActiveClaimForProject(projectId, viewType);
    if (existingProjectClaim) {
      return res.status(409).json({
        message: `This task is already claimed by ${existingProjectClaim.staffName}`,
        existingClaim: existingProjectClaim,
      });
    }

    const claim = await storage.createClaim({ projectId, viewType, staffName });
    res.json(claim);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

claimsRouter.post("/:id/complete", async (req, res) => {
  try {
    const { completionAction } = req.body;
    const claim = await storage.completeClaim(req.params.id, completionAction || "completed");
    if (!claim) return res.status(404).json({ message: "Claim not found" });
    res.json(claim);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

claimsRouter.post("/:id/release", async (req, res) => {
  try {
    const released = await storage.releaseClaim(req.params.id);
    if (!released) return res.status(404).json({ message: "Claim not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

claimsRouter.post("/complete-by-project", async (req, res) => {
  try {
    const { projectId, viewType, completionAction } = req.body;
    if (!projectId || !viewType) {
      return res.status(400).json({ message: "projectId and viewType are required" });
    }
    const claim = await storage.getActiveClaimForProject(projectId, viewType);
    if (!claim) return res.json({ success: true, message: "No active claim" });
    const completed = await storage.completeClaim(claim.id, completionAction || "status_changed");
    res.json(completed);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

claimsRouter.get("/history", async (req, res) => {
  try {
    const staffName = req.query.staffName as string | undefined;
    const projectId = req.query.projectId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const history = await storage.getClaimHistory({ staffName, projectId, limit });
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

claimsRouter.get("/kpi-stats", async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const allCompleted = await db.select().from(taskClaims)
      .where(and(eq(taskClaims.active, false), gte(taskClaims.claimedAt, thirtyDaysAgo)))
      .orderBy(desc(taskClaims.completedAt));

    const activeClaims = await storage.getActiveClaims();

    const thisWeek = allCompleted.filter(c =>
      c.completedAt && new Date(c.completedAt) >= sevenDaysAgo && c.completionAction !== 'released'
    ).length;

    const completedWithDuration = allCompleted.filter(c =>
      c.completedAt && c.claimedAt && c.completionAction !== 'released'
    );

    let avgMinutes = 0;
    if (completedWithDuration.length > 0) {
      const totalMs = completedWithDuration.reduce((sum, c) => {
        return sum + (new Date(c.completedAt!).getTime() - new Date(c.claimedAt!).getTime());
      }, 0);
      avgMinutes = Math.round(totalMs / completedWithDuration.length / 60000);
    }

    const staffStats: Record<string, { completed: number; totalMinutes: number; active: boolean; currentProject?: string }> = {};
    for (const c of completedWithDuration) {
      if (!staffStats[c.staffName]) staffStats[c.staffName] = { completed: 0, totalMinutes: 0, active: false };
      staffStats[c.staffName].completed++;
      staffStats[c.staffName].totalMinutes += Math.round(
        (new Date(c.completedAt!).getTime() - new Date(c.claimedAt!).getTime()) / 60000
      );
    }
    for (const c of activeClaims) {
      if (!staffStats[c.staffName]) staffStats[c.staffName] = { completed: 0, totalMinutes: 0, active: false };
      staffStats[c.staffName].active = true;
      staffStats[c.staffName].currentProject = c.projectId;
    }

    const viewBreakdown: Record<string, number> = {};
    for (const c of completedWithDuration) {
      viewBreakdown[c.viewType] = (viewBreakdown[c.viewType] || 0) + 1;
    }

    res.json({
      activeClaims: activeClaims.length,
      completedThisWeek: thisWeek,
      completedTotal30d: completedWithDuration.length,
      avgMinutesPerTask: avgMinutes,
      staffStats,
      viewBreakdown,
      recentCompleted: completedWithDuration.slice(0, 20),
    });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
