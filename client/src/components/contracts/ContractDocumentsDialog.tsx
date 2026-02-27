import { useState } from "react";
import type { Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, FileText, FileCheck, Map, CheckCircle2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StaffSelect } from "@/components/shared/StaffSelect";

interface ContractDocumentsDialogProps {
  project: Project;
  hasDocUpload: boolean;
}

export function ContractDocumentsDialog({ project, hasDocUpload }: ContractDocumentsDialogProps) {
  const [open, setOpen] = useState(false);
  const [uploadedBy, setUploadedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [sitePlanFile, setSitePlanFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!uploadedBy.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!contractFile && !proposalFile && !sitePlanFile) {
      toast({ title: "Please select at least one document to upload", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('uploadedBy', uploadedBy);
      formData.append('notes', notes);
      if (contractFile) formData.append('contract', contractFile);
      if (proposalFile) formData.append('proposal', proposalFile);
      if (sitePlanFile) formData.append('sitePlan', sitePlanFile);
      const res = await fetch(`/api/projects/${project.id}/contract-documents`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to upload documents');
      }
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/task-actions', 'contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'files', 'contract'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/contract-file-counts'] });
      toast({ title: `${result.uploaded.length} document(s) uploaded`, description: 'Documents stored and synced — pending review' });
      setOpen(false);
      setUploadedBy("");
      setNotes("");
      setContractFile(null);
      setProposalFile(null);
      setSitePlanFile(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={hasDocUpload ? "outline" : "default"} className="h-8 text-xs w-full" data-testid={`button-upload-docs-${project.id}`}>
          <Upload className="h-3 w-3 mr-1" />
          {hasDocUpload ? "Re-upload Documents" : "Upload Contract Documents"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Contract Documents - {project.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload the contract, proposal, and site plan for review. Files are stored locally and attached to the Client Contract subtask. Once uploaded, the contract will be reviewed and approved before sending via DocuSign.
          </p>
          <div>
            <StaffSelect
              value={uploadedBy}
              onValueChange={setUploadedBy}
              id="docUploadedBy"
              testId="select-doc-uploaded-by"
            />
          </div>
          <div className="space-y-3 border rounded-md p-3 bg-muted/30">
            <div>
              <Label htmlFor="contractFile" className="flex items-center gap-1 text-sm font-medium">
                <FileText className="h-4 w-4" />
                Contract (Word document)
              </Label>
              <Input id="contractFile" type="file" accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={(e) => setContractFile(e.target.files?.[0] || null)} className="mt-1" data-testid="input-contract-file" />
              {contractFile && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" /> {contractFile.name} ({(contractFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="proposalFile" className="flex items-center gap-1 text-sm font-medium">
                <FileCheck className="h-4 w-4" />
                Proposal Used
              </Label>
              {project.plannerProposalUrl && !proposalFile && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Already uploaded from planner (upload to replace)
                </p>
              )}
              <Input id="proposalFile" type="file" accept=".doc,.docx,.pdf,.xls,.xlsx,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={(e) => setProposalFile(e.target.files?.[0] || null)} className="mt-1" data-testid="input-proposal-file" />
              {proposalFile && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" /> {proposalFile.name} ({(proposalFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="sitePlanFile" className="flex items-center gap-1 text-sm font-medium">
                <Map className="h-4 w-4" />
                Latest Site Plan
              </Label>
              {project.plannerSitePlanUrl && !sitePlanFile && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Already uploaded from planner (upload to replace)
                </p>
              )}
              <Input id="sitePlanFile" type="file" accept=".pdf,.dwg,.dxf,image/*,application/pdf" onChange={(e) => setSitePlanFile(e.target.files?.[0] || null)} className="mt-1" data-testid="input-site-plan-file" />
              {sitePlanFile && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" /> {sitePlanFile.name} ({(sitePlanFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="docNotes">Notes (optional)</Label>
            <Textarea id="docNotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about the contract, changes made, or things to review..." data-testid="input-doc-notes" />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={submitting} data-testid="button-submit-docs">
            {submitting ? "Uploading..." : "Upload Documents for Review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
