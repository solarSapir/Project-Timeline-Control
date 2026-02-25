import { Router } from "express";
import { storage } from "../storage";

export const staffRouter = Router();

staffRouter.get("/staff", async (req, res) => {
  try {
    const activeOnly = req.query.active === "true";
    const members = await storage.getStaffMembers(activeOnly);
    res.json(members);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

staffRouter.post("/staff", async (req, res) => {
  try {
    const { name, role } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const member = await storage.createStaffMember({
      name: name.trim(),
      role: role?.trim() || null,
      active: true,
    });
    res.json(member);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

staffRouter.patch("/staff/:id", async (req, res) => {
  try {
    const updated = await storage.updateStaffMember(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Staff member not found" });
    res.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

staffRouter.delete("/staff/:id", async (req, res) => {
  try {
    const deleted = await storage.deleteStaffMember(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Staff member not found" });
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
