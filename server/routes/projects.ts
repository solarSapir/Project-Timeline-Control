import { Router } from "express";
import { storage } from "../storage";
import {
  updateAsanaTaskField,
  fetchTaskStories,
  fetchSubtasksForTask,
  completeAsanaTask,
} from "../asana";

export const projectsRouter = Router();

const ASANA_SYNCED_FIELDS = ['ucStatus', 'ahjStatus', 'siteVisitStatus', 'contractStatus', 'designStatus', 'pmStatus', 'paymentMethod', 'rebateStatus', 'installTeamStage'];

projectsRouter.get("/", async (_req, res) => {
  try {
    const allProjects = await storage.getProjects();
    res.json(allProjects);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

projectsRouter.get("/:id", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

projectsRouter.patch("/:id", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (project.asanaGid && project.asanaCustomFields) {
      const asanaFields = project.asanaCustomFields as Record<string, unknown>[];
      for (const field of ASANA_SYNCED_FIELDS) {
        if (req.body[field] && req.body[field] !== (project as Record<string, unknown>)[field]) {
          try {
            await updateAsanaTaskField(project.asanaGid, asanaFields, field, req.body[field]);
          } catch (asanaErr: unknown) {
            const msg = asanaErr instanceof Error ? asanaErr.message : String(asanaErr);
            console.error(`Failed to update Asana field ${field}:`, msg);
            return res.status(400).json({ message: `Failed to update Asana: ${msg}` });
          }
        }
      }
    }

    const currentStage = (req.body.installTeamStage || (project as Record<string, unknown>).installTeamStage || '').toLowerCase();
    const newSiteVisit = (req.body.siteVisitStatus || '').toLowerCase();
    if (newSiteVisit && (newSiteVisit.includes('visit complete') || newSiteVisit.includes('visit booked')) && currentStage.includes('pending site visit')) {
      req.body.installTeamStage = 'Active Install';
      try {
        const asanaFields = project.asanaCustomFields as Record<string, unknown>[];
        await updateAsanaTaskField(project.asanaGid!, asanaFields, 'installTeamStage', 'Active Install');
        console.log(`Auto-advanced Install Team Stage to "Active Install" for ${project.name} (site visit done)`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`Could not auto-advance stage for ${project.name}: ${msg}`);
      }
    }

    const newUcStatus = (req.body.ucStatus || '').toLowerCase();
    const oldUcStatus = ((project as Record<string, unknown>).ucStatus as string || '').toLowerCase();
    const ucClosedStatuses = ['closed', 'close off'];
    if (newUcStatus && ucClosedStatuses.some(s => newUcStatus.includes(s)) && !ucClosedStatuses.some(s => oldUcStatus.includes(s))) {
      try {
        const allSubtasks = await fetchSubtasksForTask(project.asanaGid!);
        const ucSubtasks = allSubtasks.filter((st: Record<string, unknown>) =>
          (st.name as string)?.toLowerCase().includes('tasks for uc team') && !st.completed
        );
        for (const st of ucSubtasks) {
          await completeAsanaTask(st.gid as string);
        }
        console.log(`Auto-completed ${ucSubtasks.length} UC subtasks for ${project.name} (UC status → ${req.body.ucStatus})`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`Could not auto-complete UC subtasks for ${project.name}: ${msg}`);
      }
    }

    const updated = await storage.updateProject(req.params.id, req.body);
    res.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

projectsRouter.get("/:id/deadlines", async (req, res) => {
  try {
    const deadlines = await storage.getProjectDeadlines(req.params.id);
    res.json(deadlines);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

projectsRouter.get("/:id/task-actions", async (req, res) => {
  try {
    const viewType = req.query.viewType as string | undefined;
    const actions = await storage.getTaskActions(req.params.id, viewType);
    res.json(actions);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

projectsRouter.get("/:id/install-schedules", async (req, res) => {
  try {
    const schedules = await storage.getInstallSchedules(req.params.id);
    res.json(schedules);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

projectsRouter.get("/:id/stories", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });
    const stories = await fetchTaskStories(project.asanaGid);
    res.json(stories);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

projectsRouter.get("/:id/uc-subtasks", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });
    const allSubtasks = await fetchSubtasksForTask(project.asanaGid);
    const ucSubtasks = allSubtasks.filter((st: Record<string, unknown>) =>
      (st.name as string)?.toLowerCase().includes('tasks for uc team')
    );
    ucSubtasks.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aDate = (a.name as string)?.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] || '';
      const bDate = (b.name as string)?.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] || '';
      if (aDate && bDate) {
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      }
      return 0;
    });
    res.json(ucSubtasks);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

projectsRouter.post("/:id/complete-uc-subtasks", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });
    const allSubtasks = await fetchSubtasksForTask(project.asanaGid);
    const ucSubtasks = allSubtasks.filter((st: Record<string, unknown>) =>
      (st.name as string)?.toLowerCase().includes('tasks for uc team') && !st.completed
    );
    for (const st of ucSubtasks) {
      await completeAsanaTask(st.gid as string);
    }
    res.json({ message: `Completed ${ucSubtasks.length} UC subtasks` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
