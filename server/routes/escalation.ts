import { Router } from "express";
import { storage } from "../storage";
import { addHours } from "date-fns";

export const escalationRouter = Router();

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

escalationRouter.post("/escalation-tickets", async (req, res) => {
  try {
    const { projectId, viewType, createdBy, issue } = req.body;
    if (!projectId || !viewType || !createdBy || !issue) {
      return res.status(400).json({ message: "projectId, viewType, createdBy, and issue are required" });
    }
    const hideUntil = addHours(new Date(), 48);
    const ticket = await storage.createEscalationTicket({
      projectId,
      viewType,
      createdBy,
      issue,
      status: "open",
      hideUntil,
    });

    const project = await storage.getProject(projectId);
    const projectName = project?.name || 'Unknown Project';
    const truncatedIssue = issue.length > 100 ? issue.substring(0, 100) + '...' : issue;

    if (viewType === 'uc') {
      await storage.createUcCompletion({
        projectId,
        staffName: createdBy,
        actionType: 'escalation',
        fromStatus: project?.ucStatus || null,
        toStatus: null,
        notes: `Escalation: ${truncatedIssue}`,
        hideDays: null,
      });
    } else if (viewType === 'rebates') {
      await storage.createRebateCompletion({
        projectId,
        staffName: createdBy,
        actionType: 'escalation',
        fromStatus: project?.hrspStatus || null,
        toStatus: null,
        notes: `Escalation: ${truncatedIssue}`,
      });
    }

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
    res.json(ticket);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
