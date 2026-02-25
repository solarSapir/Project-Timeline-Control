import { Router } from "express";
import { storage } from "../storage";

export const errorLogsRouter = Router();

errorLogsRouter.post("/", async (req, res) => {
  try {
    const { errorMessage, errorSource, pageUrl, userActions, apiEndpoint, apiMethod, apiPayload, stackTrace } = req.body;
    if (!errorMessage) return res.status(400).json({ message: "errorMessage is required" });

    const truncatedPayload = apiPayload && typeof apiPayload === 'string' && apiPayload.length > 2000
      ? apiPayload.substring(0, 2000) + '...[truncated]'
      : apiPayload;

    const log = await storage.createErrorLog({
      errorMessage,
      errorSource: errorSource || "unknown",
      pageUrl: pageUrl || null,
      userActions: userActions || null,
      apiEndpoint: apiEndpoint || null,
      apiMethod: apiMethod || null,
      apiPayload: truncatedPayload || null,
      stackTrace: stackTrace || null,
      resolved: false,
      resolvedNote: null,
    });
    res.json(log);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

errorLogsRouter.get("/", async (req, res) => {
  try {
    const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const logs = await storage.getErrorLogs({ resolved, search });
    res.json(logs);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

errorLogsRouter.patch("/:id/resolve", async (req, res) => {
  try {
    const { note } = req.body;
    const log = await storage.markErrorResolved(req.params.id, note || "");
    if (!log) return res.status(404).json({ message: "Error log not found" });
    res.json(log);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

errorLogsRouter.delete("/resolved", async (_req, res) => {
  try {
    const count = await storage.clearResolvedErrors();
    res.json({ deleted: count });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
