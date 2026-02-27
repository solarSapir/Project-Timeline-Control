import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/logo-spinner";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { DueIndicator } from "@/components/uc/DueIndicator";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, CheckCircle2, Clock, Camera, Lock, FolderOpen, Maximize2 } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/use-projects";
import { useWorkflowConfig } from "@/hooks/use-workflow-config";
import { useTaskActions } from "@/hooks/use-task-actions";
import { useAsanaFieldOptions } from "@/hooks/use-asana-field-options";
import { getDaysUntilDue, formatShortDate } from "@/utils/dates";
import { isAhjComplete, isVisitComplete, getStatusBadgeColor } from "@/utils/stages";
import { areDependenciesMet, getUnmetDependencies, STAGE_COMPLETION_CRITERIA } from "@/lib/stage-dependencies";
import { STAGE_LABELS } from "@shared/schema";
import { AhjSubtaskPanel } from "@/components/shared/SubtaskExpandPanel";
import { EscalationDialog } from "@/components/shared/EscalationDialog";
import { EscalationBadge } from "@/components/shared/EscalationBadge";
import { StatusChangeDialog } from "@/components/shared/StatusChangeDialog";
import { FocusDialog } from "@/components/shared/FocusDialog";
import type { Project } from "@shared/schema";

function getExpectedAhjDueDate(svCompletionDate: string | null): string | null {
  if (!svCompletionDate) return null;
  const d = new Date(svCompletionDate);
  d.setDate(d.getDate() + 21);
  return d.toISOString().split('T')[0];
}

export default function AHJView() {
  const [filter, setFilter] = useState("action-needed");
  const [search, setSearch] = useState("");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [statusChangeInfo, setStatusChangeInfo] = useState<{ project: Project; newStatus: string } | null>(null);
  const { toast } = useToast();

  const { residentialProjects, isLoading } = useProjects();
  const { data: ahjOptions } = useAsanaFieldOptions('ahjStatus');
  const { data: siteVisitActions } = useTaskActions('site_visits');
  const { data: workflowConfigs } = useWorkflowConfig();

  const statusOptions = Array.isArray(ahjOptions) ? ahjOptions.map(o => o.name) : [];

  const svCompletionDates: Record<string, string> = {};
  if (siteVisitActions) {
    for (const action of siteVisitActions) {
      if (action.actionType === 'completed' && action.completedAt) {
        const actionDate = new Date(action.completedAt).toISOString().split('T')[0];
        if (!svCompletionDates[action.projectId] || actionDate < svCompletionDates[action.projectId]) {
          svCompletionDates[action.projectId] = actionDate;
        }
      }
    }
  }

  const depsMetProjects = residentialProjects.filter(p => areDependenciesMet(p, "ahj_permitting", workflowConfigs));
  const waitingDepsProjects = residentialProjects.filter(p => !areDependenciesMet(p, "ahj_permitting", workflowConfigs) && !isAhjComplete(p.ahjStatus));

  const ahjProjects = depsMetProjects.map(p => {
    const svComplete = isVisitComplete(p.siteVisitStatus);
    const svCompDate = svCompletionDates[p.id] || null;
    const expectedDue = svComplete ? getExpectedAhjDueDate(svCompDate) : null;
    const complete = isAhjComplete(p.ahjStatus);
    const isLate = expectedDue && p.ahjDueDate ? new Date(expectedDue) > new Date(p.ahjDueDate) : false;
    return { ...p, svComplete, svCompDate, expectedAhjDue: expectedDue, targetAhjDue: p.ahjDueDate, ahjComplete: complete, isLate };
  });

  const filtered = ahjProjects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "action-needed") return !p.ahjComplete && p.svComplete;
    if (filter === "waiting-site-visit") return !p.ahjComplete && !p.svComplete;
    if (filter === "overdue") { const d = getDaysUntilDue(p.targetAhjDue); return !p.ahjComplete && d !== null && d < 0; }
    if (filter === "late") return !p.ahjComplete && p.isLate;
    if (filter === "complete") return p.ahjComplete;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.ahjComplete !== b.ahjComplete) return a.ahjComplete ? 1 : -1;
    const ad = getDaysUntilDue(a.expectedAhjDue || a.targetAhjDue), bd = getDaysUntilDue(b.expectedAhjDue || b.targetAhjDue);
    return (ad ?? 999) - (bd ?? 999);
  });

  const actionNeededCount = ahjProjects.filter(p => !p.ahjComplete && p.svComplete).length;
  const waitingSvCount = ahjProjects.filter(p => !p.ahjComplete && !p.svComplete).length;
  const completeCount = ahjProjects.filter(p => p.ahjComplete).length;
  const overdueCount = ahjProjects.filter(p => { const d = getDaysUntilDue(p.targetAhjDue); return !p.ahjComplete && d !== null && d < 0; }).length;
  const lateCount = ahjProjects.filter(p => !p.ahjComplete && p.isLate).length;

  const handleStatusChange = (projectId: string, newStatus: string) => {
    const project = residentialProjects.find(p => p.id === projectId);
    if (project) setStatusChangeInfo({ project, newStatus });
  };

  if (isLoading) return <PageLoader title="Loading AHJ / permitting..." />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-ahj-title">AHJ / Permitting</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-action-count"><AlertTriangle className="h-3 w-3 mr-1" />Action Needed: {actionNeededCount}</Badge>
          <Badge variant="secondary" data-testid="badge-waiting-count"><Camera className="h-3 w-3 mr-1" />Waiting Site Visit: {waitingSvCount}</Badge>
          {lateCount > 0 && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid="badge-late-count"><Clock className="h-3 w-3 mr-1" />Running Late: {lateCount}</Badge>}
          {overdueCount > 0 && <Badge variant="destructive" data-testid="badge-overdue-count"><AlertTriangle className="h-3 w-3 mr-1" />Overdue: {overdueCount}</Badge>}
          {completeCount > 0 && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-complete-count"><CheckCircle2 className="h-3 w-3 mr-1" />Complete: {completeCount}</Badge>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">AHJ/Permitting depends on site visit completion. Expected due date is 21 days after site visit photos are uploaded.</p>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-ahj" /></div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[260px]" data-testid="select-ahj-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({ahjProjects.length})</SelectItem>
            <SelectItem value="action-needed">Action Needed ({actionNeededCount})</SelectItem>
            <SelectItem value="waiting-site-visit">Waiting Site Visit ({waitingSvCount})</SelectItem>
            <SelectItem value="late">Running Late ({lateCount})</SelectItem>
            <SelectItem value="overdue">Overdue ({overdueCount})</SelectItem>
            <SelectItem value="complete">Complete ({completeCount})</SelectItem>
            {waitingDepsProjects.length > 0 && <SelectItem value="waiting_deps">Waiting on Dependencies ({waitingDepsProjects.length})</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {filter === "waiting_deps" ? (
        <div className="space-y-3">{waitingDepsProjects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).map(p => {
          const unmet = getUnmetDependencies(p, "ahj_permitting", workflowConfigs);
          return (<Card key={p.id} className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10" data-testid={`card-waiting-${p.id}`}><CardContent className="p-4"><Link href={`/project/${p.id}`}><span className="font-medium text-sm hover:underline cursor-pointer">{p.name}</span></Link><div className="flex flex-wrap gap-1.5 mt-2"><Badge variant="outline" className="text-xs flex items-center gap-1 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"><Lock className="h-3 w-3" /> Waiting on dependencies</Badge></div><div className="mt-2 space-y-0.5">{unmet.map(dep => (<p key={dep} className="text-xs text-muted-foreground flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" /><span className="font-medium">{STAGE_LABELS[dep] || dep}:</span><span>{STAGE_COMPLETION_CRITERIA[dep]?.label || "Not complete"}</span></p>))}</div></CardContent></Card>);
        })}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><p>{filter === "action-needed" ? "No projects ready for AHJ." : "No projects match this filter."}</p></div>
      ) : (
        <div className="space-y-3">{sorted.map(p => {
          const targetDays = getDaysUntilDue(p.targetAhjDue);
          const expectedDays = getDaysUntilDue(p.expectedAhjDue);
          const isOverdue = !p.ahjComplete && targetDays !== null && targetDays < 0;
          return (
            <Card
              key={p.id}
              className={`transition-colors ${p.ahjComplete ? "border-l-4 border-l-green-400" : isOverdue ? "border-l-4 border-l-red-400" : p.isLate ? "border-l-4 border-l-amber-400" : ""}`}
              data-testid={`card-project-${p.id}`}
            >
              <CardContent className="py-3 px-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/project/${p.id}`} className="font-medium text-sm text-primary hover:underline truncate" data-testid={`text-project-name-${p.id}`}>
                        {p.name}
                      </Link>
                      {p.ahjStatus && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getStatusBadgeColor(p.ahjStatus)}`} data-testid={`badge-status-${p.id}`}>
                          {p.ahjStatus}
                        </span>
                      )}
                      <EscalationBadge projectId={p.id} />
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                      {p.province && <span>{p.province}</span>}
                      {p.province && <span>·</span>}
                      <span>UC: {p.ucStatus || 'N/A'}</span>
                      <span>·</span>
                      <span>SV: {p.siteVisitStatus || 'N/A'}{p.svComplete && <CheckCircle2 className="inline h-3 w-3 ml-0.5 text-green-600" />}</span>
                      {p.targetAhjDue && !p.ahjComplete && <span>·</span>}
                      <DueIndicator dueDate={p.targetAhjDue} completed={p.ahjComplete} />
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {p.targetAhjDue && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isOverdue ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"}`} data-testid={`badge-target-due-${p.id}`}>
                          <Clock className="inline h-3 w-3 mr-0.5" />Target: {formatShortDate(p.targetAhjDue)}{isOverdue && ` (${Math.abs(targetDays!)}d overdue)`}
                        </span>
                      )}
                      {p.svComplete && p.expectedAhjDue && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.isLate ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" : expectedDays !== null && expectedDays <= 5 ? "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"}`} data-testid={`badge-expected-due-${p.id}`}>
                          <Clock className="inline h-3 w-3 mr-0.5" />Expected: {formatShortDate(p.expectedAhjDue)}{expectedDays !== null && <span> ({expectedDays < 0 ? `${Math.abs(expectedDays)}d overdue` : `${expectedDays}d left`})</span>}{p.isLate && <span className="font-semibold ml-1">LATE</span>}
                        </span>
                      )}
                      {!p.svComplete && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" data-testid={`badge-waiting-sv-${p.id}`}>
                          <Camera className="inline h-3 w-3 mr-0.5" />Waiting site visit
                        </span>
                      )}
                      {p.svComplete && p.svCompDate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" data-testid={`badge-sv-completed-${p.id}`}>
                          <CheckCircle2 className="inline h-3 w-3 mr-0.5" />SV done: {formatShortDate(p.svCompDate)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      <Checkbox checked={!!p.permitPaymentCollected} disabled data-testid={`checkbox-permit-payment-${p.id}`} />
                      <span className="text-[11px] text-muted-foreground">$1,500 deposit collected (includes P.eng fee)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <EscalationDialog projectId={p.id} projectName={p.name} viewType="ahj" />
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
                    <Select value={p.ahjStatus || ''} onValueChange={(v) => handleStatusChange(p.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-[140px] sm:w-[160px]" data-testid={`select-ahj-status-${p.id}`}>
                        <SelectValue placeholder="Change status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <TaskActionDialog projectId={p.id} projectName={p.name} viewType="ahj" />
                  </div>
                </div>

                {expandedProjectId === p.id && (
                  <div className="mt-3 pt-3 border-t">
                    <AhjSubtaskPanel projectId={p.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}</div>
      )}

      {statusChangeInfo && (
        <StatusChangeDialog
          open={!!statusChangeInfo}
          onOpenChange={(open) => { if (!open) setStatusChangeInfo(null); }}
          projectId={statusChangeInfo.project.id}
          projectName={statusChangeInfo.project.name}
          viewType="ahj"
          fieldName="ahjStatus"
          newStatus={statusChangeInfo.newStatus}
          oldStatus={statusChangeInfo.project.ahjStatus || ""}
        />
      )}
    </div>
  );
}
