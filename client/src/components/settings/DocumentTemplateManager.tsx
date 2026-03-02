import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Upload, Trash2, Settings2, FileText, ImageIcon, Loader2, PenLine, FilePlus2, Eye, RotateCcw, Archive } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TemplateFieldEditor } from "./TemplateFieldEditor";
import { ContractEditor } from "../contracts/ContractEditor";
import { SOLAR_CONTRACT_TEMPLATE } from "../contracts/solarContractTemplate";

const VIEW_TYPES = [
  { value: "uc", label: "UC Applications" },
  { value: "contracts", label: "Contracts" },
  { value: "rebates", label: "Rebates" },
  { value: "ahj", label: "AHJ / Permitting" },
  { value: "site_visit", label: "Site Visits" },
  { value: "planner", label: "Project Planner" },
  { value: "install", label: "Installation" },
  { value: "payment", label: "Payment" },
  { value: "close_off", label: "Close-off" },
];

interface TemplateListItem {
  id: string;
  name: string;
  viewType: string;
  templateType: string | null;
  fileName: string;
  mimeType: string;
  htmlContent: string | null;
  pageCount: number | null;
  enabled: boolean | null;
  fieldCount: number;
  createdAt: string | null;
  archivedAt: string | null;
}

function getDaysRemaining(archivedAt: string): number {
  const archived = new Date(archivedAt);
  const expiry = new Date(archived);
  expiry.setDate(expiry.getDate() + 120);
  const now = new Date();
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function DocumentTemplateManager() {
  const { toast } = useToast();
  const [filterView, setFilterView] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadViewType, setUploadViewType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingContract, setEditingContract] = useState<{ id: string; name: string; htmlContent: string | null } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createContractOpen, setCreateContractOpen] = useState(false);
  const [contractName, setContractName] = useState("");
  const [contractViewType, setContractViewType] = useState("");
  const [contractStarter, setContractStarter] = useState("solar");
  const [creatingContract, setCreatingContract] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateListItem | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<TemplateListItem[]>({
    queryKey: ["/api/document-templates"],
  });

  const { data: archivedTemplates = [] } = useQuery<TemplateListItem[]>({
    queryKey: ["/api/document-templates/archived"],
    queryFn: async () => {
      const res = await fetch("/api/document-templates/archived/list");
      if (!res.ok) throw new Error("Failed to fetch archived templates");
      return res.json();
    },
  });

  const filtered = filterView === "archived"
    ? archivedTemplates
    : filterView === "all"
      ? templates
      : templates.filter((t) => t.viewType === filterView);

  const handleUpload = async () => {
    if (!uploadFile || !uploadName || !uploadViewType) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("name", uploadName);
      formData.append("viewType", uploadViewType);

      const res = await fetch("/api/document-templates", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }

      toast({ title: "Template uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setUploadOpen(false);
      setUploadName("");
      setUploadViewType("");
      setUploadFile(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiRequest("DELETE", `/api/document-templates/${deleteId}`);
      toast({ title: "Template archived", description: "It will be permanently deleted after 120 days." });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates/archived"] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Delete failed";
      toast({ title: msg, variant: "destructive" });
    }
    setDeleteId(null);
  };

  const handleRestore = async (id: string) => {
    try {
      await apiRequest("POST", `/api/document-templates/${id}/restore`);
      toast({ title: "Template restored" });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates/archived"] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Restore failed";
      toast({ title: msg, variant: "destructive" });
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteId) return;
    try {
      await apiRequest("DELETE", `/api/document-templates/${permanentDeleteId}/permanent`);
      toast({ title: "Template permanently deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates/archived"] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Delete failed";
      toast({ title: msg, variant: "destructive" });
    }
    setPermanentDeleteId(null);
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await apiRequest("PATCH", `/api/document-templates/${id}`, { enabled });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
    } catch {}
  };

  const handleCreateContract = async () => {
    if (!contractName || !contractViewType) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setCreatingContract(true);
    try {
      const starterHtml = contractStarter === "solar" ? SOLAR_CONTRACT_TEMPLATE : "";
      const placeholder = new File([new Uint8Array(0)], "contract.html", { type: "text/html" });
      const formData = new FormData();
      formData.append("file", placeholder);
      formData.append("name", contractName);
      formData.append("viewType", contractViewType);
      formData.append("templateType", "editable");

      const res = await fetch("/api/document-templates", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Creation failed");
      }

      const created = await res.json();

      if (starterHtml) {
        await apiRequest("PATCH", `/api/document-templates/${created.id}`, { htmlContent: starterHtml });
      }

      toast({ title: "Contract template created" });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setCreateContractOpen(false);
      setContractName("");
      setContractViewType("");
      setContractStarter("solar");
      setEditingContract({ id: created.id, name: created.name, htmlContent: starterHtml || null });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Creation failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setCreatingContract(false);
    }
  };

  const viewLabel = (vt: string) => VIEW_TYPES.find((v) => v.value === vt)?.label || vt;

  if (editingTemplate) {
    return (
      <TemplateFieldEditor
        templateId={editingTemplate}
        onClose={() => setEditingTemplate(null)}
      />
    );
  }

  if (editingContract) {
    return (
      <ContractEditor
        templateId={editingContract.id}
        initialContent={editingContract.htmlContent || ""}
        templateName={editingContract.name}
        onClose={() => {
          setEditingContract(null);
          queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filterView === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterView("all")}
            data-testid="filter-all-templates"
          >
            All
          </Button>
          {VIEW_TYPES.map((vt) => (
            <Button
              key={vt.value}
              variant={filterView === vt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterView(vt.value)}
              data-testid={`filter-template-${vt.value}`}
            >
              {vt.label}
            </Button>
          ))}
          <Button
            variant={filterView === "archived" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterView("archived")}
            className={filterView === "archived" ? "" : "border-dashed text-muted-foreground"}
            data-testid="filter-template-archived"
          >
            <Archive className="h-3.5 w-3.5 mr-1.5" />
            Archived
            {archivedTemplates.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                {archivedTemplates.length}
              </Badge>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCreateContractOpen(true)} data-testid="button-create-contract">
            <FilePlus2 className="h-4 w-4 mr-2" />
            Create Contract
          </Button>
          <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-template">
            <Upload className="h-4 w-4 mr-2" />
            Upload Template
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground" data-testid="text-no-templates">
          <p>{filterView === "archived" ? "No archived templates." : "No document templates yet. Upload a PDF or image file to get started."}</p>
        </div>
      ) : filterView === "archived" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const daysLeft = t.archivedAt ? getDaysRemaining(t.archivedAt) : 120;
            return (
              <Card key={t.id} className="opacity-70 border-dashed" data-testid={`card-archived-template-${t.id}`}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {t.templateType === "editable" ? (
                        <PenLine className="h-5 w-5 text-violet-500 shrink-0" />
                      ) : t.mimeType === "application/pdf" ? (
                        <FileText className="h-5 w-5 text-red-500 shrink-0" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-archived-name-${t.id}`}>{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.templateType === "editable" ? "Editable contract" : t.fileName}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={daysLeft <= 14 ? "destructive" : daysLeft <= 30 ? "outline" : "secondary"}
                      className="shrink-0"
                      data-testid={`badge-days-remaining-${t.id}`}
                    >
                      {daysLeft}d left
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{viewLabel(t.viewType)}</Badge>
                    {t.templateType === "editable" && (
                      <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">Contract</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleRestore(t.id)}
                      data-testid={`button-restore-template-${t.id}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPermanentDeleteId(t.id)}
                      data-testid={`button-permanent-delete-${t.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className={t.enabled === false ? "opacity-60" : ""} data-testid={`card-template-${t.id}`}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {t.templateType === "editable" ? (
                      <PenLine className="h-5 w-5 text-violet-500 shrink-0" />
                    ) : t.mimeType === "application/pdf" ? (
                      <FileText className="h-5 w-5 text-red-500 shrink-0" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-template-name-${t.id}`}>{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.templateType === "editable" ? "Editable contract" : t.fileName}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={t.enabled !== false}
                    onCheckedChange={(v) => handleToggleEnabled(t.id, v)}
                    data-testid={`switch-template-enabled-${t.id}`}
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" data-testid={`badge-template-view-${t.id}`}>{viewLabel(t.viewType)}</Badge>
                  {t.templateType === "editable" ? (
                    <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">Contract</Badge>
                  ) : (
                    <Badge variant="secondary">{t.fieldCount} field{t.fieldCount !== 1 ? "s" : ""}</Badge>
                  )}
                  {t.pageCount && t.pageCount > 1 && t.templateType !== "editable" && (
                    <Badge variant="secondary">{t.pageCount} pages</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {t.templateType === "editable" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setEditingContract({ id: t.id, name: t.name, htmlContent: t.htmlContent })}
                        data-testid={`button-edit-contract-${t.id}`}
                      >
                        <PenLine className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewTemplate(t)}
                        data-testid={`button-preview-form-${t.id}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Preview
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditingTemplate(t.id)}
                      data-testid={`button-edit-fields-${t.id}`}
                    >
                      <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                      Configure Fields
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(t.id)}
                    data-testid={`button-delete-template-${t.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document Template</DialogTitle>
            <DialogDescription>
              Upload a PDF or image file to use as a fillable document template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g. UC Application Form"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label>View Type</Label>
              <Select value={uploadViewType} onValueChange={setUploadViewType}>
                <SelectTrigger data-testid="select-template-view-type">
                  <SelectValue placeholder="Select which tab this template belongs to" />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_TYPES.map((vt) => (
                    <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-file">Template File</Label>
              <Input
                id="template-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                data-testid="input-template-file"
              />
              <p className="text-xs text-muted-foreground">Supported: PDF, PNG, JPG (max 10MB)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadName || !uploadViewType} data-testid="button-confirm-upload">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createContractOpen} onOpenChange={setCreateContractOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Contract Template</DialogTitle>
            <DialogDescription>
              Create an editable contract template with a rich text editor. Choose a starter template or start from scratch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contract-name">Contract Name</Label>
              <Input
                id="contract-name"
                placeholder="e.g. Solar Installation Agreement"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                data-testid="input-contract-name"
              />
            </div>
            <div className="space-y-2">
              <Label>View Type</Label>
              <Select value={contractViewType} onValueChange={setContractViewType}>
                <SelectTrigger data-testid="select-contract-view-type">
                  <SelectValue placeholder="Select which tab this contract belongs to" />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_TYPES.map((vt) => (
                    <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Starter Template</Label>
              <Select value={contractStarter} onValueChange={setContractStarter}>
                <SelectTrigger data-testid="select-contract-starter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solar">Solar Installation Contract</SelectItem>
                  <SelectItem value="blank">Blank (start from scratch)</SelectItem>
                </SelectContent>
              </Select>
              {contractStarter === "solar" && (
                <p className="text-xs text-muted-foreground">
                  Includes client info, pricing, payment milestones, Appendix A (terms), Appendix B (scope of work checklist), and signature blocks.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateContractOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateContract} disabled={creatingContract || !contractName || !contractViewType} data-testid="button-confirm-create-contract">
              {creatingContract ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FilePlus2 className="h-4 w-4 mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Template</AlertDialogTitle>
            <AlertDialogDescription>
              This template will be moved to the archive. It can be restored within 120 days before it is permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="button-confirm-delete-template">Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!permanentDeleteId} onOpenChange={(open) => !open && setPermanentDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template and all its configured fields. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} data-testid="button-confirm-permanent-delete">Delete Forever</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Form Preview: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              This is what the form will look like when generating a contract from this template.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {previewTemplate?.htmlContent && (() => {
              const matches = previewTemplate.htmlContent!.match(/\{\{[^}]+\}\}/g) || [];
              const fields = [...new Set(matches)].filter((m) => m !== "{{signature}}");
              const hasSignature = previewTemplate.htmlContent!.includes("{{signature}}");
              return (
                <div className="space-y-4 py-2" data-testid="preview-form-fields">
                  {fields.length > 0 ? (
                    fields.map((field) => {
                      const label = field.replace(/\{\{|\}\}/g, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <div key={field} className="space-y-1">
                          <Label className="text-sm">{label}</Label>
                          <Input
                            placeholder={field}
                            disabled
                            className="bg-muted/30"
                            data-testid={`preview-input-${field.replace(/[{}]/g, "")}`}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      This template has no merge fields.
                    </p>
                  )}

                  <div className="space-y-1 pt-2 border-t">
                    <Label className="text-sm">Prepared By</Label>
                    <Input placeholder="Select staff member (optional)" disabled className="bg-muted/30" />
                  </div>

                  {hasSignature && (
                    <div className="pt-2 border-t">
                      <Label className="text-sm mb-2 block">Electronic Signature</Label>
                      <div className="bg-muted/30 border border-dashed rounded-md p-6 text-center text-sm text-muted-foreground">
                        Signature pad will appear here (draw or type)
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t text-xs text-muted-foreground space-y-1">
                    <p><strong>{fields.length}</strong> merge field{fields.length !== 1 ? "s" : ""} to fill{hasSignature ? " + electronic signature" : ""}</p>
                  </div>
                </div>
              );
            })()}
            {previewTemplate && !previewTemplate.htmlContent && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                This template has no content yet. Edit the contract first to add merge fields.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
