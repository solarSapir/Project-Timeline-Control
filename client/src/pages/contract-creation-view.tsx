import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, CalendarClock, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function getDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const UC_COMPLETE_STATUSES = ['approved', 'complete', 'not required'];

function isUcComplete(ucStatus: string | null) {
  if (!ucStatus) return false;
  const s = ucStatus.toLowerCase();
  return UC_COMPLETE_STATUSES.some(status => s.includes(status));
}

function getContractDueDate(project: any) {
  if (!isUcComplete(project.ucStatus)) return null;

  if (project.ucStatus?.toLowerCase().includes('not required')) {
    const base = project.projectCreatedDate || project.createdAt;
    if (!base) return null;
    const d = new Date(base);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }

  const ucDue = project.ucDueDate;
  if (ucDue) {
    const d = new Date(ucDue);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }

  return null;
}

function getContractSentDate(project: any) {
  const fields = project.asanaCustomFields || [];
  const field = fields.find((f: any) =>
    f.name?.toLowerCase().includes('date contract sent')
  );
  return field?.display_value ? field.display_value.split('T')[0] : null;
}

function getContractFollowUpDate(project: any) {
  const fields = project.asanaCustomFields || [];
  const field = fields.find((f: any) =>
    f.name?.toLowerCase().includes('date followed up on with contract')
  );
  return field?.display_value ? field.display_value.split('T')[0] : null;
}

function ContractDueBadge({ project }: { project: any }) {
  const dueDate = getContractDueDate(project);
  const daysLeft = getDaysUntilDue(dueDate);
  if (daysLeft === null || !dueDate) return null;

  const formattedDate = new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (daysLeft < 0) {
    return (
      <Badge variant="destructive" className="text-xs flex items-center gap-1" data-testid="badge-contract-overdue">
        <CalendarClock className="h-3 w-3" />
        {Math.abs(daysLeft)}d overdue ({formattedDate})
      </Badge>
    );
  }
  if (daysLeft <= 3) {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs flex items-center gap-1" data-testid="badge-contract-due-soon">
        <CalendarClock className="h-3 w-3" />
        Due in {daysLeft}d ({formattedDate})
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid="badge-contract-due">
      <CalendarClock className="h-3 w-3" />
      Due {formattedDate}
    </Badge>
  );
}

export default function ContractCreationView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("needs_contract");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential')
  );

  const ucReadyProjects = installProjects.filter((p: any) => isUcComplete(p.ucStatus));

  const filtered = ucReadyProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    const contractSent = getContractSentDate(p);
    if (filter === "needs_contract") return !contractSent;
    if (filter === "contract_sent") return !!contractSent;
    if (filter === "overdue") {
      const dueDate = getContractDueDate(p);
      const daysLeft = getDaysUntilDue(dueDate);
      return !contractSent && daysLeft !== null && daysLeft < 0;
    }
    return true;
  });

  const sortedFiltered = [...filtered].sort((a: any, b: any) => {
    const aSent = getContractSentDate(a);
    const bSent = getContractSentDate(b);
    if (!aSent && bSent) return -1;
    if (aSent && !bSent) return 1;
    const aDue = getContractDueDate(a);
    const bDue = getContractDueDate(b);
    const aDays = getDaysUntilDue(aDue);
    const bDays = getDaysUntilDue(bDue);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  });

  const needsContractCount = ucReadyProjects.filter((p: any) => !getContractSentDate(p)).length;
  const overdueCount = ucReadyProjects.filter((p: any) => {
    const contractSent = getContractSentDate(p);
    if (contractSent) return false;
    const dueDate = getContractDueDate(p);
    const daysLeft = getDaysUntilDue(dueDate);
    return daysLeft !== null && daysLeft < 0;
  }).length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Contracts</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-contracts-title">Contracts</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-uc-ready-count">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            UC Ready: {ucReadyProjects.length}
          </Badge>
          <Badge variant="secondary" data-testid="badge-needs-contract-count">
            <FileText className="h-3 w-3 mr-1" />
            Needs Contract: {needsContractCount}
          </Badge>
          {overdueCount > 0 && (
            <Badge variant="destructive" data-testid="badge-overdue-count">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Overdue: {overdueCount}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Projects appear here once UC is Approved, Complete, or Not Required. Contract due within 7 days of UC completion.
      </p>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All UC-Ready ({ucReadyProjects.length})</SelectItem>
            <SelectItem value="needs_contract">Needs Contract ({needsContractCount})</SelectItem>
            <SelectItem value="contract_sent">Contract Sent</SelectItem>
            <SelectItem value="overdue">Overdue ({overdueCount})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedFiltered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No projects match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFiltered.map((p: any) => {
            const contractSent = getContractSentDate(p);
            const followUp = getContractFollowUpDate(p);
            const dueDate = getContractDueDate(p);
            const daysLeft = getDaysUntilDue(dueDate);
            const isOverdue = !contractSent && daysLeft !== null && daysLeft < 0;

            return (
              <Card
                key={p.id}
                className={isOverdue ? "border-red-300 dark:border-red-800" : ""}
                data-testid={`card-project-${p.id}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                        <Badge
                          variant="outline"
                          className={
                            p.ucStatus?.toLowerCase().includes('not required')
                              ? "text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              : p.ucStatus?.toLowerCase().includes('complete')
                                ? "text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }
                          data-testid={`badge-uc-status-${p.id}`}
                        >
                          UC: {p.ucStatus}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{p.province || 'No province'}</span>
                        <span className="text-xs text-muted-foreground">PM: {p.pmStatus || 'N/A'}</span>
                        {p.ucTeam && (
                          <span className="text-xs text-muted-foreground">UC Team: {p.ucTeam}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <ContractDueBadge project={p} />
                        {contractSent && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs flex items-center gap-1" data-testid={`badge-contract-sent-${p.id}`}>
                            <CheckCircle2 className="h-3 w-3" />
                            Contract sent {new Date(contractSent).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                        )}
                        {followUp && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid={`badge-follow-up-${p.id}`}>
                            <Clock className="h-3 w-3" />
                            Follow-up {new Date(followUp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                        )}
                        {!contractSent && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1" data-testid={`badge-awaiting-contract-${p.id}`}>
                            <FileText className="h-3 w-3" />
                            Awaiting contract
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <TaskActionDialog projectId={p.id} projectName={p.name} viewType="contracts" />
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
