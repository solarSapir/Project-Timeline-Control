import type { Project } from "@shared/schema";
import { isAhjComplete } from "./stages";
import { addDays, toDateString } from "./dates";

export type InstallStatus = "on-track" | "late" | "overdue";

export interface CalendarProject {
  id: string;
  name: string;
  expectedDate: string;
  targetDate: string | null;
  status: InstallStatus;
  province: string | null;
  ahjStatus: string | null;
  installTeamStage: string | null;
  siteVisitStatus: string | null;
  ucStatus: string | null;
  daysLate: number | null;
  reason: string;
}

export const STATUS_STYLES: Record<InstallStatus, string> = {
  "on-track": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  "late": "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  "overdue": "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

export const STATUS_DOT: Record<InstallStatus, string> = {
  "on-track": "bg-emerald-500",
  "late": "bg-amber-500",
  "overdue": "bg-red-500",
};

const STAGE_GAPS = { ucToContract: 7, contractToSv: 7, svToAhj: 14, ahjToInstall: 7 };
const LATE_PUSH = 7;

const UC_COMPLETE = ['approved', 'complete', 'not required', 'closed', 'close off'];
const CONTRACT_DONE_STAGES = ['pending deposit', 'deposit collected', 'pending site visit', 'active install', 'complete'];
const SV_DONE = ['visit complete', 'not required', 'visit booked'];
const AHJ_NOT_REQUIRED = ['not required', 'closed', 'permit close off'];

const NON_RESIDENTIAL = ['commercial', 'industrial', 'agricultural', 'institutional', 'multi-residential'];
const EXCLUDED_PM = ['complete', 'project paused', 'project lost', 'close-off'];

function matchesAny(value: string | null, keywords: string[]): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

/** Determine install status based on expected vs target dates. */
export function getInstallStatus(expectedDate: string, targetDate: string | null): InstallStatus {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expected = new Date(expectedDate);
  if (targetDate) {
    const target = new Date(targetDate);
    if (expected > target) {
      return expected < now ? "overdue" : "late";
    }
  }
  return expected < now ? "overdue" : "on-track";
}

/** Get a display label for the cascading stage reason. */
export function getCalendarStageLabel(reason: string): string {
  switch (reason) {
    case "scheduled": return "Scheduled";
    case "ahj-complete": return "AHJ Done → Install";
    case "sv-complete": return "Site Visit Done → AHJ";
    case "contract-done": return "Contract Done → SV";
    case "contract-sent": return "Contract Sent";
    case "uc-complete": return "UC Done → Contract";
    case "uc-pending": return "UC Pending";
    default: return reason;
  }
}

/** Compute expected install dates for all residential install projects with cascading logic. */
export function computeCalendarProjects(projects: Project[]): CalendarProject[] {
  const installProjects = projects.filter(p =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || !NON_RESIDENTIAL.some(s => p.propertySector!.toLowerCase().includes(s))) &&
    !EXCLUDED_PM.some(s => (p.pmStatus?.toLowerCase() || '').includes(s))
  );

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const result: CalendarProject[] = [];

  for (const p of installProjects) {
    if (p.installStartDate) {
      const status = getInstallStatus(p.installStartDate, p.installDueDate);
      const daysLate = computeDaysLate(p.installStartDate, p.installDueDate);
      result.push(buildCalendarProject(p, p.installStartDate, status, daysLate, "scheduled"));
      continue;
    }

    const ucDone = matchesAny(p.ucStatus, UC_COMPLETE);
    const contractDone = matchesAny(p.installTeamStage, CONTRACT_DONE_STAGES);
    const svDone = matchesAny(p.siteVisitStatus, SV_DONE);
    const ahjDone = isAhjComplete(p.ahjStatus);
    const ahjIsNotRequired = matchesAny(p.ahjStatus, AHJ_NOT_REQUIRED);
    const effectiveSvToAhj = ahjIsNotRequired ? 0 : STAGE_GAPS.svToAhj;

    let adjustedUc = p.ucDueDate ? new Date(p.ucDueDate) : addDays(now, 21);
    let adjustedContract = p.contractDueDate ? new Date(p.contractDueDate) : addDays(adjustedUc, STAGE_GAPS.ucToContract);
    let adjustedSv = p.siteVisitDueDate ? new Date(p.siteVisitDueDate) : addDays(adjustedContract, STAGE_GAPS.contractToSv);
    let adjustedAhj = p.ahjDueDate ? new Date(p.ahjDueDate) : addDays(adjustedSv, effectiveSvToAhj);
    let adjustedInstall = p.installDueDate ? new Date(p.installDueDate) : addDays(adjustedAhj, STAGE_GAPS.ahjToInstall);

    let reason: string;
    let cascadeFrom: Date | null = null;

    if (!ucDone) {
      if (adjustedUc < now) { adjustedUc = addDays(now, LATE_PUSH); cascadeFrom = adjustedUc; }
      reason = "uc-pending";
    } else if (!contractDone) {
      if (adjustedContract < now) { adjustedContract = addDays(now, LATE_PUSH); cascadeFrom = adjustedContract; }
      reason = "uc-complete";
    } else if (!svDone) {
      if (adjustedSv < now) { adjustedSv = addDays(now, LATE_PUSH); cascadeFrom = adjustedSv; }
      reason = "contract-done";
    } else if (!ahjDone) {
      if (adjustedAhj < now) { adjustedAhj = addDays(now, LATE_PUSH); cascadeFrom = adjustedAhj; }
      reason = "sv-complete";
    } else {
      reason = "ahj-complete";
    }

    if (cascadeFrom) {
      if (reason === "uc-pending") {
        adjustedContract = addDays(cascadeFrom, STAGE_GAPS.ucToContract);
        adjustedSv = addDays(adjustedContract, STAGE_GAPS.contractToSv);
        adjustedAhj = addDays(adjustedSv, effectiveSvToAhj);
        adjustedInstall = addDays(adjustedAhj, STAGE_GAPS.ahjToInstall);
      } else if (reason === "uc-complete") {
        adjustedSv = addDays(cascadeFrom, STAGE_GAPS.contractToSv);
        adjustedAhj = addDays(adjustedSv, effectiveSvToAhj);
        adjustedInstall = addDays(adjustedAhj, STAGE_GAPS.ahjToInstall);
      } else if (reason === "contract-done") {
        adjustedAhj = addDays(cascadeFrom, effectiveSvToAhj);
        adjustedInstall = addDays(adjustedAhj, STAGE_GAPS.ahjToInstall);
      } else if (reason === "sv-complete") {
        adjustedInstall = addDays(cascadeFrom, STAGE_GAPS.ahjToInstall);
      }
    }

    const expectedDate = (ahjDone && svDone && contractDone && ucDone)
      ? toDateString(addDays(now, STAGE_GAPS.ahjToInstall))
      : toDateString(adjustedInstall);

    const status = getInstallStatus(expectedDate, p.installDueDate);
    const daysLate = computeDaysLate(expectedDate, p.installDueDate);
    result.push(buildCalendarProject(p, expectedDate, status, daysLate, reason));
  }

  return result;
}

function computeDaysLate(expectedDate: string, targetDate: string | null): number | null {
  if (!targetDate) return null;
  const diff = Math.round((new Date(expectedDate).getTime() - new Date(targetDate).getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

function buildCalendarProject(
  p: Project, expectedDate: string, status: InstallStatus, daysLate: number | null, reason: string,
): CalendarProject {
  return {
    id: p.id, name: p.name, expectedDate, targetDate: p.installDueDate,
    status, province: p.province, ahjStatus: p.ahjStatus,
    installTeamStage: p.installTeamStage, siteVisitStatus: p.siteVisitStatus,
    ucStatus: p.ucStatus, daysLate, reason,
  };
}
