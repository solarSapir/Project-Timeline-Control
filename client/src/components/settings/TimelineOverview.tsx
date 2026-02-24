import { STAGE_LABELS } from "@shared/schema";
import { STAGE_COLORS } from "@/utils/workflow-config";
import type { StageConfig } from "@/utils/workflow-config";

interface TimelineOverviewProps {
  configs: StageConfig[];
  cumulativeDays: Record<string, number>;
  maxDays: number;
}

/** Bar chart showing the cumulative timeline for all stages. */
export default function TimelineOverview({ configs, cumulativeDays, maxDays }: TimelineOverviewProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h4 className="text-sm font-medium mb-3">Timeline Overview</h4>
      <div className="space-y-2">
        {configs.map(config => {
          const colors = STAGE_COLORS[config.stage];
          const cumDays = cumulativeDays[config.stage] || 0;
          const startDay = cumDays - config.targetDays;
          const barStart = Math.max(0, (startDay / maxDays) * 100);
          const barWidth = Math.max(4, (config.targetDays / maxDays) * 100);
          return (
            <div key={config.stage} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">
                {STAGE_LABELS[config.stage]}
              </span>
              <div className="flex-1 h-5 bg-muted rounded overflow-hidden relative">
                <div
                  className={`h-full rounded ${colors.dot} opacity-80 transition-all duration-300 absolute flex items-center justify-end pr-1`}
                  style={{ left: `${barStart}%`, width: `${barWidth}%` }}
                >
                  <span className="text-[9px] font-medium text-white drop-shadow-sm tabular-nums">
                    {config.targetDays}d
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right shrink-0">
                d{cumDays}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
        <span>Day 0 (Project Created)</span>
        <span>Day {maxDays}</span>
      </div>
    </div>
  );
}
