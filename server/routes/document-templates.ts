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

    const { projectId, staffName, signatureData, htmlContent } = req.body;
    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }
    if (!htmlContent) {
      return res.status(400).json({ message: "htmlContent is required" });
    }

    const resolvedStaffName = staffName && staffName !== "none" ? staffName : "System";
    const project = await storage.getProject(projectId);
    const outputName = `${template.name} - ${project?.name || projectId}.html`;

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

    const files = req.files as Express.Multer.File[] | undefined;
    const attachmentFiles = (files || []).filter((f) => f.fieldname.startsWith("attachment_"));

    let finalHtml = htmlContent as string;

    for (const attachment of attachmentFiles) {
      const label = attachment.fieldname.replace("attachment_", "").replace(/_/g, " ").toUpperCase();
      const mime = attachment.mimetype.toLowerCase();

      if (mime.startsWith("image/")) {
        const b64 = attachment.buffer.toString("base64");
        const dataUri = `data:${mime};base64,${b64}`;
        const imgHtml = `<div style="page-break-before: always;"></div>
          <h3 style="font-size: 12pt; color: #333; margin-bottom: 0.5em;">${label}</h3>
          <img src="${dataUri}" style="max-width: 100%; max-height: 9in;" />`;
        finalHtml += imgHtml;
      } else if (mime === "application/pdf") {
        const attachName = `${label.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.pdf`;
        const attachFile = await saveFileLocally(
          projectId,
          template.viewType,
          attachment.buffer,
          attachName,
          "application/pdf",
          resolvedStaffName,
          `Attachment for contract: ${label}`
        );
        const attachUrl = `/api/projects/${projectId}/files/${attachFile.id}/download`;
        const embedHtml = `<div style="page-break-before: always;"></div>
          <h3 style="font-size: 12pt; color: #333; margin-bottom: 0.5em;">${label}</h3>
          <p style="margin: 1em 0;"><a href="${attachUrl}" target="_blank" style="color: #4a90d9; text-decoration: underline; font-weight: 600;">Open ${label} (PDF)</a></p>`;
        finalHtml += embedHtml;
      }
    }

    const logoPath = path.resolve(process.cwd(), "client", "public", "sps-logo.png");
    if (existsSync(logoPath)) {
      const logoB64 = readFileSync(logoPath).toString("base64");
      const logoDataUri = `data:image/png;base64,${logoB64}`;
      finalHtml = finalHtml.replace(/src="\/sps-logo\.png"/g, `src="${logoDataUri}"`);
    }

    const fullDocument = buildContractHtmlDocument(finalHtml);
    const htmlBuffer = Buffer.from(fullDocument, "utf-8");

    const savedFile = await saveFileLocally(
      projectId,
      template.viewType,
      htmlBuffer,
      outputName,
      "text/html",
      resolvedStaffName,
      notes
    );

    res.json(savedFile);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

function buildContractHtmlDocument(bodyContent: string): string {
  const pages = bodyContent.split(/<div\s+style\s*=\s*"page-break-before:\s*always;?\s*"[^>]*>\s*<\/div>/gi);
  const pageHtml = pages.map((page) => `<div class="print-page">${page.trim()}</div>`).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contract Document</title>
<style>
  @page {
    margin: 0.75in;
    size: letter;
  }
  @media print {
    body { margin: 0; padding: 0; background: white; }
    .no-print { display: none !important; }
    .print-page {
      width: auto;
      min-height: auto;
      margin: 0;
      padding: 0;
      box-shadow: none;
      page-break-after: always;
    }
    .print-page:last-child { page-break-after: auto; }
  }
  @media screen {
    body {
      background: #e5e7eb;
      margin: 0;
      padding: 0;
    }
    .print-page {
      background: white;
      width: 8.5in;
      min-height: 11in;
      margin: 24px auto;
      padding: 0.75in;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      box-sizing: border-box;
    }
    .print-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #1a1a2e;
      color: white;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .print-toolbar button {
      background: #4a90d9;
      color: white;
      border: none;
      padding: 8px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .print-toolbar button:hover { background: #3a7bc8; }
  }
  body {
    font-family: "Times New Roman", Georgia, "Noto Serif", serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1a1a1a;
  }
  h1 { font-size: 20pt; font-weight: 700; margin: 0.4em 0; }
  h2 { font-size: 13pt; font-weight: 600; margin: 0.5em 0 0.3em 0; text-transform: uppercase; }
  h3 { font-size: 12pt; font-weight: 600; margin: 0.3em 0; }
  p { margin: 0.3em 0; }
  table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
  td, th { padding: 6px 10px; vertical-align: top; }
  hr { border: none; border-top: 2px solid #333; margin: 0.8em 0; }
  ul, ol { padding-left: 1.5em; margin: 0.3em 0; }
  li { margin-bottom: 0.15em; }
  img { max-width: 100%; }
  img[data-align="center"] { display: block; margin-left: auto; margin-right: auto; }
  img[data-align="right"] { display: block; margin-left: auto; margin-right: 0; }
  .merge-field { font-weight: inherit; }
</style>
</head>
<body>
<div class="print-toolbar no-print">
  <span style="font-size: 14px;">Contract Document</span>
  <button onclick="window.print()">Print / Save as PDF</button>
</div>
${pageHtml}
</body>
</html>`;
}

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
