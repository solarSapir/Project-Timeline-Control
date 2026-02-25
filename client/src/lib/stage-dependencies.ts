import { DEFAULT_STAGE_GAPS } from "@shared/schema";

export const STAGE_FIELD_MAP: Record<string, {
  field: string;
  fieldLabel: string;
  asanaFieldKey: string;
}> = {
  uc_application: { field: "ucStatus", fieldLabel: "UC Team Status", asanaFieldKey: "ucStatus" },
  rebates_payment: { field: "rebateStatus", fieldLabel: "Grants Status", asanaFieldKey: "rebateStatus" },
  contract_signing: { field: "installTeamStage", fieldLabel: "Install Team Stage", asanaFieldKey: "installTeamStage" },
  site_visit: { field: "siteVisitStatus", fieldLabel: "Site Visit Request", asanaFieldKey: "siteVisitStatus" },
  ahj_permitting: { field: "ahjStatus", fieldLabel: "AHJ Status", asanaFieldKey: "ahjStatus" },
  install_booking: { field: "installStartDate", fieldLabel: "Install Start Date", asanaFieldKey: "" },
  installation: { field: "installTeamStage", fieldLabel: "Install Team Stage", asanaFieldKey: "installTeamStage" },
  close_off: { field: "pmStatus", fieldLabel: "PM Status", asanaFieldKey: "pmStatus" },
};

export const DEFAULT_COMPLETION_CRITERIA: Record<string, string[]> = {
  uc_application: ["approved", "complete", "not required", "closed", "close off"],
  rebates_payment: ["complete", "not required", "approved"],
  contract_signing: ["pending deposit", "deposit collected", "pending site visit", "active install", "complete"],
  site_visit: ["visit complete", "not required", "visit booked"],
  ahj_permitting: ["permit issued", "closed", "not required", "permit close off"],
  install_booking: [],
  installation: ["complete", "complete - close off"],
  close_off: ["close", "complete"],
};

export const STAGE_TAB_MAP: Record<string, { tabName: string; route: string }> = {
  uc_application: { tabName: "UC Applications", route: "/uc" },
  rebates_payment: { tabName: "Rebates", route: "/rebates" },
  contract_signing: { tabName: "Contracts", route: "/contracts" },
  site_visit: { tabName: "Site Visits", route: "/site-visits" },
  ahj_permitting: { tabName: "AHJ / Permitting", route: "/ahj" },
  install_booking: { tabName: "Installation", route: "/installs" },
  installation: { tabName: "Installation", route: "/installs" },
  close_off: { tabName: "Close-off", route: "/close-off" },
};

export const STAGE_COMPLETION_CRITERIA: Record<string, {
  field: string;
  completedValues: string[];
  label: string;
}> = {
  uc_application: {
    field: "ucStatus",
    completedValues: DEFAULT_COMPLETION_CRITERIA.uc_application,
    label: "UC Status = Approved / Complete / Not Required / Closed",
  },
  rebates_payment: {
    field: "rebateStatus",
    completedValues: DEFAULT_COMPLETION_CRITERIA.rebates_payment,
    label: "Grants Status = Complete / Not Required / Approved",
  },
  contract_signing: {
    field: "installTeamStage",
    completedValues: DEFAULT_COMPLETION_CRITERIA.contract_signing,
    label: "Install Team Stage = Pending Deposit or later",
  },
  site_visit: {
    field: "siteVisitStatus",
    completedValues: DEFAULT_COMPLETION_CRITERIA.site_visit,
    label: "Site Visit = Visit Complete / Not Required / Booked",
  },
  ahj_permitting: {
    field: "ahjStatus",
    completedValues: DEFAULT_COMPLETION_CRITERIA.ahj_permitting,
    label: "AHJ Status = Permit Issued / Closed / Not Required",
  },
  install_booking: {
    field: "installStartDate",
    completedValues: [],
    label: "Install Start Date is set",
  },
  installation: {
    field: "installTeamStage",
    completedValues: DEFAULT_COMPLETION_CRITERIA.installation,
    label: "Install Team Stage = Complete / Close Off",
  },
  close_off: {
    field: "pmStatus",
    completedValues: DEFAULT_COMPLETION_CRITERIA.close_off,
    label: "PM Status = Close / Complete",
  },
};

export interface WorkflowConfig {
  stage: string;
  targetDays: number;
  dependsOn: string[] | null;
  gapRelativeTo: string | null;
  completionCriteria?: string[] | null;
}

export function getCompletionCriteria(stage: string, workflowConfigs: WorkflowConfig[] | null | undefined): string[] {
  const config = workflowConfigs?.find(c => c.stage === stage);
  if (config?.completionCriteria && config.completionCriteria.length > 0) {
    return config.completionCriteria;
  }
  return DEFAULT_COMPLETION_CRITERIA[stage] ?? [];
}

export function getCompletionLabel(stage: string, workflowConfigs: WorkflowConfig[] | null | undefined): string {
  const criteria = getCompletionCriteria(stage, workflowConfigs);
  if (stage === "install_booking") return "Install Start Date is set";
  const fieldInfo = STAGE_FIELD_MAP[stage];
  if (!fieldInfo || criteria.length === 0) return STAGE_COMPLETION_CRITERIA[stage]?.label || "Not configured";
  return `${fieldInfo.fieldLabel} = ${criteria.join(" / ")}`;
}

export function isStageComplete(project: any, stage: string, workflowConfigs?: WorkflowConfig[] | null): boolean {
  if (stage === "install_booking") {
    return !!project.installStartDate;
  }

  const fieldInfo = STAGE_FIELD_MAP[stage];
  if (!fieldInfo) return false;

  const value = project[fieldInfo.field];
  if (!value) return false;
  const lower = value.toLowerCase();

  const criteria = getCompletionCriteria(stage, workflowConfigs);
  return criteria.some(v => lower.includes(v.toLowerCase()));
}

export function areDependenciesMet(
  project: any,
  stage: string,
  workflowConfigs: WorkflowConfig[] | null | undefined,
): boolean {
  const config = workflowConfigs?.find(c => c.stage === stage);
  const deps = config?.dependsOn ?? DEFAULT_STAGE_GAPS[stage]?.dependsOn ?? [];

  if (deps.length === 0) return true;

  return deps.every(dep => isStageComplete(project, dep, workflowConfigs));
}

export function getUnmetDependencies(
  project: any,
  stage: string,
  workflowConfigs: WorkflowConfig[] | null | undefined,
): string[] {
  const config = workflowConfigs?.find(c => c.stage === stage);
  const deps = config?.dependsOn ?? DEFAULT_STAGE_GAPS[stage]?.dependsOn ?? [];

  return deps.filter(dep => !isStageComplete(project, dep, workflowConfigs));
}
