import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FILE_CATEGORY_LABELS } from "@shared/schema";
import type { Project, StaffMember } from "@shared/schema";

interface TemplateField {
  id: string;
  tag: string;
  label: string;
  fieldType: string;
  options: string | null;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
}

interface TemplateDetail {
  id: string;
  name: string;
  viewType: string;
  fileName: string;
  mimeType: string;
  pageCount: number;
  fields: TemplateField[];
}

interface TemplateListItem {
  id: string;
  name: string;
  viewType: string;
  fileName: string;
  mimeType: string;
  fieldCount: number;
  enabled: boolean | null;
}

interface GeneratedFile {
  id: string;
  fileName: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  viewType: string;
}

function getProjectValue(project: Project, key: string): string {
  const map: Record<string, string> = {
    "project.name": project.name || "",
    "project.province": (project as Record<string, unknown>).province as string || "",
    "project.installType": (project as Record<string, unknown>).installType as string || "",
    "project.paymentMethod": (project as Record<string, unknown>).paymentMethod as string || "",
    "project.contractorName": (project as Record<string, unknown>).contractorName as string || "",
    "project.asanaDueDate": (project as Record<string, unknown>).asanaDueDate as string || "",
  };
  return map[key] || "";
}

export function GenerateDocumentDialog({ open, onOpenChange, project, viewType }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<"select" | "fill" | "done">("select");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [staffName, setStaffName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<GeneratedFile | null>(null);

  const { data: templates = [] } = useQuery<TemplateListItem[]>({
    queryKey: ["/api/document-templates"],
    enabled: open,
  });

  const availableTemplates = templates.filter(
    (t) => t.viewType === viewType && t.enabled !== false && t.fieldCount > 0
  );

  const { data: templateDetail } = useQuery<TemplateDetail>({
    queryKey: ["/api/document-templates", selectedTemplateId],
    enabled: !!selectedTemplateId,
  });

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
    enabled: open,
  });

  useEffect(() => {
    if (templateDetail?.fields) {
      const initial: Record<string, string> = {};
      for (const f of templateDetail.fields) {
        if (f.defaultValue && f.defaultValue !== "none") {
          initial[f.tag] = getProjectValue(project, f.defaultValue);
        } else {
          initial[f.tag] = "";
        }
      }
      setValues(initial);
    }
  }, [templateDetail, project]);

  useEffect(() => {
    if (!open) {
      setStep("select");
      setSelectedTemplateId(null);
      setValues({});
      setStaffName("");
      setGeneratedFile(null);
    }
  }, [open]);

  const sortedFields = templateDetail?.fields
    ? [...templateDetail.fields].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const requiredMissing = sortedFields.some(
    (f) => f.required && !values[f.tag]?.trim()
  );

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    setStep("fill");
  };

  const handleGenerate = async () => {
    if (!selectedTemplateId) return;
    setGenerating(true);
    try {
      const res = await apiRequest("POST", `/api/document-templates/${selectedTemplateId}/generate`, {
        projectId: project.id,
        values,
        staffName: staffName && staffName !== "none" ? staffName : undefined,
      });
      const file: GeneratedFile = await res.json();
      setGeneratedFile(file);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "files"] });
      toast({ title: "Document generated and saved to project files" });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Generation failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Document</DialogTitle>
          <DialogDescription>
            {step === "select" && "Choose a template to generate a filled document."}
            {step === "fill" && `Fill in the fields for "${templateDetail?.name || ""}"`}
            {step === "done" && "Document generated successfully."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {availableTemplates.length === 0 ? (
              <div className="py-4 text-center" data-testid="text-no-templates-available">
                <p className="text-sm text-muted-foreground">
                  No templates available for the "{(FILE_CATEGORY_LABELS as Record<string, string>)[viewType] || viewType}" category.
                </p>
                {(() => {
                  const otherCategories = templates
                    .filter((t) => t.enabled !== false && t.fieldCount > 0 && t.viewType !== viewType)
                    .map((t) => (FILE_CATEGORY_LABELS as Record<string, string>)[t.viewType] || t.viewType);
                  const unique = [...new Set(otherCategories)];
                  if (unique.length > 0) {
                    return (
                      <p className="text-xs text-muted-foreground mt-2">
                        Templates exist for: {unique.join(", ")}. Switch to that tab first.
                      </p>
                    );
                  }
                  return (
                    <p className="text-xs text-muted-foreground mt-2">
                      Add templates in Settings.
                    </p>
                  );
                })()}
              </div>
            ) : (
              availableTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  data-testid={`button-select-template-${t.id}`}
                >
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.fileName}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{t.fieldCount} fields</Badge>
                </button>
              ))
            )}
          </div>
        )}

        {step === "fill" && templateDetail && (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {sortedFields.map((field) => (
              <div key={field.tag} className="space-y-1">
                <Label className="text-sm">
                  {field.label}
                  {field.required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                {field.fieldType === "select" && field.options ? (
                  <Select
                    value={values[field.tag] || ""}
                    onValueChange={(v) => setValues({ ...values, [field.tag]: v })}
                  >
                    <SelectTrigger data-testid={`input-gen-${field.tag}`}>
                      <SelectValue placeholder={`Select ${field.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.split(",").map((opt) => (
                        <SelectItem key={opt.trim()} value={opt.trim()}>{opt.trim()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.fieldType === "date" ? (
                  <Input
                    type="date"
                    value={values[field.tag] || ""}
                    onChange={(e) => setValues({ ...values, [field.tag]: e.target.value })}
                    data-testid={`input-gen-${field.tag}`}
                  />
                ) : field.fieldType === "number" ? (
                  <Input
                    type="number"
                    value={values[field.tag] || ""}
                    onChange={(e) => setValues({ ...values, [field.tag]: e.target.value })}
                    placeholder={field.label}
                    data-testid={`input-gen-${field.tag}`}
                  />
                ) : (
                  <Input
                    value={values[field.tag] || ""}
                    onChange={(e) => setValues({ ...values, [field.tag]: e.target.value })}
                    placeholder={field.label}
                    data-testid={`input-gen-${field.tag}`}
                  />
                )}
              </div>
            ))}

            <div className="space-y-1 pt-2 border-t">
              <Label className="text-sm">Prepared By</Label>
              <Select value={staffName} onValueChange={setStaffName}>
                <SelectTrigger data-testid="select-gen-staff">
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

        {step === "done" && generatedFile && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div className="text-center">
              <p className="font-medium">{generatedFile.fileName}</p>
              <p className="text-sm text-muted-foreground">Saved to project files</p>
            </div>
            <a
              href={`/api/projects/${project.id}/files/${generatedFile.id}/download`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2" data-testid="button-download-generated">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </a>
          </div>
        )}

        <DialogFooter>
          {step === "fill" && (
            <div className="flex items-center gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => { setStep("select"); setSelectedTemplateId(null); }}>
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || requiredMissing}
                data-testid="button-generate-document"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Generate
              </Button>
            </div>
          )}
          {step === "done" && (
            <Button onClick={() => onOpenChange(false)} data-testid="button-close-generate">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
