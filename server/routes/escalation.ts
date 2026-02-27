import { Router } from "express";
import { storage } from "../storage";
import { addHours } from "date-fns";
import { upload } from "../middleware/upload";
import { saveFileLocally } from "../utils/file-storage";
import { fetchSubtasksForTask, postCommentToTask } from "../asana";

const ESCALATION_CONFIG_STAGE = "escalation_settings";
const DEFAULT_HIDE_HOURS = 48;

async function getEscalationHideHours(): Promise<number> {
  try {
    const configs = await storage.getWorkflowConfigs();
    const escalationConfig = configs.find(c => c.stage === ESCALATION_CONFIG_STAGE);
    return escalationConfig?.targetDays ?? DEFAULT_HIDE_HOURS;
  } catch {
    return DEFAULT_HIDE_HOURS;
  }
}

export const escalationRouter = Router();

escalationRouter.get("/escalation-settings", async (_req, res) => {
  try {
    const hideHours = await getEscalationHideHours();
    res.json({ hideHours });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

escalationRouter.put("/escalation-settings", async (req, res) => {
  try {
    const { hideHours } = req.body;
    if (typeof hideHours !== "number" || hideHours < 1) {
      return res.status(400).json({ message: "hideHours must be a positive number" });
    }
    await storage.upsertWorkflowConfig({
      stage: ESCALATION_CONFIG_STAGE,
      targetDays: hideHours,
      dependsOn: [],
      gapRelativeTo: null,
      completionCriteria: null,
    });
    res.json({ hideHours });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

escalationRouter.get("/escalation-tickets", async (req, res) => {
  try {
    const { status, viewType, projectId } = req.query;
    const filters: { status?: string; viewType?: string; projectId?: string } = {};
    if (typeof status === "string") filters.status = status;
    if (typeof viewType === "string") filters.viewType = viewType;
    if (typeof projectId === "string") filters.projectId = projectId;
    const tickets = await storage.getEscalationTickets(
      Object.keys(filters).length > 0 ? filters : undefined
    );
    res.json(tickets);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

escalationRouter.get("/escalation-tickets/:id", async (req, res) => {
  try {
    const ticket = await storage.getEscalationTicket(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json(ticket);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

escalationRouter.post("/escalation-tickets", upload.array('files', 10), async (req, res) => {
  try {
    const { projectId, viewType, createdBy, issue } = req.body;
    if (!projectId || !viewType || !createdBy || !issue) {
      return res.status(400).json({ message: "projectId, viewType, createdBy, and issue are required" });
    }
    const hideHours = await getEscalationHideHours();
    const hideUntil = addHours(new Date(), hideHours);
    const ticket = await storage.createEscalationTicket({
      projectId,
      viewType,
      createdBy,
      issue,
      status: "open",
      hideUntil,
    });

    const uploadedFiles = (req as any).files as Express.Multer.File[] | undefined;
    if (uploadedFiles && uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        try {
          await saveFileLocally(
            projectId,
            'escalation',
            file.buffer,
            `ESCALATION-${ticket.id} - ${file.originalname}`,
            file.mimetype,
            createdBy,
            `Escalation ticket attachment (${ticket.id})`
          );
        } catch (err) {
          console.error(`[Escalation] Failed to save file ${file.originalname}:`, err instanceof Error ? err.message : String(err));
        }
      }
      console.log(`[Escalation] Saved ${uploadedFiles.length} attachment(s) for ticket ${ticket.id}`);
    }

    const project = await storage.getProject(projectId);
    const truncatedIssue = issue.length > 100 ? issue.substring(0, 100) + '...' : issue;

    if (viewType === 'rebates' || viewType === 'payments') {
      await storage.createRebateCompletion({
        projectId,
        staffName: createdBy,
        actionType: 'escalation',
        fromStatus: project?.hrspStatus || project?.rebateStatus || null,
        toStatus: null,
        notes: `Escalation: ${truncatedIssue}`,
      });
    } else {
      await storage.createUcCompletion({
        projectId,
        staffName: createdBy,
        actionType: 'escalation',
        fromStatus: viewType === 'uc' ? (project?.ucStatus || null) : (project?.pmStatus || null),
        toStatus: null,
        notes: `Escalation (${viewType}): ${truncatedIssue}`,
        hideDays: null,
      });
    }

    await storage.createTaskAction({
      projectId,
      viewType,
      actionType: 'escalation',
      completedBy: createdBy,
      notes: `Escalation: ${truncatedIssue}`,
    });

    res.json(ticket);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

escalationRouter.patch("/escalation-tickets/:id/snooze", async (req, res) => {
  try {
    const { hideUntil } = req.body;
    if (!hideUntil) {
      return res.status(400).json({ message: "hideUntil date is required" });
    }
    const newDate = new Date(hideUntil);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 14);
    if (newDate > maxDate) {
      return res.status(400).json({ message: "Cannot snooze more than 14 days from now" });
    }
    if (newDate < new Date()) {
      return res.status(400).json({ message: "Date must be in the future" });
    }
    const ticket = await storage.updateEscalationTicket(req.params.id, {
      hideUntil: newDate,
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json(ticket);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

escalationRouter.patch("/escalation-tickets/:id/respond", async (req, res) => {
  try {
    const { managerResponse, respondedBy } = req.body;
    if (!managerResponse || !respondedBy) {
      return res.status(400).json({ message: "managerResponse and respondedBy are required" });
    }
    const ticket = await storage.updateEscalationTicket(req.params.id, {
      managerResponse,
      respondedBy,
      respondedAt: new Date(),
      status: "responded",
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json(ticket);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

const VIEW_TYPE_SUBTASK_KEYWORDS: Record<string, string[]> = {
  uc: ['uc', 'tasks for uc'],
  contracts: ['client contract', 'contract'],
  site_visits: ['site visit'],
  ahj: ['ahj', 'permitting'],
  installs: ['install'],
  rebates: ['rebate', 'hrsp', 'home renovation savings', 'home energy sav', 'greener homes', 'grant'],
  payments: ['payment'],
  close_off: ['close-off', 'close off', 'closeoff'],
};

escalationRouter.patch("/escalation-tickets/:id/resolve", async (req, res) => {
  try {
    const { resolutionNote, resolvedBy } = req.body || {};
    if (!resolutionNote || !resolutionNote.trim()) {
      return res.status(400).json({ message: "Resolution description is required" });
    }
    if (!resolvedBy || !resolvedBy.trim()) {
      return res.status(400).json({ message: "Your name is required" });
    }
    const ticket = await storage.updateEscalationTicket(req.params.id, {
      status: "resolved",
      resolvedAt: new Date(),
      resolutionNote: resolutionNote.trim(),
      resolvedBy: resolvedBy.trim(),
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const project = await storage.getProject(ticket.projectId);
    const truncatedNote = resolutionNote.length > 100 ? resolutionNote.substring(0, 100) + '...' : resolutionNote;

    if (project) {
      if (ticket.viewType === 'rebates' || ticket.viewType === 'payments') {
        await storage.createRebateCompletion({
          projectId: ticket.projectId,
          staffName: resolvedBy.trim(),
          actionType: 'escalation_resolved',
          fromStatus: null,
          toStatus: null,
          notes: `Ticket Resolution: ${truncatedNote}`,
        });
      } else {
        await storage.createUcCompletion({
          projectId: ticket.projectId,
          staffName: resolvedBy.trim(),
          actionType: 'escalation_resolved',
          fromStatus: null,
          toStatus: null,
          notes: `Ticket Resolution (${ticket.viewType}): ${truncatedNote}`,
          hideDays: null,
        });
      }

      await storage.createTaskAction({
        projectId: ticket.projectId,
        viewType: ticket.viewType,
        actionType: 'escalation_resolved',
        completedBy: resolvedBy.trim(),
        notes: `Ticket Resolution: ${resolutionNote.trim()}`,
      });

      if (project.asanaGid) {
        try {
          const subtasks = await fetchSubtasksForTask(project.asanaGid);
          const keywords = VIEW_TYPE_SUBTASK_KEYWORDS[ticket.viewType] || [];
          const matchingSubtasks = subtasks.filter((st: any) => {
            const name = ((st.name as string) || '').toLowerCase();
            return keywords.some(kw => name.includes(kw));
          });
          matchingSubtasks.sort((a: any, b: any) => {
            const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bCreated - aCreated;
          });
          const targetSubtask = matchingSubtasks[0];
          if (targetSubtask) {
            const commentText = `[Escalation Ticket Resolution]\n\nResolved by: ${resolvedBy.trim()}\n\nResolution:\n${resolutionNote.trim()}`;
            await postCommentToTask(targetSubtask.gid as string, commentText);
            console.log(`[Escalation] Posted resolution to subtask "${targetSubtask.name}" (${targetSubtask.gid}) for ${project.name}`);
          } else {
            const commentText = `[Escalation Ticket Resolution - ${ticket.viewType}]\n\nResolved by: ${resolvedBy.trim()}\n\nResolution:\n${resolutionNote.trim()}`;
            await postCommentToTask(project.asanaGid, commentText);
            console.log(`[Escalation] No matching subtask for viewType "${ticket.viewType}", posted to main task for ${project.name}`);
          }
        } catch (asanaErr) {
          console.error(`[Escalation] Failed to post resolution to Asana:`, asanaErr instanceof Error ? asanaErr.message : String(asanaErr));
        }
      }
    }

    res.json(ticket);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
