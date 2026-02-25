import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onConfirm: () => void;
}

export function CloseOffSubmittedDialog({ open, onOpenChange, projectId, projectName, onConfirm }: Props) {
  const [staffName, setStaffName] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!staffName.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!screenshot) {
      toast({ title: "Please upload a screenshot of the submission", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", screenshot);
      formData.append("category", "rebates");
      formData.append("notes", "Close-off submission screenshot");
      formData.append("uploadedBy", staffName.trim());
      await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: formData });

      await apiRequest("POST", "/api/rebate/complete-action", {
        projectId,
        staffName: staffName.trim(),
        actionType: "status_change",
        fromStatus: "Close-off",
        toStatus: "Close-off - Submitted",
        notes: "Submitted close-off with screenshot",
      });

      onConfirm();
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Close-off submission recorded" });
      onOpenChange(false);
      setStaffName("");
      setScreenshot(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) { onOpenChange(false); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close-off Submission - {projectName}</DialogTitle>
          <DialogDescription>
            Upload a screenshot of the close-off submission before changing the status.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="closeoff-staff">Your Name</Label>
            <Input
              id="closeoff-staff"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Enter your name"
              data-testid="input-closeoff-submitted-name"
            />
          </div>
          <div>
            <Label htmlFor="closeoff-screenshot">Submission Screenshot (required)</Label>
            <Input
              id="closeoff-screenshot"
              type="file"
              accept="image/*"
              className="mt-1"
              onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
              data-testid="input-closeoff-submitted-screenshot"
            />
            {screenshot && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Upload className="h-3 w-3" /> {screenshot.name} ({(screenshot.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="button-submit-closeoff-submitted"
          >
            {submitting ? "Uploading..." : "Upload Screenshot & Change Status"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
