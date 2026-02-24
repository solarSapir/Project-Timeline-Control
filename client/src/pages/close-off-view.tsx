import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, CheckCircle2, Mail, Camera, FileText, CalendarClock, AlertTriangle, Clock, Lock } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/use-projects";
import { useWorkflowConfig } from "@/hooks/use-workflow-config";
import { getDaysUntilDue } from "@/utils/dates";
import { areDependenciesMet, getUnmetDependencies, STAGE_COMPLETION_CRITERIA } from "@/lib/stage-dependencies";
import { STAGE_LABELS } from "@shared/schema";
import type { Project } from "@shared/schema";

function getCloseOffDueDate(project: Project): string | null {
  if (!project.installStartDate) return project.closeOffDueDate || null;
  const d = new Date(project.installStartDate);
  d.setDate(d.getDate() + 14);
  return d.toISOString().split('T')[0];
}

function isFullyComplete(p: Project): boolean {
  return !!(p.ucStatus?.toLowerCase().includes('closed') && p.ahjStatus?.toLowerCase().includes('closed') && p.finalPaymentCollected);
}

export default function CloseOffView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();

  const { allProjects, isLoading } = useProjects();
  const { data: workflowConfigs } = useWorkflowConfig();

  const allCloseOff = allProjects.filter(p =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
    p.pmStatus?.toLowerCase() === 'close-off'
  );

  const closeOffProjects = allCloseOff.filter(p => areDependenciesMet(p, "close_off", workflowConfigs));
  const waitingDepsProjects = allCloseOff.filter(p => !areDependenciesMet(p, "close_off", workflowConfigs));

  const filtered = closeOffProjects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    const daysLeft = getDaysUntilDue(getCloseOffDueDate(p));
    if (filter === "overdue") return daysLeft !== null && daysLeft < 0 && !isFullyComplete(p);
    if (filter === "pending") return !isFullyComplete(p);
    if (filter === "completed") return isFullyComplete(p);
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (isFullyComplete(a) !== isFullyComplete(b)) return isFullyComplete(a) ? 1 : -1;
    const ad = getDaysUntilDue(getCloseOffDueDate(a)), bd = getDaysUntilDue(getCloseOffDueDate(b));
    return (ad ?? 999) - (bd ?? 999);
  });

  const pendingCount = closeOffProjects.filter(p => !isFullyComplete(p)).length;
  const completedCount = closeOffProjects.filter(isFullyComplete).length;
  const overdueCount = closeOffProjects.filter(p => { const d = getDaysUntilDue(getCloseOffDueDate(p)); return d !== null && d < 0 && !isFullyComplete(p); }).length;

  const handleSetCloseOff = async (projectId: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { ucStatus: "Closed", ahjStatus: "Closed" });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Project set to close-off status in Asana" });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : 'Unknown error', variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-6 space-y-4"><h1 className="text-2xl font-semibold">Close-off</h1>{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-close-off-title">Close-off</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-total-count">Total: {closeOffProjects.length}</Badge>
          {pendingCount > 0 && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid="badge-pending-count"><Clock className="h-3 w-3 mr-1" />Pending: {pendingCount}</Badge>}
          {overdueCount > 0 && <Badge variant="destructive" data-testid="badge-overdue-count"><AlertTriangle className="h-3 w-3 mr-1" />Overdue: {overdueCount}</Badge>}
          {completedCount > 0 && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-completed-count"><CheckCircle2 className="h-3 w-3 mr-1" />Completed: {completedCount}</Badge>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Projects appear here when PM Status = "Close-Off". Due date is 14 days after the install date.</p>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-close-off" /></div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[220px]" data-testid="select-close-off-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Close-off ({closeOffProjects.length})</SelectItem>
            <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
            <SelectItem value="overdue">Overdue ({overdueCount})</SelectItem>
            <SelectItem value="completed">Completed ({completedCount})</SelectItem>
            {waitingDepsProjects.length > 0 && <SelectItem value="waiting_deps">Waiting on Dependencies ({waitingDepsProjects.length})</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {filter === "waiting_deps" ? (
        <div className="space-y-3">{waitingDepsProjects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).map(p => {
          const unmet = getUnmetDependencies(p, "close_off", workflowConfigs);
          return (<Card key={p.id} className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10" data-testid={`card-waiting-${p.id}`}><CardContent className="p-4"><Link href={`/project/${p.id}`}><span className="font-medium text-sm hover:underline cursor-pointer">{p.name}</span></Link><div className="flex flex-wrap gap-1.5 mt-2"><Badge variant="outline" className="text-xs flex items-center gap-1 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"><Lock className="h-3 w-3" /> Waiting on dependencies</Badge></div><div className="mt-2 space-y-0.5">{unmet.map(dep => (<p key={dep} className="text-xs text-muted-foreground flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" /><span className="font-medium">{STAGE_LABELS[dep] || dep}:</span><span>{STAGE_COMPLETION_CRITERIA[dep]?.label || "Not complete"}</span></p>))}</div></CardContent></Card>);
        })}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><p>{filter === "all" ? "No projects are in Close-Off status yet." : "No projects match this filter."}</p></div>
      ) : (
        <div className="space-y-3">{sorted.map(p => {
          const dueDate = getCloseOffDueDate(p);
          const daysLeft = getDaysUntilDue(dueDate);
          const complete = isFullyComplete(p);
          const isOverdue = daysLeft !== null && daysLeft < 0 && !complete;
          return (
            <Card key={p.id} className={complete ? "border-green-300 dark:border-green-800" : isOverdue ? "border-red-300 dark:border-red-800" : ""} data-testid={`card-project-${p.id}`}>
              <CardContent className="py-4 px-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap"><Link href={`/project/${p.id}`} className="font-medium hover:underline cursor-pointer text-primary" data-testid={`text-project-name-${p.id}`}>{p.name}</Link>{p.province && <span className="text-xs text-muted-foreground">{p.province}</span>}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {dueDate && <Badge className={`text-xs flex items-center gap-1 ${complete ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : isOverdue ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : daysLeft !== null && daysLeft <= 3 ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`} data-testid={`badge-due-${p.id}`}><CalendarClock className="h-3 w-3" />{complete ? "Complete" : isOverdue ? `${Math.abs(daysLeft!)}d overdue` : `Due in ${daysLeft}d`} ({new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</Badge>}
                      {p.installStartDate ? <Badge variant="outline" className="text-xs" data-testid={`badge-install-date-${p.id}`}>Installed: {new Date(p.installStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground border-dashed" data-testid={`badge-no-install-date-${p.id}`}>No install date set</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!complete && <Button size="sm" variant="outline" onClick={() => handleSetCloseOff(p.id)} data-testid={`button-close-off-${p.id}`}>Set Close-off</Button>}
                    <TaskActionDialog projectId={p.id} projectName={p.name} viewType="close_off" />
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">UC:</span><StatusBadge status={p.ucStatus} /></div>
                  <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">AHJ:</span><StatusBadge status={p.ahjStatus} /></div>
                  <div className="flex items-center gap-1.5"><Camera className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Photos:</span><span data-testid={`text-photos-status-${p.id}`}>Pending</span></div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Final Payment:</span><span className={p.finalPaymentCollected ? "text-green-600 font-medium" : ""} data-testid={`text-final-payment-${p.id}`}>{p.finalPaymentCollected ? "Collected" : "Pending"}</span></div>
                  <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Marketing notified:</span><span data-testid={`text-marketing-status-${p.id}`}>Pending</span></div>
                </div>
              </CardContent>
            </Card>
          );
        })}</div>
      )}
    </div>
  );
}
