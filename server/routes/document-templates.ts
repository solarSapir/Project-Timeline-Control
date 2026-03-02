import { Router } from "express";
import { storage } from "../storage";
import { upload } from "../middleware/upload";
import multer from "multer";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import PDFDocumentKit from "pdfkit";
import { saveFileLocally } from "../utils/file-storage";

export const documentTemplatesRouter = Router();

const TEMPLATES_DIR = path.resolve(process.cwd(), "data", "templates");

function ensureTemplatesDir(): string {
  if (!existsSync(TEMPLATES_DIR)) {
    mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
  return TEMPLATES_DIR;
}

function getTemplatePath(storedName: string): string {
  return path.join(TEMPLATES_DIR, storedName);
}

async function getTemplateBuffer(templateId: string, storedName: string): Promise<Buffer> {
  const filePath = getTemplatePath(storedName);
  if (existsSync(filePath)) {
    return readFileSync(filePath);
  }
  const withData = await storage.getDocumentTemplateWithData(templateId);
  if (withData?.fileData) {
    ensureTemplatesDir();
    await writeFile(filePath, withData.fileData);
    return withData.fileData;
  }
  throw new Error("Template file not found on disk or in database");
}

documentTemplatesRouter.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { name, viewType, templateType } = req.body;
    if (!name || !viewType) {
      return res.status(400).json({ message: "Name and viewType are required" });
    }

    const ext = path.extname(req.file.originalname);
    const storedName = `${randomUUID()}${ext}`;
    const dir = ensureTemplatesDir();
    await writeFile(path.join(dir, storedName), req.file.buffer);

    let pageCount = 1;
    if (req.file.mimetype === "application/pdf") {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(req.file.buffer);
        pageCount = parsed.numpages || 1;
      } catch {
        pageCount = 1;
      }
    }

    const template = await storage.createDocumentTemplate({
      name,
      viewType,
      templateType: templateType || "overlay",
      fileName: req.file.originalname,
      storedName,
      mimeType: req.file.mimetype,
      fileData: req.file.buffer,
      pageCount,
      enabled: true,
    });

    res.json(template);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

documentTemplatesRouter.get("/", async (req, res) => {
  try {
    const viewType = typeof req.query.viewType === "string" ? req.query.viewType : undefined;
    const templates = await storage.getDocumentTemplates(viewType);

    const withFieldCounts = await Promise.all(
      templates.map(async (t) => {
        const fields = await storage.getTemplateFieldsByTemplate(t.id);
        return { ...t, fieldCount: fields.length };
      })
    );

    res.json(withFieldCounts);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

documentTemplatesRouter.get("/:id", async (req, res) => {
  try {
    const template = await storage.getDocumentTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }
    const fields = await storage.getTemplateFieldsByTemplate(template.id);
    res.json({ ...template, fields });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

documentTemplatesRouter.delete("/:id", async (req, res) => {
  try {
    const template = await storage.getDocumentTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const filePath = getTemplatePath(template.storedName);
    if (existsSync(filePath)) {
      const { unlinkSync } = await import("fs");
      try { unlinkSync(filePath); } catch {}
    }

    await storage.deleteDocumentTemplate(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

documentTemplatesRouter.put("/:id/fields", async (req, res) => {
  try {
    const template = await storage.getDocumentTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const { fields } = req.body;
    if (!Array.isArray(fields)) {
      return res.status(400).json({ message: "Fields array required" });
    }

    const saved = await storage.bulkUpsertTemplateFields(template.id, fields);
    res.json(saved);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

documentTemplatesRouter.get("/:id/preview", async (req, res) => {
  try {
    const template = await storage.getDocumentTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const buffer = await getTemplateBuffer(template.id, template.storedName);
    res.setHeader("Content-Type", template.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${template.fileName}"`);
    res.send(buffer);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

documentTemplatesRouter.patch("/:id", async (req, res) => {
  try {
    const template = await storage.getDocumentTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const { name, enabled, htmlContent } = req.body;
    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name;
    if (typeof enabled === "boolean") updates.enabled = enabled;
    if (typeof htmlContent === "string") updates.htmlContent = htmlContent;

    const updated = await storage.updateDocumentTemplate(req.params.id, updates as any);
    res.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

documentTemplatesRouter.post("/:id/import-docx", upload.single("file"), async (req, res) => {
  try {
    const template = await storage.getDocumentTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const mammoth = await import("mammoth");
    const result = await mammoth.default.convertToHtml(
      { buffer: req.file.buffer },
      {
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "b => strong",
          "i => em",
          "u => u",
          "strike => s",
        ],
      }
    );

    await storage.updateDocumentTemplate(req.params.id, {
      htmlContent: result.value,
    } as any);

    res.json({ html: result.value, messages: result.messages });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

const largeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

documentTemplatesRouter.post("/:id/generate-contract", largeUpload.any(), async (req, res) => {
  try {
    const template = await storage.getDocumentTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const files = req.files as Express.Multer.File[] | undefined;
    const pdfFile = files?.find((f) => f.fieldname === "pdf");
    if (!pdfFile) {
      return res.status(400).json({ message: "No PDF file uploaded" });
    }

    const { projectId, staffName, signatureData } = req.body;
    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const resolvedStaffName = staffName && staffName !== "none" ? staffName : "System";
    const project = await storage.getProject(projectId);
    const outputName = `${template.name} - ${project?.name || projectId}.pdf`;

    let notes = `Generated from editable template: ${template.name}`;
    if (signatureData) {
      try {
        const sigInfo = JSON.parse(signatureData);
        const auditParts = [
          `Signer: ${sigInfo.signerName || "Unknown"}`,
          `Method: ${sigInfo.method === "drawn" ? "Drawn signature" : "Typed signature"}`,
          `Timestamp: ${sigInfo.timestamp || new Date().toISOString()}`,
          `Staff: ${resolvedStaffName}`,
          `Template: ${template.name} (${template.id})`,
          `Project: ${project?.name || projectId}`,
        ];
        notes += ` | E-SIGNATURE AUDIT: ${auditParts.join("; ")}`;
      } catch {}
    }

    const attachmentFiles = (files || []).filter((f) => f.fieldname.startsWith("attachment_"));
    let finalBuffer: Buffer = pdfFile.buffer;

    if (attachmentFiles.length > 0) {
      const contractPdf = await PDFDocument.load(pdfFile.buffer);

      for (const attachment of attachmentFiles) {
        const label = attachment.fieldname.replace("attachment_", "").replace(/_/g, " ").toUpperCase();
        const mime = attachment.mimetype.toLowerCase();

        if (mime === "application/pdf") {
          const attachPdf = await PDFDocument.load(attachment.buffer);
          const pageIndices = attachPdf.getPageIndices();
          const copiedPages = await contractPdf.copyPages(attachPdf, pageIndices);

          const font = await contractPdf.embedFont(StandardFonts.HelveticaBold);
          for (let i = 0; i < copiedPages.length; i++) {
            const page = contractPdf.addPage(copiedPages[i]);
            if (i === 0) {
              const { width, height } = page.getSize();
              page.drawText(`${label} - Page ${i + 1} of ${copiedPages.length}`, {
                x: 20,
                y: height - 20,
                size: 8,
                font,
                color: rgb(0.4, 0.4, 0.4),
              });
            }
          }
        } else if (mime.startsWith("image/")) {
          let embeddedImage;
          if (mime === "image/png") {
            embeddedImage = await contractPdf.embedPng(attachment.buffer);
          } else {
            embeddedImage = await contractPdf.embedJpg(attachment.buffer);
          }

          const imgDims = embeddedImage.scale(1);
          const pageWidth = 612;
          const pageHeight = 792;
          const margin = 40;
          const headerSpace = 30;
          const availWidth = pageWidth - margin * 2;
          const availHeight = pageHeight - margin * 2 - headerSpace;

          let drawWidth = imgDims.width;
          let drawHeight = imgDims.height;
          if (drawWidth > availWidth || drawHeight > availHeight) {
            const scale = Math.min(availWidth / drawWidth, availHeight / drawHeight);
            drawWidth *= scale;
            drawHeight *= scale;
          }

          const page = contractPdf.addPage([pageWidth, pageHeight]);
          const font = await contractPdf.embedFont(StandardFonts.HelveticaBold);
          page.drawText(label, {
            x: margin,
            y: pageHeight - margin,
            size: 10,
            font,
            color: rgb(0.2, 0.2, 0.2),
          });

          const x = (pageWidth - drawWidth) / 2;
          const y = (pageHeight - drawHeight - headerSpace) / 2;
          page.drawImage(embeddedImage, {
            x,
            y,
            width: drawWidth,
            height: drawHeight,
          });
        }
      }

      const mergedBytes = await contractPdf.save();
      finalBuffer = Buffer.from(mergedBytes);
    }

    const savedFile = await saveFileLocally(
      projectId,
      template.viewType,
      finalBuffer,
      outputName,
      "application/pdf",
      resolvedStaffName,
      notes
    );

    res.json(savedFile);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

documentTemplatesRouter.post("/:id/generate", async (req, res) => {
  try {
    const template = await storage.getDocumentTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const { projectId, values, staffName } = req.body;
    if (!projectId || !values) {
      return res.status(400).json({ message: "projectId and values are required" });
    }

    const fields = await storage.getTemplateFieldsByTemplate(template.id);

    const missingRequired = fields
      .filter((f) => f.required)
      .filter((f) => !values[f.tag] || String(values[f.tag]).trim() === "");
    if (missingRequired.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingRequired.map((f) => f.label).join(", ")}`,
      });
    }

    const resolvedStaffName = staffName && staffName !== "none" ? staffName : "System";

    const templateBuffer = await getTemplateBuffer(template.id, template.storedName);

    let outputBuffer: Buffer;
    const isPdf = template.mimeType === "application/pdf";

    if (isPdf) {
      const pdfDoc = await PDFDocument.load(templateBuffer);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pages = pdfDoc.getPages();

      for (const field of fields) {
        const value = values[field.tag];
        if (!value && value !== 0) continue;

        const pageIdx = (field.page || 1) - 1;
        if (pageIdx >= pages.length) continue;

        const page = pages[pageIdx];
        const { width: pw, height: ph } = page.getSize();

        const x = (field.x / 100) * pw;
        const y = ph - ((field.y / 100) * ph) - (field.fontSize || 12);
        const fontSize = field.fontSize || 12;
        const color = hexToRgb(field.fontColor || "#000000");

        page.drawText(String(value), {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(color.r, color.g, color.b),
        });
      }

      const pdfBytes = await pdfDoc.save();
      outputBuffer = Buffer.from(pdfBytes);
    } else {
      outputBuffer = await new Promise<Buffer>(async (resolve, reject) => {
        let imgWidth = 612;
        let imgHeight = 792;

        try {
          const sizeOf = (await import("image-size")).default;
          const dims = sizeOf(templateBuffer);
          if (dims.width && dims.height) {
            imgWidth = dims.width;
            imgHeight = dims.height;
          }
        } catch {}

        const doc = new PDFDocumentKit({ size: [imgWidth, imgHeight], margin: 0 });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.image(templateBuffer, 0, 0, { width: imgWidth, height: imgHeight });

        for (const field of fields) {
          const value = values[field.tag];
          if (!value && value !== 0) continue;

          const fieldPage = (field.page || 1) - 1;
          if (fieldPage > 0) continue;

          const x = (field.x / 100) * imgWidth;
          const y = (field.y / 100) * imgHeight;
          const fontSize = field.fontSize || 12;
          const fontColor = field.fontColor || "#000000";

          doc.fontSize(fontSize).fillColor(fontColor).text(String(value), x, y, {
            width: (field.width / 100) * imgWidth,
            lineBreak: false,
          });
        }

        doc.end();
      });
    }

    const project = await storage.getProject(projectId);
    const outputName = `${template.name} - ${project?.name || projectId}.pdf`;

    const savedFile = await saveFileLocally(
      projectId,
      template.viewType,
      outputBuffer,
      outputName,
      "application/pdf",
      resolvedStaffName,
      `Generated from template: ${template.name}`
    );

    res.json(savedFile);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});
