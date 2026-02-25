import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StaffSelect } from "@/components/shared/StaffSelect";

interface TaskActionDialogProps {
  projectId: string;
  projectName: string;
  viewType: string;
  onComplete?: () => void;
}

export function TaskActionDialog({ projectId, projectName, viewType, onComplete }: TaskActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [completedBy, setCompletedBy] = useState("");
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/task-actions", {
        projectId,
        viewType,
        actionType: needsFollowUp ? "follow_up" : "completed",
        completedBy: completedBy || "Staff",
        followUpDate: followUpDate ? format(followUpDate, 'yyyy-MM-dd') : null,
        notes,
      });
      toast({ title: needsFollowUp ? "Follow-up scheduled" : "Task completed" });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/task-actions'] });
      setOpen(false);
      setNotes("");
      setCompletedBy("");
      setFollowUpDate(undefined);
      setNeedsFollowUp(false);
      onComplete?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`button-complete-${projectId}`}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
          Complete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Task - {projectName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <StaffSelect
              value={completedBy}
              onValueChange={setCompletedBy}
              testId="select-completed-by"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this task..."
              data-testid="input-task-notes"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="needsFollowUp"
              checked={needsFollowUp}
              onChange={(e) => setNeedsFollowUp(e.target.checked)}
              className="h-4 w-4"
              data-testid="checkbox-follow-up"
            />
            <Label htmlFor="needsFollowUp">Needs follow-up</Label>
          </div>
          {needsFollowUp && (
            <div className="space-y-2">
              <Label>Follow-up Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-follow-up-date">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {followUpDate ? format(followUpDate, 'PPP') : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={followUpDate}
                    onSelect={setFollowUpDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          <Button onClick={handleSubmit} disabled={submitting} className="w-full" data-testid="button-submit-action">
            {submitting ? "Saving..." : needsFollowUp ? "Schedule Follow-up" : "Mark Complete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
