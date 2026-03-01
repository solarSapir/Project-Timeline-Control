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
import { Upload, Trash2, Settings2, FileText, ImageIcon, Loader2, PenLine, FilePlus2 } from "lucide-react";
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

  const { data: templates = [], isLoading } = useQuery<TemplateListItem[]>({
    queryKey: ["/api/document-templates"],
  });

  const filtered = filterView === "all"
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
      toast({ title: "Template deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Delete failed";
      toast({ title: msg, variant: "destructive" });
    }
    setDeleteId(null);
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
          <p>No document templates yet. Upload a PDF or image file to get started.</p>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditingContract({ id: t.id, name: t.name, htmlContent: t.htmlContent })}
                      data-testid={`button-edit-contract-${t.id}`}
                    >
                      <PenLine className="h-3.5 w-3.5 mr-1.5" />
                      Edit Contract
                    </Button>
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
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template and all its configured fields. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="button-confirm-delete-template">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
