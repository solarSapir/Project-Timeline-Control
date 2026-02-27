import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Paperclip, X } from "lucide-react";
import { StaffSelect } from "@/components/shared/StaffSelect";

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
  requireFile?: boolean;
  requireFileLabel?: string;
}

export function StatusChangeDialog({
  open, onOpenChange, projectId, projectName,
  viewType, fieldName, newStatus, oldStatus,
  extraPatchFields, onSuccess, requireFile, requireFileLabel,
}: StatusChangeDialogProps) {
  const [name, setName] = useState("");
  const [actionDone, setActionDone] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const hasRequiredFile = !requireFile || files.length > 0;
  const isValid = name.trim() && actionDone.trim() && nextSteps.trim() && hasRequiredFile;

  const resetForm = () => {
    setName("");
    setActionDone("");
    setNextSteps("");
    setFiles([]);
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const patchBody: Record<string, string> = { [fieldName]: newStatus, ...(extraPatchFields || {}) };
      await apiRequest("PATCH", `/api/projects/${projectId}`, patchBody);

      const combinedNotes = `Action Taken:\n${actionDone.trim()}\n\nNext Steps:\n${nextSteps.trim()}`;

      const formData = new FormData();
      formData.append('notes', combinedNotes);
      formData.append('completedBy', name.trim());
      formData.append('viewType', viewType);
      formData.append('fromStatus', oldStatus);
      formData.append('toStatus', newStatus);
      files.forEach(f => formData.append('files', f));

      const res = await fetch(`/api/projects/${projectId}/status-note`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: 'Failed to post note' }));
        throw new Error(data.message || 'Failed to post note');
      }

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
            <StaffSelect
              value={name}
              onValueChange={setName}
              id="sc-name"
              testId="select-status-change-name"
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
          <div>
            <Label className="mb-1.5 block">
              {requireFile ? (requireFileLabel || "Screenshot Proof") : "Supporting Documents"}
              {requireFile ? (
                <span className="text-destructive ml-1">*</span>
              ) : (
                <span className="text-muted-foreground font-normal text-xs ml-1">(optional)</span>
              )}
            </Label>
            {requireFile && files.length === 0 && (
              <p className="text-xs text-destructive mb-1.5">
                A screenshot is required to confirm this submission.
              </p>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xlsx,.csv,.heic"
              className="hidden"
              onChange={handleAddFiles}
              data-testid="input-status-change-files"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`h-8 text-xs gap-1.5 w-full border-dashed ${requireFile && files.length === 0 ? "border-destructive text-destructive" : ""}`}
              onClick={() => fileRef.current?.click()}
              data-testid="button-status-change-add-files"
            >
              <Upload className="h-3.5 w-3.5" />
              {requireFile ? "Upload Submission Screenshot" : "Add Screenshots & Documents"}
            </Button>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5" data-testid={`sc-file-${i}`}>
                    <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-muted-foreground flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0" data-testid={`button-remove-sc-file-${i}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
