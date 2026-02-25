import { Router } from "express";
import { storage } from "../storage";
import {
  updateAsanaTaskField,
  fetchTaskStories,
  fetchSubtasksForTask,
  createSubtaskForTask,
  completeAsanaTask,
  updateSubtaskField,
} from "../asana";

export const projectsRouter = Router();

const ASANA_SYNCED_FIELDS = ['ucStatus', 'ahjStatus', 'siteVisitStatus', 'contractStatus', 'designStatus', 'pmStatus', 'paymentMethod', 'installTeamStage'];

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
            if (msg.includes('Could not find Asana custom field')) {
              console.warn(`Skipping Asana sync for ${field} on ${project.name}: field not available in this task`);
            } else {
              console.error(`Failed to update Asana field ${field}:`, msg);
              return res.status(400).json({ message: `Failed to update Asana: ${msg}` });
            }
          }
        }
      }
    }

    if (req.body.rebateStatus && req.body.rebateStatus !== project.rebateStatus) {
      const rebateLower = req.body.rebateStatus.toLowerCase();
      const rebateFollowUpStatuses = ['in-progress', 'submitted'];
      if (rebateFollowUpStatuses.some(s => rebateLower.includes(s))) {
        const oldLower = (project.rebateStatus || '').toLowerCase();
        if (!rebateFollowUpStatuses.some(s => oldLower.includes(s))) {
          req.body.rebateSubmittedDate = new Date().toISOString();
        }
      }

      if (project.hrspSubtaskGid) {
        try {
          await updateSubtaskField(project.hrspSubtaskGid, 'grants status', req.body.rebateStatus);
          req.body.hrspStatus = req.body.rebateStatus;

          if (req.body.rebateStatus.toLowerCase().includes('100% complete')) {
            await completeAsanaTask(project.hrspSubtaskGid);
            console.log(`Auto-completed HRSP subtask for ${project.name} (status → 100% complete)`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to update HRSP subtask for ${project.name}:`, msg);
          return res.status(400).json({ message: `Failed to update Asana: ${msg}` });
        }
      } else if (project.asanaGid && project.asanaCustomFields) {
        try {
          const asanaFields = project.asanaCustomFields as Record<string, unknown>[];
          await updateAsanaTaskField(project.asanaGid, asanaFields, 'rebateStatus', req.body.rebateStatus);
        } catch (asanaErr: unknown) {
          const msg = asanaErr instanceof Error ? asanaErr.message : String(asanaErr);
          if (!msg.includes('Could not find Asana custom field')) {
            console.error(`Failed to update Asana rebateStatus for ${project.name}:`, msg);
            return res.status(400).json({ message: `Failed to update Asana: ${msg}` });
          }
          console.warn(`Skipping parent Asana sync for rebateStatus on ${project.name}: field not available`);
        }
      }
    }

    const oldPmStatus = ((project as Record<string, unknown>).pmStatus as string || '').toLowerCase();
    const newPmStatus = (req.body.pmStatus || '').toLowerCase();
    if (oldPmStatus.includes('project paused') && newPmStatus && !newPmStatus.includes('project paused')) {
      req.body.lastUnpausedDate = new Date().toISOString().split('T')[0];
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
        const ucSubtasks = allSubtasks.filter((st: Record<string, unknown>) => {
          const name = ((st.name as string) || '').toLowerCase();
          return name.includes('uc') && !name.includes('install') && !name.includes('hrsp') && !name.includes('rebate') && !st.completed;
        });
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
    const ucSubtasks = allSubtasks.filter((st: Record<string, unknown>) => {
      const name = ((st.name as string) || '').toLowerCase();
      return name.includes('uc') && !name.includes('install') && !name.includes('hrsp') && !name.includes('rebate');
    });
    ucSubtasks.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aName = (a.name as string) || '';
      const bName = (b.name as string) || '';
      const aDate = aName.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || aName.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] || '';
      const bDate = bName.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || bName.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] || '';
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
    const ucSubtasks = allSubtasks.filter((st: Record<string, unknown>) => {
      const name = ((st.name as string) || '').toLowerCase();
      return name.includes('uc') && !name.includes('install') && !name.includes('hrsp') && !name.includes('rebate') && !st.completed;
    });
    for (const st of ucSubtasks) {
      await completeAsanaTask(st.gid as string);
    }
    res.json({ message: `Completed ${ucSubtasks.length} UC subtasks` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

/** Find or create a sub-subtask under "Install Team" subtask */
projectsRouter.get("/:id/install-team-subtask", async (req, res) => {
  try {
    const subtaskName = req.query.name as string;
    if (!subtaskName) return res.status(400).json({ message: "name query param required" });

    const project = await storage.getProject(req.params.id);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });

    const topSubtasks = await fetchSubtasksForTask(project.asanaGid);
    let installTeam = topSubtasks.find((st: Record<string, unknown>) =>
      (st.name as string)?.toLowerCase().includes('install team')
    );

    if (!installTeam) {
      installTeam = await createSubtaskForTask(project.asanaGid, "Install Team");
    }

    const children = await fetchSubtasksForTask(installTeam.gid as string);
    let target = children.find((st: Record<string, unknown>) =>
      (st.name as string)?.toLowerCase() === subtaskName.toLowerCase()
    );

    if (!target) {
      target = await createSubtaskForTask(installTeam.gid as string, subtaskName);
    }

    res.json({ gid: target.gid, name: target.name, completed: target.completed || false });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

/** Find all subtasks with "AHJ" in the name */
projectsRouter.get("/:id/ahj-subtasks", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });

    const allSubtasks = await fetchSubtasksForTask(project.asanaGid);
    const ahjSubtasks = allSubtasks.filter((st: Record<string, unknown>) =>
      (st.name as string)?.toLowerCase().includes('ahj')
    );
    res.json(ahjSubtasks);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

/** Get the HRSP subtask detail for expand in rebates view */
projectsRouter.get("/:id/hrsp-subtask", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });

    if (project.hrspSubtaskGid) {
      res.json([{ gid: project.hrspSubtaskGid, name: "Home Renovation Savings Program", completed: false }]);
    } else {
      const allSubtasks = await fetchSubtasksForTask(project.asanaGid);
      const hrsp = allSubtasks.filter((st: Record<string, unknown>) =>
        (st.name as string)?.toLowerCase().includes('home renovation savings program') ||
        (st.name as string)?.toLowerCase().includes('hrsp')
      );
      res.json(hrsp);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
