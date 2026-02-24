import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Wrench, Calendar as CalendarIcon, Plus, Truck, Zap as ZapIcon, ClipboardCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";

function ScheduleDialog({ projectId, projectName }: { projectId: string; projectName: string }) {
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
        projectId,
        taskType,
        scheduledDate: scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : null,
        duration: duration ? parseInt(duration) : null,
        installerName,
        notes,
        status: "scheduled",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/install-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'install-schedules'] });
      toast({ title: "Schedule item added" });
      setOpen(false);
      setTaskType("");
      setScheduledDate(undefined);
      setDuration("");
      setInstallerName("");
      setNotes("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`button-add-schedule-${projectId}`}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Schedule - {projectName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Task Type</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger data-testid="select-task-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
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
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} />
              </PopoverContent>
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
          <Button onClick={handleSubmit} className="w-full" disabled={!taskType} data-testid="button-submit-schedule">
            Add to Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const taskIcons: Record<string, any> = {
  "Equipment Arrival": Truck,
  "Disconnect/Reconnect": ZapIcon,
  "Final Inspection": ClipboardCheck,
};

export default function InstallsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const { toast } = useToast();

  const { data: projects, isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery<any[]>({
    queryKey: ['/api/install-schedules'],
  });

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install'
  );

  const readyForInstall = (p: any) => {
    const ucDone = ["Approved", "Complete", "Not Required"].includes(p.ucStatus || '');
    const ahjDone = ["Approved", "Complete"].includes(p.ahjStatus || '');
    return ucDone && ahjDone;
  };

  const filtered = installProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "active") return readyForInstall(p);
    if (filter === "scheduled") {
      const hasSchedule = (schedules || []).some((s: any) => s.projectId === p.id);
      return hasSchedule;
    }
    return true;
  });

  const getProjectSchedules = (projectId: string) => {
    return (schedules || []).filter((s: any) => s.projectId === projectId);
  };

  if (projectsLoading || schedulesLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Installation Coordination</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-installs-title">Installation Coordination</h1>
        <Badge variant="outline" data-testid="badge-project-count">{filtered.length} projects</Badge>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-installs" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-installs-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Ready for Install</SelectItem>
            <SelectItem value="scheduled">Has Schedule</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No projects match this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((p: any) => {
            const projSchedules = getProjectSchedules(p.id);
            return (
              <Card key={p.id} data-testid={`card-project-${p.id}`}>
                <CardContent className="py-4 px-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.province || ''} - UC: {p.ucStatus || 'N/A'} - AHJ: {p.ahjStatus || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ScheduleDialog projectId={p.id} projectName={p.name} />
                      <TaskActionDialog projectId={p.id} projectName={p.name} viewType="installs" />
                    </div>
                  </div>
                  {projSchedules.length > 0 && (
                    <div className="border-t pt-2 space-y-1">
                      {projSchedules.map((s: any) => {
                        const Icon = taskIcons[s.taskType] || Wrench;
                        return (
                          <div key={s.id} className="flex items-center gap-3 text-sm py-1" data-testid={`row-schedule-${s.id}`}>
                            <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium text-xs min-w-[130px]" data-testid={`text-task-type-${s.id}`}>{s.taskType}</span>
                            <span className="text-xs text-muted-foreground" data-testid={`text-schedule-date-${s.id}`}>
                              {s.scheduledDate ? format(new Date(s.scheduledDate), 'MMM d, yyyy') : 'No date'}
                            </span>
                            {s.duration && <span className="text-xs text-muted-foreground" data-testid={`text-duration-${s.id}`}>({s.duration}d)</span>}
                            {s.installerName && <span className="text-xs text-muted-foreground" data-testid={`text-installer-${s.id}`}>- {s.installerName}</span>}
                            <Badge variant="outline" className="text-xs ml-auto" data-testid={`status-schedule-${s.id}`}>{s.status}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
