import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDaysUntilDue } from "@/utils/dates";
import type { Project } from "@shared/schema";

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

function HrspStatusSelect({ project, hrspOptions, onUpdate }: { project: Project; hrspOptions: string[]; onUpdate: (projectId: string, status: string) => void }) {
  if (!project.hrspSubtaskGid) return null;

  return (
    <Select value={project.hrspStatus || ''} onValueChange={(v) => onUpdate(project.id, v)}>
      <SelectTrigger className="w-[180px] h-7 text-xs" data-testid={`select-hrsp-status-${project.id}`}>
        <SelectValue placeholder="Set HRSP status" />
      </SelectTrigger>
      <SelectContent>
        {hrspOptions.map(s => (
          <SelectItem key={s} value={s}>{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function PaymentsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: rebateOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/rebateStatus'],
  });

  const rebateStatusOptions = Array.isArray(rebateOptions) ? rebateOptions.map(o => o.name) : [];

  const allInstallProjects = (projects || []).filter((p: Project) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
    !['complete', 'project paused', 'project lost'].includes(p.pmStatus?.toLowerCase() || '')
  );

  const isRebateEligible = (p: Project) =>
    p.ucTeam?.toLowerCase().includes('load displacement') &&
    p.province?.toLowerCase().includes('ontario');

  const installProjects = allInstallProjects.filter((p: Project) => isRebateEligible(p));

  const firstHrspSubtaskGid = installProjects.find((p: Project) => p.hrspSubtaskGid)?.hrspSubtaskGid;

  const { data: hrspOptionsData } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/hrsp/field-options', firstHrspSubtaskGid],
    queryFn: () => fetch(`/api/hrsp/field-options/${firstHrspSubtaskGid}`).then(r => r.json()),
    enabled: !!firstHrspSubtaskGid,
  });

  const hrspStatusOptions = Array.isArray(hrspOptionsData) ? hrspOptionsData.map(o => o.name) : [];

  const handleHrspStatus = async (projectId: string, status: string) => {
    try {
      await apiRequest("PATCH", `/api/hrsp/${projectId}`, { status });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "HRSP status updated in Asana" });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const hasHrspIssue = (p: Project) => {
    const isLdOn = p.ucTeam?.toLowerCase().includes('load displacement') && p.province?.toLowerCase().includes('ontario');
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
    if (filter !== "all" && p.rebateStatus !== filter) return false;
    return true;
  });

  const needsAttention = installProjects.filter((p: Project) =>
    !p.rebateStatus || p.rebateStatus.toLowerCase().includes('new') || p.rebateStatus.toLowerCase().includes('check')
  ).length;

  const hrspIssueCount = installProjects.filter((p: Project) => hasHrspIssue(p)).length;

  const handleRebateStatus = async (projectId: string, status: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { rebateStatus: status });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Rebate status updated in Asana" });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const getRebateStatusColor = (status: string) => {
    const lower = status.toLowerCase();
    if (lower.includes('not required')) return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    if (lower.includes('new') || lower.includes('check')) return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    if (lower.includes('complete')) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (lower.includes('in-progress') || lower.includes('submitted')) return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-rebates-title">Rebates</h1>
        <div className="flex gap-2 flex-wrap">
          {hrspIssueCount > 0 && (
            <Badge variant="destructive" data-testid="badge-hrsp-issues-count">
              <AlertCircle className="h-3 w-3 mr-1" />
              {hrspIssueCount} HRSP issue{hrspIssueCount > 1 ? 's' : ''}
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
          <SelectTrigger className="w-[260px]" data-testid="select-rebates-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            <SelectItem value="needs_attention">Needs Attention</SelectItem>
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
              const aIssue = hasHrspIssue(a);
              const bIssue = hasHrspIssue(b);
              if (aIssue && !bIssue) return -1;
              if (!aIssue && bIssue) return 1;
              return 0;
            })
            .map((p: Project) => {
            const isLdOn = p.ucTeam?.toLowerCase().includes('load displacement') && p.province?.toLowerCase().includes('ontario');
            const hrspIssue = hasHrspIssue(p);

            const displayStatus = p.rebateStatus || (isLdOn && p.hrspStatus ? p.hrspStatus : null);
            const isHrspFallback = !p.rebateStatus && isLdOn && !!p.hrspStatus;

            return (
              <Card
                key={p.id}
                className={`transition-colors ${hrspIssue ? "border-l-4 border-l-red-400" : ""}`}
                data-testid={`card-project-${p.id}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/project/${p.id}`} className="font-medium text-sm text-primary hover:underline truncate" data-testid={`link-project-${p.id}`}>
                          {p.name}
                        </Link>
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
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                        <span>{p.province || 'No province'}</span>
                        <span>·</span>
                        <span>UC Team: {p.ucTeam || 'N/A'}</span>
                        <span>·</span>
                        <span>PM: {p.pmStatus || 'N/A'}</span>
                      </div>

                      {isLdOn && <HrspInfo project={p} />}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Select value={p.rebateStatus || ''} onValueChange={(v) => handleRebateStatus(p.id, v)}>
                        <SelectTrigger className="w-[180px] h-7 text-xs" data-testid={`select-rebate-status-${p.id}`}>
                          <SelectValue placeholder="Set rebate status" />
                        </SelectTrigger>
                        <SelectContent>
                          {rebateStatusOptions.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isLdOn && p.hrspSubtaskGid && (
                        <HrspStatusSelect project={p} hrspOptions={hrspStatusOptions} onUpdate={handleHrspStatus} />
                      )}
                      <TaskActionDialog projectId={p.id} projectName={p.name} viewType="payments" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
