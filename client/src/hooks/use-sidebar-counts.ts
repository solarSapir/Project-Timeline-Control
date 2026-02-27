import { useQuery } from "@tanstack/react-query";
import type { Project, EscalationTicket } from "@shared/schema";
import { isUcComplete, isAhjComplete, isVisitComplete, isVisitBooked, isPermitIssued, isContractSent } from "@/utils/stages";
import { areDependenciesMet, type WorkflowConfig } from "@/lib/stage-dependencies";

const NON_RESIDENTIAL_SECTORS = [
  'commercial', 'industrial', 'agricultural', 'institutional', 'multi-residential',
];
const EXCLUDED_PM_STATUSES = ['complete', 'project paused', 'project lost'];

function isResidentialInstall(p: Project): boolean {
  if (p.installType?.toLowerCase() !== 'install') return false;
  if (p.propertySector && p.propertySector.toLowerCase() !== 'residential') {
    const sector = p.propertySector.toLowerCase();
    if (NON_RESIDENTIAL_SECTORS.some(s => sector.includes(s))) return false;
  }
  const pm = p.pmStatus?.toLowerCase() ?? '';
  if (EXCLUDED_PM_STATUSES.some(s => pm.includes(s))) return false;
  return true;
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

  if (!projects) return {};

  const allProjects = projects;
  const residential = allProjects.filter(isResidentialInstall);

  const paused = allProjects.filter(p => p.pmStatus?.toLowerCase() === 'project paused').length;

  const escalated = (escalationTickets || []).filter(t => t.status === 'open').length;

  const ucActive = residential.filter(p =>
    !isUcComplete(p.ucStatus) && !isPlannerIncomplete(p)
  ).length;

  const rebatesNeedAttention = residential.filter(p => {
    const s = p.rebateStatus?.toLowerCase() ?? '';
    return !p.rebateStatus || s.includes('new') || s.includes('check');
  }).length;

  const paymentNeeded = residential.filter(p => !p.paymentMethod).length;

  const contractsNeeded = residential.filter(p =>
    areDependenciesMet(p, "contract_signing", workflowConfigs ?? null) &&
    !isContractSent(p.installTeamStage)
  ).length;

  const siteVisitsPending = residential.filter(p => {
    if (!areDependenciesMet(p, "site_visit", workflowConfigs ?? null)) return false;
    const stage = p.installTeamStage?.toLowerCase() ?? '';
    if (!stage.includes('pending site visit')) return false;
    return !isVisitComplete(p.siteVisitStatus) && !isVisitBooked(p.siteVisitStatus);
  }).length;

  const ahjAction = residential.filter(p => {
    if (!areDependenciesMet(p, "ahj_permitting", workflowConfigs ?? null)) return false;
    return !isAhjComplete(p.ahjStatus) && isVisitComplete(p.siteVisitStatus);
  }).length;

  const plannerNeeded = residential.filter(p => isPlannerIncomplete(p)).length;

  const installAction = residential.filter(p => {
    if (!areDependenciesMet(p, "install_booking", workflowConfigs ?? null)) return false;
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
    '/site-visits': siteVisitsPending,
    '/ahj': ahjAction,
    '/planner': plannerNeeded,
    '/installs': installAction,
    '/close-off': closeOffPending,
  } as Record<string, number>;
}
