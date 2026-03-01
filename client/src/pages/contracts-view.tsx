import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/logo-spinner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, FileText, CheckCircle2, AlertTriangle, DollarSign, MessageSquare, Maximize2, Upload, Eye, EyeOff } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useTaskActions } from "@/hooks/use-task-actions";
import { useWorkflowConfig } from "@/hooks/use-workflow-config";
import { useContractActions } from "@/hooks/use-contract-actions";
import { areDependenciesMet, type WorkflowConfig } from "@/lib/stage-dependencies";
import { ContractCard } from "@/components/contracts/ContractCard";
import { ContractExpandedView } from "@/components/contracts/ContractExpandedView";
import { WaitingDepsCard } from "@/components/contracts/WaitingDepsCard";
import { getLastFollowUp, findAction, hasAction, filterProjects, sortByDue, computeCounts } from "@/hooks/use-contract-filters";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, TaskAction, ContractCompletion, ContractWorkflowRule } from "@shared/schema";

export type ContractFileDetail = { total: number; contract: boolean; proposal: boolean; sitePlan: boolean };
export type ContractFileCounts = Record<string, ContractFileDetail>;

function ContractCardList({ projects, taskActions, contractFileCounts, updating, onContractSent, onContractSigned, onDepositCollected, onFocus, completions, onReadyForReview, readyForReviewPending, followUpHideDays }: {
  projects: Project[];
  taskActions: TaskAction[] | undefined;
  contractFileCounts: ContractFileCounts;
  updating: string | null;
  onContractSent: (p: Project, c: boolean) => void;
  onContractSigned: (p: Project, c: boolean) => void;
  onDepositCollected: (p: Project, c: boolean) => void;
  onFocus: (p: Project) => void;
  completions: ContractCompletion[];
  onReadyForReview: (projectId: string) => void;
  readyForReviewPending: boolean;
  followUpHideDays: number;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {projects.map((p) => {
        const detail = contractFileCounts[p.id];
        const hasRealFiles = detail ? detail.total > 0 : false;
        const uploadedCount = detail ? (detail.contract ? 1 : 0) + (detail.proposal ? 1 : 0) + (detail.sitePlan ? 1 : 0) : 0;
        const isReady = hasReadyForReview(completions, p.id);
        const isApprovedCompletion = hasContractApproved(completions, p.id);
        const showFollowUp = needsReviewFollowUp(completions, p.id);
        return (
          <ContractCard
            key={p.id}
            project={p}
            lastFollowUp={getLastFollowUp(taskActions, p.id)}
            docUploaded={hasRealFiles}
            uploadedCount={uploadedCount}
            docUploadAction={hasRealFiles ? findAction(taskActions, p.id, 'document_upload') : null}
            approved={hasRealFiles && hasAction(taskActions, p.id, 'contract_approved')}
            approvalAction={hasRealFiles ? findAction(taskActions, p.id, 'contract_approved') : null}
            updating={updating}
            isExpanded={expandedId === p.id}
            onToggleExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
            onExpand={() => onFocus(p)}
            onContractSent={onContractSent}
            onContractSigned={onContractSigned}
            onDepositCollected={onDepositCollected}
            readyForReview={isReady}
            contractApproved={isApprovedCompletion}
            showReviewFollowUp={showFollowUp}
            reviewFollowUpHideDays={followUpHideDays}
            onReadyForReview={() => onReadyForReview(p.id)}
            readyForReviewPending={readyForReviewPending}
          />
        );
      })}
    </div>
  );
}

function isHiddenByWorkflow(completions: ContractCompletion[], projectId: string): boolean {
  const projCompletions = completions.filter(c => c.projectId === projectId);
  if (projCompletions.length === 0) return false;
  const latest = projCompletions.reduce((a, b) =>
    new Date(a.completedAt!).getTime() > new Date(b.completedAt!).getTime() ? a : b
  );
  if (!latest.hideDays || latest.hideDays <= 0) return false;
  const hideUntil = new Date(latest.completedAt!).getTime() + latest.hideDays * 86400000;
  return hideUntil > Date.now();
}

function needsReviewFollowUp(completions: ContractCompletion[], projectId: string): boolean {
  const projCompletions = completions.filter(c => c.projectId === projectId);
  const latest = projCompletions.reduce<ContractCompletion | null>((a, b) =>
    !a ? b : new Date(a.completedAt!).getTime() > new Date(b.completedAt!).getTime() ? a : b
  , null);
  if (!latest) return false;
  if (latest.actionType !== 'ready_for_review' && latest.actionType !== 'follow_up_review') return false;
  if (!latest.hideDays || latest.hideDays <= 0) return false;
  const hideUntil = new Date(latest.completedAt!).getTime() + latest.hideDays * 86400000;
  return hideUntil <= Date.now();
}

function hasReadyForReview(completions: ContractCompletion[], projectId: string): boolean {
  return completions.some(c => c.projectId === projectId && c.actionType === 'ready_for_review');
}

function hasContractApproved(completions: ContractCompletion[], projectId: string): boolean {
  return completions.some(c => c.projectId === projectId && c.actionType === 'contract_approved');
}

export default function ContractCreationView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("needs_contract");
  const [focusProject, setFocusProject] = useState<Project | null>(null);
  const { residentialProjects, isLoading } = useProjects();
  const { data: taskActions } = useTaskActions('contracts');
  const { data: workflowConfigs } = useWorkflowConfig();
  const { data: contractFileCounts } = useQuery<ContractFileCounts>({ queryKey: ['/api/projects/contract-file-counts'] });
  const { data: contractCompletions } = useQuery<ContractCompletion[]>({ queryKey: ['/api/contracts/completions'] });
  const { data: workflowRules } = useQuery<ContractWorkflowRule[]>({ queryKey: ['/api/contracts/workflow-rules'] });
  const { updating, handleContractSent, handleContractSigned, handleDepositCollected } = useContractActions();
  const { toast } = useToast();

  const urlParams = new URLSearchParams(window.location.search);
  const urlFilter = urlParams.get('filter');
  useEffect(() => {
    if (urlFilter && ['to_create', 'for_review'].includes(urlFilter)) {
      setFilter(urlFilter === 'to_create' ? 'needs_contract' : 'for_review');
    }
  }, [urlFilter]);

  const completions = contractCompletions || [];
  const reviewHideDays = useMemo(() => {
    const rule = (workflowRules || []).find(r => r.triggerAction === 'ready_for_review');
    return rule?.hideDays ?? 1;
  }, [workflowRules]);
  const followUpHideDays = useMemo(() => {
    const rule = (workflowRules || []).find(r => r.triggerAction === 'follow_up_review');
    return rule?.hideDays ?? 1;
  }, [workflowRules]);

  const readyForReviewMutation = useMutation({
    mutationFn: async ({ projectId, staffName }: { projectId: string; staffName: string }) => {
      await apiRequest("POST", "/api/contracts/complete-action", {
        projectId,
        staffName,
        actionType: "ready_for_review",
        fromStatus: null,
        toStatus: null,
        notes: "Marked ready for manager review",
        hideDays: reviewHideDays,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/completions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/kpi-stats'] });
      toast({ title: "Marked ready for review" });
    },
  });

  const configs = workflowConfigs as WorkflowConfig[] | undefined;
  const depsMetProjects = residentialProjects.filter((p) => areDependenciesMet(p, "contract_signing", configs));
  const waitingDepsProjects = residentialProjects.filter((p) => !areDependenciesMet(p, "contract_signing", configs));

  const fileCounts = contractFileCounts || {};

  const hiddenCount = depsMetProjects.filter(p => isHiddenByWorkflow(completions, p.id)).length;
  const needsReviewFollowUpCount = depsMetProjects.filter(p => needsReviewFollowUp(completions, p.id)).length;

  const filteredProjects = useMemo(() => {
    let base = depsMetProjects;
    if (filter === "hidden") {
      return base.filter(p => isHiddenByWorkflow(completions, p.id));
    }
    if (filter === "needs_review_followup") {
      return base.filter(p => needsReviewFollowUp(completions, p.id));
    }
    base = base.filter(p => !isHiddenByWorkflow(completions, p.id));
    return filterProjects(base, filter, search, taskActions, fileCounts);
  }, [depsMetProjects, filter, search, taskActions, fileCounts, completions]);

  const sortedFiltered = sortByDue(filteredProjects);
  const counts = computeCounts(depsMetProjects.filter(p => !isHiddenByWorkflow(completions, p.id)), taskActions, fileCounts);

  if (isLoading) {
    return <PageLoader title="Loading contracts..." />;
  }

  const emptyMsg = filter === "needs_followup" ? "All pending signatures have been followed up today — check back in 24 hours."
    : filter === "followed_up" ? "No projects have been followed up recently."
    : filter === "hidden" ? "No contracts are currently hidden."
    : filter === "needs_review_followup" ? "No contracts need review follow-up right now."
    : "No projects match this filter.";

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
          {counts.forReview > 0 && <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 ring-1 ring-orange-300 dark:ring-orange-700 cursor-pointer" onClick={() => setFilter("for_review")} data-testid="badge-for-review-count"><Upload className="h-3 w-3 mr-1" />For Review: {counts.forReview}</Badge>}
          {needsReviewFollowUpCount > 0 && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 cursor-pointer" onClick={() => setFilter("needs_review_followup")} data-testid="badge-review-followup-count"><Eye className="h-3 w-3 mr-1" />Review Follow-up: {needsReviewFollowUpCount}</Badge>}
          {hiddenCount > 0 && <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 cursor-pointer" onClick={() => setFilter("hidden")} data-testid="badge-hidden-count"><EyeOff className="h-3 w-3 mr-1" />Hidden: {hiddenCount}</Badge>}
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
            <SelectItem value="for_review">For Review ({counts.forReview})</SelectItem>
            <SelectItem value="needs_review_followup">Review Follow-up ({needsReviewFollowUpCount})</SelectItem>
            <SelectItem value="needs_followup">Needs Follow-up ({counts.needsFollowUp})</SelectItem>
            <SelectItem value="followed_up">Recently Followed Up ({counts.followedUp})</SelectItem>
            <SelectItem value="pending_signature">All Pending Signature ({counts.pendingSig})</SelectItem>
            <SelectItem value="pending_deposit">Pending Deposit ({counts.pendingDeposit})</SelectItem>
            <SelectItem value="complete">Contract Complete ({counts.complete})</SelectItem>
            <SelectItem value="overdue">Overdue ({counts.overdue})</SelectItem>
            <SelectItem value="hidden">Hidden ({hiddenCount})</SelectItem>
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
        <ContractCardList
          projects={sortedFiltered}
          taskActions={taskActions}
          contractFileCounts={contractFileCounts || {}}
          updating={updating}
          onContractSent={handleContractSent}
          onContractSigned={handleContractSigned}
          onDepositCollected={handleDepositCollected}
          onFocus={(p) => setFocusProject(p)}
          completions={completions}
          onReadyForReview={(projectId) => readyForReviewMutation.mutate({ projectId, staffName: "System" })}
          readyForReviewPending={readyForReviewMutation.isPending}
          followUpHideDays={followUpHideDays}
        />
      )}

      <Dialog open={!!focusProject} onOpenChange={(open) => { if (!open) setFocusProject(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-contract-focus">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Maximize2 className="h-5 w-5" />
              {focusProject?.name}
            </DialogTitle>
            <DialogDescription>
              Contract focus view — project details, documents, approval status, and subtasks.
            </DialogDescription>
          </DialogHeader>
          {focusProject && (
            <ContractExpandedView
              project={focusProject}
              docUploaded={fileCounts[focusProject.id] ? fileCounts[focusProject.id].total > 0 : false}
              uploadedCount={fileCounts[focusProject.id] ? (fileCounts[focusProject.id].contract ? 1 : 0) + (fileCounts[focusProject.id].proposal ? 1 : 0) + (fileCounts[focusProject.id].sitePlan ? 1 : 0) : 0}
              docUploadAction={findAction(taskActions, focusProject.id, 'document_upload')}
              approved={hasAction(taskActions, focusProject.id, 'contract_approved')}
              approvalAction={findAction(taskActions, focusProject.id, 'contract_approved')}
              lastFollowUp={getLastFollowUp(taskActions, focusProject.id)}
              updating={updating}
              onContractSent={handleContractSent}
              onContractSigned={handleContractSigned}
              onDepositCollected={handleDepositCollected}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
