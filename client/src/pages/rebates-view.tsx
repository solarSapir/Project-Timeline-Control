import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, AlertCircle, Maximize2, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDaysUntilDue, daysSince } from "@/utils/dates";
import { HrspChecklist } from "@/components/hrsp/HrspChecklist";
import { RebateProjectModal } from "@/components/hrsp/RebateProjectModal";
import type { Project, RebateWorkflowRule } from "@shared/schema";
import { EscalationDialog } from "@/components/shared/EscalationDialog";
import { EscalationBadge } from "@/components/shared/EscalationBadge";
import { RebateFollowUpDialog } from "@/components/hrsp/RebateFollowUpDialog";
import { CloseOffSubmittedDialog } from "@/components/hrsp/CloseOffSubmittedDialog";
import { StatusChangeDialog } from "@/components/shared/StatusChangeDialog";

function HrspInfo({ project }: { project: Project }) {
  const isLoadDisplacementOntario =
    project.ucTeam?.toLowerCase().includes('load displacement') &&
    project.province?.toLowerCase().includes('ontario');

  if (!isLoadDisplacementOntario) return null;

  if (project.hrspMissing) {
    return (
      <div className="flex items-center gap-1.5 mt-1 text-[11px]">
        <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
        <span className="text-red-600 dark:text-red-400 font-medium" data-testid={`text-hrsp-missing-${project.id}`}>
          HRSP subtask missing — needs review
        </span>
      </div>
    );
  }

  if (!project.hrspStatus) return null;

  const isComplete = project.hrspStatus.toLowerCase().includes('complete') || project.hrspStatus.toLowerCase().includes('not required');
  const daysLeft = getDaysUntilDue(project.hrspDueDate);
  const isLate = !isComplete && daysLeft !== null && daysLeft < 0;

  return (
    <div className="flex items-center gap-1.5 mt-1 text-[11px]">
      <span className={
        isComplete
          ? "text-green-700 dark:text-green-400"
          : isLate
            ? "text-red-600 dark:text-red-400 font-medium"
            : "text-muted-foreground"
      } data-testid={`text-hrsp-status-${project.id}`}>
        HRSP: {project.hrspStatus}
      </span>
      {isLate && (
        <span className="text-red-600 dark:text-red-400 font-medium">
          — {Math.abs(daysLeft!)}d overdue
        </span>
      )}
    </div>
  );
}

function getCloseOffDueInfo(p: Project, dueWindowDays: number): { daysLeft: number; dueDate: string } | null {
  const status = (p.rebateStatus || '').toLowerCase();
  if (!status.includes('close-off') && !status.includes('close off') && !status.includes('closeoff')) return null;
  const closeOffDate = p.rebateCloseOffDate;
  if (!closeOffDate) return null;
  const due = new Date(new Date(closeOffDate).getTime() + dueWindowDays * 86400000);
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
  const dueDate = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { daysLeft, dueDate };
}

function needsRebateFollowUp(p: Project, followUpDays: number): boolean {
  const status = (p.rebateStatus || p.hrspStatus || '').toLowerCase();
  const eligible = ['in-progress', 'submitted', 'close-off - submitted', 'close-off submitted'].some(s => status.includes(s));
  if (!eligible) return false;
  const days = daysSince(p.rebateSubmittedDate);
  return days !== null && days >= followUpDays;
}

export default function PaymentsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalProject, setModalProject] = useState<Project | null>(null);
  const [closeOffSubmitProject, setCloseOffSubmitProject] = useState<Project | null>(null);
  const [statusChangeInfo, setStatusChangeInfo] = useState<{ project: Project; newStatus: string } | null>(null);
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: rebateOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/rebateStatus'],
  });

  const { data: workflowRules } = useQuery<RebateWorkflowRule[]>({
    queryKey: ['/api/rebate/workflow-rules'],
  });

  const ruleMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (workflowRules) {
      for (const r of workflowRules) {
        if (r.enabled) map[r.triggerAction] = r.hideDays;
      }
    }
    return map;
  }, [workflowRules]);

  const followUpDays = ruleMap["follow_up_submitted"] ?? ruleMap["status_to_submitted"] ?? 5;
  const closeOffDueWindowDays = ruleMap["closeoff_due_window"] ?? 14;

  const rebateStatusOptions = Array.isArray(rebateOptions) ? rebateOptions.map(o => o.name) : [];

  const allInstallProjects = (projects || []).filter((p: Project) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
    !['complete', 'project paused', 'project lost'].includes(p.pmStatus?.toLowerCase() || '')
  );

  const isRebateEligible = (p: Project) =>
    p.ucTeam?.toLowerCase().includes('load displacement') &&
    p.province?.toLowerCase().includes('ontario');

  const isWaitingForInstall = (p: Project) => {
    const s = (p.rebateStatus || '').toLowerCase();
    return s.includes('pre approved') || s.includes('pre-approved') || s === 'complete - (pre approved, waiting for job to complete)';
  };

  const installProjects = allInstallProjects.filter((p: Project) => isRebateEligible(p) && !isWaitingForInstall(p));

  const hasHrspIssue = (p: Project) => {
    const isLdOn = isRebateEligible(p);
    if (!isLdOn) return false;
    if (p.hrspMissing) return true;
    const isComplete = p.hrspStatus?.toLowerCase().includes('complete') || p.hrspStatus?.toLowerCase().includes('not required');
    if (!isComplete && getDaysUntilDue(p.hrspDueDate) !== null && getDaysUntilDue(p.hrspDueDate)! < 0) return true;
    return false;
  };

  const filtered = installProjects.filter((p: Project) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "needs_attention") {
      return !p.rebateStatus || p.rebateStatus.toLowerCase().includes('new') || p.rebateStatus.toLowerCase().includes('check');
    }
    if (filter === "not_required") return p.rebateStatus?.toLowerCase().includes('not required');
    if (filter === "hrsp_issues") return hasHrspIssue(p);
    if (filter === "needs_followup") return needsRebateFollowUp(p, followUpDays);
    if (filter !== "all" && p.rebateStatus !== filter) return false;
    return true;
  });

  const needsAttention = installProjects.filter((p: Project) =>
    !p.rebateStatus || p.rebateStatus.toLowerCase().includes('new') || p.rebateStatus.toLowerCase().includes('check')
  ).length;

  const hrspIssueCount = installProjects.filter((p: Project) => hasHrspIssue(p)).length;
  const followUpCount = installProjects.filter((p: Project) => needsRebateFollowUp(p, followUpDays)).length;

  const handleRebateStatus = (projectId: string, status: string) => {
    const lower = status.toLowerCase();
    const proj = (projects || []).find(p => p.id === projectId);
    if (!proj) return;

    if (lower === 'close-off - submitted' || lower === 'close-off submitted') {
      setCloseOffSubmitProject(proj);
      return;
    }

    const extraFields: Record<string, string> = {};
    if (lower.includes('close-off') || lower.includes('close off') || lower.includes('closeoff')) {
      extraFields.rebateCloseOffDate = new Date().toISOString().split('T')[0];
    }

    setStatusChangeInfo({
      project: proj,
      newStatus: status,
    });
  };

  const confirmCloseOffSubmitted = async () => {
    if (!closeOffSubmitProject) return;
    try {
      await apiRequest("PATCH", `/api/projects/${closeOffSubmitProject.id}`, {
        rebateStatus: "Close-off - Submitted",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Status changed to Close-off - Submitted" });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const getRebateStatusColor = (status: string) => {
    const lower = status.toLowerCase();
    if (lower.includes('not required')) return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    if (lower.includes('new') || lower.includes('check')) return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    if (lower.includes('complete')) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (lower === 'close-off - submitted' || lower === 'close-off submitted') return "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300";
    if (lower.includes('in-progress') || lower.includes('submitted')) return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    return "bg-muted text-muted-foreground";
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Rebates</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-rebates-title">Rebates</h1>
        <div className="flex gap-2 flex-wrap">
          {hrspIssueCount > 0 && (
            <Badge variant="destructive" data-testid="badge-hrsp-issues-count">
              <AlertCircle className="h-3 w-3 mr-1" />
              {hrspIssueCount} HRSP issue{hrspIssueCount > 1 ? 's' : ''}
            </Badge>
          )}
          {followUpCount > 0 && (
            <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300" data-testid="badge-followup-count">
              <MessageSquare className="h-3 w-3 mr-1" />
              {followUpCount} need follow-up
            </Badge>
          )}
          {needsAttention > 0 && (
            <Badge variant="outline" data-testid="badge-needs-attention-count">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {needsAttention} need attention
            </Badge>
          )}
          <Badge variant="outline" data-testid="badge-project-count">{filtered.length} projects</Badge>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-rebates" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-[260px]" data-testid="select-rebates-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            <SelectItem value="needs_attention">Needs Attention</SelectItem>
            <SelectItem value="needs_followup">Needs Follow-Up</SelectItem>
            <SelectItem value="hrsp_issues">HRSP Issues (ON Load Displacement)</SelectItem>
            <SelectItem value="not_required">Not Required</SelectItem>
            {rebateStatusOptions.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No projects match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...filtered]
            .sort((a: Project, b: Project) => {
              const aFollowUp = needsRebateFollowUp(a, followUpDays);
              const bFollowUp = needsRebateFollowUp(b, followUpDays);
              if (aFollowUp && !bFollowUp) return -1;
              if (!aFollowUp && bFollowUp) return 1;
              const aIssue = hasHrspIssue(a);
              const bIssue = hasHrspIssue(b);
              if (aIssue && !bIssue) return -1;
              if (!aIssue && bIssue) return 1;
              return 0;
            })
            .map((p: Project) => {
            const isLdOn = isRebateEligible(p);
            const hrspIssue = hasHrspIssue(p);
            const followUp = needsRebateFollowUp(p, followUpDays);

            const displayStatus = p.rebateStatus || (isLdOn && p.hrspStatus ? p.hrspStatus : null);
            const isHrspFallback = !p.rebateStatus && isLdOn && !!p.hrspStatus;
            const closeOffDue = getCloseOffDueInfo(p, closeOffDueWindowDays);

            return (
              <Card
                key={p.id}
                className={`transition-colors ${followUp ? "border-l-4 border-l-amber-400" : hrspIssue ? "border-l-4 border-l-red-400" : ""}`}
                data-testid={`card-project-${p.id}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/project/${p.id}`} className="font-medium text-sm text-primary hover:underline truncate shrink-0 max-w-[60%] sm:max-w-none" data-testid={`link-project-${p.id}`}>
                      {p.name}
                    </Link>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <RebateFollowUpDialog project={p} />
                      <EscalationDialog projectId={p.id} projectName={p.name} viewType="payments" />
                      <Select value={p.rebateStatus || ''} onValueChange={(v) => handleRebateStatus(p.id, v)}>
                        <SelectTrigger className="w-[120px] lg:w-[180px] h-7 text-xs" data-testid={`select-rebate-status-${p.id}`}>
                          <SelectValue placeholder="Set status" />
                        </SelectTrigger>
                        <SelectContent>
                          {rebateStatusOptions.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 px-2"
                        onClick={() => setModalProject(p)}
                        data-testid={`button-focus-${p.id}`}
                      >
                        <Maximize2 className="h-3 w-3" />
                        <span className="hidden sm:inline">Focus</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {isLdOn && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300" data-testid={`badge-ld-on-${p.id}`}>
                        Load Displacement - ON
                      </span>
                    )}
                    {displayStatus && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getRebateStatusColor(displayStatus)}`} data-testid={`badge-rebate-status-${p.id}`}>
                        {isHrspFallback ? `HRSP: ${displayStatus}` : displayStatus}
                      </span>
                    )}
                    {!displayStatus && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground" data-testid={`badge-no-rebate-${p.id}`}>
                        No rebate status
                      </span>
                    )}
                    <EscalationBadge projectId={p.id} />
                  </div>

                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground flex-wrap">
                    <span>{p.province || 'No province'}</span>
                    <span>·</span>
                    <span>UC Team: {p.ucTeam || 'N/A'}</span>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline">PM: {p.pmStatus || 'N/A'}</span>
                    {closeOffDue && (
                      <>
                        <span>·</span>
                        <span className={`font-medium ${closeOffDue.daysLeft < 0 ? "text-red-600 dark:text-red-400" : closeOffDue.daysLeft <= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} data-testid={`text-closeoff-due-${p.id}`}>
                          Due {closeOffDue.dueDate} ({closeOffDue.daysLeft < 0 ? `${Math.abs(closeOffDue.daysLeft)}d overdue` : `${closeOffDue.daysLeft}d left`})
                        </span>
                      </>
                    )}
                    {followUp && (
                      <>
                        <span>·</span>
                        <span className="text-amber-600 dark:text-amber-400 font-medium">follow-up needed</span>
                      </>
                    )}
                  </div>

                  {isLdOn && <HrspInfo project={p} />}
                  {isLdOn && <HrspChecklist project={p} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <RebateProjectModal
        project={modalProject}
        open={!!modalProject}
        onOpenChange={(open) => { if (!open) setModalProject(null); }}
      />

      <CloseOffSubmittedDialog
        open={!!closeOffSubmitProject}
        onOpenChange={(open) => { if (!open) setCloseOffSubmitProject(null); }}
        projectId={closeOffSubmitProject?.id || ""}
        projectName={closeOffSubmitProject?.name || ""}
        onConfirm={confirmCloseOffSubmitted}
      />

      {statusChangeInfo && (
        <StatusChangeDialog
          open={!!statusChangeInfo}
          onOpenChange={(open) => { if (!open) setStatusChangeInfo(null); }}
          projectId={statusChangeInfo.project.id}
          projectName={statusChangeInfo.project.name}
          viewType="payments"
          fieldName="rebateStatus"
          newStatus={statusChangeInfo.newStatus}
          oldStatus={statusChangeInfo.project.rebateStatus || ""}
          extraPatchFields={
            statusChangeInfo.newStatus.toLowerCase().includes('close-off') ||
            statusChangeInfo.newStatus.toLowerCase().includes('close off')
              ? { rebateCloseOffDate: new Date().toISOString().split('T')[0] }
              : undefined
          }
        />
      )}
    </div>
  );
}
