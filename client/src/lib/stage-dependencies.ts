import { DEFAULT_STAGE_GAPS } from "@shared/schema";

export const STAGE_COMPLETION_CRITERIA: Record<string, {
  field: string;
  completedValues: string[];
  label: string;
}> = {
  uc_application: {
    field: "ucStatus",
    completedValues: ["approved", "complete", "not required", "closed", "close off"],
    label: "UC Status = Approved / Complete / Not Required / Closed",
  },
  rebates_payment: {
    field: "rebateStatus",
    completedValues: ["complete", "not required", "approved"],
    label: "Grants Status = Complete / Not Required / Approved",
  },
  contract_signing: {
    field: "installTeamStage",
    completedValues: ["pending deposit", "deposit collected", "pending site visit", "active install", "complete"],
    label: "Install Team Stage = Pending Deposit or later",
  },
  site_visit: {
    field: "siteVisitStatus",
    completedValues: ["visit complete", "not required", "visit booked"],
    label: "Site Visit = Visit Complete / Not Required / Booked",
  },
  ahj_permitting: {
    field: "ahjStatus",
    completedValues: ["permit issued", "closed", "not required", "permit close off"],
    label: "AHJ Status = Permit Issued / Closed / Not Required",
  },
  install_booking: {
    field: "installStartDate",
    completedValues: [],
    label: "Install Start Date is set",
  },
  installation: {
    field: "installTeamStage",
    completedValues: ["complete", "complete - close off"],
    label: "Install Team Stage = Complete / Close Off",
  },
  close_off: {
    field: "pmStatus",
    completedValues: ["close", "complete"],
    label: "PM Status = Close / Complete",
  },
};

export function isStageComplete(project: any, stage: string): boolean {
  const criteria = STAGE_COMPLETION_CRITERIA[stage];
  if (!criteria) return false;

  if (stage === "install_booking") {
    return !!project.installStartDate;
  }

  const value = project[criteria.field];
  if (!value) return false;
  const lower = value.toLowerCase();
  return criteria.completedValues.some(v => lower.includes(v));
}

export interface WorkflowConfig {
  stage: string;
  targetDays: number;
  dependsOn: string[];
  gapRelativeTo: string | null;
}

export function areDependenciesMet(
  project: any,
  stage: string,
  workflowConfigs: WorkflowConfig[] | null | undefined,
): boolean {
  const config = workflowConfigs?.find(c => c.stage === stage);
  const deps = config?.dependsOn ?? DEFAULT_STAGE_GAPS[stage]?.dependsOn ?? [];

  if (deps.length === 0) return true;

  return deps.every(dep => isStageComplete(project, dep));
}

export function getUnmetDependencies(
  project: any,
  stage: string,
  workflowConfigs: WorkflowConfig[] | null | undefined,
): string[] {
  const config = workflowConfigs?.find(c => c.stage === stage);
  const deps = config?.dependsOn ?? DEFAULT_STAGE_GAPS[stage]?.dependsOn ?? [];

  return deps.filter(dep => !isStageComplete(project, dep));
}
