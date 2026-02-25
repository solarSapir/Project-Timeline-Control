import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EscalationDialogProps {
  projectId: string;
  projectName: string;
  viewType: string;
}

export function EscalationDialog({ projectId, projectName, viewType }: EscalationDialogProps) {
  const [open, setOpen] = useState(false);
  const [createdBy, setCreatedBy] = useState("");
  const [issue, setIssue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!createdBy.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!issue.trim()) {
      toast({ title: "Please describe what you're stuck on", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/escalation-tickets", {
        projectId,
        viewType,
        createdBy: createdBy.trim(),
        issue: issue.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Escalation ticket created", description: "A manager will review and respond to your ticket." });
      setOpen(false);
      setCreatedBy("");
      setIssue("");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to create ticket";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950" data-testid={`button-stuck-${projectId}`}>
          <AlertTriangle className="h-3 w-3" />
          I'm Stuck
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
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
            <Label htmlFor="escalationName">Your Name</Label>
            <Input id="escalationName" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} placeholder="Enter your name" data-testid="input-escalation-name" />
          </div>
          <div>
            <Label htmlFor="escalationIssue">What are you stuck on?</Label>
            <Textarea id="escalationIssue" value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Describe the issue, what you've tried, and what help you need from a manager..." rows={4} data-testid="input-escalation-issue" />
          </div>
          <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSubmit} disabled={submitting} data-testid="button-submit-escalation">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
            {submitting ? "Creating Ticket..." : "Create Escalation Ticket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
