import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Clock, Search, Maximize2, EyeOff } from "lucide-react";
import { getDaysUntilDue, daysSince } from "@/utils/dates";
import { isUcComplete } from "@/utils/stages";
import { ExpandedProjectView } from "@/components/uc/ExpandedProjectView";
import { UCProjectCard } from "@/components/uc/UCProjectCard";
import { UcApprovalDialog } from "@/components/uc/UcApprovalDialog";
import { UcRejectionDialog } from "@/components/uc/UcRejectionDialog";
import type { Project, EscalationTicket, UcCompletion } from "@shared/schema";

export default function UCView() {
  const [filter, setFilter] = useState("needs_action");
  const [search, setSearch] = useState("");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [focusProject, setFocusProject] = useState<Project | null>(null);
  const [approvalProject, setApprovalProject] = useState<Project | null>(null);
  const [rejectionProject, setRejectionProject] = useState<Project | null>(null);
  const [rejectionStatus, setRejectionStatus] = useState("");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const { data: ucOptions } = useQuery<{ gid: string; name: string }[]>({ queryKey: ['/api/asana/field-options/ucStatus'] });
  const { data: escalationTickets } = useQuery<EscalationTicket[]>({ queryKey: ['/api/escalation-tickets'] });
  const { data: ucCompletions } = useQuery<UcCompletion[]>({ queryKey: ['/api/uc/completions'] });

  const statusOptions = Array.isArray(ucOptions) ? ucOptions.map(o => o.name) : [];

  const openEscalations = new Map<string, EscalationTicket>();
  (escalationTickets || []).forEach(t => {
    if ((t.status === 'open' || t.status === 'responded') && t.viewType === 'uc') {
      openEscalations.set(t.projectId, t);
    }
  });

  const isHiddenByEscalation = (projectId: string) => {
    const ticket = openEscalations.get(projectId);
    if (!ticket || !ticket.hideUntil) return false;
    return ticket.status === 'open' && new Date(ticket.hideUntil) > new Date();
  };

  const isHiddenByWorkflow = (projectId: string) => {
    const completions = (ucCompletions || []).filter(c => c.projectId === projectId);
    if (completions.length === 0) return false;
    const latest = completions[0];
    if (!latest.completedAt || !latest.hideDays || latest.hideDays <= 0) return false;
    const hideUntil = new Date(latest.completedAt).getTime() + latest.hideDays * 86400000;
    return hideUntil > Date.now();
  };

  const installProjects = (projects || []).filter((p) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
    !['complete', 'project paused', 'project lost'].includes(p.pmStatus?.toLowerCase() || '')
  );

  const escalatedCount = installProjects.filter(p => openEscalations.has(p.id)).length;
  const hiddenCount = installProjects.filter(p => isHiddenByWorkflow(p.id)).length;

  const filtered = installProjects.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "escalated") return openEscalations.has(p.id);
    if (filter === "hidden") return isHiddenByWorkflow(p.id);
    if (filter !== "all" && filter !== "escalated" && filter !== "hidden") {
      if (isHiddenByEscalation(p.id) || isHiddenByWorkflow(p.id)) return false;
    }
    if (filter === "needs_action") return !isUcComplete(p.ucStatus);
    if (filter === "completed") return isUcComplete(p.ucStatus);
    if (filter === "submitted") return p.ucStatus?.toLowerCase() === 'submitted';
    if (filter !== "all" && p.ucStatus !== filter) return false;
    return true;
  });

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    const lower = newStatus.toLowerCase();
    const project = installProjects.find(p => p.id === projectId);

    if (lower.includes('approved')) {
      if (project) setApprovalProject(project);
      return;
    }
    if (lower.includes('reject')) {
      if (project) {
        setRejectionProject(project);
        setRejectionStatus(newStatus);
      }
      return;
    }

    try {
      const patchBody: Record<string, string> = { ucStatus: newStatus };
      if (lower === 'submitted' || lower.includes('submitted')) {
        patchBody.ucSubmittedDate = new Date().toISOString().split('T')[0];
      }
      await apiRequest("PATCH", `/api/projects/${projectId}`, patchBody);

      if (lower === 'submitted' || lower.includes('submitted')) {
        await apiRequest("POST", "/api/uc/complete-action", {
          projectId,
          staffName: "System",
          actionType: "status_change",
          fromStatus: project?.ucStatus || "",
          toStatus: newStatus,
          hideDays: 7,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/uc/completions'] });
      toast({ title: "UC status updated in Asana" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">UC Applications</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  const totalNeedAction = installProjects.filter(p => !isUcComplete(p.ucStatus) && !isHiddenByWorkflow(p.id)).length;
  const totalCompleted = installProjects.filter(p => isUcComplete(p.ucStatus)).length;
  const totalSubmitted = installProjects.filter(p => p.ucStatus?.toLowerCase() === 'submitted').length;
  const needsFollowUpCount = installProjects.filter(p => {
    if (p.ucStatus?.toLowerCase() !== 'submitted') return false;
    const days = daysSince(p.ucSubmittedDate);
    return days !== null && days >= 7;
  }).length;
  const overdueCount = installProjects.filter(p => {
    if (isUcComplete(p.ucStatus)) return false;
    return (getDaysUntilDue(p.ucDueDate) ?? 1) < 0;
  }).length;

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (isUcComplete(a.ucStatus) && !isUcComplete(b.ucStatus)) return 1;
    if (!isUcComplete(a.ucStatus) && isUcComplete(b.ucStatus)) return -1;
    const aSubmittedDays = a.ucStatus?.toLowerCase() === 'submitted' ? (daysSince(a.ucSubmittedDate) ?? 0) : -1;
    const bSubmittedDays = b.ucStatus?.toLowerCase() === 'submitted' ? (daysSince(b.ucSubmittedDate) ?? 0) : -1;
    if (aSubmittedDays >= 7 && bSubmittedDays < 7) return -1;
    if (aSubmittedDays < 7 && bSubmittedDays >= 7) return 1;
    const aDays = getDaysUntilDue(a.ucDueDate);
    const bDays = getDaysUntilDue(b.ucDueDate);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-uc-title">UC Applications</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {overdueCount > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{overdueCount} overdue</span>}
          {needsFollowUpCount > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{needsFollowUpCount} need follow-up</span>}
          {hiddenCount > 0 && <span className="text-purple-600 dark:text-purple-400 font-medium">{hiddenCount} hidden</span>}
          <span>{totalNeedAction} active</span>
          <span className="text-muted-foreground/60">|</span>
          <span>{totalSubmitted} submitted</span>
          <span className="text-muted-foreground/60">|</span>
          <span>{totalCompleted} complete</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-uc" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[240px]" data-testid="select-uc-filter">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="needs_action">Needs Action ({totalNeedAction})</SelectItem>
            <SelectItem value="submitted">Submitted ({totalSubmitted})</SelectItem>
            {escalatedCount > 0 && <SelectItem value="escalated">Escalated ({escalatedCount})</SelectItem>}
            {hiddenCount > 0 && <SelectItem value="hidden">Hidden ({hiddenCount})</SelectItem>}
            <SelectItem value="completed">Completed ({totalCompleted})</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <UcApprovalDialog
        projectId={approvalProject?.id || ""}
        projectName={approvalProject?.name || ""}
        open={!!approvalProject}
        onOpenChange={(open) => { if (!open) setApprovalProject(null); }}
        onComplete={() => {
          setApprovalProject(null);
          queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
          queryClient.invalidateQueries({ queryKey: ['/api/uc/completions'] });
        }}
      />

      <UcRejectionDialog
        projectId={rejectionProject?.id || ""}
        projectName={rejectionProject?.name || ""}
        rejectionStatus={rejectionStatus}
        open={!!rejectionProject}
        onOpenChange={(open) => { if (!open) { setRejectionProject(null); setRejectionStatus(""); } }}
        onComplete={() => {
          setRejectionProject(null);
          setRejectionStatus("");
          queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
          queryClient.invalidateQueries({ queryKey: ['/api/uc/completions'] });
          queryClient.invalidateQueries({ queryKey: ['/api/escalation-tickets'] });
        }}
      />

      <Dialog open={!!focusProject} onOpenChange={(open) => { if (!open) setFocusProject(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-expanded-view">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Maximize2 className="h-5 w-5" />
              {focusProject?.name}
            </DialogTitle>
            <DialogDescription>
              Expanded UC project view — all details, hydro info, and subtasks in one place.
            </DialogDescription>
          </DialogHeader>
          {focusProject && (
            <ExpandedProjectView project={focusProject} statusOptions={statusOptions} onStatusChange={handleStatusChange} />
          )}
        </DialogContent>
      </Dialog>

      {sortedFiltered.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            {filter === "completed" ? <><CheckCircle2 className="h-3.5 w-3.5" /> Completed ({sortedFiltered.length})</>
            : filter === "submitted" ? <><Clock className="h-3.5 w-3.5" /> Submitted ({sortedFiltered.length})</>
            : filter === "escalated" ? <><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Escalated ({sortedFiltered.length})</>
            : filter === "hidden" ? <><EyeOff className="h-3.5 w-3.5 text-purple-500" /> Hidden ({sortedFiltered.length})</>
            : filter === "needs_action" ? <><AlertTriangle className="h-3.5 w-3.5" /> Action Required ({sortedFiltered.length})</>
            : <>All ({sortedFiltered.length})</>}
          </p>

          {sortedFiltered.map((p) => (
            <UCProjectCard
              key={p.id}
              project={p}
              statusOptions={statusOptions}
              isExpanded={expandedProjectId === p.id}
              onToggleExpand={() => setExpandedProjectId(expandedProjectId === p.id ? null : p.id)}
              onExpand={() => setFocusProject(p)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>{filter === "needs_action" ? "All UC applications are complete — no action needed." : "No projects match this filter."}</p>
        </div>
      )}
    </div>
  );
}
