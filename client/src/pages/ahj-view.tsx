import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, CheckCircle2, Clock, CalendarIcon, Camera } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function getDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isSiteVisitComplete(status: string | null) {
  if (!status) return false;
  return status.toLowerCase().includes('visit complete');
}

function getExpectedAhjDueDate(siteVisitCompletionDate: string | null): string | null {
  if (!siteVisitCompletionDate) return null;
  const d = new Date(siteVisitCompletionDate);
  d.setDate(d.getDate() + 21);
  return d.toISOString().split('T')[0];
}

function isAhjComplete(status: string | null) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('permit issued') || s.includes('closed') || s.includes('not required') || s.includes('permit close off');
}

export default function AHJView() {
  const [filter, setFilter] = useState("action-needed");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: ahjOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/ahjStatus'],
  });

  const { data: siteVisitActions } = useQuery<any[]>({
    queryKey: ['/api/task-actions', 'site_visits'],
  });

  const statusOptions = Array.isArray(ahjOptions) ? ahjOptions.map(o => o.name) : [];

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential')
  );

  const siteVisitCompletionDates: Record<string, string> = {};
  if (siteVisitActions) {
    for (const action of siteVisitActions) {
      if (action.actionType === 'completed' && action.completedAt) {
        const existing = siteVisitCompletionDates[action.projectId];
        const actionDate = new Date(action.completedAt).toISOString().split('T')[0];
        if (!existing || actionDate < existing) {
          siteVisitCompletionDates[action.projectId] = actionDate;
        }
      }
    }
  }

  const ahjProjects = installProjects.map((p: any) => {
    const svComplete = isSiteVisitComplete(p.siteVisitStatus);
    const svCompletionDate = siteVisitCompletionDates[p.id] || null;
    const expectedDue = svComplete ? getExpectedAhjDueDate(svCompletionDate) : null;
    const targetDue = p.ahjDueDate;
    const complete = isAhjComplete(p.ahjStatus);

    let isLate = false;
    if (expectedDue && targetDue) {
      isLate = new Date(expectedDue) > new Date(targetDue);
    }

    return {
      ...p,
      svComplete,
      svCompletionDate,
      expectedAhjDue: expectedDue,
      targetAhjDue: targetDue,
      ahjComplete: complete,
      isLate,
    };
  });

  const filtered = ahjProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;

    if (filter === "action-needed") return !p.ahjComplete && p.svComplete;
    if (filter === "waiting-site-visit") return !p.ahjComplete && !p.svComplete;
    if (filter === "overdue") {
      const targetDays = getDaysUntilDue(p.targetAhjDue);
      return !p.ahjComplete && targetDays !== null && targetDays < 0;
    }
    if (filter === "late") return !p.ahjComplete && p.isLate;
    if (filter === "complete") return p.ahjComplete;
    if (filter !== "all" && p.ahjStatus !== filter) return false;
    return true;
  });

  const sortedFiltered = [...filtered].sort((a: any, b: any) => {
    if (a.ahjComplete && !b.ahjComplete) return 1;
    if (!a.ahjComplete && b.ahjComplete) return -1;
    const aDue = a.expectedAhjDue || a.targetAhjDue;
    const bDue = b.expectedAhjDue || b.targetAhjDue;
    const aDays = getDaysUntilDue(aDue);
    const bDays = getDaysUntilDue(bDue);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  });

  const actionNeededCount = ahjProjects.filter(p => !p.ahjComplete && p.svComplete).length;
  const waitingSiteVisitCount = ahjProjects.filter(p => !p.ahjComplete && !p.svComplete).length;
  const completeCount = ahjProjects.filter(p => p.ahjComplete).length;
  const overdueCount = ahjProjects.filter(p => {
    const targetDays = getDaysUntilDue(p.targetAhjDue);
    return !p.ahjComplete && targetDays !== null && targetDays < 0;
  }).length;
  const lateCount = ahjProjects.filter(p => !p.ahjComplete && p.isLate).length;

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { ahjStatus: newStatus });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "AHJ status updated in Asana" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEngFee = async (projectId: string, collected: boolean) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { engineeringFeeCollected: collected });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: collected ? "Engineering fee marked as collected" : "Engineering fee unmarked" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">AHJ / Permitting</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-ahj-title">AHJ / Permitting</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-action-count">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Action Needed: {actionNeededCount}
          </Badge>
          <Badge variant="secondary" data-testid="badge-waiting-count">
            <Camera className="h-3 w-3 mr-1" />
            Waiting Site Visit: {waitingSiteVisitCount}
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
          {completeCount > 0 && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-complete-count">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Complete: {completeCount}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        AHJ/Permitting depends on site visit completion. Expected due date is 21 days after site visit photos are uploaded. Target due date stays fixed from the project timeline.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-ahj" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[260px]" data-testid="select-ahj-filter">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({ahjProjects.length})</SelectItem>
            <SelectItem value="action-needed">Action Needed - Site Visit Done ({actionNeededCount})</SelectItem>
            <SelectItem value="waiting-site-visit">Waiting on Site Visit ({waitingSiteVisitCount})</SelectItem>
            <SelectItem value="late">Running Late ({lateCount})</SelectItem>
            <SelectItem value="overdue">Overdue ({overdueCount})</SelectItem>
            <SelectItem value="complete">Complete ({completeCount})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedFiltered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{filter === "action-needed" ? "No projects ready for AHJ. Site visits need to be completed first." : "No projects match this filter."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFiltered.map((p: any) => {
            const targetDays = getDaysUntilDue(p.targetAhjDue);
            const expectedDays = getDaysUntilDue(p.expectedAhjDue);
            const isOverdue = !p.ahjComplete && targetDays !== null && targetDays < 0;

            return (
              <Card
                key={p.id}
                className={p.ahjComplete ? "border-green-300 dark:border-green-800" : isOverdue ? "border-red-300 dark:border-red-800" : p.isLate ? "border-amber-300 dark:border-amber-800" : ""}
                data-testid={`card-project-${p.id}`}
              >
                <CardContent className="py-3 px-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                        <StatusBadge status={p.ahjStatus} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{p.province || 'No province'}</span>
                        <span className="text-xs text-muted-foreground">UC: {p.ucStatus || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">
                          Site Visit: {p.siteVisitStatus || 'N/A'}
                          {p.svComplete && <CheckCircle2 className="inline h-3 w-3 ml-1 text-green-600" />}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {p.targetAhjDue && (
                          <Badge
                            variant={isOverdue ? "destructive" : "outline"}
                            className="text-xs flex items-center gap-1"
                            data-testid={`badge-target-due-${p.id}`}
                          >
                            <Clock className="h-3 w-3" />
                            Target: {new Date(p.targetAhjDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {isOverdue && ` (${Math.abs(targetDays!)}d overdue)`}
                          </Badge>
                        )}

                        {p.svComplete && p.expectedAhjDue && (
                          <Badge
                            className={`text-xs flex items-center gap-1 ${
                              p.isLate
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                : expectedDays !== null && expectedDays <= 5
                                  ? "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                            data-testid={`badge-expected-due-${p.id}`}
                          >
                            <Clock className="h-3 w-3" />
                            Expected: {new Date(p.expectedAhjDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {expectedDays !== null && (
                              <span>
                                ({expectedDays < 0 ? `${Math.abs(expectedDays)}d overdue` : `${expectedDays}d left`})
                              </span>
                            )}
                            {p.isLate && <span className="font-semibold ml-1">LATE</span>}
                          </Badge>
                        )}

                        {!p.svComplete && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1 bg-gray-50 dark:bg-gray-900" data-testid={`badge-waiting-sv-${p.id}`}>
                            <Camera className="h-3 w-3" />
                            Waiting on site visit
                          </Badge>
                        )}

                        {p.svComplete && p.svCompletionDate && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid={`badge-sv-completed-${p.id}`}>
                            <CheckCircle2 className="h-3 w-3" />
                            Site visit done: {new Date(p.svCompletionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <Select value={p.ahjStatus || ''} onValueChange={(v) => handleStatusChange(p.id, v)}>
                        <SelectTrigger className="h-8 text-xs w-full" data-testid={`select-ahj-status-${p.id}`}>
                          <SelectValue placeholder="Change status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <TaskActionDialog projectId={p.id} projectName={p.name} viewType="ahj" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!!p.permitPaymentCollected}
                        disabled
                        data-testid={`checkbox-permit-payment-${p.id}`}
                      />
                      <span className="text-xs text-muted-foreground">$1,500 permit fee</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!!p.engineeringFeeCollected}
                        onCheckedChange={(checked) => handleEngFee(p.id, !!checked)}
                        data-testid={`checkbox-eng-fee-${p.id}`}
                      />
                      <span className="text-xs">P.eng fee collected</span>
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
