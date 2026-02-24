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
  const [notes, setNotes] = useState("");
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
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('notes', notes);
      formData.append('completedBy', completedBy);
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
      setNotes("");
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
            <Label htmlFor="notes">Follow-up Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you follow up on?" data-testid="input-followup-notes" />
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
