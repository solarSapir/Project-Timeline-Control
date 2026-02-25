import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, XCircle } from "lucide-react";
import { StaffSelect } from "@/components/shared/StaffSelect";

interface UcRejectionDialogProps {
  projectId: string;
  projectName: string;
  rejectionStatus: string;
  onComplete: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UcRejectionDialog({
  projectId,
  projectName,
  rejectionStatus,
  onComplete,
  open,
  onOpenChange,
}: UcRejectionDialogProps) {
  const [name, setName] = useState("");
  const [rejectionFiles, setRejectionFiles] = useState<File[]>([]);
  const [emailScreenshot, setEmailScreenshot] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setName("");
    setRejectionFiles([]);
    setEmailScreenshot(null);
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!notes.trim()) {
      toast({ title: "Please describe what happened", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, {
        ucStatus: rejectionStatus,
      });

      const allFiles = [...rejectionFiles];
      if (emailScreenshot) allFiles.push(emailScreenshot);

      for (const file of allFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "UC");
        formData.append("uploadedBy", name.trim());
        formData.append("notes", `Rejection file: ${file.name}`);

        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || `Failed to upload ${file.name}`);
        }
      }

      await apiRequest("POST", "/api/uc/complete-action", {
        projectId,
        staffName: name.trim(),
        actionType: "status_change",
        fromStatus: "Submitted",
        toStatus: rejectionStatus,
        notes: notes.trim(),
        hideDays: 0,
      });

      await apiRequest("POST", "/api/escalation-tickets", {
        projectId,
        viewType: "uc",
        createdBy: name.trim(),
        issue: `UC Application Rejected: ${notes.trim()}`,
        status: "open",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/uc/completions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });

      toast({ title: "Rejection recorded", description: "Escalation ticket created for manager review." });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            UC Rejection
          </DialogTitle>
          <DialogDescription>
            Record the rejection for {projectName}. An escalation ticket will be auto-created for manager review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <StaffSelect
            value={name}
            onValueChange={setName}
            id="rejection-name"
            testId="select-rejection-name"
          />
          <div>
            <Label htmlFor="rejection-notes">What happened? (required)</Label>
            <Textarea
              id="rejection-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the rejection reason and any details..."
              rows={4}
              data-testid="input-rejection-notes"
            />
          </div>
          <div>
            <Label htmlFor="rejection-files">Rejection Files</Label>
            <Input
              id="rejection-files"
              type="file"
              multiple
              className="mt-1"
              onChange={(e) => setRejectionFiles(Array.from(e.target.files || []))}
              data-testid="input-rejection-files"
            />
            {rejectionFiles.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {rejectionFiles.map((f, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-rejection-file-${i}`}>
                    <Upload className="h-3 w-3" /> {f.name} ({(f.size / 1024).toFixed(0)} KB)
                  </p>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="rejection-screenshot">Email Screenshot (optional)</Label>
            <Input
              id="rejection-screenshot"
              type="file"
              accept="image/*"
              className="mt-1"
              onChange={(e) => setEmailScreenshot(e.target.files?.[0] || null)}
              data-testid="input-rejection-screenshot"
            />
            {emailScreenshot && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1" data-testid="text-rejection-screenshot">
                <Upload className="h-3 w-3" /> {emailScreenshot.name} ({(emailScreenshot.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
          <Button
            className="w-full"
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="button-submit-rejection"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
            {submitting ? "Recording Rejection..." : "Submit Rejection & Create Escalation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
