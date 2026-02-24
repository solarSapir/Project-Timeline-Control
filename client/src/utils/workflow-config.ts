import { PROJECT_STAGES, DEFAULT_DEADLINES_WEEKS, DEFAULT_STAGE_GAPS } from "@shared/schema";
import type { WorkflowConfig } from "@shared/schema";
import { DEFAULT_COMPLETION_CRITERIA } from "@/lib/stage-dependencies";

export interface StageConfig {
  stage: string;
  targetDays: number;
  dependsOn: string[];
  gapRelativeTo: string | null;
  completionCriteria: string[];
}

export const STAGE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  uc_application: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  rebates_payment: { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  contract_signing: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  site_visit: { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  ahj_permitting: { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  install_booking: { bg: "bg-cyan-50 dark:bg-cyan-950/40", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
  installation: { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
  close_off: { bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
};

/** Build default stage configs from schema constants. */
export function defaultConfigs(): StageConfig[] {
  return PROJECT_STAGES.map(stage => {
    const gap = DEFAULT_STAGE_GAPS[stage];
    return {
      stage,
      targetDays: gap ? gap.gapDays : (DEFAULT_DEADLINES_WEEKS[stage]?.max ?? 4) * 7,
      dependsOn: gap ? gap.dependsOn : (DEFAULT_DEADLINES_WEEKS[stage]?.dependsOn || []),
      gapRelativeTo: gap ? gap.gapRelativeTo : null,
      completionCriteria: DEFAULT_COMPLETION_CRITERIA[stage] || [],
    };
  });
}

/** Merge saved workflow configs from DB with defaults for any missing stages. */
export function mergeWithDefaults(saved: WorkflowConfig[]): StageConfig[] {
  const savedMap = new Map(saved.map(s => [s.stage, s]));
  return PROJECT_STAGES.map(stage => {
    const s = savedMap.get(stage);
    const gap = DEFAULT_STAGE_GAPS[stage];
    if (s) return {
      stage: s.stage,
      targetDays: s.targetDays,
      dependsOn: s.dependsOn || gap?.dependsOn || [],
      gapRelativeTo: s.gapRelativeTo ?? gap?.gapRelativeTo ?? null,
      completionCriteria: s.completionCriteria ?? DEFAULT_COMPLETION_CRITERIA[stage] ?? [],
    };
    return {
      stage,
      targetDays: gap?.gapDays ?? 7,
      dependsOn: gap?.dependsOn || [],
      gapRelativeTo: gap?.gapRelativeTo ?? null,
      completionCriteria: DEFAULT_COMPLETION_CRITERIA[stage] || [],
    };
  });
}
