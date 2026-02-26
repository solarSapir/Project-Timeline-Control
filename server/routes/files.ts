import { Router } from "express";
import { storage } from "../storage";
import { upload } from "../middleware/upload";
import { saveFileLocally, deleteFileLocally, createFileReadStream, getFileBuffer } from "../utils/file-storage";
import { FILE_CATEGORIES } from "@shared/schema";

export const filesRouter = Router();

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

filesRouter.post("/:id/files", upload.array('files', 20), async (req, res) => {
  try {
    const projectId = req.params.id as string;
    const { category, uploadedBy, notes } = req.body;

    if (!category || !(FILE_CATEGORIES as readonly string[]).includes(category)) {
      return res.status(400).json({ message: `Invalid category. Must be one of: ${FILE_CATEGORIES.join(', ')}` });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "At least one file is required" });
    }

    const results = [];
    for (const file of files) {
      const record = await saveFileLocally(
        projectId, category, file.buffer, file.originalname, file.mimetype, uploadedBy, notes
      );
      results.push(record);
    }

    res.json({ files: results, message: `${results.length} file(s) uploaded` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
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
