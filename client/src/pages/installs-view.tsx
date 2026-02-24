import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Wrench, Calendar as CalendarIcon, Plus, Truck, Zap as ZapIcon, ClipboardCheck, Clock, AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";

function getDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isPermitIssued(ahjStatus: string | null) {
  if (!ahjStatus) return false;
  return ahjStatus.toLowerCase().includes('permit issued');
}

function isAhjComplete(status: string | null) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('permit issued') || s.includes('closed') || s.includes('not required') || s.includes('permit close off');
}

function getExpectedInstallDue(ahjCompletionDate: string | null): string | null {
  if (!ahjCompletionDate) return null;
  const d = new Date(ahjCompletionDate);
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

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
        <Button size="sm" variant="outline" className="h-8 text-xs" data-testid={`button-add-schedule-${projectId}`}>
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
  const [filter, setFilter] = useState("action-needed");
  const { toast } = useToast();

  const { data: projects, isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery<any[]>({
    queryKey: ['/api/install-schedules'],
  });

  const { data: ahjActions } = useQuery<any[]>({
    queryKey: ['/api/task-actions', 'ahj'],
  });

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential')
  );

  const ahjCompletionDates: Record<string, string> = {};
  if (ahjActions) {
    for (const action of ahjActions) {
      if (action.actionType === 'completed' && action.completedAt) {
        const existing = ahjCompletionDates[action.projectId];
        const actionDate = new Date(action.completedAt).toISOString().split('T')[0];
        if (!existing || actionDate < existing) {
          ahjCompletionDates[action.projectId] = actionDate;
        }
      }
    }
  }

  const installViewProjects = installProjects.map((p: any) => {
    const permitDone = isPermitIssued(p.ahjStatus);
    const ahjDone = isAhjComplete(p.ahjStatus);
    const ahjCompDate = ahjCompletionDates[p.id] || null;
    const expectedDue = ahjDone ? getExpectedInstallDue(ahjCompDate) : null;
    const targetDue = p.installDueDate;
    const hasSchedule = (schedules || []).some((s: any) => s.projectId === p.id);

    let isLate = false;
    if (expectedDue && targetDue) {
      isLate = new Date(expectedDue) > new Date(targetDue);
    }

    return {
      ...p,
      permitDone,
      ahjDone,
      ahjCompDate,
      expectedInstallDue: expectedDue,
      targetInstallDue: targetDue,
      isLate,
      hasSchedule,
    };
  });

  const filtered = installViewProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;

    if (filter === "action-needed") return p.permitDone;
    if (filter === "waiting-ahj") return !p.ahjDone;
    if (filter === "late") return p.permitDone && p.isLate;
    if (filter === "overdue") {
      const targetDays = getDaysUntilDue(p.targetInstallDue);
      return p.permitDone && targetDays !== null && targetDays < 0;
    }
    if (filter === "scheduled") return p.hasSchedule;
    return true;
  });

  const sortedFiltered = [...filtered].sort((a: any, b: any) => {
    const aDue = a.expectedInstallDue || a.targetInstallDue;
    const bDue = b.expectedInstallDue || b.targetInstallDue;
    const aDays = getDaysUntilDue(aDue);
    const bDays = getDaysUntilDue(bDue);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  });

  const actionNeededCount = installViewProjects.filter(p => p.permitDone).length;
  const waitingAhjCount = installViewProjects.filter(p => !p.ahjDone).length;
  const lateCount = installViewProjects.filter(p => p.permitDone && p.isLate).length;
  const overdueCount = installViewProjects.filter(p => {
    const targetDays = getDaysUntilDue(p.targetInstallDue);
    return p.permitDone && targetDays !== null && targetDays < 0;
  }).length;
  const scheduledCount = installViewProjects.filter(p => p.hasSchedule).length;

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
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-action-count">
            <Shield className="h-3 w-3 mr-1" />
            Permit Issued: {actionNeededCount}
          </Badge>
          <Badge variant="secondary" data-testid="badge-waiting-count">
            <Clock className="h-3 w-3 mr-1" />
            Waiting AHJ: {waitingAhjCount}
          </Badge>
          {lateCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid="badge-late-count">
              <Clock className="h-3 w-3 mr-1" />
              Running Late: {lateCount}
            </Badge>
          )}
          {overdueCount > 0 && (
            <Badge variant="destructive" data-testid="badge-overdue-count">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Overdue: {overdueCount}
            </Badge>
          )}
          {scheduledCount > 0 && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-scheduled-count">
              <CalendarIcon className="h-3 w-3 mr-1" />
              Scheduled: {scheduledCount}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Projects enter installation coordination when AHJ Status is "Permit Issued". Expected due date is 7 days after AHJ completion. Target due date stays fixed from the project timeline.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-installs" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[260px]" data-testid="select-installs-filter">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({installViewProjects.length})</SelectItem>
            <SelectItem value="action-needed">Permit Issued - Ready ({actionNeededCount})</SelectItem>
            <SelectItem value="waiting-ahj">Waiting on AHJ ({waitingAhjCount})</SelectItem>
            <SelectItem value="late">Running Late ({lateCount})</SelectItem>
            <SelectItem value="overdue">Overdue ({overdueCount})</SelectItem>
            <SelectItem value="scheduled">Has Schedule ({scheduledCount})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedFiltered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{filter === "action-needed" ? "No projects with Permit Issued. AHJ permits need to be issued first." : "No projects match this filter."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedFiltered.map((p: any) => {
            const targetDays = getDaysUntilDue(p.targetInstallDue);
            const expectedDays = getDaysUntilDue(p.expectedInstallDue);
            const isOverdue = p.permitDone && targetDays !== null && targetDays < 0;
            const projSchedules = getProjectSchedules(p.id);

            return (
              <Card
                key={p.id}
                className={isOverdue ? "border-red-300 dark:border-red-800" : p.isLate ? "border-amber-300 dark:border-amber-800" : p.permitDone ? "" : "opacity-70"}
                data-testid={`card-project-${p.id}`}
              >
                <CardContent className="py-3 px-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                        <StatusBadge status={p.ahjStatus} />
                        {p.installTeamStage && (
                          <Badge variant="outline" className="text-xs">{p.installTeamStage}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{p.province || 'No province'}</span>
                        <span className="text-xs text-muted-foreground">UC: {p.ucStatus || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">
                          AHJ: {p.ahjStatus || 'N/A'}
                          {p.permitDone && <CheckCircle2 className="inline h-3 w-3 ml-1 text-green-600" />}
                        </span>
                        <span className="text-xs text-muted-foreground">Site Visit: {p.siteVisitStatus || 'N/A'}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {p.targetInstallDue && (
                          <Badge
                            variant={isOverdue ? "destructive" : "outline"}
                            className="text-xs flex items-center gap-1"
                            data-testid={`badge-target-due-${p.id}`}
                          >
                            <Clock className="h-3 w-3" />
                            Target: {new Date(p.targetInstallDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {isOverdue && ` (${Math.abs(targetDays!)}d overdue)`}
                          </Badge>
                        )}

                        {p.permitDone && p.expectedInstallDue && (
                          <Badge
                            className={`text-xs flex items-center gap-1 ${
                              p.isLate
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                : expectedDays !== null && expectedDays <= 3
                                  ? "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                            data-testid={`badge-expected-due-${p.id}`}
                          >
                            <Clock className="h-3 w-3" />
                            Expected: {new Date(p.expectedInstallDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {expectedDays !== null && (
                              <span>
                                ({expectedDays < 0 ? `${Math.abs(expectedDays)}d overdue` : `${expectedDays}d left`})
                              </span>
                            )}
                            {p.isLate && <span className="font-semibold ml-1">LATE</span>}
                          </Badge>
                        )}

                        {!p.ahjDone && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1 bg-gray-50 dark:bg-gray-900" data-testid={`badge-waiting-ahj-${p.id}`}>
                            <Shield className="h-3 w-3" />
                            Waiting on AHJ permit
                          </Badge>
                        )}

                        {p.ahjDone && p.ahjCompDate && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid={`badge-ahj-done-${p.id}`}>
                            <CheckCircle2 className="h-3 w-3" />
                            AHJ done: {new Date(p.ahjCompDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[180px]">
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
