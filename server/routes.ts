import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchAsanaWorkspaces, fetchAsanaProjects, fetchAsanaTasksFromProject, mapAsanaTaskToProject, updateAsanaTaskField, getAsanaEnumOptions, fetchTaskStories, findStatusChangeInStories, postCommentToTask, uploadAttachmentToTask, fetchSubtasksForTask, findHrspSubtask, updateSubtaskField, getSubtaskFieldOptions, createSubtaskForTask } from "./asana";
import { addDays, addWeeks, format } from "date-fns";
import { DEFAULT_DEADLINES_WEEKS, PROJECT_STAGES } from "@shared/schema";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

  async function syncProjectFromAsana(projectGid: string) {
    const tasks = await fetchAsanaTasksFromProject(projectGid);
    const synced = [];

    for (const task of tasks) {
      if (!task.name || task.name.trim() === '') continue;
      const mapped: any = mapAsanaTaskToProject(task);

      if (mapped.projectCreatedDate) {
        const createdDate = new Date(mapped.projectCreatedDate);
        const isOffGrid = mapped.ucTeam?.toLowerCase().includes('off grid') || mapped.ucTeam?.toLowerCase().includes('no/');
        mapped.ucDueDate = isOffGrid
          ? format(createdDate, 'yyyy-MM-dd')
          : format(addDays(createdDate, 21), 'yyyy-MM-dd');
        mapped.ahjDueDate = format(addDays(createdDate, 56), 'yyyy-MM-dd');
        mapped.contractDueDate = format(addDays(createdDate, 35), 'yyyy-MM-dd');
        mapped.siteVisitDueDate = format(addDays(createdDate, 42), 'yyyy-MM-dd');
        mapped.installDueDate = format(addDays(createdDate, 70), 'yyyy-MM-dd');
        mapped.closeOffDueDate = format(addDays(createdDate, 84), 'yyyy-MM-dd');
      }

      if (mapped.ucStatus?.toLowerCase() === 'submitted' && task.gid) {
        try {
          const stories = await fetchTaskStories(task.gid);
          const submittedChange = findStatusChangeInStories(stories, 'UC TEAM STATUS', 'Submitted');
          if (submittedChange) {
            mapped.ucSubmittedDate = submittedChange.date.split('T')[0];
            mapped.ucSubmittedBy = submittedChange.user;
          }
        } catch (err: any) {
          console.log(`Could not fetch stories for ${task.name}: ${err.message}`);
        }
      }

      const isLoadDisplacementOntario =
        mapped.ucTeam?.toLowerCase().includes('load displacement') &&
        mapped.province?.toLowerCase().includes('ontario');

      if (isLoadDisplacementOntario && task.gid) {
        try {
          const subtasks = await fetchSubtasksForTask(task.gid);
          const hrsp = findHrspSubtask(subtasks);
          if (hrsp) {
            mapped.hrspSubtaskGid = hrsp.gid;
            mapped.hrspStatus = hrsp.status;
            mapped.hrspMissing = false;
          } else {
            mapped.hrspSubtaskGid = null;
            mapped.hrspStatus = null;
            mapped.hrspMissing = true;
          }
          if (mapped.projectCreatedDate) {
            mapped.hrspDueDate = format(addDays(new Date(mapped.projectCreatedDate), 14), 'yyyy-MM-dd');
          }
        } catch (err: any) {
          console.log(`Could not fetch subtasks for ${task.name}: ${err.message}`);
        }
      }

      const isUcComplete = mapped.ucStatus && ['approved', 'complete', 'not required'].some(s => mapped.ucStatus!.toLowerCase().includes(s));
      const stageNeedsCorrection = mapped.installTeamStage && mapped.installTeamStage.toLowerCase().includes('new cx pending other teams');

      if (isUcComplete && stageNeedsCorrection && task.gid) {
        try {
          await updateAsanaTaskField(task.gid, mapped.asanaCustomFields as any[], 'installTeamStage', 'Need contract');
          mapped.installTeamStage = 'Need contract';
          console.log(`Auto-corrected Install Team Stage to "Need contract" for ${task.name}`);
        } catch (err: any) {
          console.log(`Could not auto-correct Install Team Stage for ${task.name}: ${err.message}`);
        }
      }

      const isPendingSiteVisit = mapped.installTeamStage && mapped.installTeamStage.toLowerCase().includes('pending site visit');
      const siteVisitDone = mapped.siteVisitStatus && (mapped.siteVisitStatus.toLowerCase().includes('visit complete') || mapped.siteVisitStatus.toLowerCase().includes('visit booked'));
      if (isPendingSiteVisit && siteVisitDone && task.gid) {
        try {
          await updateAsanaTaskField(task.gid, mapped.asanaCustomFields as any[], 'installTeamStage', 'Active Install');
          mapped.installTeamStage = 'Active Install';
          console.log(`Auto-advanced Install Team Stage to "Active Install" for ${task.name} (site visit done)`);
        } catch (err: any) {
          console.log(`Could not auto-advance stage for ${task.name}: ${err.message}`);
        }
      }

      const project = await storage.upsertProject(mapped);

      const existingDeadlines = await storage.getProjectDeadlines(project.id);
      if (existingDeadlines.length === 0) {
        const baseDate = mapped.projectCreatedDate ? new Date(mapped.projectCreatedDate) : new Date();
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

    return synced;
  }

  let cachedProjectGid: string | null = null;
  let lastSyncTime: string | null = null;

  async function findProjectManageTeamGid(): Promise<string> {
    if (cachedProjectGid) return cachedProjectGid;

    const workspaces = await fetchAsanaWorkspaces();
    for (const ws of workspaces) {
      const projects = await fetchAsanaProjects(ws.gid);
      const target = projects.find((p: any) =>
        p.name.toLowerCase().includes('project manage team')
      );
      if (target) {
        cachedProjectGid = target.gid;
        return target.gid;
      }
    }
    throw new Error('Could not find "Project Manage Team" project in Asana. Please check your Asana workspace.');
  }

  app.post("/api/asana/sync-all", async (_req, res) => {
    try {
      const projectGid = await findProjectManageTeamGid();
      const synced = await syncProjectFromAsana(projectGid);
      lastSyncTime = new Date().toISOString();
      console.log(`[Auto-Sync] Synced ${synced.length} projects at ${lastSyncTime}`);
      res.json({ synced: synced.length, lastSyncTime, projectGid });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/asana/sync-status", async (_req, res) => {
    res.json({ lastSyncTime, cachedProjectGid });
  });

  app.post("/api/asana/sync/:projectGid", async (req, res) => {
    try {
      const synced = await syncProjectFromAsana(req.params.projectGid);
      lastSyncTime = new Date().toISOString();
      res.json({ synced: synced.length, projects: synced });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;
  async function runAutoSync() {
    try {
      const projectGid = await findProjectManageTeamGid();
      const synced = await syncProjectFromAsana(projectGid);
      lastSyncTime = new Date().toISOString();
      console.log(`[Auto-Sync] Synced ${synced.length} projects at ${lastSyncTime}`);
    } catch (error: any) {
      console.error("[Auto-Sync] Error:", error.message);
    }
  }

  setTimeout(() => {
    runAutoSync();
    setInterval(runAutoSync, AUTO_SYNC_INTERVAL_MS);
  }, 10000);

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

  app.get("/api/hrsp/field-options/:subtaskGid", async (req, res) => {
    try {
      const options = await getSubtaskFieldOptions(req.params.subtaskGid, 'grants status');
      res.json(options);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/hrsp/:projectId", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!project.hrspSubtaskGid) return res.status(400).json({ message: "No HRSP subtask found for this project" });

      const { status } = req.body;
      if (!status) return res.status(400).json({ message: "Status is required" });

      await updateSubtaskField(project.hrspSubtaskGid, 'grants status', status);

      await storage.updateProject(project.id, { hrspStatus: status });

      res.json({ success: true, hrspStatus: status });
    } catch (error: any) {
      console.error('HRSP update error:', error.message);
      res.status(500).json({ message: error.message });
    }
  });

  const ASANA_SYNCED_FIELDS = ['ucStatus', 'ahjStatus', 'siteVisitStatus', 'contractStatus', 'designStatus', 'pmStatus', 'paymentMethod', 'rebateStatus', 'installTeamStage'];

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

      const currentStage = (req.body.installTeamStage || (project as any).installTeamStage || '').toLowerCase();
      const newSiteVisit = (req.body.siteVisitStatus || '').toLowerCase();
      if (newSiteVisit && (newSiteVisit.includes('visit complete') || newSiteVisit.includes('visit booked')) && currentStage.includes('pending site visit')) {
        req.body.installTeamStage = 'Active Install';
        try {
          const asanaFields = project.asanaCustomFields as any[];
          await updateAsanaTaskField(project.asanaGid!, asanaFields, 'installTeamStage', 'Active Install');
          console.log(`Auto-advanced Install Team Stage to "Active Install" for ${project.name} (site visit done)`);
        } catch (err: any) {
          console.log(`Could not auto-advance stage for ${project.name}: ${err.message}`);
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

  app.get("/api/projects/:id/stories", async (req, res) => {
    try {
      const projectId = req.params.id as string;
      const project = await storage.getProject(projectId);
      if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });
      const stories = await fetchTaskStories(project.asanaGid);
      res.json(stories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/follow-up", upload.single('screenshot'), async (req, res) => {
    try {
      const projectId = req.params.id as string;
      const project = await storage.getProject(projectId);
      if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });

      const { notes, completedBy, viewType } = req.body;
      const isContract = viewType === 'contracts';
      const commentPrefix = isContract ? 'Contract Follow-up' : 'UC Follow-up';
      const commentText = `${commentPrefix} by ${completedBy || 'Team'}:\n${notes || 'Follow-up completed'}`;

      await postCommentToTask(project.asanaGid, commentText);

      if (req.file) {
        await uploadAttachmentToTask(
          project.asanaGid,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
      }

      const followUpDays = isContract ? 1 : 7;
      const action = await storage.createTaskAction({
        projectId: projectId,
        viewType: viewType || 'uc',
        actionType: 'follow_up',
        completedBy: completedBy || null,
        notes: notes || null,
        followUpDate: format(addDays(new Date(), followUpDays), 'yyyy-MM-dd'),
      });

      res.json({ success: true, action, message: `${commentPrefix} posted to Asana timeline` });
    } catch (error: any) {
      console.error("Follow-up error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/site-visit-photos", upload.array('photos', 10), async (req, res) => {
    try {
      const projectId = req.params.id as string;
      const project = await storage.getProject(projectId);
      if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });

      const { notes, completedBy } = req.body;
      const files = req.files as Express.Multer.File[];

      const subtasks = await fetchSubtasksForTask(project.asanaGid);
      let photosSubtask = subtasks.find((st: any) => st.name?.toLowerCase().includes('site visit photos'));

      if (!photosSubtask) {
        photosSubtask = await createSubtaskForTask(project.asanaGid, 'Site visit Photos');
        console.log(`Created "Site visit Photos" subtask for ${project.name}`);
      }

      if (notes || completedBy) {
        const commentText = `Site Visit Photos uploaded by ${completedBy || 'Team'}:\n${notes || 'Photos uploaded'}`;
        await postCommentToTask(photosSubtask.gid, commentText);
      }

      let uploadedCount = 0;
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            await uploadAttachmentToTask(photosSubtask.gid, file.buffer, file.originalname, file.mimetype);
            uploadedCount++;
          } catch (err: any) {
            console.error(`Failed to upload ${file.originalname}: ${err.message}`);
          }
        }
      }

      const action = await storage.createTaskAction({
        projectId: projectId,
        viewType: 'site_visits',
        actionType: 'completed',
        completedBy: completedBy || null,
        notes: notes || null,
        followUpDate: null,
      });

      res.json({ success: true, action, uploadedCount, subtaskGid: photosSubtask.gid, message: `${uploadedCount} photo(s) uploaded to "Site visit Photos" subtask` });
    } catch (error: any) {
      console.error("Site visit photos error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      const allProjects = await storage.getProjects();
      const allDeadlines = await storage.getAllDeadlines();
      const today = new Date();

      const installProjects = allProjects.filter(p =>
        p.installType?.toLowerCase() === 'install' &&
        (!p.propertySector || p.propertySector.toLowerCase() === 'residential')
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
