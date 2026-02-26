import { Router } from "express";
import PDFDocument from "pdfkit";
import { storage } from "../storage";
import { upload } from "../middleware/upload";
import {
  DEFAULT_HRSP_INVOICE_TEMPLATE,
  type HrspInvoiceTemplate,
  type HrspRequiredDocument,
} from "@shared/schema";
import { saveFileLocally, getDownloadUrl } from "../utils/file-storage";
import { uploadAttachmentToTask } from "../asana";

export const hrspInvoiceRouter = Router();

async function getInvoiceTemplate(): Promise<HrspInvoiceTemplate> {
  const config = await storage.getHrspConfig();
  if (config?.invoiceTemplate) {
    return { ...DEFAULT_HRSP_INVOICE_TEMPLATE, ...(config.invoiceTemplate as Partial<HrspInvoiceTemplate>) };
  }
  return DEFAULT_HRSP_INVOICE_TEMPLATE;
}

function buildInvoicePdf(
  tpl: HrspInvoiceTemplate,
  serviceAddress: string,
  quoteDate: string,
  quoteNumber: string,
  options?: { paid?: boolean; installDate?: string }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(14).font("Helvetica-Bold").text(tpl.companyName, 50, 50);
    doc.fontSize(9).font("Helvetica");
    doc.text(tpl.address1, 50, 70);
    doc.text(tpl.address2, 50, 82);
    doc.text(tpl.city, 50, 94);
    doc.text(`Phone: ${tpl.phone}`, 50, 106);
    doc.text(`Email: ${tpl.email}`, 50, 118);

    doc.text(`GST/HST Registration:`, 380, 70);
    doc.text(tpl.gstHst, 380, 82);

    doc.text(`QUOTE: #${quoteNumber}`, 380, 50, { align: "right" });
    doc.text(`Quote Date`, 380, 106);
    doc.text(quoteDate, 380, 118);

    if (options?.paid) {
      doc.save();
      doc.fontSize(28).font("Helvetica-Bold").fillColor("red");
      doc.text("PAID", 420, 130);
      doc.restore();
      doc.fillColor("black");
    }

    doc.moveDown(2);
    const saY = 150;
    doc.fontSize(10).font("Helvetica-Bold").text("Service Address", 50, saY);
    doc.fontSize(9).font("Helvetica").text(serviceAddress, 50, saY + 14, { width: 300 });

    const installDateText = options?.installDate || "TBD";
    doc.text(`Installation Date: ${installDateText}`, 50, saY + 50);

    const tableTop = saY + 80;
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Description", 50, tableTop, { width: 220 });
    doc.text("QTY", 280, tableTop, { width: 50 });
    doc.text("Rate", 400, tableTop, { width: 70 });
    doc.text("Amount", 480, tableTop, { width: 80, align: "right" });
    doc.moveTo(50, tableTop + 14).lineTo(560, tableTop + 14).stroke();

    let y = tableTop + 22;

    doc.font("Helvetica-Bold").fontSize(10).text("Material Costs", 50, y); y += 16;
    doc.font("Helvetica-Bold").fontSize(9).text("Solar Panel Make:", 50, y, { width: 220 });
    doc.font("Helvetica").text(tpl.panelMake, 60, y + 12, { width: 210 });
    doc.text("1", 280, y, { width: 50 });
    doc.text(`$${tpl.panelCost.toFixed(2)}`, 400, y, { width: 70 });
    doc.text(`$${tpl.panelCost.toFixed(2)}`, 480, y, { width: 80, align: "right" });
    y += 24;
    doc.fontSize(8);
    doc.text(`Solar Panel Model: ${tpl.panelModel}`, 60, y); y += 12;
    doc.text(`Solar Panel Size (watt): ${tpl.panelWatt}`, 60, y); y += 12;
    doc.text(`Qty of solar panels (units): ${tpl.panelQty}`, 60, y); y += 12;
    doc.text(`Total Kw DC (watt): ${tpl.totalKwDc}`, 60, y); y += 18;

    doc.font("Helvetica-Bold").fontSize(9).text("Battery Make:", 50, y, { width: 220 });
    doc.font("Helvetica").text(`${tpl.batteryMake} — ${tpl.batteryModel}`, 60, y + 12, { width: 210 });
    doc.text("1", 280, y, { width: 50 });
    doc.text(`$${tpl.batteryCost.toFixed(2)}`, 400, y, { width: 70 });
    doc.text(`$${tpl.batteryCost.toFixed(2)}`, 480, y, { width: 80, align: "right" });
    y += 24;
    doc.fontSize(8);
    doc.text(`Battery size (Kwh): ${tpl.batterySize}`, 60, y); y += 18;

    doc.font("Helvetica-Bold").fontSize(10).text("Labour cost", 50, y); y += 14;
    doc.font("Helvetica").fontSize(9);
    doc.text("PV PORTION", 60, y);
    doc.text("1", 280, y);
    doc.text("$0.00", 480, y, { width: 80, align: "right" }); y += 14;
    doc.text("BATTERY PORTION", 60, y);
    doc.text("1", 280, y);
    doc.text("$0.00", 480, y, { width: 80, align: "right" }); y += 18;

    doc.font("Helvetica-Bold").fontSize(10).text("Other cost", 50, y); y += 14;
    doc.font("Helvetica").fontSize(9);
    doc.text("Electrical engineering", 60, y);
    doc.text("1", 280, y); y += 14;
    doc.text("Utility application, connection costs", 60, y);
    doc.text("1", 280, y);
    doc.text(`$${tpl.otherCost.toFixed(2)}`, 480, y, { width: 80, align: "right" }); y += 20;

    doc.moveTo(50, y).lineTo(560, y).stroke(); y += 8;

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Subtotal", 380, y);
    doc.text(`$${tpl.subtotal.toFixed(2)}`, 480, y, { width: 80, align: "right" }); y += 16;
    doc.text(`HST (ON) ${(tpl.hstRate * 100).toFixed(0)}%`, 380, y);
    doc.text(`$${tpl.hst.toFixed(2)}`, 480, y, { width: 80, align: "right" }); y += 20;

    doc.fontSize(12);
    doc.text("Total", 380, y);
    doc.text(`$${tpl.total.toFixed(2)}`, 480, y, { width: 80, align: "right" }); y += 20;

    doc.fontSize(9).font("Helvetica");
    doc.text(`Total (PV ONLY) Pre tax: $${tpl.pvOnlyPreTax.toFixed(2)}`, 380, y);

    doc.end();
  });
}

hrspInvoiceRouter.get("/hrsp-invoice/sample", async (_req, res) => {
  try {
    const tpl = await getInvoiceTemplate();
    const pdfBuffer = await buildInvoicePdf(tpl, "123 Sample Street\nAnytown, ON A1B 2C3", new Date().toISOString().slice(0, 10), "SAMPLE");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="HRSP_Invoice_SAMPLE.pdf"');
    res.send(pdfBuffer);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

hrspInvoiceRouter.post("/:id/hrsp-invoice", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id as string);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { serviceAddress, quoteDate, quoteNumber } = req.body;
    if (!serviceAddress || !quoteDate || !quoteNumber) {
      return res.status(400).json({ message: "serviceAddress, quoteDate, and quoteNumber are required" });
    }

    const tpl = await getInvoiceTemplate();
    const pdfBuffer = await buildInvoicePdf(tpl, serviceAddress, quoteDate, quoteNumber);
    const fileName = `HRSP_Invoice_${quoteNumber}_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    const savedFile = await saveFileLocally(req.params.id as string, 'rebates', pdfBuffer, fileName, 'application/pdf', undefined, 'HRSP Invoice');
    const localUrl = getDownloadUrl(req.params.id as string, savedFile.id);

    const updated = await storage.updateProject(req.params.id as string, {
      hrspInvoiceUrl: localUrl,
      hrspInvoiceGeneratedAt: new Date(),
      hrspServiceAddress: serviceAddress,
      hrspQuoteNumber: quoteNumber,
      hrspQuoteDate: quoteDate,
    });

    try {
      await storage.createTaskAction({
        projectId: req.params.id as string,
        viewType: "payments",
        actionType: "document_upload",
        completedBy: null,
        notes: `Generated: Invoice (Quote #${quoteNumber})`,
        followUpDate: null,
      });
    } catch { /* non-critical */ }

    res.json({ project: updated, invoiceUrl: localUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[HRSP Invoice] Error:", msg);
    res.status(500).json({ message: msg });
  }
});

hrspInvoiceRouter.post("/:id/hrsp-paid-invoice", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id as string);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { installDate } = req.body;
    if (!installDate) return res.status(400).json({ message: "installDate is required" });
    if (!project.hrspServiceAddress || !project.hrspQuoteNumber || !project.hrspQuoteDate) {
      return res.status(400).json({ message: "Original invoice must be generated first" });
    }

    const tpl = await getInvoiceTemplate();
    const pdfBuffer = await buildInvoicePdf(tpl, project.hrspServiceAddress, project.hrspQuoteDate, project.hrspQuoteNumber, { paid: true, installDate });
    const fileName = `HRSP_PAID_Invoice_${project.hrspQuoteNumber}_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    const savedFile = await saveFileLocally(req.params.id as string, 'rebates', pdfBuffer, fileName, 'application/pdf', undefined, 'HRSP Paid Invoice');
    const localUrl = getDownloadUrl(req.params.id as string, savedFile.id);

    const updated = await storage.updateProject(req.params.id as string, {
      hrspPaidInvoiceUrl: localUrl,
      hrspInstallDate: installDate,
    });

    try {
      await storage.createTaskAction({
        projectId: req.params.id as string,
        viewType: "payments",
        actionType: "document_upload",
        completedBy: null,
        notes: `Generated: Paid Invoice (Install Date: ${installDate})`,
        followUpDate: null,
      });
    } catch { /* non-critical */ }

    res.json({ project: updated, invoiceUrl: localUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[HRSP Paid Invoice] Error:", msg);
    res.status(500).json({ message: msg });
  }
});

hrspInvoiceRouter.get("/:id/hrsp-invoice/download", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id as string);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!project.hrspServiceAddress) return res.status(400).json({ message: "No invoice data found. Generate an invoice first." });

    const tpl = await getInvoiceTemplate();
    const pdfBuffer = await buildInvoicePdf(tpl, project.hrspServiceAddress, project.hrspQuoteDate || "", project.hrspQuoteNumber || "");
    const fileName = `HRSP_Invoice_${project.hrspQuoteNumber || "draft"}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

const DOC_LABELS: Record<string, string> = {
  hrspAuthDocUrl: "Participation Document",
  hrspPowerConsumptionUrl: "Hydro Bill",
  hrspSldUrl: "SLD",
  hrspRoofPicsUrl: "Roof Photos",
  hrspPanelNameplateUrl: "Panel Nameplate",
  hrspInverterNameplateUrl: "Inverter Nameplate",
  hrspBatteryNameplateUrl: "Battery Nameplate",
  hrspEsaCertUrl: "ESA Certificate",
  hrspPaidInvoiceUrl: "Paid Invoice",
};

function createUploadHandler(_endpoint: string, fieldName: string, asanaPrefix: string, projectField: string) {
  return [upload.single(fieldName), async (req: any, res: any) => {
    try {
      const project = await storage.getProject(req.params.id as string);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!req.file) return res.status(400).json({ message: "File is required" });

      const savedFile = await saveFileLocally(req.params.id as string, 'rebates', req.file.buffer, `${asanaPrefix} - ${req.file.originalname}`, req.file.mimetype, undefined, asanaPrefix);
      const localUrl = getDownloadUrl(req.params.id as string, savedFile.id);

      const updateData: Record<string, unknown> = { [projectField]: localUrl };
      if (projectField === "hrspAuthDocUrl") updateData.hrspAuthDocUploadedAt = new Date();

      const updated = await storage.updateProject(req.params.id as string, updateData);

      const docLabel = DOC_LABELS[projectField] || asanaPrefix;
      try {
        await storage.createTaskAction({
          projectId: req.params.id as string,
          viewType: "payments",
          actionType: "document_upload",
          completedBy: null,
          notes: `Uploaded: ${docLabel} (${req.file.originalname})`,
          followUpDate: null,
        });
      } catch (logErr: unknown) {
        console.error("[HRSP Upload Log] Failed to log action:", logErr instanceof Error ? logErr.message : String(logErr));
      }

      res.json({ project: updated, attachmentUrl: localUrl });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[HRSP ${asanaPrefix}] Error:`, msg);
      res.status(500).json({ message: msg });
    }
  }];
}

hrspInvoiceRouter.post("/:id/hrsp-invoice-upload", ...createUploadHandler("hrsp-invoice-upload", "invoice", "HRSP INVOICE", "hrspInvoiceUrl"));
hrspInvoiceRouter.post("/:id/hrsp-paid-invoice-upload", ...createUploadHandler("hrsp-paid-invoice-upload", "paidInvoice", "HRSP PAID INVOICE", "hrspPaidInvoiceUrl"));
hrspInvoiceRouter.post("/:id/hrsp-auth-doc", ...createUploadHandler("hrsp-auth-doc", "authDoc", "HRSP AUTH", "hrspAuthDocUrl"));
hrspInvoiceRouter.post("/:id/hrsp-power-doc", ...createUploadHandler("hrsp-power-doc", "powerDoc", "HRSP POWER CONSUMPTION", "hrspPowerConsumptionUrl"));
hrspInvoiceRouter.post("/:id/hrsp-sld", ...createUploadHandler("hrsp-sld", "sldDoc", "HRSP SLD", "hrspSldUrl"));
hrspInvoiceRouter.post("/:id/hrsp-roof-pics", ...createUploadHandler("hrsp-roof-pics", "roofPics", "HRSP ROOF PHOTOS", "hrspRoofPicsUrl"));
hrspInvoiceRouter.post("/:id/hrsp-panel-nameplate", ...createUploadHandler("hrsp-panel-nameplate", "panelNameplate", "HRSP PANEL NAMEPLATE", "hrspPanelNameplateUrl"));
hrspInvoiceRouter.post("/:id/hrsp-inverter-nameplate", ...createUploadHandler("hrsp-inverter-nameplate", "inverterNameplate", "HRSP INVERTER NAMEPLATE", "hrspInverterNameplateUrl"));
hrspInvoiceRouter.post("/:id/hrsp-battery-nameplate", ...createUploadHandler("hrsp-battery-nameplate", "batteryNameplate", "HRSP BATTERY NAMEPLATE", "hrspBatteryNameplateUrl"));
hrspInvoiceRouter.post("/:id/hrsp-esa-cert", ...createUploadHandler("hrsp-esa-cert", "esaCert", "HRSP ESA CERTIFICATE", "hrspEsaCertUrl"));
