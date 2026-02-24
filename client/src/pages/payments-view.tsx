import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Gift, AlertTriangle, CalendarClock, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function getDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function HrspBadge({ project }: { project: any }) {
  const isLoadDisplacementOntario =
    project.ucTeam?.toLowerCase().includes('load displacement') &&
    project.province?.toLowerCase().includes('ontario');

  if (!isLoadDisplacementOntario) return null;

  if (project.hrspMissing) {
    return (
      <Badge variant="destructive" className="text-xs flex items-center gap-1" data-testid={`badge-hrsp-missing-${project.id}`}>
        <AlertCircle className="h-3 w-3" />
        HRSP subtask missing — needs review
      </Badge>
    );
  }

  if (!project.hrspStatus) return null;

  const isComplete = project.hrspStatus.toLowerCase().includes('complete') || project.hrspStatus.toLowerCase().includes('not required');
  const daysLeft = getDaysUntilDue(project.hrspDueDate);
  const isLate = !isComplete && daysLeft !== null && daysLeft < 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge
        className={
          isComplete
            ? "text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            : isLate
              ? "text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              : "text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        }
        data-testid={`badge-hrsp-status-${project.id}`}
      >
        HRSP: {project.hrspStatus}
      </Badge>
      {isLate && (
        <Badge variant="destructive" className="text-xs flex items-center gap-1">
          <CalendarClock className="h-3 w-3" />
          HRSP {Math.abs(daysLeft!)}d overdue
        </Badge>
      )}
    </div>
  );
}

function HrspStatusSelect({ project, hrspOptions, onUpdate }: { project: any; hrspOptions: string[]; onUpdate: (projectId: string, status: string) => void }) {
  if (!project.hrspSubtaskGid) return null;

  return (
    <Select value={project.hrspStatus || ''} onValueChange={(v) => onUpdate(project.id, v)}>
      <SelectTrigger className="w-[220px] h-8 text-xs" data-testid={`select-hrsp-status-${project.id}`}>
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

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: rebateOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/rebateStatus'],
  });

  const rebateStatusOptions = Array.isArray(rebateOptions) ? rebateOptions.map(o => o.name) : [];

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential')
  );

  const firstHrspSubtaskGid = installProjects.find((p: any) => p.hrspSubtaskGid)?.hrspSubtaskGid;

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
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filtered = installProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "needs_attention") {
      return !p.rebateStatus || p.rebateStatus.toLowerCase().includes('new') || p.rebateStatus.toLowerCase().includes('check');
    }
    if (filter === "not_required") return p.rebateStatus?.toLowerCase().includes('not required');
    if (filter === "hrsp_issues") {
      const isLdOn = p.ucTeam?.toLowerCase().includes('load displacement') && p.province?.toLowerCase().includes('ontario');
      if (!isLdOn) return false;
      if (p.hrspMissing) return true;
      const isComplete = p.hrspStatus?.toLowerCase().includes('complete') || p.hrspStatus?.toLowerCase().includes('not required');
      if (!isComplete && getDaysUntilDue(p.hrspDueDate) !== null && getDaysUntilDue(p.hrspDueDate)! < 0) return true;
      return false;
    }
    if (filter !== "all" && p.rebateStatus !== filter) return false;
    return true;
  });

  const needsAttention = installProjects.filter((p: any) =>
    !p.rebateStatus || p.rebateStatus.toLowerCase().includes('new') || p.rebateStatus.toLowerCase().includes('check')
  ).length;

  const hrspIssueCount = installProjects.filter((p: any) => {
    const isLdOn = p.ucTeam?.toLowerCase().includes('load displacement') && p.province?.toLowerCase().includes('ontario');
    if (!isLdOn) return false;
    if (p.hrspMissing) return true;
    const isComplete = p.hrspStatus?.toLowerCase().includes('complete') || p.hrspStatus?.toLowerCase().includes('not required');
    if (!isComplete && getDaysUntilDue(p.hrspDueDate) !== null && getDaysUntilDue(p.hrspDueDate)! < 0) return true;
    return false;
  }).length;

  const handleRebateStatus = async (projectId: string, status: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { rebateStatus: status });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Rebate status updated in Asana" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
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
            .sort((a: any, b: any) => {
              const aHrspIssue = a.hrspMissing || (!a.hrspStatus?.toLowerCase().includes('complete') && !a.hrspStatus?.toLowerCase().includes('not required') && getDaysUntilDue(a.hrspDueDate) !== null && getDaysUntilDue(a.hrspDueDate)! < 0);
              const bHrspIssue = b.hrspMissing || (!b.hrspStatus?.toLowerCase().includes('complete') && !b.hrspStatus?.toLowerCase().includes('not required') && getDaysUntilDue(b.hrspDueDate) !== null && getDaysUntilDue(b.hrspDueDate)! < 0);
              if (aHrspIssue && !bHrspIssue) return -1;
              if (!aHrspIssue && bHrspIssue) return 1;
              return 0;
            })
            .map((p: any) => {
            const isLdOn = p.ucTeam?.toLowerCase().includes('load displacement') && p.province?.toLowerCase().includes('ontario');
            const hasHrspIssue = isLdOn && (p.hrspMissing || (!p.hrspStatus?.toLowerCase().includes('complete') && !p.hrspStatus?.toLowerCase().includes('not required') && getDaysUntilDue(p.hrspDueDate) !== null && getDaysUntilDue(p.hrspDueDate)! < 0));
            return (
              <Card
                key={p.id}
                className={hasHrspIssue ? "border-red-300 dark:border-red-800" : ""}
                data-testid={`card-project-${p.id}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                        {isLdOn && (
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-300" data-testid={`badge-ld-on-${p.id}`}>
                            Load Displacement - ON
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{p.province || 'No province'}</span>
                        <span className="text-xs text-muted-foreground">UC Team: {p.ucTeam || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">PM: {p.pmStatus || 'N/A'}</span>
                      </div>
                      {isLdOn && p.rebateStatus && (
                        <div className="mt-2">
                          <HrspBadge project={p} />
                        </div>
                      )}
                      {isLdOn && !p.rebateStatus && p.hrspMissing && (
                        <div className="mt-2">
                          <HrspBadge project={p} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const displayStatus = p.rebateStatus || (isLdOn && p.hrspStatus ? p.hrspStatus : null);
                        if (displayStatus) {
                          const isHrspFallback = !p.rebateStatus && isLdOn && p.hrspStatus;
                          return (
                            <Badge
                              className={
                                displayStatus.toLowerCase().includes('not required')
                                  ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                  : displayStatus.toLowerCase().includes('new') || displayStatus.toLowerCase().includes('check')
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                    : displayStatus.toLowerCase().includes('complete')
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : displayStatus.toLowerCase().includes('in-progress') || displayStatus.toLowerCase().includes('submitted')
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                        : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              }
                              data-testid={`badge-rebate-status-${p.id}`}
                            >
                              <Gift className="h-3 w-3 mr-1" />
                              {isHrspFallback ? `HRSP: ${displayStatus}` : displayStatus}
                            </Badge>
                          );
                        }
                        return (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-no-rebate-${p.id}`}>
                            No rebate status
                          </Badge>
                        );
                      })()}
                      <Select value={p.rebateStatus || ''} onValueChange={(v) => handleRebateStatus(p.id, v)}>
                        <SelectTrigger className="w-[200px] h-8 text-xs" data-testid={`select-rebate-status-${p.id}`}>
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
