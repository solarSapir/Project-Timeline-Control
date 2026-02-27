import { useState } from "react";
import { differenceInDays, parseISO, format } from "date-fns";
import { PROJECT_STAGES, STAGE_LABELS } from "@shared/schema";
import { FileText, DollarSign, Camera, Shield, Calendar, Wrench, CheckCircle2, Clock } from "lucide-react";
import type { StageExpectations } from "@/hooks/use-expected-dates";
import type { LucideIcon } from "lucide-react";

const stageIcons: Record<string, LucideIcon> = {
  uc_application: FileText, rebates: DollarSign, payment: DollarSign, contract_signing: FileText,
  site_visit: Camera, ahj_permitting: Shield, install_booking: Calendar,
  installation: Wrench, close_off: CheckCircle2,
};

const STAGE_COLORS: Record<string, { bar: string; text: string }> = {
  uc_application: { bar: "bg-blue-500", text: "text-white" },
  rebates: { bar: "bg-purple-500", text: "text-white" },
  payment: { bar: "bg-pink-500", text: "text-white" },
  contract_signing: { bar: "bg-amber-500", text: "text-white" },
  site_visit: { bar: "bg-emerald-500", text: "text-white" },
  ahj_permitting: { bar: "bg-orange-500", text: "text-white" },
  install_booking: { bar: "bg-cyan-500", text: "text-white" },
  installation: { bar: "bg-indigo-500", text: "text-white" },
  close_off: { bar: "bg-rose-500", text: "text-white" },
};

export function GanttChart({ stages }: { stages: StageExpectations }) {
  const [zoomed, setZoomed] = useState(false);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const allExpected = PROJECT_STAGES
    .map((k) => (stages[k]?.expected ? parseISO(stages[k].expected!) : null))
    .filter(Boolean) as Date[];
  const earliestExpected = allExpected.length > 0 ? new Date(Math.min(...allExpected.map((d) => d.getTime()))) : now;
  const baseDate = earliestExpected > now ? now : earliestExpected;
  const zoomBase = zoomed ? now : baseDate;

  const stageData = PROJECT_STAGES.map((key, idx) => {
    const stage = stages[key];
    if (!stage) return null;
    const expectedDate = stage.expected ? parseISO(stage.expected) : null;
    const endDay = expectedDate ? Math.max(0, differenceInDays(expectedDate, zoomBase)) : 0;
    let startDay = 0;
    if (idx > 0) {
      const prevStage = stages[PROJECT_STAGES[idx - 1]];
      const prevExpected = prevStage?.expected ? parseISO(prevStage.expected) : null;
      startDay = prevExpected ? Math.max(0, differenceInDays(prevExpected, zoomBase)) : 0;
    }
    if (key === "rebates" || key === "payment") startDay = 0;
    const duration = Math.max(1, endDay - startDay);
    const isLate = !!(stage.target && stage.expected && new Date(stage.expected) > new Date(stage.target));
    return { key, startDay, endDay, duration, stage, isLate };
  }).filter(Boolean) as { key: string; startDay: number; endDay: number; duration: number; stage: { target: string | null; expected: string | null; status: string }; isLate: boolean }[];

  const maxDay = Math.max(...stageData.map((s) => s.endDay), 1);
  const todayDay = Math.max(0, differenceInDays(now, zoomBase));
  const startLabel = zoomed ? format(now, "MMM d, yyyy") : format(zoomBase, "MMM d, yyyy");
  const endDate = new Date(zoomBase);
  endDate.setDate(endDate.getDate() + maxDay);

  return (
    <div className="space-y-1.5" data-testid="gantt-chart">
      {stageData.map(({ key, startDay, duration, stage, isLate }) => {
        const Icon = stageIcons[key] || Clock;
        const isCompleted = stage.status === "completed";
        const leftPct = (startDay / maxDay) * 100;
        const widthPct = Math.max(3, (duration / maxDay) * 100);
        const colors = STAGE_COLORS[key] || { bar: "bg-gray-400", text: "text-white" };
        const barClass = isCompleted ? "bg-green-500" : isLate ? "bg-red-400" : colors.bar;
        const expectedStr = stage.expected ? format(parseISO(stage.expected), "MMM d") : "";
        return (
          <div key={key} className="flex items-center gap-2" data-testid={`gantt-row-${key}`}>
            <div className="w-[140px] flex items-center gap-1.5 flex-shrink-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs truncate">{STAGE_LABELS[key] || key}</span>
            </div>
            <div className="flex-1 relative h-7 rounded bg-muted/30">
              {!zoomed && todayDay >= 0 && todayDay <= maxDay && (
                <div className="absolute top-0 bottom-0 w-px bg-blue-400/60 z-10" style={{ left: `${(todayDay / maxDay) * 100}%` }} title="Today" />
              )}
              <div
                className={`absolute top-1 h-5 rounded ${barClass} flex items-center justify-center transition-all`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={`${STAGE_LABELS[key]}: ${duration}d (${expectedStr})`}
              >
                <span className={`text-[10px] font-medium ${colors.text} drop-shadow-sm`}>{duration}d</span>
              </div>
            </div>
            <div className="w-[55px] flex-shrink-0 text-right">
              <span className="text-[10px] text-muted-foreground">{expectedStr}</span>
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between mt-1 pt-1.5 border-t text-[10px] text-muted-foreground">
        <span>{startLabel}</span>
        <span>{format(endDate, "MMM d, yyyy")}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500" /><span>Complete</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-400" /><span>Late</span></div>
          {!zoomed && <div className="flex items-center gap-1"><div className="w-px h-4 bg-blue-400/60" /><span>Today</span></div>}
        </div>
        <button onClick={() => setZoomed(!zoomed)} className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" data-testid="button-zoom-gantt">
          {zoomed ? "Show full timeline" : "Zoom to today →"}
        </button>
      </div>
    </div>
  );
}
