import type { Express } from "express";
import { createServer, type Server } from "http";
import { createRequire } from "module";
import { storage } from "./storage";
import { fetchAsanaWorkspaces, fetchAsanaProjects, fetchAsanaTasksFromProject, mapAsanaTaskToProject, updateAsanaTaskField, getAsanaEnumOptions, fetchTaskStories, findStatusChangeInStories, postCommentToTask, uploadAttachmentToTask, fetchSubtasksForTask, findHrspSubtask, updateSubtaskField, getSubtaskFieldOptions, createSubtaskForTask, fetchTaskAttachments, completeAsanaTask } from "./asana";
import { addDays, addWeeks, format } from "date-fns";
import { DEFAULT_DEADLINES_WEEKS, PROJECT_STAGES } from "@shared/schema";
import multer from "multer";
import OpenAI from "openai";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

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
        const ahjDue = new Date(mapped.ahjDueDate);
        mapped.installDueDate = format(addDays(ahjDue, 7), 'yyyy-MM-dd');
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

      const newUcStatus = (req.body.ucStatus || '').toLowerCase();
      const oldUcStatus = ((project as any).ucStatus || '').toLowerCase();
      const ucClosedStatuses = ['closed', 'close off'];
      if (newUcStatus && ucClosedStatuses.some(s => newUcStatus.includes(s)) && !ucClosedStatuses.some(s => oldUcStatus.includes(s))) {
        try {
          const allSubtasks = await fetchSubtasksForTask(project.asanaGid!);
          const ucSubtasks = allSubtasks.filter((st: any) =>
            st.name?.toLowerCase().includes('tasks for uc team') && !st.completed
          );
          for (const st of ucSubtasks) {
            await completeAsanaTask(st.gid);
          }
          console.log(`Auto-completed ${ucSubtasks.length} UC subtasks for ${project.name} (UC status → ${req.body.ucStatus})`);
        } catch (err: any) {
          console.log(`Could not auto-complete UC subtasks for ${project.name}: ${err.message}`);
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

  app.get("/api/projects/:id/uc-subtasks", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });
      const allSubtasks = await fetchSubtasksForTask(project.asanaGid);
      const ucSubtasks = allSubtasks.filter((st: any) =>
        st.name?.toLowerCase().includes('tasks for uc team')
      );
      ucSubtasks.sort((a: any, b: any) => {
        const aDate = a.name?.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] || '';
        const bDate = b.name?.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] || '';
        if (aDate && bDate) {
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        }
        return 0;
      });
      res.json(ucSubtasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/subtasks/:gid/stories", async (req, res) => {
    try {
      const stories = await fetchTaskStories(req.params.gid);
      const comments = stories.filter((s: any) =>
        s.resource_subtype === 'comment_added' || s.type === 'comment'
      );
      comments.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/subtasks/:gid/attachments", async (req, res) => {
    try {
      const attachments = await fetchTaskAttachments(req.params.gid);
      res.json(attachments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/subtasks/:gid/comment", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ message: "Comment text is required" });
      const result = await postCommentToTask(req.params.gid, text);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/subtasks/:gid/attachment", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "File is required" });
      const result = await uploadAttachmentToTask(
        req.params.gid,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/complete-uc-subtasks", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });
      const allSubtasks = await fetchSubtasksForTask(project.asanaGid);
      const ucSubtasks = allSubtasks.filter((st: any) =>
        st.name?.toLowerCase().includes('tasks for uc team') && !st.completed
      );
      for (const st of ucSubtasks) {
        await completeAsanaTask(st.gid);
      }
      res.json({ message: `Completed ${ucSubtasks.length} UC subtasks` });
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

  app.post("/api/projects/:id/hydro-bill", upload.single('hydroBill'), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });

      if (!req.file) return res.status(400).json({ message: "File is required" });

      console.log(`[Hydro Bill] Upload started for ${project.name}: file="${req.file.originalname}", mimetype="${req.file.mimetype}", size=${req.file.buffer.length} bytes`);

      const result = await uploadAttachmentToTask(
        project.asanaGid,
        req.file.buffer,
        `HYDRO BILL - ${req.file.originalname}`,
        req.file.mimetype
      );
      console.log(`[Hydro Bill] Asana upload success for ${project.name}`);

      let extracted: { hydroCompanyName?: string; hydroAccountNumber?: string; hydroCustomerName?: string } = {};
      let aiError: string | null = null;

      const isImage = req.file.mimetype.startsWith('image/');
      const isPdf = req.file.mimetype === 'application/pdf';
      console.log(`[Hydro Bill] isImage=${isImage}, isPdf=${isPdf} for mimetype="${req.file.mimetype}"`);

      if (isImage || isPdf) {
        try {
          const openai = new OpenAI({
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          });

          const extractionPrompt = "You are an expert at reading utility/hydro bills. Extract these three fields:\n1. The utility/hydro company name (e.g. Toronto Hydro, Alectra, Hydro One)\n2. The customer account number\n3. The full customer name exactly as it appears on the bill\n\nReturn ONLY a JSON object with these exact keys: hydroCompanyName, hydroAccountNumber, hydroCustomerName. If you cannot find a field, set its value to null. No explanation, just the JSON.";

          let aiResponse;

          if (isImage) {
            const base64 = req.file.buffer.toString('base64');
            const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
            console.log(`[Hydro Bill] Starting AI image extraction, base64 length: ${base64.length}`);

            aiResponse = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: extractionPrompt + "\n\nLook at this bill image carefully." },
                    { type: "image_url", image_url: { url: dataUrl, detail: "high" } }
                  ]
                }
              ],
              max_tokens: 500,
            });
          } else {
            const pdfData = await pdfParse(req.file.buffer);
            const pdfText = pdfData.text?.trim();
            console.log(`[Hydro Bill] PDF text extracted, length: ${pdfText?.length || 0} chars, first 500: "${pdfText?.substring(0, 500)}"`);

            if (!pdfText || pdfText.length < 10) {
              throw new Error("PDF appears to be a scanned image with no selectable text. Please upload a JPG/PNG screenshot instead.");
            }

            aiResponse = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                {
                  role: "user",
                  content: `${extractionPrompt}\n\nHere is the text content extracted from a hydro/utility bill PDF:\n\n---\n${pdfText.substring(0, 4000)}\n---`
                }
              ],
              max_tokens: 500,
            });
          }

          const rawContent = aiResponse.choices[0]?.message?.content || '';
          console.log(`[Hydro Bill] AI raw response for ${project.name}: "${rawContent}"`);

          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            extracted = {
              hydroCompanyName: parsed.hydroCompanyName || undefined,
              hydroAccountNumber: parsed.hydroAccountNumber || undefined,
              hydroCustomerName: parsed.hydroCustomerName || undefined,
            };
            console.log(`[Hydro Bill] Extracted for ${project.name}:`, extracted);
          } else {
            console.warn(`[Hydro Bill] AI response didn't contain JSON for ${project.name}`);
            aiError = "AI response didn't contain valid JSON";
          }
        } catch (aiErr: any) {
          aiError = aiErr.message || 'Unknown AI error';
          console.error(`[Hydro Bill] AI extraction failed for ${project.name}:`, aiErr.message, aiErr.status, aiErr.code);
          if (aiErr.error) {
            console.error(`[Hydro Bill] AI error detail:`, JSON.stringify(aiErr.error));
          }
        }
      } else {
        aiError = `File type "${req.file.mimetype}" is not supported for scanning. Upload a PDF, JPG, or PNG.`;
        console.log(`[Hydro Bill] Skipping AI extraction — unsupported type: ${req.file.mimetype}`);
      }

      const attachmentData = result.data || result;
      const viewUrl = attachmentData.view_url || attachmentData.download_url || attachmentData.permanent_url || 'uploaded';

      const updated = await storage.updateProject(req.params.id, {
        hydroBillUrl: viewUrl,
        ...extracted,
      });

      console.log(`[Hydro Bill] Complete for ${project.name}. URL=${viewUrl}, extracted=${JSON.stringify(extracted)}, aiError=${aiError}`);
      res.json({ attachment: result, project: updated, extracted, aiError });
    } catch (error: any) {
      console.error("[Hydro Bill] Upload error:", error.message, error.stack);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/contract-documents", upload.fields([
    { name: 'contract', maxCount: 1 },
    { name: 'proposal', maxCount: 1 },
    { name: 'sitePlan', maxCount: 1 },
  ]), async (req, res) => {
    try {
      const projectId = req.params.id as string;
      const project = await storage.getProject(projectId);
      if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });

      const { uploadedBy, notes } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const results: { type: string; fileName: string }[] = [];

      if (files?.contract?.[0]) {
        const file = files.contract[0];
        await uploadAttachmentToTask(project.asanaGid, file.buffer, `CONTRACT - ${file.originalname}`, file.mimetype);
        results.push({ type: 'Contract', fileName: file.originalname });
      }
      if (files?.proposal?.[0]) {
        const file = files.proposal[0];
        await uploadAttachmentToTask(project.asanaGid, file.buffer, `PROPOSAL - ${file.originalname}`, file.mimetype);
        results.push({ type: 'Proposal', fileName: file.originalname });
      }
      if (files?.sitePlan?.[0]) {
        const file = files.sitePlan[0];
        await uploadAttachmentToTask(project.asanaGid, file.buffer, `SITE PLAN - ${file.originalname}`, file.mimetype);
        results.push({ type: 'Site Plan', fileName: file.originalname });
      }

      const commentParts = [`Contract documents uploaded by ${uploadedBy || 'Team'}:`];
      for (const r of results) {
        commentParts.push(`- ${r.type}: ${r.fileName}`);
      }
      if (notes) commentParts.push(`\nNotes: ${notes}`);
      commentParts.push('\nStatus: PENDING REVIEW');

      await postCommentToTask(project.asanaGid, commentParts.join('\n'));

      const action = await storage.createTaskAction({
        projectId: projectId,
        viewType: 'contracts',
        actionType: 'document_upload',
        completedBy: uploadedBy || null,
        notes: `Uploaded: ${results.map(r => r.type).join(', ')}${notes ? ` | Notes: ${notes}` : ''}`,
        followUpDate: null,
      });

      res.json({ success: true, action, uploaded: results, message: `${results.length} document(s) uploaded to Asana` });
    } catch (error: any) {
      console.error("Contract documents upload error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/contract-approve", async (req, res) => {
    try {
      const projectId = req.params.id as string;
      const project = await storage.getProject(projectId);
      if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });

      const { approvedBy, notes } = req.body;
      const commentText = `CONTRACT APPROVED by ${approvedBy || 'Manager'}\n${notes ? `Notes: ${notes}` : 'Ready to send via DocuSign.'}`;
      await postCommentToTask(project.asanaGid, commentText);

      const action = await storage.createTaskAction({
        projectId: projectId,
        viewType: 'contracts',
        actionType: 'contract_approved',
        completedBy: approvedBy || null,
        notes: notes || 'Contract approved for sending',
        followUpDate: null,
      });

      res.json({ success: true, action, message: "Contract approved and posted to Asana" });
    } catch (error: any) {
      console.error("Contract approve error:", error);
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

      const excludedPmStatuses = ['complete', 'project paused', 'project lost'];
      const installProjects = allProjects.filter(p =>
        p.installType?.toLowerCase() === 'install' &&
        (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
        !excludedPmStatuses.includes(p.pmStatus?.toLowerCase() || '')
      );

      const totalProjects = installProjects.length;
      const installProjectIds = new Set(installProjects.map(p => p.id));
      const installDeadlines = allDeadlines.filter(d => installProjectIds.has(d.projectId));

      const projectsWithOverdue = new Set<string>();
      for (const d of installDeadlines) {
        if (d.status === 'pending' && d.targetDate && new Date(d.targetDate) < today) {
          projectsWithOverdue.add(d.projectId);
        }
      }
      const overdueProjectCount = projectsWithOverdue.size;
      const onTrackProjectCount = totalProjects - overdueProjectCount;

      const stageBreakdown: Record<string, { total: number; overdue: number; onTrack: number }> = {};
      for (const stage of PROJECT_STAGES) {
        const deadlinesForStage = installDeadlines.filter(d => d.stage === stage);
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
        overdueCount: overdueProjectCount,
        onTrackCount: onTrackProjectCount,
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
