import type { Project, TaskAction } from "@shared/schema";
import { getStageStatus } from "@/utils/stages";

interface StageExpectation {
  target: string | null;
  expected: string | null;
  status: string;
}

export type StageExpectations = Record<string, StageExpectation>;

const STAGE_GAPS = {
  ucToContract: 7,
  contractToSv: 7,
  svToAhj: 14,
  ahjToInstall: 7,
  installToCloseOff: 7,
};
const LATE_PUSH = 7;

const UC_COMPLETE = ["approved", "complete", "not required", "closed", "close off"];
const CONTRACT_DONE = ["pending deposit", "deposit collected", "pending site visit", "active install", "complete"];
const SV_DONE = ["visit complete", "not required", "visit booked"];
const AHJ_DONE = ["permit issued", "closed", "not required", "permit close off", "approved", "complete"];
const AHJ_NOT_REQUIRED = ["not required", "closed", "permit close off"];

function isMatch(val: string | null | undefined, keywords: string[]): boolean {
  if (!val) return false;
  const lower = val.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function addD(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Compute expected dates for every project stage based on due dates and current status. */
export function computeExpectedDates(project: Project, _taskActions: TaskAction[]): StageExpectations {
  const stages: StageExpectations = {};

  const ucDone = isMatch(project.ucStatus, UC_COMPLETE);
  const contractDone = isMatch(project.installTeamStage, CONTRACT_DONE);
  const svDone = isMatch(project.siteVisitStatus, SV_DONE);
  const ahjDone = isMatch(project.ahjStatus, AHJ_DONE);
  const ahjNotRequired = isMatch(project.ahjStatus, AHJ_NOT_REQUIRED);
  const effectiveSvToAhj = ahjNotRequired ? 0 : STAGE_GAPS.svToAhj;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let expectedUc = project.ucDueDate ? new Date(project.ucDueDate) : addD(now, 21);
  let expectedContract = project.contractDueDate ? new Date(project.contractDueDate) : addD(expectedUc, STAGE_GAPS.ucToContract);
  let expectedSv = project.siteVisitDueDate ? new Date(project.siteVisitDueDate) : addD(expectedContract, STAGE_GAPS.contractToSv);
  let expectedAhj = project.ahjDueDate ? new Date(project.ahjDueDate) : addD(expectedSv, effectiveSvToAhj);
  let expectedInstall = project.installDueDate ? new Date(project.installDueDate) : addD(expectedAhj, STAGE_GAPS.ahjToInstall);
  let expectedCloseOff = project.closeOffDueDate ? new Date(project.closeOffDueDate) : addD(expectedInstall, STAGE_GAPS.installToCloseOff);

  if (!ucDone && expectedUc < now) {
    expectedUc = addD(now, LATE_PUSH);
    expectedContract = addD(expectedUc, STAGE_GAPS.ucToContract);
    expectedSv = addD(expectedContract, STAGE_GAPS.contractToSv);
    expectedAhj = addD(expectedSv, effectiveSvToAhj);
    expectedInstall = addD(expectedAhj, STAGE_GAPS.ahjToInstall);
    expectedCloseOff = addD(expectedInstall, STAGE_GAPS.installToCloseOff);
  } else if (!contractDone && expectedContract < now) {
    expectedContract = addD(now, LATE_PUSH);
    expectedSv = addD(expectedContract, STAGE_GAPS.contractToSv);
    expectedAhj = addD(expectedSv, effectiveSvToAhj);
    expectedInstall = addD(expectedAhj, STAGE_GAPS.ahjToInstall);
    expectedCloseOff = addD(expectedInstall, STAGE_GAPS.installToCloseOff);
  } else if (!svDone && expectedSv < now) {
    expectedSv = addD(now, LATE_PUSH);
    expectedAhj = addD(expectedSv, effectiveSvToAhj);
    expectedInstall = addD(expectedAhj, STAGE_GAPS.ahjToInstall);
    expectedCloseOff = addD(expectedInstall, STAGE_GAPS.installToCloseOff);
  } else if (!ahjDone && expectedAhj < now) {
    expectedAhj = addD(now, LATE_PUSH);
    expectedInstall = addD(expectedAhj, STAGE_GAPS.ahjToInstall);
    expectedCloseOff = addD(expectedInstall, STAGE_GAPS.installToCloseOff);
  }

  stages.uc_application = {
    target: project.ucDueDate,
    expected: toStr(expectedUc),
    status: ucDone ? "completed" : project.ucStatus ? "in_progress" : "pending",
  };

  stages.rebates = {
    target: project.ucDueDate,
    expected: toStr(expectedUc),
    status: getStageStatus(project.rebateStatus, ["complete", "not required", "approved"]),
  };

  stages.payment = {
    target: project.ucDueDate,
    expected: toStr(expectedUc),
    status: project.paymentMethod ? "completed" : "pending",
  };

  stages.contract_signing = {
    target: project.contractDueDate,
    expected: toStr(expectedContract),
    status: contractDone ? "completed" : project.installTeamStage ? "in_progress" : "pending",
  };

  stages.site_visit = {
    target: project.siteVisitDueDate,
    expected: project.siteVisitDate || toStr(expectedSv),
    status: svDone ? "completed" : "pending",
  };

  stages.ahj_permitting = {
    target: project.ahjDueDate,
    expected: toStr(expectedAhj),
    status: ahjDone ? "completed" : project.ahjStatus ? "in_progress" : "pending",
  };

  stages.install_booking = {
    target: project.installDueDate,
    expected: project.installStartDate || toStr(expectedInstall),
    status: project.installStartDate ? "completed" : "pending",
  };

  stages.installation = {
    target: project.installDueDate,
    expected: project.installStartDate || toStr(expectedInstall),
    status: project.installTeamStage?.toLowerCase().includes("active install")
      ? "completed"
      : project.installTeamStage?.toLowerCase().includes("complete")
        ? "completed"
        : "pending",
  };

  stages.close_off = {
    target: project.closeOffDueDate,
    expected: toStr(expectedCloseOff),
    status:
      project.pmStatus?.toLowerCase().includes("close") ||
      project.pmStatus?.toLowerCase().includes("complete")
        ? "completed"
        : "pending",
  };

  return stages;
}
