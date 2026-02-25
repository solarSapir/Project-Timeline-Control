import { Router } from "express";
import PDFDocument from "pdfkit";
import { storage } from "../storage";
import { uploadAttachmentToTask } from "../asana";
import { upload } from "../middleware/upload";

export const hrspInvoiceRouter = Router();

const COMPANY = {
  name: "Solar Power Store Canada LTD",
  address1: "526 Bryne Dr",
  address2: "Unit C",
  city: "Barrie, ON L4N 9P6",
  phone: "1-888-421-5354",
  email: "accounting@solarpowerstore.ca",
  gstHst: "772144143RT0001",
};

const EQUIPMENT = {
  panelMake: "MAPLE LEAF",
  panelModel: "TS-BGT72(580)",
  panelWatt: 580,
  panelQty: 31,
  totalKwDc: 17980,
  panelCost: 24354.89,
  batteryMake: "FOX ESS",
  batteryModel: "ECS4000-H4",
  batterySize: "12Kwh",
  batteryCost: 10638.97,
  otherCost: 1000,
  subtotal: 35993.86,
  hstRate: 0.13,
  hst: 4679.20,
  total: 40673.06,
  pvOnlyPreTax: 29610.48,
};

function buildInvoicePdf(serviceAddress: string, quoteDate: string, quoteNumber: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(14).font("Helvetica-Bold").text(COMPANY.name, 50, 50);
    doc.fontSize(9).font("Helvetica");
    doc.text(COMPANY.address1, 50, 70);
    doc.text(COMPANY.address2, 50, 82);
    doc.text(COMPANY.city, 50, 94);
    doc.text(`Phone: ${COMPANY.phone}`, 50, 106);
    doc.text(`Email: ${COMPANY.email}`, 50, 118);

    doc.text(`GST/HST Registration:`, 380, 70);
    doc.text(COMPANY.gstHst, 380, 82);

    doc.text(`QUOTE: #${quoteNumber}`, 380, 50, { align: "right" });
    doc.text(`Quote Date`, 380, 106);
    doc.text(quoteDate, 380, 118);

    doc.moveDown(2);
    const saY = 150;
    doc.fontSize(10).font("Helvetica-Bold").text("Service Address", 50, saY);
    doc.fontSize(9).font("Helvetica").text(serviceAddress, 50, saY + 14, { width: 300 });

    doc.text("Installation Date: TBD", 50, saY + 50);

    const tableTop = saY + 80;
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Description", 50, tableTop, { width: 220 });
    doc.text("QTY", 280, tableTop, { width: 50 });
    doc.text("Rate", 400, tableTop, { width: 70 });
    doc.text("Amount", 480, tableTop, { width: 80, align: "right" });

    doc.moveTo(50, tableTop + 14).lineTo(560, tableTop + 14).stroke();

    let y = tableTop + 22;
    const row = (label: string, detail: string, qty: string, rate: string, amount: string) => {
      doc.font("Helvetica-Bold").fontSize(9).text(label, 50, y, { width: 220 });
      if (detail) {
        y += 12;
        doc.font("Helvetica").text(detail, 60, y, { width: 210 });
      }
      doc.font("Helvetica").text(qty, 280, y - (detail ? 12 : 0), { width: 50 });
      doc.text(rate, 400, y - (detail ? 12 : 0), { width: 70 });
      doc.text(amount, 480, y - (detail ? 12 : 0), { width: 80, align: "right" });
      y += 18;
    };

    doc.font("Helvetica-Bold").fontSize(10).text("Material Costs", 50, y);
    y += 16;

    row("Solar Panel Make:", EQUIPMENT.panelMake, "1", `$${EQUIPMENT.panelCost.toFixed(2)}`, `$${EQUIPMENT.panelCost.toFixed(2)}`);
    doc.font("Helvetica").fontSize(8);
    doc.text(`Solar Panel Model: ${EQUIPMENT.panelModel}`, 60, y); y += 12;
    doc.text(`Solar Panel Size (watt): ${EQUIPMENT.panelWatt}`, 60, y); y += 12;
    doc.text(`Qty of solar panels (units): ${EQUIPMENT.panelQty}`, 60, y); y += 12;
    doc.text(`Total Kw DC (watt): ${EQUIPMENT.totalKwDc}`, 60, y); y += 18;

    row("Battery Make:", `${EQUIPMENT.batteryMake} — ${EQUIPMENT.batteryModel}`, "1", `$${EQUIPMENT.batteryCost.toFixed(2)}`, `$${EQUIPMENT.batteryCost.toFixed(2)}`);
    doc.font("Helvetica").fontSize(8);
    doc.text(`Battery size (Kwh): ${EQUIPMENT.batterySize}`, 60, y); y += 18;

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
    doc.text("1", 280, y);
    y += 14;
    doc.text("Utility application, connection costs", 60, y);
    doc.text("1", 280, y);
    doc.text(`$${EQUIPMENT.otherCost.toFixed(2)}`, 480, y, { width: 80, align: "right" }); y += 20;

    doc.moveTo(50, y).lineTo(560, y).stroke(); y += 8;

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Subtotal", 380, y);
    doc.text(`$${EQUIPMENT.subtotal.toFixed(2)}`, 480, y, { width: 80, align: "right" }); y += 16;
    doc.text("HST (ON) 13%", 380, y);
    doc.text(`$${EQUIPMENT.hst.toFixed(2)}`, 480, y, { width: 80, align: "right" }); y += 20;

    doc.fontSize(12);
    doc.text("Total", 380, y);
    doc.text(`$${EQUIPMENT.total.toFixed(2)}`, 480, y, { width: 80, align: "right" }); y += 20;

    doc.fontSize(9).font("Helvetica");
    doc.text(`Total (PV ONLY) Pre tax: $${EQUIPMENT.pvOnlyPreTax.toFixed(2)}`, 380, y);

    doc.end();
  });
}

hrspInvoiceRouter.post("/:id/hrsp-invoice", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id as string);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { serviceAddress, quoteDate, quoteNumber } = req.body;
    if (!serviceAddress || !quoteDate || !quoteNumber) {
      return res.status(400).json({ message: "serviceAddress, quoteDate, and quoteNumber are required" });
    }

    const pdfBuffer = await buildInvoicePdf(serviceAddress, quoteDate, quoteNumber);
    const fileName = `HRSP_Invoice_${quoteNumber}_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    let viewUrl = "generated";
    if (project.asanaGid) {
      try {
        const result = await uploadAttachmentToTask(project.asanaGid, pdfBuffer, fileName, "application/pdf");
        const attachmentData = (result as Record<string, unknown>).data || result;
        const data = attachmentData as Record<string, unknown>;
        viewUrl = (data.view_url || data.download_url || data.permanent_url || "generated") as string;
      } catch (uploadErr: unknown) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        console.warn(`[HRSP Invoice] Asana upload failed: ${msg}`);
      }
    }

    const updated = await storage.updateProject(req.params.id as string, {
      hrspInvoiceUrl: viewUrl,
      hrspInvoiceGeneratedAt: new Date(),
      hrspServiceAddress: serviceAddress,
      hrspQuoteNumber: quoteNumber,
      hrspQuoteDate: quoteDate,
    });

    res.json({ project: updated, invoiceUrl: viewUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[HRSP Invoice] Error:", msg);
    res.status(500).json({ message: msg });
  }
});

hrspInvoiceRouter.get("/:id/hrsp-invoice/download", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id as string);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { serviceAddress, quoteDate, quoteNumber } = project.hrspServiceAddress
      ? { serviceAddress: project.hrspServiceAddress, quoteDate: project.hrspQuoteDate || "", quoteNumber: project.hrspQuoteNumber || "" }
      : { serviceAddress: "", quoteDate: "", quoteNumber: "" };

    if (!serviceAddress) return res.status(400).json({ message: "No invoice data found. Generate an invoice first." });

    const pdfBuffer = await buildInvoicePdf(serviceAddress, quoteDate, quoteNumber);
    const fileName = `HRSP_Invoice_${quoteNumber}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: msg });
  }
});

hrspInvoiceRouter.post("/:id/hrsp-auth-doc", upload.single("authDoc"), async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id as string);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });
    if (!req.file) return res.status(400).json({ message: "File is required" });

    const result = await uploadAttachmentToTask(
      project.asanaGid,
      req.file.buffer,
      `HRSP AUTH - ${req.file.originalname}`,
      req.file.mimetype
    );

    const attachmentData = (result as Record<string, unknown>).data || result;
    const data = attachmentData as Record<string, unknown>;
    const viewUrl = (data.view_url || data.download_url || data.permanent_url || "uploaded") as string;

    const updated = await storage.updateProject(req.params.id as string, {
      hrspAuthDocUrl: viewUrl,
      hrspAuthDocUploadedAt: new Date(),
    });

    res.json({ project: updated, attachmentUrl: viewUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[HRSP Auth Doc] Error:", msg);
    res.status(500).json({ message: msg });
  }
});

hrspInvoiceRouter.post("/:id/hrsp-power-doc", upload.single("powerDoc"), async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id as string);
    if (!project || !project.asanaGid) return res.status(404).json({ message: "Project not found or no Asana link" });
    if (!req.file) return res.status(400).json({ message: "File is required" });

    const result = await uploadAttachmentToTask(
      project.asanaGid,
      req.file.buffer,
      `HRSP POWER CONSUMPTION - ${req.file.originalname}`,
      req.file.mimetype
    );

    const attachmentData = (result as Record<string, unknown>).data || result;
    const data = attachmentData as Record<string, unknown>;
    const viewUrl = (data.view_url || data.download_url || data.permanent_url || "uploaded") as string;

    const updated = await storage.updateProject(req.params.id as string, {
      hrspPowerConsumptionUrl: viewUrl,
    });

    res.json({ project: updated, attachmentUrl: viewUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[HRSP Power Doc] Error:", msg);
    res.status(500).json({ message: msg });
  }
});
