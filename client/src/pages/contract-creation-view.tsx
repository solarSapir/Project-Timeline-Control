import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, CheckCircle2, AlertTriangle, DollarSign, MessageSquare } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useTaskActions } from "@/hooks/use-task-actions";
import { useWorkflowConfig } from "@/hooks/use-workflow-config";
import { useContractActions } from "@/hooks/use-contract-actions";
import { areDependenciesMet, type WorkflowConfig } from "@/lib/stage-dependencies";
import { ContractCard } from "@/components/contracts/ContractCard";
import { WaitingDepsCard } from "@/components/contracts/WaitingDepsCard";
import { getLastFollowUp, findAction, hasAction, filterProjects, sortByDue, computeCounts } from "@/hooks/use-contract-filters";

export default function ContractCreationView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("needs_contract");
  const { residentialProjects, isLoading } = useProjects();
  const { data: taskActions } = useTaskActions('contracts');
  const { data: workflowConfigs } = useWorkflowConfig();
  const { updating, handleContractSent, handleContractSigned, handleDepositCollected } = useContractActions();

  const configs = workflowConfigs as WorkflowConfig[] | undefined;
  const depsMetProjects = residentialProjects.filter((p) => areDependenciesMet(p, "contract_signing", configs));
  const waitingDepsProjects = residentialProjects.filter((p) => !areDependenciesMet(p, "contract_signing", configs));

  const sortedFiltered = sortByDue(filterProjects(depsMetProjects, filter, search, taskActions));
  const counts = computeCounts(depsMetProjects, taskActions);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Contracts</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  const emptyMsg = filter === "needs_followup" ? "All pending signatures have been followed up today — check back in 24 hours."
    : filter === "followed_up" ? "No projects have been followed up recently." : "No projects match this filter.";

  const waitingVisible = waitingDepsProjects.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-contracts-title">Contracts</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-uc-ready-count"><CheckCircle2 className="h-3 w-3 mr-1" />UC Ready: {depsMetProjects.length}</Badge>
          <Badge variant="secondary" data-testid="badge-needs-contract-count"><FileText className="h-3 w-3 mr-1" />Needs Contract: {counts.needsContract}</Badge>
          {counts.needsFollowUp > 0 && <Badge variant="destructive" data-testid="badge-needs-followup-count"><MessageSquare className="h-3 w-3 mr-1" />Needs Follow-up: {counts.needsFollowUp}</Badge>}
          {counts.followedUp > 0 && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-followed-up-count"><CheckCircle2 className="h-3 w-3 mr-1" />Followed Up: {counts.followedUp}</Badge>}
          {counts.pendingDeposit > 0 && <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" data-testid="badge-pending-deposit-count"><DollarSign className="h-3 w-3 mr-1" />Pending Deposit: {counts.pendingDeposit}</Badge>}
          {counts.overdue > 0 && <Badge variant="destructive" data-testid="badge-overdue-count"><AlertTriangle className="h-3 w-3 mr-1" />Overdue: {counts.overdue}</Badge>}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Projects appear once all workflow dependencies are met. Contract due within 7 days of UC completion. Follow up on pending signatures every 24 hours with proof.
        {waitingDepsProjects.length > 0 && (
          <span className="ml-1 text-amber-600 dark:text-amber-400">({waitingDepsProjects.length} project{waitingDepsProjects.length !== 1 ? 's' : ''} waiting on dependencies)</span>
        )}
      </p>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[240px]" data-testid="select-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All UC-Ready ({depsMetProjects.length})</SelectItem>
            <SelectItem value="needs_contract">Needs Contract ({counts.needsContract})</SelectItem>
            <SelectItem value="needs_followup">Needs Follow-up ({counts.needsFollowUp})</SelectItem>
            <SelectItem value="followed_up">Recently Followed Up ({counts.followedUp})</SelectItem>
            <SelectItem value="pending_signature">All Pending Signature ({counts.pendingSig})</SelectItem>
            <SelectItem value="pending_deposit">Pending Deposit ({counts.pendingDeposit})</SelectItem>
            <SelectItem value="complete">Contract Complete ({counts.complete})</SelectItem>
            <SelectItem value="overdue">Overdue ({counts.overdue})</SelectItem>
            {waitingDepsProjects.length > 0 && <SelectItem value="waiting_deps">Waiting on Dependencies ({waitingDepsProjects.length})</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {filter === "waiting_deps" ? (
        waitingVisible.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><p>No projects match this filter.</p></div>
        ) : (
          <div className="space-y-3">
            {waitingVisible.map((p) => <WaitingDepsCard key={p.id} project={p} workflowConfigs={configs} />)}
          </div>
        )
      ) : sortedFiltered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><p>{emptyMsg}</p></div>
      ) : (
        <div className="space-y-3">
          {sortedFiltered.map((p) => (
            <ContractCard
              key={p.id}
              project={p}
              lastFollowUp={getLastFollowUp(taskActions, p.id)}
              docUploaded={hasAction(taskActions, p.id, 'document_upload')}
              docUploadAction={findAction(taskActions, p.id, 'document_upload')}
              approved={hasAction(taskActions, p.id, 'contract_approved')}
              approvalAction={findAction(taskActions, p.id, 'contract_approved')}
              updating={updating}
              onContractSent={handleContractSent}
              onContractSigned={handleContractSigned}
              onDepositCollected={handleDepositCollected}
            />
          ))}
        </div>
      )}
    </div>
  );
}
