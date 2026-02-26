import { Router } from "express";
import { storage } from "../storage";
import { upload } from "../middleware/upload";
import { saveFileLocally, deleteFileLocally, createFileReadStream, getFileBuffer } from "../utils/file-storage";
import { FILE_CATEGORIES } from "@shared/schema";
import { fetchSubtasksForTask, fetchTaskAttachments } from "../asana";

export const filesRouter = Router();

filesRouter.get("/contract-file-counts", async (req, res) => {
  try {
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");
    const rows = await db.execute(sql`
      SELECT project_id, COUNT(*) as file_count
      FROM project_files
      WHERE category = 'contract' AND file_data IS NOT NULL
      GROUP BY project_id
    `);
    const counts: Record<string, number> = {};
    for (const row of rows.rows) {
      counts[row.project_id as string] = Number(row.file_count);
    }
    res.json(counts);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

filesRouter.get("/:id/files", async (req, res) => {
  try {
    const projectId = req.params.id as string;
    const category = req.query.category as string | undefined;
    const files = await storage.getProjectFiles(projectId, category);
    res.json(files);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

filesRouter.get("/:id/files/:fileId/download", async (req, res) => {
  try {
    const file = await storage.getProjectFile(req.params.fileId as string);
    if (!file) return res.status(404).json({ message: "File not found" });
    if (file.projectId !== req.params.id) return res.status(403).json({ message: "File does not belong to this project" });

    const stream = createFileReadStream(file.projectId, file.category, file.storedName);
    if (stream) {
      res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.fileName)}"`);
      if (file.fileSize) res.setHeader("Content-Length", file.fileSize);
      return stream.pipe(res);
    }

    const buffer = await getFileBuffer(req.params.fileId as string);
    if (buffer) {
      res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.fileName)}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    }

    return res.status(404).json({ message: "File not found on disk or in database. Please re-upload." });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

filesRouter.post("/:id/files", upload.any(), async (req, res) => {
  try {
    const projectId = req.params.id as string;
    const { category, uploadedBy, notes, uploadToAsana, asanaLabel } = req.body;

    if (!category || !(FILE_CATEGORIES as readonly string[]).includes(category)) {
      return res.status(400).json({ message: `Invalid category. Must be one of: ${FILE_CATEGORIES.join(', ')}` });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "At least one file is required" });
    }

    const results = [];
    for (const file of files) {
      const label = asanaLabel ? `${asanaLabel} - ${file.originalname}` : file.originalname;
      const record = await saveFileLocally(
        projectId, category, file.buffer, label, file.mimetype, uploadedBy, notes
      );
      results.push(record);
    }

    if (uploadToAsana === 'true') {
      try {
        const project = await storage.getProject(projectId);
        if (project?.hrspSubtaskGid) {
          const { uploadAttachmentToTask, postCommentToTask } = await import("../asana");
          for (const file of files) {
            const label = asanaLabel ? `${asanaLabel} - ${file.originalname}` : file.originalname;
            await uploadAttachmentToTask(project.hrspSubtaskGid, file.buffer, label, file.mimetype);
          }
          const commentText = `${asanaLabel || 'Document'} uploaded by ${uploadedBy || 'Team'}:\n${files.map(f => `- ${f.originalname}`).join('\n')}`;
          await postCommentToTask(project.hrspSubtaskGid, commentText);
        } else if (project?.asanaGid) {
          const { uploadAttachmentToTask, postCommentToTask } = await import("../asana");
          for (const file of files) {
            const label = asanaLabel ? `${asanaLabel} - ${file.originalname}` : file.originalname;
            await uploadAttachmentToTask(project.asanaGid, file.buffer, label, file.mimetype);
          }
          const commentText = `${asanaLabel || 'Document'} uploaded by ${uploadedBy || 'Team'}:\n${files.map(f => `- ${f.originalname}`).join('\n')}`;
          await postCommentToTask(project.asanaGid, commentText);
        }
      } catch (asanaErr) {
        console.error("[File Upload] Asana upload error (non-blocking):", asanaErr instanceof Error ? asanaErr.message : String(asanaErr));
      }
    }

    res.json({ files: results, message: `${results.length} file(s) uploaded` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

filesRouter.post("/:id/files/recover-from-asana", async (req, res) => {
  try {
    const projectId = req.params.id as string;
    const { category } = req.body;
    const project = await storage.getProject(projectId);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });

    const existingFiles = await storage.getProjectFiles(projectId, category || 'contract');
    if (existingFiles.length > 0) {
      return res.json({ message: "Files already exist locally, no recovery needed", recovered: 0, files: existingFiles });
    }

    const topSubtasks = await fetchSubtasksForTask(project.asanaGid);
    let targetGid: string | null = null;

    if (category === 'contract' || !category) {
      const installTeam = topSubtasks.find((st: Record<string, unknown>) =>
        (st.name as string)?.toLowerCase().includes('install team')
      );
      if (installTeam) {
        const children = await fetchSubtasksForTask(installTeam.gid as string);
        const clientContract = children.find((st: Record<string, unknown>) =>
          (st.name as string)?.toLowerCase() === 'client contract'
        );
        if (clientContract) targetGid = clientContract.gid as string;
      }
    }

    const gidsToCheck: { gid: string; label: string }[] = [];
    if (targetGid) {
      gidsToCheck.push({ gid: targetGid, label: 'Client Contract' });
    }
    gidsToCheck.push({ gid: project.asanaGid, label: 'Parent Task' });
    for (const st of topSubtasks) {
      if ((st as any).gid !== targetGid) {
        const stName = (st as any).name || 'unknown';
        if (stName.toLowerCase().includes('install') || stName.toLowerCase().includes('contract') || stName.toLowerCase().includes('planning')) {
          gidsToCheck.push({ gid: (st as any).gid, label: stName });
        }
      }
    }

    let allAttachments: any[] = [];
    let foundOn = '';
    for (const entry of gidsToCheck) {
      try {
        const atts = await fetchTaskAttachments(entry.gid);
        if (atts && atts.length > 0) {
          allAttachments = atts;
          foundOn = entry.label;
          break;
        }
      } catch (err) {
        console.log(`[Recovery] Error checking ${entry.label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (allAttachments.length === 0) {
      return res.status(404).json({
        message: "No attachments found on any Asana subtask. The files were stored locally on disk but were lost during a server restart before database persistence was added. They will need to be re-uploaded.",
        checkedLocations: gidsToCheck.map(g => g.label),
      });
    }

    const attachments = allAttachments;


    const contractKeywords = ['contract', 'proposal', 'site plan', 'site_plan', 'siteplan'];
    const filteredAttachments = foundOn === 'Client Contract'
      ? attachments
      : attachments.filter((att: any) => {
          const name = (att.name || '').toLowerCase();
          return contractKeywords.some(kw => name.includes(kw));
        });

    if (filteredAttachments.length === 0 && attachments.length > 0) {
      return res.status(404).json({
        message: "Found attachments on Asana but none appear to be contract documents. The contract-specific files (Contract, Proposal, Site Plan) were lost before they could be uploaded to Asana. They will need to be re-uploaded.",
        foundAttachments: attachments.map((a: any) => a.name),
      });
    }

    const recovered = [];
    for (const att of filteredAttachments) {
      if (!att.download_url) continue;
      try {
        const fileRes = await fetch(att.download_url);
        if (!fileRes.ok) continue;
        const buffer = Buffer.from(await fileRes.arrayBuffer());
        const mimeType = fileRes.headers.get('content-type') || 'application/octet-stream';
        const savedFile = await saveFileLocally(
          projectId, category || 'contract', buffer,
          att.name || 'recovered-file', mimeType,
          'System (recovered from Asana)', 'Recovered from Asana attachment'
        );
        recovered.push({ name: att.name, id: savedFile.id });
      } catch (err) {
        console.error(`[Recovery] Failed to download attachment ${att.name}:`, err instanceof Error ? err.message : String(err));
      }
    }

    res.json({ message: `Recovered ${recovered.length} file(s) from Asana`, recovered: recovered.length, files: recovered });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Recovery] Error:", msg);
    res.status(500).json({ message: msg });
  }
});

filesRouter.post("/bulk-recover-contracts", async (req, res) => {
  try {
    const allProjects = await storage.getProjects();
    const installProjects = allProjects.filter(p =>
      p.asanaGid &&
      p.installType?.toLowerCase() === 'install' &&
      p.installTeamStage &&
      !['project complete'].includes(p.installTeamStage?.toLowerCase() || '')
    );

    const results: { projectId: string; name: string; recovered: number; files: string[]; error?: string }[] = [];
    let totalRecovered = 0;
    let skipped = 0;

    for (const project of installProjects) {
      const existingFiles = await storage.getProjectFiles(project.id, 'contract');
      if (existingFiles.length > 0) {
        skipped++;
        continue;
      }

      try {
        const topSubtasks = await fetchSubtasksForTask(project.asanaGid!);
        const installTeam = topSubtasks.find((st: any) =>
          (st.name as string)?.toLowerCase().includes('install team')
        );

        let contractAtts: any[] = [];
        let source = '';

        if (installTeam) {
          const children = await fetchSubtasksForTask(installTeam.gid as string);
          const clientContract = children.find((st: any) =>
            (st.name as string)?.toLowerCase() === 'client contract'
          );
          if (clientContract) {
            const atts = await fetchTaskAttachments(clientContract.gid as string);
            if (atts && atts.length > 0) {
              contractAtts = atts;
              source = 'Client Contract subtask';
            }
          }
        }

        if (contractAtts.length === 0) {
          const parentAtts = await fetchTaskAttachments(project.asanaGid!);
          if (parentAtts && parentAtts.length > 0) {
            const contractKeywords = ['contract', 'proposal', 'site plan', 'site_plan', 'siteplan'];
            contractAtts = parentAtts.filter((att: any) => {
              const name = (att.name || '').toLowerCase();
              return contractKeywords.some(kw => name.includes(kw));
            });
            if (contractAtts.length > 0) source = 'Parent task';
          }
        }

        if (contractAtts.length === 0) {
          continue;
        }

        const recoveredFiles: string[] = [];
        const seenNames = new Set<string>();
        for (const att of contractAtts) {
          if (!att.download_url) continue;
          const name = att.name || 'recovered-file';
          if (seenNames.has(name.toLowerCase())) continue;
          seenNames.add(name.toLowerCase());

          try {
            const fileRes = await fetch(att.download_url);
            if (!fileRes.ok) continue;
            const buffer = Buffer.from(await fileRes.arrayBuffer());
            const mimeType = fileRes.headers.get('content-type') || 'application/octet-stream';
            await saveFileLocally(
              project.id, 'contract', buffer, name, mimeType,
              'System (recovered from Asana)', `Recovered from ${source}`
            );
            recoveredFiles.push(name);
          } catch (dlErr) {
            console.error(`[Bulk Recovery] Failed to download ${name} for ${project.name}:`, dlErr instanceof Error ? dlErr.message : String(dlErr));
          }
        }

        if (recoveredFiles.length > 0) {
          await storage.createTaskAction({
            projectId: project.id,
            viewType: 'contracts',
            actionType: 'document_upload',
            completedBy: 'System (recovered)',
            notes: `Recovered from Asana: ${recoveredFiles.join(', ')}`,
            followUpDate: null,
          });
          totalRecovered += recoveredFiles.length;
          results.push({ projectId: project.id, name: project.name || project.id, recovered: recoveredFiles.length, files: recoveredFiles });
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        results.push({ projectId: project.id, name: project.name || project.id, recovered: 0, files: [], error: err instanceof Error ? err.message : String(err) });
      }
    }

    res.json({
      message: `Bulk recovery complete. Recovered ${totalRecovered} files across ${results.length} projects. ${skipped} projects already had files.`,
      totalRecovered,
      projectsRecovered: results.filter(r => r.recovered > 0).length,
      skipped,
      checked: installProjects.length,
      details: results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Bulk Recovery] Error:", msg);
    res.status(500).json({ message: msg });
  }
});

filesRouter.delete("/:id/files/:fileId", async (req, res) => {
  try {
    const file = await storage.getProjectFile(req.params.fileId as string);
    if (!file) return res.status(404).json({ message: "File not found" });
    if (file.projectId !== req.params.id) return res.status(403).json({ message: "File does not belong to this project" });

    const deleted = await deleteFileLocally(req.params.fileId as string);
    if (!deleted) return res.status(500).json({ message: "Failed to delete file" });

    res.json({ success: true, message: "File deleted" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
