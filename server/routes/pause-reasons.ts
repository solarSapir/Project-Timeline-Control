import { Router } from "express";
import { storage } from "../storage";
import { DEFAULT_PAUSE_REASONS } from "@shared/schema";
import OpenAI from "openai";

export const pauseReasonsRouter = Router();

pauseReasonsRouter.get("/", async (_req, res) => {
  try {
    let reasons = await storage.getPauseReasons();
    if (reasons.length === 0) {
      for (const reason of DEFAULT_PAUSE_REASONS) {
        await storage.createPauseReason({ reason });
      }
      reasons = await storage.getPauseReasons();
    }
    res.json(reasons);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

pauseReasonsRouter.post("/", async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return res.status(400).json({ message: "Reason is required" });
    }
    const created = await storage.createPauseReason({ reason: reason.trim() });
    res.json(created);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

pauseReasonsRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { db } = await import("../db");
    const { pauseReasons } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const result = await db.delete(pauseReasons).where(eq(pauseReasons.id, id));
    if ((result?.rowCount ?? 0) > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ message: "Reason not found" });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

pauseReasonsRouter.get("/logs", async (req, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const logs = await storage.getPauseLogs(projectId);
    res.json(logs);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

pauseReasonsRouter.post("/logs", async (req, res) => {
  try {
    const { projectId, reason, note, staffName } = req.body;
    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }
    const log = await storage.createPauseLog({ projectId, reason, note, staffName });

    if (reason) {
      try {
        await storage.incrementPauseReasonUsage(reason);
      } catch (err) {
        console.error("Failed to increment pause reason usage:", err);
      }
    }

    res.json(log);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

pauseReasonsRouter.post("/insights", async (_req, res) => {
  try {
    const allProjects = await storage.getProjects();
    const pausedProjects = allProjects.filter(p => p.pmStatus?.toLowerCase() === "project paused");
    const allLogs = await storage.getPauseLogs();

    const reasonCounts: Record<string, number> = {};
    const notes: string[] = [];
    const projectPauseCounts: Record<string, number> = {};

    for (const log of allLogs) {
      if (log.reason) {
        reasonCounts[log.reason] = (reasonCounts[log.reason] || 0) + 1;
      }
      if (log.note) {
        notes.push(log.note);
      }
      projectPauseCounts[log.projectId] = (projectPauseCounts[log.projectId] || 0) + 1;
    }

    const repeatPausers = Object.values(projectPauseCounts).filter(c => c > 1).length;

    const summary = {
      totalPaused: pausedProjects.length,
      totalLogs: allLogs.length,
      uniqueProjectsPaused: Object.keys(projectPauseCounts).length,
      repeatPausers,
      reasonBreakdown: Object.entries(reasonCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([reason, count]) => ({ reason, count, pct: allLogs.length > 0 ? Math.round((count / allLogs.length) * 100) : 0 })),
    };

    if (allLogs.length === 0) {
      return res.json({
        ...summary,
        aiInsight: "No pause log data available yet. Start logging pause reasons on paused projects to generate insights.",
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const reasonText = summary.reasonBreakdown
      .map(r => `- "${r.reason}": ${r.count} pause events (${r.pct}%)`)
      .join("\n");

    const notesText = notes.length > 0
      ? `\n\nFree-text notes from pause events:\n${notes.slice(0, 30).map(n => `- "${n}"`).join("\n")}`
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an operations analyst for a solar installation company in Canada. Analyze project pause data and provide actionable insights. Be concise and specific. Focus on patterns, trends, and recommendations to reduce project pauses. 3-5 bullet points max.",
        },
        {
          role: "user",
          content: `We have ${pausedProjects.length} currently paused solar projects, with ${allLogs.length} total pause events logged across ${summary.uniqueProjectsPaused} unique projects. ${repeatPausers} projects have been paused more than once.\n\nReason breakdown:\n${reasonText}${notesText}\n\nProvide insights on pause patterns and recommendations to reduce project pauses.`,
        },
      ],
      max_tokens: 500,
    });

    const aiInsight = response.choices[0]?.message?.content || "Unable to generate insights at this time.";

    res.json({ ...summary, aiInsight });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
