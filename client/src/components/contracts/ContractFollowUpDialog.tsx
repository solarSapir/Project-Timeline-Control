import { useState } from "react";
import type { Project, TaskAction } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Upload } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { hoursSince } from "@/utils/dates";
import { isPendingSignature } from "@/utils/stages";
import { StaffSelect } from "@/components/shared/StaffSelect";

interface ContractFollowUpDialogProps {
  project: Project;
  lastFollowUp: TaskAction | null;
}

export function ContractFollowUpDialog({ project, lastFollowUp }: ContractFollowUpDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionDone, setActionDone] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [completedBy, setCompletedBy] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (!isPendingSignature(project.installTeamStage)) return null;

  const lastFollowUpDate = lastFollowUp?.completedAt;
  const hrs = hoursSince(lastFollowUpDate ? String(lastFollowUpDate) : null);
  const needsFollowUp = hrs === null || hrs >= 24;

  const handleSubmit = async () => {
    if (!completedBy.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!actionDone.trim()) {
      toast({ title: "Please describe what has been done", variant: "destructive" });
      return;
    }
    if (!nextSteps.trim()) {
      toast({ title: "Please describe the next steps", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const combinedNotes = `Action Taken:\n${actionDone.trim()}\n\nNext Steps:\n${nextSteps.trim()}`;
      const formData = new FormData();
      formData.append('notes', combinedNotes);
      formData.append('completedBy', completedBy);
      formData.append('viewType', 'contracts');
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }
      const res = await fetch(`/api/projects/${project.id}/follow-up`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to submit follow-up');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/task-actions', 'contracts'] });
      toast({ title: "Contract follow-up posted to Asana timeline" });
      setOpen(false);
      setActionDone("");
      setNextSteps("");
      setCompletedBy("");
      setScreenshot(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {needsFollowUp && (
        <Badge variant="destructive" className="text-xs flex items-center gap-1" data-testid={`badge-followup-needed-${project.id}`}>
          <MessageSquare className="h-3 w-3" />
          Follow-up needed {hrs !== null ? `(${hrs}h since last)` : '(no follow-ups yet)'}
        </Badge>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 text-xs" data-testid={`button-contract-followup-${project.id}`}>
            <MessageSquare className="h-3 w-3 mr-1" />
            Follow Up
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contract Follow-Up - {project.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Contract signature should be followed up every 24 hours. This will post to the Asana project timeline.
            </p>
            {lastFollowUp && (
              <div className="p-2 rounded bg-muted text-xs">
                Last follow-up: {new Date(lastFollowUp.completedAt!).toLocaleString()} by {lastFollowUp.completedBy || 'Unknown'}
                {lastFollowUp.notes && <p className="mt-1 text-muted-foreground">{lastFollowUp.notes}</p>}
              </div>
            )}
            <div>
              <StaffSelect
                value={completedBy}
                onValueChange={setCompletedBy}
                id="contractCompletedBy"
                testId="select-contract-followup-name"
              />
            </div>
            <div>
              <Label htmlFor="contractActionDone">What has been done <span className="text-destructive">*</span></Label>
              <Textarea id="contractActionDone" value={actionDone} onChange={(e) => setActionDone(e.target.value)} placeholder="Describe the action you took..." rows={3} data-testid="input-contract-followup-action-done" />
            </div>
            <div>
              <Label htmlFor="contractNextSteps">Next Steps <span className="text-destructive">*</span></Label>
              <Textarea id="contractNextSteps" value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} placeholder="What needs to happen next?" rows={3} data-testid="input-contract-followup-next-steps" />
            </div>
            <div>
              <Label htmlFor="contractScreenshot">Screenshot (optional)</Label>
              <div className="mt-1">
                <Input id="contractScreenshot" type="file" accept="image/*" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} data-testid="input-contract-followup-screenshot" />
                {screenshot && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Upload className="h-3 w-3" /> {screenshot.name} ({(screenshot.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={submitting || !completedBy.trim() || !actionDone.trim() || !nextSteps.trim()} data-testid="button-submit-contract-followup">
              {submitting ? "Posting to Asana..." : "Submit Follow-Up & Post to Asana"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
