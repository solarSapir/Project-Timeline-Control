import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, Calendar as CalendarIcon, CheckCircle2, Clock, AlertTriangle, Lock, FolderOpen } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useProjects } from "@/hooks/use-projects";
import { useWorkflowConfig } from "@/hooks/use-workflow-config";
import { getDaysUntilDue, formatShortDate } from "@/utils/dates";
import { isVisitComplete, isVisitBooked, getStatusBadgeColor } from "@/utils/stages";
import { areDependenciesMet, getUnmetDependencies, STAGE_COMPLETION_CRITERIA } from "@/lib/stage-dependencies";
import { STAGE_LABELS } from "@shared/schema";
import { useAsanaFieldOptions } from "@/hooks/use-asana-field-options";
import SiteVisitPhotosDialog from "@/components/site-visits/SiteVisitPhotosDialog";
import { DueIndicator } from "@/components/uc/DueIndicator";
import { InstallTeamSubtaskPanel } from "@/components/shared/SubtaskExpandPanel";
import { EscalationDialog } from "@/components/shared/EscalationDialog";
import { EscalationBadge } from "@/components/shared/EscalationBadge";

function getSiteVisitDueDate(project: { contractDueDate: string | null; siteVisitDueDate: string | null }): string | null {
  if (!project.contractDueDate) return project.siteVisitDueDate || null;
  const d = new Date(project.contractDueDate);
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

export default function SiteVisitsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("pending");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const { toast } = useToast();

  const { residentialProjects, isLoading } = useProjects();
  const { data: siteVisitOptions } = useAsanaFieldOptions('siteVisitStatus');
  const { data: workflowConfigs } = useWorkflowConfig();

  const statusOptions = Array.isArray(siteVisitOptions) ? siteVisitOptions.map(o => o.name) : [];

  const depsMetProjects = residentialProjects.filter(p => areDependenciesMet(p, "site_visit", workflowConfigs));
  const waitingDepsProjects = residentialProjects.filter(p => !areDependenciesMet(p, "site_visit", workflowConfigs) && p.installTeamStage?.toLowerCase().includes('pending site visit'));

  const pendingProjects = depsMetProjects.filter(p => p.installTeamStage?.toLowerCase().includes('pending site visit'));

  const handleStatus = async (projectId: string, status: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { siteVisitStatus: status });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Site visit status updated in Asana" });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : 'Unknown error', variant: "destructive" });
    }
  };

  const handleDate = async (projectId: string, date: Date | undefined) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { siteVisitDate: date ? format(date, 'yyyy-MM-dd') : null });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: date ? "Site visit date set" : "Site visit date cleared" });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : 'Unknown error', variant: "destructive" });
    }
  };

  const filtered = pendingProjects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    const complete = isVisitComplete(p.siteVisitStatus);
    const booked = isVisitBooked(p.siteVisitStatus);
    if (filter === "pending") return !complete && !booked;
    if (filter === "booked") return booked && !complete;
    if (filter === "complete") return complete;
    if (filter === "overdue") { const d = getDaysUntilDue(getSiteVisitDueDate(p)); return !complete && !booked && d !== null && d < 0; }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (isVisitComplete(a.siteVisitStatus) !== isVisitComplete(b.siteVisitStatus)) return isVisitComplete(a.siteVisitStatus) ? 1 : -1;
    const ad = getDaysUntilDue(getSiteVisitDueDate(a)), bd = getDaysUntilDue(getSiteVisitDueDate(b));
    return (ad ?? 999) - (bd ?? 999);
  });

  const pendingCount = pendingProjects.filter(p => !isVisitComplete(p.siteVisitStatus) && !isVisitBooked(p.siteVisitStatus)).length;
  const bookedCount = pendingProjects.filter(p => isVisitBooked(p.siteVisitStatus) && !isVisitComplete(p.siteVisitStatus)).length;
  const completeCount = pendingProjects.filter(p => isVisitComplete(p.siteVisitStatus)).length;
  const overdueCount = pendingProjects.filter(p => {
    if (isVisitComplete(p.siteVisitStatus) || isVisitBooked(p.siteVisitStatus)) return false;
    const d = getDaysUntilDue(getSiteVisitDueDate(p));
    return d !== null && d < 0;
  }).length;

  if (isLoading) return <div className="p-6 space-y-4"><h1 className="text-2xl font-semibold">Site Visits</h1>{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-site-visits-title">Site Visits</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-total-count"><MapPin className="h-3 w-3 mr-1" />Total: {pendingProjects.length}</Badge>
          <Badge variant="secondary" data-testid="badge-pending-count"><Clock className="h-3 w-3 mr-1" />Pending: {pendingCount}</Badge>
          {bookedCount > 0 && <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" data-testid="badge-booked-count"><CalendarIcon className="h-3 w-3 mr-1" />Booked: {bookedCount}</Badge>}
          {completeCount > 0 && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-complete-count"><CheckCircle2 className="h-3 w-3 mr-1" />Complete: {completeCount}</Badge>}
          {overdueCount > 0 && <Badge variant="destructive" data-testid="badge-overdue-count"><AlertTriangle className="h-3 w-3 mr-1" />Overdue: {overdueCount}</Badge>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Projects with Install Team Stage "Pending site visit". Site visits are due within 7 days of contract signing.</p>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-site-visits" /></div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[220px]" data-testid="select-site-visits-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({pendingProjects.length})</SelectItem>
            <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
            <SelectItem value="booked">Booked ({bookedCount})</SelectItem>
            <SelectItem value="complete">Complete ({completeCount})</SelectItem>
            <SelectItem value="overdue">Overdue ({overdueCount})</SelectItem>
            {waitingDepsProjects.length > 0 && <SelectItem value="waiting_deps">Waiting on Dependencies ({waitingDepsProjects.length})</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {filter === "waiting_deps" ? (
        <div className="space-y-3">{waitingDepsProjects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).map(p => {
          const unmet = getUnmetDependencies(p, "site_visit", workflowConfigs);
          return (<Card key={p.id} className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10" data-testid={`card-waiting-${p.id}`}><CardContent className="p-4"><Link href={`/project/${p.id}`}><span className="font-medium text-sm hover:underline cursor-pointer">{p.name}</span></Link><div className="flex flex-wrap gap-1.5 mt-2"><Badge variant="outline" className="text-xs flex items-center gap-1 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"><Lock className="h-3 w-3" /> Waiting on dependencies</Badge></div><div className="mt-2 space-y-0.5">{unmet.map(dep => (<p key={dep} className="text-xs text-muted-foreground flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" /><span className="font-medium">{STAGE_LABELS[dep] || dep}:</span><span>{STAGE_COMPLETION_CRITERIA[dep]?.label || "Not complete"}</span></p>))}</div></CardContent></Card>);
        })}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><p>{filter === "pending" ? "No pending site visits." : "No projects match this filter."}</p></div>
      ) : (
        <div className="space-y-3">{sorted.map(p => {
          const dueDate = getSiteVisitDueDate(p);
          const daysLeft = getDaysUntilDue(dueDate);
          const complete = isVisitComplete(p.siteVisitStatus);
          const booked = isVisitBooked(p.siteVisitStatus);
          const isOverdue = !complete && !booked && daysLeft !== null && daysLeft < 0;
          return (
            <Card
              key={p.id}
              className={`transition-colors ${
                complete ? "border-l-4 border-l-green-400" :
                isOverdue ? "border-l-4 border-l-red-400" :
                booked ? "border-l-4 border-l-blue-400" : ""
              }`}
              data-testid={`card-project-${p.id}`}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/project/${p.id}`} className="font-medium text-sm text-primary hover:underline truncate" data-testid={`text-project-name-${p.id}`}>
                        {p.name}
                      </Link>
                      {p.siteVisitStatus && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getStatusBadgeColor(p.siteVisitStatus)}`} data-testid={`badge-status-${p.id}`}>
                          {p.siteVisitStatus}
                        </span>
                      )}
                      <EscalationBadge projectId={p.id} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      {p.province && <span>{p.province}</span>}
                      {p.province && p.ucStatus && <span>·</span>}
                      {p.ucStatus && <span>UC: {p.ucStatus}</span>}
                      {(p.province || p.ucStatus) && p.installTeamStage && <span>·</span>}
                      {p.installTeamStage && <span>{p.installTeamStage}</span>}
                      {(p.province || p.ucStatus || p.installTeamStage) && dueDate && !complete && <span>·</span>}
                      <DueIndicator dueDate={dueDate} completed={complete} />
                    </div>
                    {p.siteVisitDate && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Visit: {formatShortDate(p.siteVisitDate)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <EscalationDialog projectId={p.id} projectName={p.name} viewType="site_visits" />
                    <Button
                      size="sm"
                      variant={expandedProjectId === p.id ? "secondary" : "ghost"}
                      className="h-7 text-xs gap-1 px-2"
                      onClick={() => setExpandedProjectId(expandedProjectId === p.id ? null : p.id)}
                      data-testid={`button-subtasks-${p.id}`}
                    >
                      <FolderOpen className="h-3 w-3" />
                      Subtasks
                    </Button>
                    <Select value={p.siteVisitStatus || ''} onValueChange={(v) => handleStatus(p.id, v)}>
                      <SelectTrigger className="w-[160px] h-7 text-xs" data-testid={`select-site-visit-status-${p.id}`}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs" data-testid={`button-set-visit-date-${p.id}`}>
                          <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                          {p.siteVisitDate ? format(new Date(p.siteVisitDate), 'MMM d') : "Visit Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={p.siteVisitDate ? new Date(p.siteVisitDate) : undefined} onSelect={(d) => handleDate(p.id, d)} />
                      </PopoverContent>
                    </Popover>
                    <SiteVisitPhotosDialog projectId={p.id} projectName={p.name} siteVisitStatus={p.siteVisitStatus} />
                  </div>
                </div>

                {expandedProjectId === p.id && (
                  <div className="mt-3 pt-3 border-t">
                    <InstallTeamSubtaskPanel projectId={p.id} subtaskName="Site visit" label="Site Visit Subtask" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}</div>
      )}
    </div>
  );
}
