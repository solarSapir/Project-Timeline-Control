import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ScheduleDialogProps {
  projectId: string;
  projectName: string;
}

/** Dialog for adding a schedule item (equipment, install, disconnect, inspection) to a project. */
export default function ScheduleDialog({ projectId, projectName }: ScheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [taskType, setTaskType] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [duration, setDuration] = useState("");
  const [installerName, setInstallerName] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const handleSubmit = async () => {
    try {
      await apiRequest("PUT", "/api/install-schedules", {
        projectId, taskType,
        scheduledDate: scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : null,
        duration: duration ? parseInt(duration) : null,
        installerName, notes, status: "scheduled",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/install-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'install-schedules'] });
      toast({ title: "Schedule item added" });
      setOpen(false);
      setTaskType(""); setScheduledDate(undefined); setDuration(""); setInstallerName(""); setNotes("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs" data-testid={`button-add-schedule-${projectId}`}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Schedule - {projectName}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Task Type</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger data-testid="select-task-type"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Equipment Arrival">Equipment Arrival</SelectItem>
                <SelectItem value="Install Start">Install Start</SelectItem>
                <SelectItem value="Disconnect/Reconnect">Disconnect/Reconnect</SelectItem>
                <SelectItem value="Final Inspection">Final Inspection</SelectItem>
                <SelectItem value="Foundation/Trenching">Foundation/Trenching</SelectItem>
                <SelectItem value="Commissioning">Commissioning</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start" data-testid="button-schedule-date">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, 'PPP') : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} /></PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Duration (days)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="1" data-testid="input-duration" />
          </div>
          <div className="space-y-2">
            <Label>Installer</Label>
            <Input value={installerName} onChange={(e) => setInstallerName(e.target.value)} placeholder="Installer name" data-testid="input-installer" />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..." data-testid="input-schedule-notes" />
          </div>
          <Button onClick={handleSubmit} className="w-full" disabled={!taskType} data-testid="button-submit-schedule">Add to Schedule</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
