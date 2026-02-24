import { Router } from "express";
import { storage } from "../storage";

export const workflowRouter = Router();

workflowRouter.get("/", async (_req, res) => {
  try {
    const configs = await storage.getWorkflowConfigs();
    res.json(configs);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

workflowRouter.put("/", async (req, res) => {
  try {
    const items = req.body as Array<{
      stage: string;
      targetDays: number;
      dependsOn: string[];
      gapRelativeTo?: string | null;
      completionCriteria?: string[] | null;
    }>;
    const results = [];
    for (const item of items) {
      const result = await storage.upsertWorkflowConfig({
        stage: item.stage,
        targetDays: item.targetDays,
        dependsOn: item.dependsOn || [],
        gapRelativeTo: item.gapRelativeTo ?? null,
        completionCriteria: item.completionCriteria ?? null,
      });
      results.push(result);
    }
    res.json(results);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
