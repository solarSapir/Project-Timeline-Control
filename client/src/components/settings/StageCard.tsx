import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_STAGES, STAGE_LABELS } from "@shared/schema";
import { STAGE_COMPLETION_CRITERIA } from "@/lib/stage-dependencies";
import { STAGE_COLORS } from "@/utils/workflow-config";
import type { StageConfig } from "@/utils/workflow-config";

const STAGE_TAB_MAP: Record<string, string> = {
  uc_application: "UC Applications",
  rebates_payment: "Rebates / Payment Method",
  contract_signing: "Contracts",
  site_visit: "Site Visits",
  ahj_permitting: "AHJ / Permitting",
  install_booking: "Install Coordination",
  installation: "Install Calendar",
  close_off: "Close-off",
};

interface StageCardProps {
  config: StageConfig;
  cumulativeDays: number;
  maxDays: number;
  onUpdateDays: (stage: string, days: number) => void;
  onUpdateGapRelativeTo: (stage: string, relativeTo: string) => void;
  onToggleDependency: (stage: string, dep: string) => void;
}

/** Individual stage configuration card within the workflow editor. */
export default function StageCard({
  config, cumulativeDays, maxDays, onUpdateDays, onUpdateGapRelativeTo, onToggleDependency,
}: StageCardProps) {
  const colors = STAGE_COLORS[config.stage];
  const barWidth = Math.max(8, (cumulativeDays / maxDays) * 100);
  const stageIdx = PROJECT_STAGES.indexOf(config.stage as typeof PROJECT_STAGES[number]);

  return (
    <div className={`rounded-lg border-2 p-4 ${colors.bg} ${colors.border} transition-all`} data-testid={`card-workflow-${config.stage}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-3 w-3 rounded-full ${colors.dot} shrink-0`} />
          <div className="min-w-0">
            <span className={`font-medium text-sm ${colors.text}`}>{STAGE_LABELS[config.stage]}</span>
            {STAGE_TAB_MAP[config.stage] && (
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                Tab: {STAGE_TAB_MAP[config.stage]}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="text-xs tabular-nums">{config.targetDays}d gap</Badge>
          <Badge variant="secondary" className="text-[10px] tabular-nums">d{cumulativeDays}</Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Gap:</span>
        <Input
          type="number" min={0} max={365} value={config.targetDays}
          onChange={(e) => onUpdateDays(config.stage, parseInt(e.target.value) || 0)}
          className="h-8 w-20 text-sm text-center tabular-nums"
          data-testid={`input-days-${config.stage}`}
        />
        {config.dependsOn.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">days after</span>
            <Select value={config.gapRelativeTo || config.dependsOn[0]} onValueChange={(val) => onUpdateGapRelativeTo(config.stage, val)}>
              <SelectTrigger className="h-8 w-[180px] text-xs" data-testid={`select-gap-relative-${config.stage}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.dependsOn.map(dep => (
                  <SelectItem key={dep} value={dep}>{STAGE_LABELS[dep] || dep}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">days from project start</span>
        )}
      </div>

      <div className="h-2 bg-white/60 dark:bg-black/20 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full ${colors.dot} transition-all duration-300`} style={{ width: `${barWidth}%` }} />
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Dependencies:</span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {PROJECT_STAGES.filter(s => s !== config.stage).map(dep => {
            const depIdx = PROJECT_STAGES.indexOf(dep);
            if (depIdx >= stageIdx) return null;
            const depColors = STAGE_COLORS[dep];
            const isChecked = config.dependsOn.includes(dep);
            return (
              <label key={dep} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox checked={isChecked} onCheckedChange={() => onToggleDependency(config.stage, dep)} className="h-3.5 w-3.5" data-testid={`checkbox-dep-${config.stage}-${dep}`} />
                <span className={`inline-flex items-center gap-1 text-[10px] ${isChecked ? (depColors?.text || 'text-gray-600') : 'text-muted-foreground'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${depColors?.dot || 'bg-gray-400'}`} />
                  {STAGE_LABELS[dep] || dep}
                </span>
              </label>
            );
          })}
        </div>
        {config.dependsOn.length === 0 && (
          <span className="text-[10px] text-muted-foreground italic">No dependencies — starts from project creation</span>
        )}
      </div>

      {config.dependsOn.length > 0 && (
        <div className="mt-2 pt-2 border-t border-dashed border-current/10">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Required to unlock:</span>
          <div className="mt-1 space-y-0.5">
            {config.dependsOn.map(dep => {
              const criteria = STAGE_COMPLETION_CRITERIA[dep];
              if (!criteria) return null;
              return (
                <p key={dep} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${STAGE_COLORS[dep]?.dot || 'bg-gray-400'} shrink-0 mt-1`} />
                  <span><span className="font-medium">{STAGE_LABELS[dep]}:</span> {criteria.label}</span>
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
