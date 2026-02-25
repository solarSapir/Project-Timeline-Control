import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  viewType: string;
  fieldName: string;
  newStatus: string;
  oldStatus: string;
  extraPatchFields?: Record<string, string>;
  onSuccess?: () => void;
}

export function StatusChangeDialog({
  open, onOpenChange, projectId, projectName,
  viewType, fieldName, newStatus, oldStatus,
  extraPatchFields, onSuccess,
}: StatusChangeDialogProps) {
  const [name, setName] = useState("");
  const [actionDone, setActionDone] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const isValid = name.trim() && actionDone.trim() && nextSteps.trim();

  const resetForm = () => {
    setName("");
    setActionDone("");
    setNextSteps("");
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const patchBody: Record<string, string> = { [fieldName]: newStatus, ...(extraPatchFields || {}) };
      await apiRequest("PATCH", `/api/projects/${projectId}`, patchBody);

      const combinedNotes = `Action Taken:\n${actionDone.trim()}\n\nNext Steps:\n${nextSteps.trim()}`;
      await fetch(`/api/projects/${projectId}/status-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: combinedNotes,
          completedBy: name.trim(),
          viewType,
          fromStatus: oldStatus,
          toStatus: newStatus,
        }),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/uc/completions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rebate/completions"] });
      toast({ title: `Status changed to "${newStatus}" and note posted to Asana` });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const viewLabel = viewType === "uc" ? "UC" : viewType === "payments" ? "Rebate" :
    viewType === "ahj" ? "AHJ" : viewType === "site_visit" ? "Site Visit" :
    viewType === "contracts" ? "Contract" : viewType === "close_off" ? "Close-off" : viewType;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-status-change-title">{viewLabel} Status Change</DialogTitle>
          <DialogDescription>
            Changing status for {projectName} from "{oldStatus || 'None'}" to "{newStatus}".
            Notes are required and will be posted to the Asana timeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="sc-name">Your Name <span className="text-destructive">*</span></Label>
            <Input
              id="sc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              data-testid="input-status-change-name"
            />
          </div>
          <div>
            <Label htmlFor="sc-done">What has been done <span className="text-destructive">*</span></Label>
            <Textarea
              id="sc-done"
              value={actionDone}
              onChange={(e) => setActionDone(e.target.value)}
              placeholder="Describe the action you took..."
              rows={3}
              data-testid="input-status-change-action-done"
            />
          </div>
          <div>
            <Label htmlFor="sc-next">Next Steps <span className="text-destructive">*</span></Label>
            <Textarea
              id="sc-next"
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              placeholder="What needs to happen next?"
              rows={3}
              data-testid="input-status-change-next-steps"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            data-testid="button-submit-status-change"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {submitting ? "Updating..." : "Confirm Status Change & Post to Asana"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
