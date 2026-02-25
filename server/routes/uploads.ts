import { Router } from "express";
import { createRequire } from "module";
import { storage } from "../storage";
import {
  postCommentToTask,
  fetchSubtasksForTask,
  createSubtaskForTask,
} from "../asana";
import { upload } from "../middleware/upload";
import { addDays, format } from "date-fns";
import OpenAI from "openai";
import { saveFileLocally, getDownloadUrl } from "../utils/file-storage";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

export const uploadsRouter = Router();

uploadsRouter.post("/:id/follow-up", upload.single('screenshot'), async (req, res) => {
  try {
    const projectId = req.params.id as string;
    const project = await storage.getProject(projectId);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });

    const { notes, completedBy, viewType, subtaskGid } = req.body;
    const isContract = viewType === 'contracts';
    const isRebate = viewType === 'payments';
    const isUc = !isContract && !isRebate;
    const commentPrefix = isRebate ? 'Rebate Follow-up' : isContract ? 'Contract Follow-up' : 'UC Follow-up';
    const commentText = `${commentPrefix} by ${completedBy || 'Team'}:\n${notes || 'Follow-up completed'}`;

    let targetGid = subtaskGid || '';
    if (!targetGid && isRebate && project.hrspSubtaskGid) {
      targetGid = project.hrspSubtaskGid;
    }
    if (!targetGid && isUc && project.asanaGid) {
      try {
        const subs = await fetchSubtasksForTask(project.asanaGid);
        const ucSub = subs.find((s: Record<string, unknown>) =>
          (s.name as string)?.toLowerCase().includes('tasks for uc team') && !s.completed
        ) || subs.find((s: Record<string, unknown>) =>
          (s.name as string)?.toLowerCase().includes('tasks for uc team')
        );
        if (ucSub) targetGid = ucSub.gid as string;
      } catch { /* fall through to main task */ }
    }
    if (!targetGid) targetGid = project.asanaGid;

    await postCommentToTask(targetGid, commentText);

    if (req.file) {
      const categoryMap: Record<string, string> = { contracts: 'contract', payments: 'rebates', uc: 'uc' };
      const fileCategory = categoryMap[viewType || 'uc'] || 'uc';
      await saveFileLocally(projectId, fileCategory, req.file.buffer, req.file.originalname, req.file.mimetype, completedBy, 'Follow-up screenshot');
    }

    const followUpDays = isRebate ? 5 : isContract ? 1 : 7;
    const action = await storage.createTaskAction({
      projectId: projectId,
      viewType: viewType || 'uc',
      actionType: 'follow_up',
      completedBy: completedBy || null,
      notes: notes || null,
      followUpDate: format(addDays(new Date(), followUpDays), 'yyyy-MM-dd'),
    });

    res.json({ success: true, action, message: `${commentPrefix} posted to Asana` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Follow-up error:", error);
    res.status(500).json({ message: msg });
  }
});

uploadsRouter.post("/:id/hydro-bill", upload.single('hydroBill'), async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id as string);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });
    if (!req.file) return res.status(400).json({ message: "File is required" });

    console.log(`[Hydro Bill] Upload started for ${project.name}: file="${req.file.originalname}", mimetype="${req.file.mimetype}", size=${req.file.buffer.length} bytes`);

    const savedFile = await saveFileLocally(req.params.id as string, 'uc', req.file.buffer, `HYDRO BILL - ${req.file.originalname}`, req.file.mimetype, undefined, 'Hydro bill upload');
    console.log(`[Hydro Bill] File saved locally for ${project.name}`);

    let extracted: { hydroCompanyName?: string; hydroAccountNumber?: string; hydroCustomerName?: string } = {};
    let aiError: string | null = null;

    const isImage = req.file.mimetype.startsWith('image/');
    const isPdf = req.file.mimetype === 'application/pdf';

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
          aiResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: [{ type: "text", text: extractionPrompt + "\n\nLook at this bill image carefully." }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] }],
            max_tokens: 500,
          });
        } else {
          const uint8 = new Uint8Array(req.file.buffer);
          const parser = new PDFParse(uint8);
          const pdfResult = await parser.getText();
          const pdfText = (pdfResult.text || pdfResult.pages?.map((p: Record<string, unknown>) => p.text).join('\n') || '').trim();

          if (!pdfText || pdfText.length < 10) {
            throw new Error("PDF appears to be a scanned image with no selectable text. Please upload a JPG/PNG screenshot instead.");
          }

          aiResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: `${extractionPrompt}\n\nHere is the text content extracted from a hydro/utility bill PDF:\n\n---\n${pdfText.substring(0, 4000)}\n---` }],
            max_tokens: 500,
          });
        }

        const rawContent = aiResponse.choices[0]?.message?.content || '';
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          extracted = {
            hydroCompanyName: parsed.hydroCompanyName || undefined,
            hydroAccountNumber: parsed.hydroAccountNumber || undefined,
            hydroCustomerName: parsed.hydroCustomerName || undefined,
          };
        } else {
          aiError = "AI response didn't contain valid JSON";
        }
      } catch (aiErr: unknown) {
        aiError = aiErr instanceof Error ? aiErr.message : 'Unknown AI error';
        console.error(`[Hydro Bill] AI extraction failed for ${project.name}:`, aiError);
      }
    } else {
      aiError = `File type "${req.file.mimetype}" is not supported for scanning. Upload a PDF, JPG, or PNG.`;
    }

    const localUrl = getDownloadUrl(req.params.id as string, savedFile.id);

    const updated = await storage.updateProject(req.params.id as string, { hydroBillUrl: localUrl, ...extracted });

    res.json({ project: updated, extracted, aiError, fileId: savedFile.id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Hydro Bill] Upload error:", msg);
    res.status(500).json({ message: msg });
  }
});

uploadsRouter.post("/:id/meterbase", upload.single('meterbase'), async (req, res) => {
  try {
    const projectId = req.params.id as string;
    const project = await storage.getProject(projectId);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });
    if (!req.file) return res.status(400).json({ message: "File is required" });

    const savedFile = await saveFileLocally(projectId, 'uc', req.file.buffer, `METERBASE - ${req.file.originalname}`, req.file.mimetype, req.body.uploadedBy, 'Meterbase photo upload');
    const localUrl = getDownloadUrl(projectId, savedFile.id);
    const updated = await storage.updateProject(projectId, { ucMeterbaseUrl: localUrl });

    res.json({ project: updated, fileId: savedFile.id, message: "Meterbase photo uploaded" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Meterbase] Upload error:", msg);
    res.status(500).json({ message: msg });
  }
});

uploadsRouter.post("/:id/contract-documents", upload.fields([
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
      await saveFileLocally(projectId, 'contract', file.buffer, `CONTRACT - ${file.originalname}`, file.mimetype, uploadedBy, notes);
      results.push({ type: 'Contract', fileName: file.originalname });
    }
    if (files?.proposal?.[0]) {
      const file = files.proposal[0];
      await saveFileLocally(projectId, 'contract', file.buffer, `PROPOSAL - ${file.originalname}`, file.mimetype, uploadedBy, notes);
      results.push({ type: 'Proposal', fileName: file.originalname });
    }
    if (files?.sitePlan?.[0]) {
      const file = files.sitePlan[0];
      await saveFileLocally(projectId, 'contract', file.buffer, `SITE PLAN - ${file.originalname}`, file.mimetype, uploadedBy, notes);
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Contract documents upload error:", error);
    res.status(500).json({ message: msg });
  }
});

uploadsRouter.post("/:id/contract-approve", async (req, res) => {
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Contract approve error:", error);
    res.status(500).json({ message: msg });
  }
});

uploadsRouter.post("/:id/site-visit-photos", upload.array('photos', 10), async (req, res) => {
  try {
    const projectId = req.params.id as string;
    const project = await storage.getProject(projectId);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });

    const { notes, completedBy } = req.body;
    const files = req.files as Express.Multer.File[];

    if (notes || completedBy) {
      try {
        const subtasks = await fetchSubtasksForTask(project.asanaGid);
        let photosSubtask = subtasks.find((st: Record<string, unknown>) => (st.name as string)?.toLowerCase().includes('site visit photos'));
        if (!photosSubtask) {
          photosSubtask = await createSubtaskForTask(project.asanaGid, 'Site visit Photos');
        }
        const commentText = `Site Visit Photos uploaded by ${completedBy || 'Team'}:\n${notes || 'Photos uploaded'}`;
        await postCommentToTask(photosSubtask.gid as string, commentText);
      } catch {
        console.warn(`[Site Visit] Could not post comment to Asana for ${project.name}`);
      }
    }

    let uploadedCount = 0;
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          await saveFileLocally(projectId, 'site_visit', file.buffer, file.originalname, file.mimetype, completedBy, notes);
          uploadedCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to save ${file.originalname}: ${msg}`);
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

    res.json({ success: true, action, uploadedCount, message: `${uploadedCount} photo(s) saved` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Site visit photos error:", error);
    res.status(500).json({ message: msg });
  }
});

