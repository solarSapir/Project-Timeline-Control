import { Router, Request, Response } from "express";
import { storage } from "../storage";
import {
  fetchSingleAsanaTask,
  mapAsanaTaskToProject,
  fetchTaskStories,
  findStatusChangeInStories,
  fetchSubtasksForTask,
  findHrspSubtask,
  fixHrspRebateField,
  updateAsanaTaskField,
  createAsanaWebhook,
  deleteAsanaWebhook,
  listAsanaWebhooks,
  fetchAsanaWorkspaces,
} from "../asana";
import { addDays, addWeeks, format } from "date-fns";
import { DEFAULT_DEADLINES_WEEKS, DEFAULT_STAGE_GAPS, PROJECT_STAGES } from "@shared/schema";

export const webhookRouter = Router();

let webhookSecret: string | null = null;
let activeWebhookGid: string | null = null;
let lastWebhookEventAt: string | null = null;
let webhookEventsProcessed = 0;

const syncQueue = new Set<string>();
let syncTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 2000;

async function syncSingleTask(taskGid: string, projectGid: string | null) {
  try {
    const task = await fetchSingleAsanaTask(taskGid);

    if (!task) {
      const existing = await storage.getProjectByAsanaGid(taskGid);
      if (existing) {
        await storage.deleteProject(existing.id);
        console.log(`[Webhook] Removed "${existing.name}" — task deleted from Asana`);
      }
      return;
    }

    if (!task.name || task.name.trim() === '') return;

    if (projectGid && task.memberships) {
      const inProject = task.memberships.some((m: any) => m.project?.gid === projectGid);
      if (!inProject) {
        const existing = await storage.getProjectByAsanaGid(taskGid);
        if (existing) {
          await storage.deleteProject(existing.id);
          console.log(`[Webhook] Removed "${existing.name}" — task no longer in project`);
        }
        return;
      }
    }

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
        console.log(`[Webhook] Could not fetch stories for ${task.name}: ${msg}`);
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
          if (hrsp.status) mapped.rebateStatus = hrsp.status;
          if (hrsp.needsRebateFieldFix && isLoadDisplacementOntario) {
            try {
              const fixed = await fixHrspRebateField(hrsp.gid);
              if (fixed) console.log(`[Webhook] Auto-fixed HRSP subtask for ${task.name}`);
            } catch (_) { /* ignore fix errors */ }
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
        console.log(`[Webhook] Could not fetch subtasks for ${task.name}: ${msg}`);
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
      } catch (_) { /* ignore */ }
    }

    const isPendingSiteVisit = mapped.installTeamStage && (mapped.installTeamStage as string).toLowerCase().includes('pending site visit');
    const siteVisitDone = mapped.siteVisitStatus && ((mapped.siteVisitStatus as string).toLowerCase().includes('visit complete') || (mapped.siteVisitStatus as string).toLowerCase().includes('visit booked'));
    if (isPendingSiteVisit && siteVisitDone && task.gid) {
      try {
        await updateAsanaTaskField(task.gid, mapped.asanaCustomFields as Record<string, unknown>[], 'installTeamStage', 'Active Install');
        mapped.installTeamStage = 'Active Install';
      } catch (_) { /* ignore */ }
    }

    if (task.gid) {
      const existing = await storage.getProjectByAsanaGid(task.gid);
      const rebateFollowUp = ['in-progress', 'submitted', 'close-off - submitted', 'close-off submitted'];
      const newStatusInFollowUp = mapped.rebateStatus && rebateFollowUp.some(s => (mapped.rebateStatus as string).toLowerCase().includes(s));
      if (existing?.rebateSubmittedDate && newStatusInFollowUp) {
        mapped.rebateSubmittedDate = existing.rebateSubmittedDate;
      } else if (!existing?.rebateSubmittedDate && newStatusInFollowUp) {
        mapped.rebateSubmittedDate = new Date().toISOString();
      } else {
        mapped.rebateSubmittedDate = null;
      }
    }

    const project = await storage.upsertProject(mapped as Parameters<typeof storage.upsertProject>[0]);

    if (project.hydroBillUrl && !project.hrspPowerConsumptionUrl) {
      await storage.updateProject(project.id, { hrspPowerConsumptionUrl: project.hydroBillUrl });
    }

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

    console.log(`[Webhook] Synced "${project.name}" (${taskGid})`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Webhook] Error syncing task ${taskGid}:`, msg);
  }
}

function processSyncQueue(projectGid: string | null) {
  if (syncQueue.size === 0) return;
  const tasks = [...syncQueue];
  syncQueue.clear();
  console.log(`[Webhook] Processing ${tasks.length} task update(s)...`);
  for (const taskGid of tasks) {
    syncSingleTask(taskGid, projectGid).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Webhook] Queue error for ${taskGid}:`, msg);
    });
  }
}

let cachedProjectGidForWebhook: string | null = null;

webhookRouter.post("/asana", (req: Request, res: Response) => {
  if (req.headers['x-hook-secret']) {
    webhookSecret = req.headers['x-hook-secret'] as string;
    console.log('[Webhook] Asana handshake received — webhook is now active');
    res.setHeader('X-Hook-Secret', webhookSecret);
    return res.sendStatus(200);
  }

  const events = req.body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    return res.sendStatus(200);
  }

  lastWebhookEventAt = new Date().toISOString();
  webhookEventsProcessed += events.length;

  for (const event of events) {
    const resourceGid = event.resource?.gid;
    if (!resourceGid) continue;

    if (event.resource?.resource_type === 'task') {
      syncQueue.add(resourceGid);
    }

    if (event.parent?.gid) {
      syncQueue.add(event.parent.gid);
    }
  }

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => processSyncQueue(cachedProjectGidForWebhook), DEBOUNCE_MS);

  res.sendStatus(200);
});

webhookRouter.post("/setup", async (req: Request, res: Response) => {
  try {
    const { projectGid } = req.body;
    if (!projectGid) {
      return res.status(400).json({ message: "projectGid is required" });
    }

    const devDomain = process.env.REPLIT_DEV_DOMAIN;
    const deploymentDomain = process.env.REPLIT_DEPLOYMENT_URL || process.env.REPL_SLUG;
    const hostname = devDomain || deploymentDomain;

    if (!hostname) {
      return res.status(400).json({ message: "Could not determine server URL for webhook" });
    }

    const targetUrl = `https://${hostname}/api/webhooks/asana`;

    if (activeWebhookGid) {
      try {
        await deleteAsanaWebhook(activeWebhookGid);
        console.log(`[Webhook] Deleted previous webhook ${activeWebhookGid}`);
      } catch (_) { /* ignore */ }
    }

    const result = await createAsanaWebhook(projectGid, targetUrl);
    activeWebhookGid = result?.data?.gid || null;
    cachedProjectGidForWebhook = projectGid;
    console.log(`[Webhook] Created webhook ${activeWebhookGid} for project ${projectGid} → ${targetUrl}`);

    res.json({
      success: true,
      webhookGid: activeWebhookGid,
      targetUrl,
      projectGid,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Webhook] Setup error:", msg);
    res.status(500).json({ message: msg });
  }
});

webhookRouter.delete("/teardown", async (_req: Request, res: Response) => {
  try {
    if (activeWebhookGid) {
      await deleteAsanaWebhook(activeWebhookGid);
      console.log(`[Webhook] Deleted webhook ${activeWebhookGid}`);
      activeWebhookGid = null;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

webhookRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    let asanaWebhooks: any[] = [];
    try {
      const workspaces = await fetchAsanaWorkspaces();
      if (workspaces.length > 0) {
        asanaWebhooks = await listAsanaWebhooks(workspaces[0].gid);
      }
    } catch (_) { /* ignore */ }

    res.json({
      active: !!activeWebhookGid,
      webhookGid: activeWebhookGid,
      lastEventAt: lastWebhookEventAt,
      eventsProcessed: webhookEventsProcessed,
      asanaWebhooks: asanaWebhooks.map((w: any) => ({
        gid: w.gid,
        target: w.target,
        active: w.active,
        resourceGid: w.resource?.gid,
        resourceName: w.resource?.name,
        lastSuccessAt: w.last_success_at,
        lastFailureAt: w.last_failure_at,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
