import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import {
  fetchTaskStories,
  fetchTaskAttachments,
  postCommentToTask,
  uploadAttachmentToTask,
  getAccessToken,
} from "./asana";
import { upload } from "./middleware/upload";
import { format } from "date-fns";
import { asanaRouter, hrspRouter, startAutoSync } from "./routes/asana";
import { projectsRouter } from "./routes/projects";
import { uploadsRouter } from "./routes/uploads";
import { workflowRouter } from "./routes/workflow";
import { dashboardRouter } from "./routes/dashboard";
import { errorLogsRouter } from "./routes/error-logs";
import { hrspInvoiceRouter } from "./routes/hrsp-invoice";
import { filesRouter } from "./routes/files";
import { escalationRouter } from "./routes/escalation";
import { ucWorkflowRouter } from "./routes/uc-workflow";
import { rebateWorkflowRouter, runRebateBackfillIfNeeded } from "./routes/rebate-workflow";
import { webhookRouter } from "./routes/webhook";
import { staffRouter } from "./routes/staff";
import { DEFAULT_HRSP_INVOICE_TEMPLATE, DEFAULT_HRSP_DOCUMENTS, type HrspRequiredDocument } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use("/api/asana", asanaRouter);
  app.use("/api/hrsp", hrspRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/projects", uploadsRouter);
  app.use("/api/workflow-config", workflowRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/error-logs", errorLogsRouter);
  app.use("/api/projects", hrspInvoiceRouter);
  app.use("/api/projects", filesRouter);
  app.use("/api", escalationRouter);
  app.use("/api/uc", ucWorkflowRouter);
  app.use("/api/rebate", rebateWorkflowRouter);
  app.use("/api/webhooks", webhookRouter);
  app.use("/api", staffRouter);

  app.get("/api/hrsp-config", async (_req, res) => {
    try {
      const config = await storage.getHrspConfig();
      const savedDocs = config?.requiredDocuments as HrspRequiredDocument[] | undefined;

      let mergedDocs = DEFAULT_HRSP_DOCUMENTS;
      if (savedDocs && Array.isArray(savedDocs)) {
        const savedMap = new Map(savedDocs.map(d => [d.key, d]));
        mergedDocs = DEFAULT_HRSP_DOCUMENTS.map(def => {
          const saved = savedMap.get(def.key);
          if (saved) return { ...def, enabled: saved.enabled };
          return def;
        });
      }

      res.json({
        invoiceTemplate: config?.invoiceTemplate || DEFAULT_HRSP_INVOICE_TEMPLATE,
        requiredDocuments: mergedDocs,
        updatedAt: config?.updatedAt || null,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.put("/api/hrsp-config", async (req, res) => {
    try {
      const { invoiceTemplate, requiredDocuments } = req.body;
      const config = await storage.upsertHrspConfig({ invoiceTemplate, requiredDocuments });
      res.json(config);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.put("/api/deadlines", async (req, res) => {
    try {
      const deadline = await storage.upsertProjectDeadline(req.body);
      res.json(deadline);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/deadlines", async (_req, res) => {
    try {
      const allDeadlines = await storage.getAllDeadlines();
      res.json(allDeadlines);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/install-schedules", async (_req, res) => {
    try {
      const schedules = await storage.getAllInstallSchedules();
      res.json(schedules);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.put("/api/install-schedules", async (req, res) => {
    try {
      const schedule = await storage.upsertInstallSchedule(req.body);
      res.json(schedule);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/subtasks/:gid/stories", async (req, res) => {
    try {
      const stories = await fetchTaskStories(req.params.gid);
      const comments = stories.filter((s: Record<string, unknown>) =>
        s.resource_subtype === 'comment_added' || s.type === 'comment'
      );
      comments.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
      );
      res.json(comments);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/subtasks/:gid/attachments", async (req, res) => {
    try {
      const attachments = await fetchTaskAttachments(req.params.gid);
      res.json(attachments);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/asana/asset/:assetId", async (req, res) => {
    try {
      const accessToken = await getAccessToken();
      const attachmentRes = await fetch(`https://app.asana.com/api/1.0/attachments/${req.params.assetId}?opt_fields=download_url,view_url,name,host`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (attachmentRes.ok) {
        const attachData = await attachmentRes.json();
        const imgUrl = attachData?.data?.download_url || attachData?.data?.view_url;
        if (imgUrl) {
          const imgRes = await fetch(imgUrl);
          if (imgRes.ok) {
            const contentType = imgRes.headers.get('content-type') || 'image/png';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            return res.send(buffer);
          }
        }
      }
      const assetUrl = `https://app.asana.com/app/asana/-/get_asset?asset_id=${req.params.assetId}`;
      const asanaRes = await fetch(assetUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        redirect: 'follow',
      });
      if (!asanaRes.ok) {
        return res.status(asanaRes.status).json({ message: "Failed to fetch asset" });
      }
      const contentType = asanaRes.headers.get('content-type') || 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      const buffer = Buffer.from(await asanaRes.arrayBuffer());
      res.send(buffer);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/subtasks/:gid/comment", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ message: "Comment text is required" });
      const result = await postCommentToTask(req.params.gid, text);
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/subtasks/:gid/attachment", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "File is required" });
      const gid = Array.isArray(req.params.gid) ? req.params.gid[0] : req.params.gid;
      const result = await uploadAttachmentToTask(gid, req.file.buffer, req.file.originalname, req.file.mimetype);
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/task-actions/:viewType", async (req, res) => {
    try {
      const actions = await storage.getTaskActionsByView(req.params.viewType);
      res.json(actions);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/task-actions/:viewType/follow-ups", async (req, res) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const actions = await storage.getFollowUpTasks(req.params.viewType, today);
      res.json(actions);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/task-actions", async (req, res) => {
    try {
      const action = await storage.createTaskAction(req.body);
      res.json(action);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  startAutoSync();

  runRebateBackfillIfNeeded().catch(err => {
    console.error("[Startup] Rebate backfill failed:", err);
  });

  return httpServer;
}
