import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchAsanaWorkspaces, fetchAsanaProjects, fetchAsanaTasksFromProject, mapAsanaTaskToProject, updateAsanaTaskField, getAsanaEnumOptions } from "./asana";
import { addWeeks, format } from "date-fns";
import { DEFAULT_DEADLINES_WEEKS, PROJECT_STAGES } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/asana/workspaces", async (_req, res) => {
    try {
      const workspaces = await fetchAsanaWorkspaces();
      res.json(workspaces);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/asana/projects/:workspaceGid", async (req, res) => {
    try {
      const projects = await fetchAsanaProjects(req.params.workspaceGid);
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/asana/sync/:projectGid", async (req, res) => {
    try {
      const tasks = await fetchAsanaTasksFromProject(req.params.projectGid);
      const synced = [];

      for (const task of tasks) {
        if (!task.name || task.name.trim() === '') continue;
        const mapped = mapAsanaTaskToProject(task);
        const project = await storage.upsertProject(mapped);

        const existingDeadlines = await storage.getProjectDeadlines(project.id);
        if (existingDeadlines.length === 0) {
          const baseDate = new Date();
          for (const stage of PROJECT_STAGES) {
            const config = DEFAULT_DEADLINES_WEEKS[stage];
            if (config) {
              await storage.upsertProjectDeadline({
                projectId: project.id,
                stage,
                targetDate: format(addWeeks(baseDate, config.max), 'yyyy-MM-dd'),
                status: "pending",
              });
            }
          }
        }

        synced.push(project);
      }

      res.json({ synced: synced.length, projects: synced });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects", async (_req, res) => {
    try {
      const allProjects = await storage.getProjects();
      res.json(allProjects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/asana/field-options/:fieldName", async (req, res) => {
    try {
      const allProjects = await storage.getProjects();
      const projectWithFields = allProjects.find(p => p.asanaCustomFields && (p.asanaCustomFields as any[]).length > 0);
      if (!projectWithFields) {
        return res.json([]);
      }
      const options = await getAsanaEnumOptions(projectWithFields.asanaCustomFields as any[], req.params.fieldName);
      res.json(options);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const ASANA_SYNCED_FIELDS = ['ucStatus', 'ahjStatus', 'siteVisitStatus', 'contractStatus', 'designStatus', 'pmStatus'];

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      if (project.asanaGid && project.asanaCustomFields) {
        const asanaFields = project.asanaCustomFields as any[];
        for (const field of ASANA_SYNCED_FIELDS) {
          if (req.body[field] && req.body[field] !== (project as any)[field]) {
            try {
              await updateAsanaTaskField(project.asanaGid, asanaFields, field, req.body[field]);
            } catch (asanaErr: any) {
              console.error(`Failed to update Asana field ${field}:`, asanaErr.message);
              return res.status(400).json({ message: `Failed to update Asana: ${asanaErr.message}` });
            }
          }
        }
      }

      const updated = await storage.updateProject(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/deadlines", async (req, res) => {
    try {
      const deadlines = await storage.getProjectDeadlines(req.params.id);
      res.json(deadlines);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/deadlines", async (req, res) => {
    try {
      const deadline = await storage.upsertProjectDeadline(req.body);
      res.json(deadline);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/deadlines", async (_req, res) => {
    try {
      const allDeadlines = await storage.getAllDeadlines();
      res.json(allDeadlines);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/task-actions/:viewType", async (req, res) => {
    try {
      const actions = await storage.getTaskActionsByView(req.params.viewType);
      res.json(actions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/task-actions/:viewType/follow-ups", async (req, res) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const actions = await storage.getFollowUpTasks(req.params.viewType, today);
      res.json(actions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/task-actions", async (req, res) => {
    try {
      const action = await storage.createTaskAction(req.body);
      res.json(action);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/task-actions", async (req, res) => {
    try {
      const viewType = req.query.viewType as string | undefined;
      const actions = await storage.getTaskActions(req.params.id, viewType);
      res.json(actions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/install-schedules", async (_req, res) => {
    try {
      const schedules = await storage.getAllInstallSchedules();
      res.json(schedules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/install-schedules", async (req, res) => {
    try {
      const schedules = await storage.getInstallSchedules(req.params.id);
      res.json(schedules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/install-schedules", async (req, res) => {
    try {
      const schedule = await storage.upsertInstallSchedule(req.body);
      res.json(schedule);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      const allProjects = await storage.getProjects();
      const allDeadlines = await storage.getAllDeadlines();
      const today = new Date();

      const installProjects = allProjects.filter(p =>
        p.installType?.toLowerCase() === 'install'
      );

      const totalProjects = installProjects.length;
      const overdueDeadlines = allDeadlines.filter(d =>
        d.status === 'pending' && d.targetDate && new Date(d.targetDate) < today
      );

      const stageBreakdown: Record<string, { total: number; overdue: number; onTrack: number }> = {};
      for (const stage of PROJECT_STAGES) {
        const deadlinesForStage = allDeadlines.filter(d => d.stage === stage);
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
        overdueCount: overdueDeadlines.length,
        stageBreakdown,
        ucBreakdown,
        ahjBreakdown,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
