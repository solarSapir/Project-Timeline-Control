const UC_COMPLETE_STATUSES = ['approved', 'complete', 'not required', 'closed', 'close off'];
const AHJ_COMPLETE_STATUSES = ['permit issued', 'closed', 'not required', 'permit close off'];
const CONTRACT_DONE_STATUSES = ['pending deposit', 'deposit collected', 'pending site visit', 'active install', 'complete'];
const SV_DONE_STATUSES = ['visit complete', 'not required', 'visit booked'];

function matchesAny(value: string | null, keywords: string[]): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

/** Check if a UC application status indicates completion. */
export function isUcComplete(ucStatus: string | null): boolean {
  return matchesAny(ucStatus, UC_COMPLETE_STATUSES);
}

/** Check if an AHJ status indicates completion. */
export function isAhjComplete(ahjStatus: string | null): boolean {
  return matchesAny(ahjStatus, AHJ_COMPLETE_STATUSES);
}

/** Check if an AHJ permit has been issued specifically. */
export function isPermitIssued(ahjStatus: string | null): boolean {
  if (!ahjStatus) return false;
  return ahjStatus.toLowerCase().includes('permit issued');
}

/** Check if site visit is completed. */
export function isVisitComplete(status: string | null): boolean {
  if (!status) return false;
  return status.toLowerCase().includes('visit complete');
}

/** Check if site visit has been booked. */
export function isVisitBooked(status: string | null): boolean {
  if (!status) return false;
  return status.toLowerCase().includes('visit booked');
}

/** Check if a contract has been sent (any post-send stage). */
export function isContractSent(stage: string | null): boolean {
  return matchesAny(stage, [
    'pending contract to be signed', 'pending deposit', 'deposit collected',
    'pending site visit', 'active install', 'complete',
  ]);
}

/** Check if a contract has been signed (deposit stage or later). */
export function isContractSigned(stage: string | null): boolean {
  return matchesAny(stage, [
    'pending deposit', 'deposit collected', 'pending site visit',
    'active install', 'complete',
  ]);
}

/** Check if the $1500 deposit has been collected. */
export function isDepositCollected(stage: string | null): boolean {
  return matchesAny(stage, [
    'pending site visit', 'deposit collected', 'active install', 'complete',
  ]);
}

/** Check if contract is awaiting customer signature. */
export function isPendingSignature(stage: string | null): boolean {
  if (!stage) return false;
  return stage.toLowerCase().includes('pending contract to be signed');
}

/** Get a display-friendly label for an install team stage. */
export function getInstallStageLabel(stage: string | null): string {
  if (!stage) return 'Unknown';
  return stage;
}

/** Get Tailwind badge classes based on install team stage. */
export function getInstallStageBadgeClass(stage: string | null): string {
  if (!stage) return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  const s = stage.toLowerCase();
  if (s.includes('active install') || s.includes('complete'))
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (s.includes('deposit collected'))
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (s.includes('pending site visit'))
    return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
  if (s.includes('pending deposit'))
    return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (s.includes('pending contract'))
    return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  if (s.includes('need contract'))
    return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

/** Determine stage status from a field value and completion keywords. */
export function getStageStatus(
  fieldValue: string | null | undefined,
  completedKeywords: string[],
): "pending" | "in_progress" | "completed" {
  if (!fieldValue) return "pending";
  const lower = fieldValue.toLowerCase();
  if (completedKeywords.some(kw => lower.includes(kw))) return "completed";
  return "in_progress";
}

export { UC_COMPLETE_STATUSES, AHJ_COMPLETE_STATUSES, CONTRACT_DONE_STATUSES, SV_DONE_STATUSES };
