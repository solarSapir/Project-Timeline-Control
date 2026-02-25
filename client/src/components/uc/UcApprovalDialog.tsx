import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StaffSelect } from "@/components/shared/StaffSelect";

interface UcApprovalDialogProps {
  projectId: string;
  projectName: string;
  onComplete: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UcApprovalDialog({ projectId, projectName, onComplete, open, onOpenChange }: UcApprovalDialogProps) {
  const [name, setName] = useState("");
  const [connectionFee, setConnectionFee] = useState("");
  const [approvalFiles, setApprovalFiles] = useState<File[]>([]);
  const [emailScreenshot, setEmailScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setName("");
    setConnectionFee("");
    setApprovalFiles([]);
    setEmailScreenshot(null);
  };

  const handleApprovalFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setApprovalFiles(Array.from(e.target.files));
    }
  };

  const removeApprovalFile = (index: number) => {
    setApprovalFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!connectionFee.trim()) {
      toast({ title: "Please enter the hydro connection fee", variant: "destructive" });
      return;
    }

    const feeValue = parseFloat(connectionFee.replace(/[^0-9.]/g, ""));
    if (isNaN(feeValue) || feeValue < 0) {
      toast({ title: "Please enter a valid dollar amount", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, {
        ucStatus: "Approved",
        ucConnectionFee: connectionFee.trim(),
      });

      const allFiles = [...approvalFiles];
      if (emailScreenshot) allFiles.push(emailScreenshot);

      for (const file of allFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "UC");
        formData.append("uploadedBy", name.trim());
        formData.append("notes", "UC Approval document");

        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "Failed to upload file");
        }
      }

      await apiRequest("POST", "/api/uc/complete-action", {
        projectId,
        staffName: name.trim(),
        actionType: "status_change",
        toStatus: "Approved",
        hideDays: 14,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/uc/completions"] });

      toast({ title: "UC application marked as Approved" });
      resetForm();
      onOpenChange(false);
      onComplete();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="text-approval-title">UC Approval - {projectName}</DialogTitle>
          <DialogDescription>Record the UC approval details and upload supporting documents.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <StaffSelect
            value={name}
            onValueChange={setName}
            id="approval-name"
            testId="select-approval-name"
          />
          <div>
            <Label htmlFor="approval-fee">Hydro Connection Fee</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                id="approval-fee"
                value={connectionFee}
                onChange={(e) => setConnectionFee(e.target.value)}
                placeholder="0.00"
                className="pl-7"
                data-testid="input-approval-fee"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="approval-files">Upload Approval Files</Label>
            <Input
              id="approval-files"
              type="file"
              multiple
              className="mt-1"
              onChange={handleApprovalFilesChange}
              data-testid="input-approval-files"
            />
            {approvalFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {approvalFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Upload className="h-3 w-3" />
                    <span>{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeApprovalFile(i)}
                      data-testid={`button-remove-file-${i}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="approval-screenshot">Upload Email Screenshot (optional)</Label>
            <Input
              id="approval-screenshot"
              type="file"
              accept="image/*"
              className="mt-1"
              onChange={(e) => setEmailScreenshot(e.target.files?.[0] || null)}
              data-testid="input-approval-screenshot"
            />
            {emailScreenshot && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Upload className="h-3 w-3" /> {emailScreenshot.name} ({(emailScreenshot.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="button-submit-approval"
          >
            {submitting ? "Submitting..." : "Confirm Approval"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
