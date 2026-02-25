import { Router } from "express";
import { storage } from "../storage";
import {
  fetchAsanaWorkspaces,
  fetchAsanaProjects,
  fetchAsanaTasksFromProject,
  mapAsanaTaskToProject,
  updateAsanaTaskField,
  getAsanaEnumOptions,
  fetchTaskStories,
  findStatusChangeInStories,
  fetchSubtasksForTask,
  findHrspSubtask,
  fixHrspRebateField,
  getSubtaskFieldOptions,
  updateSubtaskField,
} from "../asana";
import { addDays, addWeeks, format } from "date-fns";
import { DEFAULT_DEADLINES_WEEKS, DEFAULT_STAGE_GAPS, PROJECT_STAGES } from "@shared/schema";

export const asanaRouter = Router();

async function syncProjectFromAsana(projectGid: string) {
  const tasks = await fetchAsanaTasksFromProject(projectGid);
  const synced = [];

  for (const task of tasks) {
    if (!task.name || task.name.trim() === '') continue;
    const mapped: Record<string, unknown> = mapAsanaTaskToProject(task);

    if (mapped.projectCreatedDate) {
      const createdDate = new Date(mapped.projectCreatedDate as string);
      const ucTeamStr = (mapped.ucTeam as string | null)?.toLowerCase() || '';
      const isOffGrid = ucTeamStr.includes('off grid') || ucTeamStr.includes('no/');
      const ucDue = isOffGrid ? createdDate : addDays(createdDate, DEFAULT_STAGE_GAPS.uc_application.gapDays);
      mapped.ucDueDate = format(ucDue, 'yyyy-MM-dd');

      const contractDue = addDays(ucDue, DEFAULT_STAGE_GAPS.contract_signing.gapDays);
      mapped.contractDueDate = format(contractDue, 'yyyy-MM-dd');

      const svDue = addDays(contractDue, DEFAULT_STAGE_GAPS.site_visit.gapDays);
      mapped.siteVisitDueDate = format(svDue, 'yyyy-MM-dd');

      const ahjStatusStr = (mapped.ahjStatus as string | null)?.toLowerCase() || '';
      const ahjNotRequired = ahjStatusStr.includes('not required') || ahjStatusStr.includes('closed');
      const ahjDue = ahjNotRequired ? svDue : addDays(svDue, DEFAULT_STAGE_GAPS.ahj_permitting.gapDays);
      mapped.ahjDueDate = format(ahjDue, 'yyyy-MM-dd');

      const installDue = addDays(ahjDue, DEFAULT_STAGE_GAPS.install_booking.gapDays);
      mapped.installDueDate = format(installDue, 'yyyy-MM-dd');

      const closeOffDue = addDays(installDue, DEFAULT_STAGE_GAPS.close_off.gapDays);
      mapped.closeOffDueDate = format(closeOffDue, 'yyyy-MM-dd');
    }

    const ucStatusStr = (mapped.ucStatus as string | null)?.toLowerCase() || '';
    if (ucStatusStr === 'submitted' && task.gid) {
      try {
        const stories = await fetchTaskStories(task.gid);
        const submittedChange = findStatusChangeInStories(stories, 'UC TEAM STATUS', 'Submitted');
        if (submittedChange) {
          mapped.ucSubmittedDate = submittedChange.date.split('T')[0];
          mapped.ucSubmittedBy = submittedChange.user;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`Could not fetch stories for ${task.name}: ${msg}`);
      }
    }

    const ucTeamLower = (mapped.ucTeam as string | null)?.toLowerCase() || '';
    const provinceLower = (mapped.province as string | null)?.toLowerCase() || '';
    const isLoadDisplacementOntario = ucTeamLower.includes('load displacement') && provinceLower.includes('ontario');

    const grantsTeamField = (task.custom_fields || []).find((f: any) =>
      f.name?.toLowerCase().includes('grants and loan team')
    );
    const hasGrantsTeam = grantsTeamField?.enum_value?.name?.toLowerCase() === 'yes' || grantsTeamField?.display_value?.toLowerCase() === 'yes';

    if ((isLoadDisplacementOntario || hasGrantsTeam) && task.gid) {
      try {
        const subtasks = await fetchSubtasksForTask(task.gid);
        const hrsp = findHrspSubtask(subtasks);
        if (hrsp) {
          mapped.hrspSubtaskGid = hrsp.gid;
          mapped.hrspStatus = hrsp.status;
          mapped.hrspMissing = false;
          if (hrsp.status) {
            mapped.rebateStatus = hrsp.status;
          }
          if (hrsp.needsRebateFieldFix && isLoadDisplacementOntario) {
            try {
              const fixed = await fixHrspRebateField(hrsp.gid);
              if (fixed) {
                console.log(`Auto-fixed [no value] HRSP subtask for ${task.name} → Home Renovation Savings Program (ON)`);
              }
            } catch (fixErr: unknown) {
              const fixMsg = fixErr instanceof Error ? fixErr.message : String(fixErr);
              console.warn(`Could not auto-fix HRSP subtask for ${task.name}: ${fixMsg}`);
            }
          }
        } else if (isLoadDisplacementOntario) {
          mapped.hrspSubtaskGid = null;
          mapped.hrspStatus = null;
          mapped.hrspMissing = true;
        } else {
          mapped.hrspSubtaskGid = null;
          mapped.hrspStatus = null;
          mapped.hrspMissing = false;
        }
        if (isLoadDisplacementOntario && mapped.projectCreatedDate) {
          mapped.hrspDueDate = format(addDays(new Date(mapped.projectCreatedDate as string), 14), 'yyyy-MM-dd');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`Could not fetch subtasks for ${task.name}: ${msg}`);
      }
    } else {
      mapped.hrspSubtaskGid = null;
      mapped.hrspStatus = null;
      mapped.hrspMissing = false;
      mapped.hrspDueDate = null;
    }

    const isUcComplete = mapped.ucStatus && ['approved', 'complete', 'not required'].some(s => (mapped.ucStatus as string).toLowerCase().includes(s));
    const stageNeedsCorrection = mapped.installTeamStage && (mapped.installTeamStage as string).toLowerCase().includes('new cx pending other teams');

    if (isUcComplete && stageNeedsCorrection && task.gid) {
      try {
        await updateAsanaTaskField(task.gid, mapped.asanaCustomFields as Record<string, unknown>[], 'installTeamStage', 'Need contract');
        mapped.installTeamStage = 'Need contract';
        console.log(`Auto-corrected Install Team Stage to "Need contract" for ${task.name}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`Could not auto-correct Install Team Stage for ${task.name}: ${msg}`);
      }
    }

    const isPendingSiteVisit = mapped.installTeamStage && (mapped.installTeamStage as string).toLowerCase().includes('pending site visit');
    const siteVisitDone = mapped.siteVisitStatus && ((mapped.siteVisitStatus as string).toLowerCase().includes('visit complete') || (mapped.siteVisitStatus as string).toLowerCase().includes('visit booked'));
    if (isPendingSiteVisit && siteVisitDone && task.gid) {
      try {
        await updateAsanaTaskField(task.gid, mapped.asanaCustomFields as Record<string, unknown>[], 'installTeamStage', 'Active Install');
        mapped.installTeamStage = 'Active Install';
        console.log(`Auto-advanced Install Team Stage to "Active Install" for ${task.name} (site visit done)`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`Could not auto-advance stage for ${task.name}: ${msg}`);
      }
    }

    const project = await storage.upsertProject(mapped as Parameters<typeof storage.upsertProject>[0]);

    const existingDeadlines = await storage.getProjectDeadlines(project.id);
    if (existingDeadlines.length === 0) {
      const baseDate = mapped.projectCreatedDate ? new Date(mapped.projectCreatedDate as string) : new Date();
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
    const target = projects.find((p: Record<string, unknown>) =>
      (p.name as string).toLowerCase().includes('project manage team')
    );
    if (target) {
      cachedProjectGid = target.gid as string;
      return cachedProjectGid;
    }
  }
  throw new Error('Could not find "Project Manage Team" project in Asana. Please check your Asana workspace.');
}

asanaRouter.get("/workspaces", async (_req, res) => {
  try {
    const workspaces = await fetchAsanaWorkspaces();
    res.json(workspaces);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

asanaRouter.get("/projects/:workspaceGid", async (req, res) => {
  try {
    const projects = await fetchAsanaProjects(req.params.workspaceGid);
    res.json(projects);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

asanaRouter.post("/sync-all", async (_req, res) => {
  try {
    const projectGid = await findProjectManageTeamGid();
    const synced = await syncProjectFromAsana(projectGid);
    lastSyncTime = new Date().toISOString();
    console.log(`[Auto-Sync] Synced ${synced.length} projects at ${lastSyncTime}`);
    res.json({ synced: synced.length, lastSyncTime, projectGid });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Sync error:", error);
    res.status(500).json({ message: msg });
  }
});

asanaRouter.get("/sync-status", async (_req, res) => {
  res.json({ lastSyncTime, cachedProjectGid });
});

asanaRouter.post("/sync/:projectGid", async (req, res) => {
  try {
    const synced = await syncProjectFromAsana(req.params.projectGid);
    lastSyncTime = new Date().toISOString();
    res.json({ synced: synced.length, projects: synced });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Sync error:", error);
    res.status(500).json({ message: msg });
  }
});

asanaRouter.get("/field-options/:fieldName", async (req, res) => {
  try {
    const allProjects = await storage.getProjects();
    const projectWithFields = allProjects.find(p => p.asanaCustomFields && (p.asanaCustomFields as Record<string, unknown>[]).length > 0);
    if (!projectWithFields) {
      return res.json([]);
    }
    const options = await getAsanaEnumOptions(projectWithFields.asanaCustomFields as Record<string, unknown>[], req.params.fieldName);
    res.json(options);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;

async function runAutoSync() {
  try {
    const projectGid = await findProjectManageTeamGid();
    const synced = await syncProjectFromAsana(projectGid);
    lastSyncTime = new Date().toISOString();
    console.log(`[Auto-Sync] Synced ${synced.length} projects at ${lastSyncTime}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Auto-Sync] Error:", msg);
  }
}

export function startAutoSync() {
  setTimeout(() => {
    runAutoSync();
    setInterval(runAutoSync, AUTO_SYNC_INTERVAL_MS);
  }, 10000);
}

export const hrspRouter = Router();

hrspRouter.get("/field-options/:subtaskGid", async (req, res) => {
  try {
    const options = await getSubtaskFieldOptions(req.params.subtaskGid, 'grants status');
    res.json(options);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

hrspRouter.patch("/:projectId", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!project.hrspSubtaskGid) return res.status(400).json({ message: "No HRSP subtask found for this project" });

    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "Status is required" });

    await updateSubtaskField(project.hrspSubtaskGid, 'grants status', status);
    await storage.updateProject(project.id, { hrspStatus: status });

    res.json({ success: true, hrspStatus: status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('HRSP update error:', msg);
    res.status(500).json({ message: msg });
  }
});
