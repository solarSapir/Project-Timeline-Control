import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Upload } from "lucide-react";
import type { Project } from "@shared/schema";

export function FollowUpDialog({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [actionDone, setActionDone] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [completedBy, setCompletedBy] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (project.ucStatus?.toLowerCase() !== 'submitted') return null;

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
      formData.append('viewType', 'uc');
      if (screenshot) formData.append('screenshot', screenshot);

      const res = await fetch(`/api/projects/${project.id}/follow-up`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to submit follow-up');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/task-actions'] });
      toast({ title: "Follow-up posted to Asana timeline" });
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" data-testid={`button-followup-${project.id}`}>
          <MessageSquare className="h-3 w-3" />
          Follow Up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>UC Follow-Up - {project.name}</DialogTitle>
          <DialogDescription>Post a follow-up note to the Asana project timeline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {project.ucSubmittedDate && (
            <p className="text-sm text-muted-foreground">
              Submitted on {new Date(project.ucSubmittedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {project.ucSubmittedBy && ` by ${project.ucSubmittedBy}`}
            </p>
          )}
          <div>
            <Label htmlFor="completedBy">Your Name</Label>
            <Input id="completedBy" value={completedBy} onChange={(e) => setCompletedBy(e.target.value)} placeholder="Enter your name" data-testid="input-followup-name" />
          </div>
          <div>
            <Label htmlFor="actionDone">What has been done</Label>
            <Textarea id="actionDone" value={actionDone} onChange={(e) => setActionDone(e.target.value)} placeholder="Describe the action you took for this task..." rows={3} data-testid="input-followup-action-done" />
          </div>
          <div>
            <Label htmlFor="nextSteps">Next Steps</Label>
            <Textarea id="nextSteps" value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} placeholder="What needs to happen next?" rows={3} data-testid="input-followup-next-steps" />
          </div>
          <div>
            <Label htmlFor="screenshot">Screenshot (optional)</Label>
            <Input id="screenshot" type="file" accept="image/*" className="mt-1" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} data-testid="input-followup-screenshot" />
            {screenshot && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Upload className="h-3 w-3" /> {screenshot.name} ({(screenshot.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={submitting} data-testid="button-submit-followup">
            {submitting ? "Posting to Asana..." : "Submit Follow-Up & Post to Asana"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
