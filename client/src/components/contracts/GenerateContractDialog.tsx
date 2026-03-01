import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Download, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad, type SignatureData } from "./SignaturePad";
import type { Project, StaffMember } from "@shared/schema";

interface TemplateListItem {
  id: string;
  name: string;
  viewType: string;
  templateType: string | null;
  htmlContent: string | null;
  fieldCount: number;
  enabled: boolean | null;
}

interface GeneratedFile {
  id: string;
  fileName: string;
}

const MERGE_MAP: Record<string, (p: Project) => string> = {
  "{{client_name}}": (p) => p.name || "",
  "{{customer_name}}": (p) => p.name || "",
  "{{project_name}}": (p) => p.name || "",
  "{{project_address}}": () => "",
  "{{client_phone}}": () => "",
  "{{client_email}}": () => "",
  "{{address}}": () => "",
  "{{province}}": (p) => (p as any).province || "",
  "{{install_type}}": (p) => (p as any).installType || "",
  "{{project_description}}": () => "",
  "{{payment_method}}": (p) => (p as any).paymentMethod || "",
  "{{contractor_name}}": (p) => (p as any).contractorName || "",
  "{{due_date}}": (p) => (p as any).asanaDueDate || "",
  "{{subtotal}}": () => "",
  "{{hst_rate}}": (p) => {
    const prov = ((p as any).province || "").toLowerCase();
    if (prov === "bc" || prov === "ab" || prov === "sk" || prov === "mb") return "5%";
    if (prov === "on") return "13%";
    if (prov === "ns" || prov === "nb" || prov === "nl" || prov === "pe") return "15%";
    return "13%";
  },
  "{{hst_amount}}": () => "",
  "{{total_price}}": () => "",
  "{{helcim_link}}": () => "",
  "{{date}}": () => new Date().toLocaleDateString("en-CA"),
  "{{rep_name}}": () => "",
  "{{signer_name}}": () => "",
  "{{signer_date}}": () => new Date().toLocaleDateString("en-CA"),
  "{{client_initials}}": () => "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  viewType: string;
}

export function GenerateContractDialog({ open, onOpenChange, project, viewType }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<"select" | "fill" | "sign" | "generating" | "done">("select");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateListItem | null>(null);
  const [mergeValues, setMergeValues] = useState<Record<string, string>>({});
  const [staffName, setStaffName] = useState("");
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [generatedFile, setGeneratedFile] = useState<GeneratedFile | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const { data: templates = [] } = useQuery<TemplateListItem[]>({
    queryKey: ["/api/document-templates"],
    enabled: open,
  });

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
    enabled: open,
  });

  const editableTemplates = templates.filter(
    (t) => t.templateType === "editable" && t.viewType === viewType && t.enabled !== false && t.htmlContent
  );

  useEffect(() => {
    if (!open) {
      setStep("select");
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
      setMergeValues({});
      setStaffName("");
      setSignatureData(null);
      setGeneratedFile(null);
    }
  }, [open]);

  const extractMergeFields = useCallback((html: string): string[] => {
    const matches = html.match(/\{\{[^}]+\}\}/g) || [];
    return [...new Set(matches)].filter((m) => m !== "{{signature}}");
  }, []);

  const handleSelectTemplate = (t: TemplateListItem) => {
    setSelectedTemplateId(t.id);
    setSelectedTemplate(t);

    const fields = extractMergeFields(t.htmlContent || "");
    const initial: Record<string, string> = {};
    for (const field of fields) {
      const getter = MERGE_MAP[field];
      initial[field] = getter ? getter(project) : "";
    }
    setMergeValues(initial);
    setStep("fill");
  };

  const hasSignatureField = selectedTemplate?.htmlContent?.includes("{{signature}}") ?? false;

  const buildFinalHtml = useCallback((overrideSigData?: SignatureData | null) => {
    let html = selectedTemplate?.htmlContent || "";
    const sig = overrideSigData ?? signatureData;

    for (const [key, value] of Object.entries(mergeValues)) {
      html = html.replaceAll(key, value || key);
    }

    if (sig) {
      html = html.replaceAll(
        "{{signature}}",
        `<div style="margin: 10px 0;">
          <img src="${sig.imageDataUrl}" style="max-height: 80px; max-width: 300px;" />
          <div style="font-size: 9pt; color: #666; margin-top: 4px;">
            Electronically signed by ${sig.signerName} on ${new Date(sig.timestamp).toLocaleString("en-CA")}
            <br/>Method: ${sig.method === "drawn" ? "Drawn signature" : "Typed signature"}
          </div>
        </div>`
      );
    } else {
      html = html.replaceAll("{{signature}}", '<div style="border-bottom: 2px solid #000; width: 300px; height: 40px; margin: 10px 0;"></div>');
    }

    return html;
  }, [selectedTemplate, mergeValues, signatureData]);

  const signatureDataRef = useRef<SignatureData | null>(null);
  useEffect(() => { signatureDataRef.current = signatureData; }, [signatureData]);

  const handleGenerate = async (sigData?: SignatureData) => {
    if (!selectedTemplateId || !selectedTemplate) return;
    const activeSigData = sigData || signatureDataRef.current || signatureData;
    setStep("generating");

    try {
      const finalHtml = buildFinalHtml(activeSigData);

      const fullDocument = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { margin: 0.75in; size: letter; }
            body {
              font-family: "Times New Roman", Georgia, serif;
              font-size: 12pt;
              line-height: 1.6;
              color: #1a1a1a;
              margin: 0;
              padding: 0;
            }
            h1 { font-size: 24pt; font-weight: 700; margin: 0.5em 0; }
            h2 { font-size: 18pt; font-weight: 600; margin: 0.4em 0; }
            h3 { font-size: 14pt; font-weight: 600; margin: 0.3em 0; }
            table { border-collapse: collapse; width: 100%; margin: 1em 0; }
            td, th { border: 1px solid #ccc; padding: 0.5em; }
            th { background: #f5f5f5; font-weight: 600; }
            hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
            ul, ol { padding-left: 1.5em; }
            img { max-width: 100%; }
          </style>
        </head>
        <body>${finalHtml}</body>
        </html>
      `;

      const html2pdf = (await import("html2pdf.js")).default;

      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.width = "8.5in";
      iframe.style.height = "11in";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Could not access iframe document");
      iframeDoc.open();
      iframeDoc.write(fullDocument);
      iframeDoc.close();

      await new Promise((r) => setTimeout(r, 500));

      const container = iframeDoc.body;

      const pdfBlob = await html2pdf()
        .from(container)
        .set({
          margin: [0.75, 0.75, 0.75, 0.75],
          filename: "contract.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .outputPdf("blob");

      document.body.removeChild(iframe);

      const formData = new FormData();
      formData.append("pdf", new File([pdfBlob], "contract.pdf", { type: "application/pdf" }));
      formData.append("projectId", project.id);
      formData.append("staffName", staffName && staffName !== "none" ? staffName : "");
      if (activeSigData) {
        formData.append("signatureData", JSON.stringify(activeSigData));
      }

      const res = await fetch(`/api/document-templates/${selectedTemplateId}/generate-contract`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Generation failed");
      }

      const file: GeneratedFile = await res.json();
      setGeneratedFile(file);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "files"] });
      toast({ title: "Contract generated and saved to project files" });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Generation failed";
      toast({ title: msg, variant: "destructive" });
      setStep(signatureData ? "sign" : "fill");
    }
  };

  const mergeFields = selectedTemplate ? extractMergeFields(selectedTemplate.htmlContent || "") : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate Contract</DialogTitle>
          <DialogDescription>
            {step === "select" && "Choose a contract template to generate."}
            {step === "fill" && `Fill in the merge fields for "${selectedTemplate?.name || ""}"`}
            {step === "sign" && "Add your signature to the document."}
            {step === "generating" && "Generating your contract..."}
            {step === "done" && "Contract generated successfully."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === "select" && (
            <div className="space-y-2">
              {editableTemplates.length === 0 ? (
                <div className="py-4 text-center" data-testid="text-no-contract-templates">
                  <p className="text-sm text-muted-foreground">
                    No editable contract templates available for this category.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Create editable templates in Settings to get started.
                  </p>
                </div>
              ) : (
                editableTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    data-testid={`button-select-contract-${t.id}`}
                  >
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">Editable contract template</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {step === "fill" && (
            <div className="space-y-4">
              {mergeFields.length > 0 ? (
                mergeFields.map((field) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-sm">{field.replace(/\{\{|\}\}/g, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</Label>
                    <Input
                      value={mergeValues[field] || ""}
                      onChange={(e) => setMergeValues({ ...mergeValues, [field]: e.target.value })}
                      placeholder={field}
                      data-testid={`input-merge-${field.replace(/[{}]/g, "")}`}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  This template has no merge fields. You can proceed directly.
                </p>
              )}

              <div className="space-y-1 pt-2 border-t">
                <Label className="text-sm">Prepared By</Label>
                <Select value={staffName} onValueChange={setStaffName}>
                  <SelectTrigger data-testid="select-contract-staff">
                    <SelectValue placeholder="Select staff member (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {staffList.filter((s) => s.active !== false).map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === "sign" && (
            <SignaturePad
              onSign={(data) => {
                setSignatureData(data);
                handleGenerate(data);
              }}
              signerName={mergeValues["{{signer_name}}"] || ""}
              initialData={signatureData}
            />
          )}

          {step === "generating" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating your contract PDF...</p>
            </div>
          )}

          {step === "done" && generatedFile && (
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center">
                <p className="font-medium">{generatedFile.fileName}</p>
                <p className="text-sm text-muted-foreground">Saved to project files</p>
                {signatureData && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Signed by {signatureData.signerName} ({signatureData.method}) on {new Date(signatureData.timestamp).toLocaleString("en-CA")}
                  </p>
                )}
              </div>
              <a
                href={`/api/projects/${project.id}/files/${generatedFile.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="gap-2" data-testid="button-download-contract">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </a>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "fill" && (
            <div className="flex items-center gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => { setStep("select"); setSelectedTemplateId(null); setSelectedTemplate(null); }}>
                Back
              </Button>
              <div className="flex items-center gap-2">
                {hasSignatureField ? (
                  <Button onClick={() => setStep("sign")} data-testid="button-proceed-to-sign">
                    Next: Sign Document
                  </Button>
                ) : (
                  <Button onClick={handleGenerate} data-testid="button-generate-contract">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Contract
                  </Button>
                )}
              </div>
            </div>
          )}
          {step === "done" && (
            <Button onClick={() => onOpenChange(false)} data-testid="button-close-contract">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
