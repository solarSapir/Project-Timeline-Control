import { useQuery } from "@tanstack/react-query";
import type { Project, EscalationTicket, ContractCompletion, PauseLog, UcCompletion } from "@shared/schema";
import { isUcComplete, isAhjComplete, isVisitComplete, isVisitBooked, isPermitIssued, isContractSent } from "@/utils/stages";
import { areDependenciesMet, type WorkflowConfig } from "@/lib/stage-dependencies";

const UC_EXCLUDED_SECTORS = ['commercial', 'industrial', 'agricultural', 'institutional'];
const UC_ELIGIBLE_TYPES = ['install', 'diy'];
const UC_EXCLUDED_PM = ['complete', 'project paused', 'project lost'];

const DEPS_EXCLUDED_SECTORS = ['commercial', 'industrial', 'agricultural', 'institutional', 'multi-residential'];
const DEPS_EXCLUDED_PM = ['complete', 'project paused', 'project lost', 'close-off'];

const SIMPLE_EXCLUDED_PM = ['complete', 'project paused', 'project lost'];

function filterUcEligible(projects: Project[]): Project[] {
  return projects.filter(p => {
    if (!UC_ELIGIBLE_TYPES.includes(p.installType?.toLowerCase() || '')) return false;
    if (p.propertySector) {
      const sector = p.propertySector.toLowerCase();
      if (UC_EXCLUDED_SECTORS.some(s => sector.includes(s))) return false;
    }
    const pm = p.pmStatus?.toLowerCase() ?? '';
    if (UC_EXCLUDED_PM.some(s => pm.includes(s))) return false;
    return true;
  });
}

function filterDepsEligible(projects: Project[]): Project[] {
  return projects.filter(p => {
    if (p.installType?.toLowerCase() !== 'install') return false;
    const sector = p.propertySector?.toLowerCase() ?? '';
    if (DEPS_EXCLUDED_SECTORS.some(s => sector.includes(s))) return false;
    const pm = p.pmStatus?.toLowerCase() ?? '';
    if (DEPS_EXCLUDED_PM.some(s => pm.includes(s))) return false;
    return true;
  });
}

function filterSimpleResidential(projects: Project[]): Project[] {
  return projects.filter(p => {
    if (p.installType?.toLowerCase() !== 'install') return false;
    if (p.propertySector && p.propertySector.toLowerCase() !== 'residential') return false;
    const pm = p.pmStatus?.toLowerCase() ?? '';
    if (SIMPLE_EXCLUDED_PM.some(s => pm.includes(s))) return false;
    return true;
  });
}

function isPlannerIncomplete(p: Project): boolean {
  if (p.installType?.toLowerCase() !== 'install') return false;
  const isNS = p.province?.toLowerCase().includes('nova scotia') || p.province?.toLowerCase() === 'ns';
  const hasContractor = !!p.contractStatus && p.contractStatus !== 'A. Not Assign';
  const scopeOk = !!p.plannerScopeConfirmed;
  const proposalOk = !!p.plannerProposalUrl;
  const sitePlanOk = !!p.plannerSitePlanUrl;
  const costOk = !!p.plannerTotalCost;
  const payoutOk = !!p.plannerContractorPayout;
  const contractSent = !!p.plannerContractSent;
  const contractSigned = !!p.plannerContractSigned;
  const permitOk = !isNS || !!p.electricalPermitUrl;
  return !(hasContractor && scopeOk && proposalOk && sitePlanOk && costOk && payoutOk && contractSent && contractSigned && permitOk);
}

function isRebateEligible(p: Project): boolean {
  return !!(
    p.ucTeam?.toLowerCase().includes('load displacement') &&
    p.province?.toLowerCase().includes('ontario')
  );
}

function isWaitingForInstall(p: Project): boolean {
  const s = (p.rebateStatus || '').toLowerCase();
  return s.includes('pre approved') || s.includes('pre-approved') || s === 'complete - (pre approved, waiting for job to complete)';
}

function isContractHiddenByWorkflow(completions: ContractCompletion[], projectId: string): boolean {
  const projCompletions = completions.filter(c => c.projectId === projectId);
  if (projCompletions.length === 0) return false;
  const latest = projCompletions.reduce((a, b) =>
    new Date(a.completedAt!).getTime() > new Date(b.completedAt!).getTime() ? a : b
  );
  if (!latest.hideDays || latest.hideDays <= 0) return false;
  const hideUntil = new Date(latest.completedAt!).getTime() + latest.hideDays * 86400000;
  return hideUntil > Date.now();
}

function isUcHiddenByWorkflow(completions: UcCompletion[], projectId: string): boolean {
  const projCompletions = completions.filter(c => c.projectId === projectId);
  if (projCompletions.length === 0) return false;
  const latest = projCompletions[0];
  if (!latest.completedAt || !latest.hideDays || latest.hideDays <= 0) return false;
  const hideUntil = new Date(latest.completedAt).getTime() + latest.hideDays * 86400000;
  return hideUntil > Date.now();
}

function isUcHiddenByEscalation(escalationTickets: EscalationTicket[], projectId: string): boolean {
  const ticket = escalationTickets.find(t =>
    t.projectId === projectId && t.viewType === 'uc' && (t.status === 'open' || t.status === 'responded')
  );
  if (!ticket || !ticket.hideUntil) return false;
  return ticket.status === 'open' && new Date(ticket.hideUntil) > new Date();
}

export function useSidebarCounts() {
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    refetchInterval: 60000,
  });

  const { data: escalationTickets } = useQuery<EscalationTicket[]>({
    queryKey: ['/api/escalation-tickets'],
    refetchInterval: 60000,
  });

  const { data: workflowConfigs } = useQuery<WorkflowConfig[]>({
    queryKey: ['/api/workflow-config'],
  });

  const { data: contractCompletions } = useQuery<ContractCompletion[]>({
    queryKey: ['/api/contracts/completions'],
    refetchInterval: 60000,
  });

  const { data: ucCompletions } = useQuery<UcCompletion[]>({
    queryKey: ['/api/uc/completions'],
    refetchInterval: 60000,
  });

  const { data: pauseLogs } = useQuery<PauseLog[]>({
    queryKey: ['/api/pause-reasons/logs'],
    refetchInterval: 60000,
  });

  if (!projects) return {};

  const allProjects = projects;
  const ucEligible = filterUcEligible(allProjects);
  const depsEligible = filterDepsEligible(allProjects);
  const simpleResidential = filterSimpleResidential(allProjects);

  const pausedAll = allProjects.filter(p => p.pmStatus?.toLowerCase() === 'project paused');
  const todayStr = new Date().toISOString().split("T")[0];
  const projectFollowUps = new Map<string, string>();
  for (const log of (pauseLogs || [])) {
    if (log.followUpDate) {
      const existing = projectFollowUps.get(log.projectId);
      if (!existing || log.followUpDate > existing) {
        projectFollowUps.set(log.projectId, log.followUpDate);
      }
    }
  }
  const paused = pausedAll.filter(p => {
    const fu = projectFollowUps.get(p.id);
    return !fu || fu <= todayStr;
  }).length;

  const escalated = (escalationTickets || []).filter(t => t.status === 'open').length;

  const ucComps = ucCompletions || [];
  const escTickets = escalationTickets || [];
  const ucActive = ucEligible.filter(p =>
    !isUcComplete(p.ucStatus) &&
    !isPlannerIncomplete(p) &&
    !isUcHiddenByWorkflow(ucComps, p.id) &&
    !isUcHiddenByEscalation(escTickets, p.id)
  ).length;

  const rebateBase = simpleResidential.filter(p => isRebateEligible(p) && !isWaitingForInstall(p));
  const rebatesNeedAttention = rebateBase.filter(p => {
    const s = p.rebateStatus?.toLowerCase() ?? '';
    return !p.rebateStatus || s.includes('new') || s.includes('check');
  }).length;

  const paymentNeeded = simpleResidential.filter(p => !p.paymentMethod).length;

  const configs = workflowConfigs ?? null;

  const contractDepsMetProjects = depsEligible.filter(p =>
    areDependenciesMet(p, "contract_signing", configs)
  );

  const completionsArr = contractCompletions || [];
  const visibleContractProjects = contractDepsMetProjects.filter(p =>
    !isContractHiddenByWorkflow(completionsArr, p.id)
  );

  const contractsNeeded = visibleContractProjects.filter(p =>
    !isContractSent(p.installTeamStage)
  ).length;

  const contractsForReview = visibleContractProjects.filter(p => {
    const hasReady = completionsArr.some(c => c.projectId === p.id && c.actionType === 'ready_for_review');
    const hasApproved = completionsArr.some(c => c.projectId === p.id && c.actionType === 'contract_approved');
    return hasReady && !hasApproved;
  }).length;

  const siteVisitsPending = depsEligible.filter(p => {
    if (!areDependenciesMet(p, "site_visit", configs)) return false;
    const stage = p.installTeamStage?.toLowerCase() ?? '';
    if (!stage.includes('pending site visit')) return false;
    return !isVisitComplete(p.siteVisitStatus) && !isVisitBooked(p.siteVisitStatus);
  }).length;

  const ahjAction = depsEligible.filter(p => {
    if (!areDependenciesMet(p, "ahj_permitting", configs)) return false;
    return !isAhjComplete(p.ahjStatus) && isVisitComplete(p.siteVisitStatus);
  }).length;

  const plannerNeeded = simpleResidential.filter(p => isPlannerIncomplete(p)).length;

  const installAction = depsEligible.filter(p => {
    if (!areDependenciesMet(p, "install_booking", configs)) return false;
    return isPermitIssued(p.ahjStatus);
  }).length;

  const closeOffPending = allProjects.filter(p => {
    const pm = p.pmStatus?.toLowerCase() ?? '';
    if (!pm.includes('close')) return false;
    const ucDone = isUcComplete(p.ucStatus);
    const ahjDone = isAhjComplete(p.ahjStatus);
    return !(ucDone && ahjDone);
  }).length;

  return {
    '/paused': paused,
    '/escalated': escalated,
    '/uc': ucActive,
    '/rebates': rebatesNeedAttention,
    '/payment-method': paymentNeeded,
    '/contracts': contractsNeeded,
    '/contracts/to_create': contractsNeeded,
    '/contracts/for_review': contractsForReview,
    '/site-visits': siteVisitsPending,
    '/ahj': ahjAction,
    '/planner': plannerNeeded,
    '/installs': installAction,
    '/close-off': closeOffPending,
  } as Record<string, number>;
}
