import { useState } from "react";
import type { Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StaffSelect } from "@/components/shared/StaffSelect";

interface ContractReviewFollowUpDialogProps {
  project: Project;
  hideDays: number;
}

export function ContractReviewFollowUpDialog({ project, hideDays }: ContractReviewFollowUpDialogProps) {
  const [open, setOpen] = useState(false);
  const [whatReviewed, setWhatReviewed] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [staffName, setStaffName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!staffName.trim()) {
      toast({ title: "Please select your name", variant: "destructive" });
      return;
    }
    if (!whatReviewed.trim()) {
      toast({ title: "Please describe what was reviewed", variant: "destructive" });
      return;
    }
    if (!nextSteps.trim()) {
      toast({ title: "Please describe the next steps", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const combinedNotes = `Review Follow-Up:\n${whatReviewed.trim()}\n\nNext Steps:\n${nextSteps.trim()}`;
      await apiRequest("POST", "/api/contracts/complete-action", {
        projectId: project.id,
        staffName: staffName.trim(),
        actionType: "follow_up_review",
        fromStatus: null,
        toStatus: null,
        notes: combinedNotes,
        hideDays,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/completions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/kpi-stats'] });
      toast({ title: "Review follow-up recorded" });
      setOpen(false);
      setWhatReviewed("");
      setNextSteps("");
      setStaffName("");
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
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 px-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
          data-testid={`button-review-followup-${project.id}`}
        >
          <Eye className="h-3 w-3" />
          Review Follow-up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contract Review Follow-Up - {project.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This contract reappeared after the review period. Record what was checked and next steps.
          </p>
          <div>
            <StaffSelect
              value={staffName}
              onValueChange={setStaffName}
              id="reviewFollowUpStaff"
              testId="select-review-followup-staff"
            />
          </div>
          <div>
            <Label htmlFor="whatReviewed">What was reviewed <span className="text-destructive">*</span></Label>
            <Textarea id="whatReviewed" value={whatReviewed} onChange={(e) => setWhatReviewed(e.target.value)} placeholder="Describe what documents/details were reviewed..." rows={3} data-testid="input-review-what-reviewed" />
          </div>
          <div>
            <Label htmlFor="reviewNextSteps">Next Steps <span className="text-destructive">*</span></Label>
            <Textarea id="reviewNextSteps" value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} placeholder="What needs to happen next?" rows={3} data-testid="input-review-next-steps" />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={submitting || !staffName.trim() || !whatReviewed.trim() || !nextSteps.trim()} data-testid="button-submit-review-followup">
            {submitting ? "Recording..." : "Submit Review Follow-Up"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
