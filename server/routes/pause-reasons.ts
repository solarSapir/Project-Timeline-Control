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

pauseReasonsRouter.post("/insights", async (_req, res) => {
  try {
    const allProjects = await storage.getProjects();
    const pausedProjects = allProjects.filter(p => p.pmStatus?.toLowerCase() === "project paused");

    const reasonCounts: Record<string, number> = {};
    const notes: string[] = [];
    let withReason = 0;
    let withNote = 0;

    for (const p of pausedProjects) {
      if (p.pauseReason) {
        reasonCounts[p.pauseReason] = (reasonCounts[p.pauseReason] || 0) + 1;
        withReason++;
      }
      if (p.pauseNote) {
        notes.push(p.pauseNote);
        withNote++;
      }
    }

    const summary = {
      totalPaused: pausedProjects.length,
      withReason,
      withNote,
      reasonBreakdown: Object.entries(reasonCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([reason, count]) => ({ reason, count, pct: pausedProjects.length > 0 ? Math.round((count / pausedProjects.length) * 100) : 0 })),
    };

    if (pausedProjects.length === 0 || withReason === 0) {
      return res.json({
        ...summary,
        aiInsight: "No pause reason data available yet. Start tagging paused projects with reasons to generate insights.",
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const reasonText = summary.reasonBreakdown
      .map(r => `- "${r.reason}": ${r.count} projects (${r.pct}%)`)
      .join("\n");

    const notesText = notes.length > 0
      ? `\n\nFree-text notes from paused projects:\n${notes.slice(0, 30).map(n => `- "${n}"`).join("\n")}`
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an operations analyst for a solar installation company in Canada. Analyze pause reason data and provide actionable insights. Be concise and specific. Focus on patterns, trends, and recommendations to reduce project pauses. 3-5 bullet points max.",
        },
        {
          role: "user",
          content: `We have ${pausedProjects.length} paused solar projects. Here's the breakdown of why projects are paused:\n\n${reasonText}${notesText}\n\nProvide insights on the most common reasons projects are pausing and what we can do to reduce pauses.`,
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
