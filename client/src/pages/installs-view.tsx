import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { Search, Wrench, Calendar as CalendarIcon, Truck, Zap as ZapIcon, ClipboardCheck, Clock, AlertTriangle, CheckCircle2, Shield, Lock } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useProjects } from "@/hooks/use-projects";
import { useWorkflowConfig } from "@/hooks/use-workflow-config";
import { useTaskActions } from "@/hooks/use-task-actions";
import { getDaysUntilDue } from "@/utils/dates";
import { isPermitIssued, isAhjComplete } from "@/utils/stages";
import { areDependenciesMet, getUnmetDependencies, STAGE_COMPLETION_CRITERIA, type WorkflowConfig } from "@/lib/stage-dependencies";
import { STAGE_LABELS, type Project } from "@shared/schema";
import ScheduleDialog from "@/components/installs/ScheduleDialog";
import { useQuery } from "@tanstack/react-query";

const taskIcons: Record<string, typeof Wrench> = {
  "Equipment Arrival": Truck,
  "Disconnect/Reconnect": ZapIcon,
  "Final Inspection": ClipboardCheck,
};

function getExpectedInstallDue(ahjCompletionDate: string | null): string | null {
  if (!ahjCompletionDate) return null;
  const d = new Date(ahjCompletionDate);
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

export default function InstallsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("action-needed");

  const { residentialProjects, isLoading: projectsLoading } = useProjects();
  const { data: schedules, isLoading: schedulesLoading } = useQuery<{ id: string; projectId: string; taskType: string; scheduledDate: string | null; duration: number | null; installerName: string | null; status: string }[]>({ queryKey: ['/api/install-schedules'] });
  const { data: ahjActions } = useTaskActions('ahj');
  const { data: workflowConfigs } = useWorkflowConfig();

  const ahjCompletionDates: Record<string, string> = {};
  if (ahjActions) {
    for (const action of ahjActions) {
      if (action.actionType === 'completed' && action.completedAt) {
        const actionDate = new Date(action.completedAt).toISOString().split('T')[0];
        if (!ahjCompletionDates[action.projectId] || actionDate < ahjCompletionDates[action.projectId]) {
          ahjCompletionDates[action.projectId] = actionDate;
        }
      }
    }
  }

  const depsMetProjects = residentialProjects.filter(p => areDependenciesMet(p, "install_booking", workflowConfigs));
  const waitingDepsProjects = residentialProjects.filter(p => !areDependenciesMet(p, "install_booking", workflowConfigs) && !isAhjComplete(p.ahjStatus));

  const installViewProjects = depsMetProjects.map(p => {
    const permitDone = isPermitIssued(p.ahjStatus);
    const ahjDone = isAhjComplete(p.ahjStatus);
    const ahjCompDate = ahjCompletionDates[p.id] || null;
    const expectedDue = ahjDone ? getExpectedInstallDue(ahjCompDate) : null;
    const targetDue = p.installDueDate;
    const hasSchedule = (schedules || []).some(s => s.projectId === p.id);
    const isLate = expectedDue && targetDue ? new Date(expectedDue) > new Date(targetDue) : false;
    return { ...p, permitDone, ahjDone, ahjCompDate, expectedInstallDue: expectedDue, targetInstallDue: targetDue, isLate, hasSchedule };
  });

  const filtered = installViewProjects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "action-needed") return p.permitDone;
    if (filter === "waiting-ahj") return !p.ahjDone;
    if (filter === "late") return p.permitDone && p.isLate;
    if (filter === "overdue") { const d = getDaysUntilDue(p.targetInstallDue); return p.permitDone && d !== null && d < 0; }
    if (filter === "scheduled") return p.hasSchedule;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aDays = getDaysUntilDue(a.expectedInstallDue || a.targetInstallDue);
    const bDays = getDaysUntilDue(b.expectedInstallDue || b.targetInstallDue);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  });

  const actionNeededCount = installViewProjects.filter(p => p.permitDone).length;
  const waitingAhjCount = installViewProjects.filter(p => !p.ahjDone).length;
  const lateCount = installViewProjects.filter(p => p.permitDone && p.isLate).length;
  const overdueCount = installViewProjects.filter(p => { const d = getDaysUntilDue(p.targetInstallDue); return p.permitDone && d !== null && d < 0; }).length;
  const scheduledCount = installViewProjects.filter(p => p.hasSchedule).length;

  if (projectsLoading || schedulesLoading) {
    return <div className="p-6 space-y-4"><h1 className="text-2xl font-semibold">Installation Coordination</h1>{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-installs-title">Installation Coordination</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-action-count"><Shield className="h-3 w-3 mr-1" />Permit Issued: {actionNeededCount}</Badge>
          <Badge variant="secondary" data-testid="badge-waiting-count"><Clock className="h-3 w-3 mr-1" />Waiting AHJ: {waitingAhjCount}</Badge>
          {lateCount > 0 && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid="badge-late-count"><Clock className="h-3 w-3 mr-1" />Running Late: {lateCount}</Badge>}
          {overdueCount > 0 && <Badge variant="destructive" data-testid="badge-overdue-count"><AlertTriangle className="h-3 w-3 mr-1" />Overdue: {overdueCount}</Badge>}
          {scheduledCount > 0 && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-scheduled-count"><CalendarIcon className="h-3 w-3 mr-1" />Scheduled: {scheduledCount}</Badge>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Projects enter installation coordination when AHJ Status is "Permit Issued". Expected due date is 7 days after AHJ completion.</p>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-installs" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[260px]" data-testid="select-installs-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({installViewProjects.length})</SelectItem>
            <SelectItem value="action-needed">Permit Issued - Ready ({actionNeededCount})</SelectItem>
            <SelectItem value="waiting-ahj">Waiting on AHJ ({waitingAhjCount})</SelectItem>
            <SelectItem value="late">Running Late ({lateCount})</SelectItem>
            <SelectItem value="overdue">Overdue ({overdueCount})</SelectItem>
            <SelectItem value="scheduled">Has Schedule ({scheduledCount})</SelectItem>
            {waitingDepsProjects.length > 0 && <SelectItem value="waiting_deps">Waiting on Dependencies ({waitingDepsProjects.length})</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {filter === "waiting_deps" ? (
        <WaitingDepsSection projects={waitingDepsProjects} search={search} stage="install_booking" configs={workflowConfigs} />
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><p>{filter === "action-needed" ? "No projects with Permit Issued." : "No projects match this filter."}</p></div>
      ) : (
        <div className="space-y-4">
          {sorted.map(p => {
            const targetDays = getDaysUntilDue(p.targetInstallDue);
            const expectedDays = getDaysUntilDue(p.expectedInstallDue);
            const isOverdue = p.permitDone && targetDays !== null && targetDays < 0;
            const projSchedules = (schedules || []).filter(s => s.projectId === p.id);
            return (
              <Card key={p.id} className={isOverdue ? "border-red-300 dark:border-red-800" : p.isLate ? "border-amber-300 dark:border-amber-800" : p.permitDone ? "" : "opacity-70"} data-testid={`card-project-${p.id}`}>
                <CardContent className="py-3 px-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/project/${p.id}`} className="font-medium hover:underline cursor-pointer text-primary" data-testid={`text-project-name-${p.id}`}>{p.name}</Link>
                        <StatusBadge status={p.ahjStatus} />
                        {p.installTeamStage && <Badge variant="outline" className="text-xs">{p.installTeamStage}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{p.province || 'No province'}</span>
                        <span className="text-xs text-muted-foreground">UC: {p.ucStatus || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">AHJ: {p.ahjStatus || 'N/A'}{p.permitDone && <CheckCircle2 className="inline h-3 w-3 ml-1 text-green-600" />}</span>
                        <span className="text-xs text-muted-foreground">Site Visit: {p.siteVisitStatus || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {p.targetInstallDue && <Badge variant={isOverdue ? "destructive" : "outline"} className="text-xs flex items-center gap-1" data-testid={`badge-target-due-${p.id}`}><Clock className="h-3 w-3" />Target: {new Date(p.targetInstallDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{isOverdue && ` (${Math.abs(targetDays!)}d overdue)`}</Badge>}
                        {p.permitDone && p.expectedInstallDue && <Badge className={`text-xs flex items-center gap-1 ${p.isLate ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" : expectedDays !== null && expectedDays <= 3 ? "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"}`} data-testid={`badge-expected-due-${p.id}`}><Clock className="h-3 w-3" />Expected: {new Date(p.expectedInstallDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{expectedDays !== null && <span>({expectedDays < 0 ? `${Math.abs(expectedDays)}d overdue` : `${expectedDays}d left`})</span>}{p.isLate && <span className="font-semibold ml-1">LATE</span>}</Badge>}
                        {!p.ahjDone && <Badge variant="outline" className="text-xs flex items-center gap-1 bg-gray-50 dark:bg-gray-900" data-testid={`badge-waiting-ahj-${p.id}`}><Shield className="h-3 w-3" />Waiting on AHJ permit</Badge>}
                        {p.ahjDone && p.ahjCompDate && <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid={`badge-ahj-done-${p.id}`}><CheckCircle2 className="h-3 w-3" />AHJ done: {new Date(p.ahjCompDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 min-w-[180px]">
                      <ScheduleDialog projectId={p.id} projectName={p.name} />
                      <TaskActionDialog projectId={p.id} projectName={p.name} viewType="installs" />
                    </div>
                  </div>
                  {projSchedules.length > 0 && (
                    <div className="border-t pt-2 space-y-1">
                      {projSchedules.map(s => { const Icon = taskIcons[s.taskType] || Wrench; return (
                        <div key={s.id} className="flex items-center gap-3 text-sm py-1" data-testid={`row-schedule-${s.id}`}>
                          <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-xs min-w-[130px]" data-testid={`text-task-type-${s.id}`}>{s.taskType}</span>
                          <span className="text-xs text-muted-foreground" data-testid={`text-schedule-date-${s.id}`}>{s.scheduledDate ? format(new Date(s.scheduledDate), 'MMM d, yyyy') : 'No date'}</span>
                          {s.duration && <span className="text-xs text-muted-foreground" data-testid={`text-duration-${s.id}`}>({s.duration}d)</span>}
                          {s.installerName && <span className="text-xs text-muted-foreground" data-testid={`text-installer-${s.id}`}>- {s.installerName}</span>}
                          <Badge variant="outline" className="text-xs ml-auto" data-testid={`status-schedule-${s.id}`}>{s.status}</Badge>
                        </div>
                      ); })}
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

function WaitingDepsSection({ projects, search, stage, configs }: { projects: Project[]; search: string; stage: string; configs: WorkflowConfig[] | undefined }) {
  return (
    <div className="space-y-3">
      {projects
        .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
        .map(p => {
          const unmet = getUnmetDependencies(p, stage, configs);
          return (
            <Card key={p.id} className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10" data-testid={`card-waiting-${p.id}`}>
              <CardContent className="p-4">
                <Link href={`/project/${p.id}`}><span className="font-medium text-sm hover:underline cursor-pointer">{p.name}</span></Link>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="outline" className="text-xs flex items-center gap-1 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"><Lock className="h-3 w-3" /> Waiting on dependencies</Badge>
                </div>
                <div className="mt-2 space-y-0.5">
                  {unmet.map(dep => (
                    <p key={dep} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="font-medium">{STAGE_LABELS[dep] || dep}:</span>
                      <span>{STAGE_COMPLETION_CRITERIA[dep]?.label || "Not complete"}</span>
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
