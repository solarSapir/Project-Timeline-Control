import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Upload, X, Paperclip } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StaffSelect } from "@/components/shared/StaffSelect";

interface EscalationDialogProps {
  projectId: string;
  projectName: string;
  viewType: string;
}

export function EscalationDialog({ projectId, projectName, viewType }: EscalationDialogProps) {
  const [open, setOpen] = useState(false);
  const [createdBy, setCreatedBy] = useState("");
  const [doneSoFar, setDoneSoFar] = useState("");
  const [stuckOn, setStuckOn] = useState("");
  const [needFromManager, setNeedFromManager] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isValid = createdBy.trim() && doneSoFar.trim() && stuckOn.trim() && needFromManager.trim();

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setCreatedBy("");
    setDoneSoFar("");
    setStuckOn("");
    setNeedFromManager("");
    setFiles([]);
  };

  const handleSubmit = async () => {
    if (!isValid) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const issue = `WHAT HAS BEEN DONE SO FAR:\n${doneSoFar.trim()}\n\nWHAT NEXT STEPS ARE YOU STUCK ON:\n${stuckOn.trim()}\n\nWHAT DO YOU NEED FROM THE MANAGER:\n${needFromManager.trim()}`;

      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("viewType", viewType);
      formData.append("createdBy", createdBy.trim());
      formData.append("issue", issue);
      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch("/api/escalation-tickets", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create ticket");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Escalation ticket created", description: "A manager will review and respond to your ticket." });
      setOpen(false);
      resetForm();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to create ticket";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950" data-testid={`button-stuck-${projectId}`}>
          <AlertTriangle className="h-3 w-3" />
          I'm Stuck
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Escalate Issue
          </DialogTitle>
          <DialogDescription>
            Create an escalation ticket for manager review. This task will be paused for 48 hours while a manager reviews your request.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{projectName}</p>

          <div>
            <StaffSelect
              value={createdBy}
              onValueChange={setCreatedBy}
              id="escalationName"
              testId="select-escalation-name"
            />
          </div>

          <div>
            <Label htmlFor="escalationDoneSoFar">
              What has been done so far <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="escalationDoneSoFar"
              value={doneSoFar}
              onChange={(e) => setDoneSoFar(e.target.value)}
              placeholder="Describe all the steps you've already taken on this project..."
              rows={3}
              data-testid="input-escalation-done-so-far"
            />
          </div>

          <div>
            <Label htmlFor="escalationStuckOn">
              What next steps are you stuck on <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="escalationStuckOn"
              value={stuckOn}
              onChange={(e) => setStuckOn(e.target.value)}
              placeholder="What specific step or task are you unable to move forward on..."
              rows={3}
              data-testid="input-escalation-stuck-on"
            />
          </div>

          <div>
            <Label htmlFor="escalationNeedFromManager">
              What do you need from the manager <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="escalationNeedFromManager"
              value={needFromManager}
              onChange={(e) => setNeedFromManager(e.target.value)}
              placeholder="What decision, information, or action do you need from the manager to unblock this..."
              rows={3}
              data-testid="input-escalation-need-from-manager"
            />
          </div>

          <div>
            <Label className="mb-1.5 block">
              Supporting Documents
              <span className="text-muted-foreground font-normal text-xs ml-1">(screenshots, emails, documents)</span>
            </Label>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xlsx,.csv,.heic"
              className="hidden"
              onChange={handleAddFiles}
              data-testid="input-escalation-files"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 w-full border-dashed"
              onClick={() => fileRef.current?.click()}
              data-testid="button-escalation-add-files"
            >
              <Upload className="h-3.5 w-3.5" />
              Add Screenshots & Documents
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1">
              Include screenshots, error messages, emails, or any documents that will help the manager understand and resolve the issue quickly.
            </p>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5" data-testid={`file-attachment-${i}`}>
                    <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-muted-foreground flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground hover:text-destructive flex-shrink-0"
                      data-testid={`button-remove-file-${i}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            data-testid="button-submit-escalation"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
            {submitting ? "Creating Ticket..." : "Create Escalation Ticket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
