import type { Project, TaskAction } from "@shared/schema";
import { getDaysUntilDue, hoursSince } from "@/utils/dates";
import { isContractSent, isContractSigned, isDepositCollected, isPendingSignature } from "@/utils/stages";
import { getContractDueDate } from "@/components/contracts/contract-helpers";

export function getLastFollowUp(actions: TaskAction[] | undefined, projectId: string): TaskAction | null {
  if (!actions) return null;
  return actions
    .filter((a) => a.projectId === projectId && a.viewType === 'contracts' && a.actionType === 'follow_up')
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())[0] || null;
}

export function findAction(actions: TaskAction[] | undefined, projectId: string, actionType: string): TaskAction | null {
  if (!actions) return null;
  return actions
    .filter((a) => a.projectId === projectId && a.actionType === actionType)
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())[0] || null;
}

export function hasAction(actions: TaskAction[] | undefined, projectId: string, actionType: string): boolean {
  return !!actions?.some((a) => a.projectId === projectId && a.actionType === actionType);
}

export function needsFollowUpCheck(p: Project, taskActions: TaskAction[] | undefined): boolean {
  if (!isPendingSignature(p.installTeamStage)) return false;
  const last = getLastFollowUp(taskActions, p.id);
  if (!last) return true;
  const hrs = hoursSince(last.completedAt ? String(last.completedAt) : null);
  return hrs === null || hrs >= 24;
}

export function recentlyFollowedUp(p: Project, taskActions: TaskAction[] | undefined): boolean {
  if (!isPendingSignature(p.installTeamStage)) return false;
  const last = getLastFollowUp(taskActions, p.id);
  if (!last) return false;
  const hrs = hoursSince(last.completedAt ? String(last.completedAt) : null);
  return hrs !== null && hrs < 24;
}

export function filterProjects(projects: Project[], filter: string, search: string, taskActions: TaskAction[] | undefined): Project[] {
  return projects.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    const sent = isContractSent(p.installTeamStage);
    const signed = isContractSigned(p.installTeamStage);
    const depositDone = isDepositCollected(p.installTeamStage);
    if (filter === "needs_contract") return !sent;
    if (filter === "needs_followup") return needsFollowUpCheck(p, taskActions);
    if (filter === "followed_up") return recentlyFollowedUp(p, taskActions);
    if (filter === "pending_signature") return isPendingSignature(p.installTeamStage);
    if (filter === "pending_deposit") return signed && !depositDone;
    if (filter === "complete") return signed && depositDone;
    if (filter === "overdue") {
      const daysLeft = getDaysUntilDue(getContractDueDate(p));
      return !sent && daysLeft !== null && daysLeft < 0;
    }
    return true;
  });
}

export function sortByDue(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const aDone = isDepositCollected(a.installTeamStage);
    const bDone = isDepositCollected(b.installTeamStage);
    if (aDone !== bDone) return aDone ? 1 : -1;
    const aDays = getDaysUntilDue(getContractDueDate(a));
    const bDays = getDaysUntilDue(getContractDueDate(b));
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  });
}

export function computeCounts(projects: Project[], taskActions: TaskAction[] | undefined) {
  return {
    needsContract: projects.filter((p) => !isContractSent(p.installTeamStage)).length,
    needsFollowUp: projects.filter((p) => needsFollowUpCheck(p, taskActions)).length,
    followedUp: projects.filter((p) => recentlyFollowedUp(p, taskActions)).length,
    pendingSig: projects.filter((p) => isPendingSignature(p.installTeamStage)).length,
    pendingDeposit: projects.filter((p) => isContractSigned(p.installTeamStage) && !isDepositCollected(p.installTeamStage)).length,
    complete: projects.filter((p) => isContractSigned(p.installTeamStage) && isDepositCollected(p.installTeamStage)).length,
    overdue: projects.filter((p) => {
      if (isContractSent(p.installTeamStage)) return false;
      const daysLeft = getDaysUntilDue(getContractDueDate(p));
      return daysLeft !== null && daysLeft < 0;
    }).length,
  };
}
