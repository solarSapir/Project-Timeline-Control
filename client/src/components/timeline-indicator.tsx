import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO } from "date-fns";
import { STAGE_LABELS } from "@shared/schema";

interface TimelineIndicatorProps {
  deadlines: Array<{
    stage: string;
    targetDate: string | null;
    actualDate: string | null;
    status: string | null;
  }>;
}

export function TimelineIndicator({ deadlines }: TimelineIndicatorProps) {
  if (!deadlines || deadlines.length === 0) return null;

  const today = new Date();

  const getStageHealth = (d: any) => {
    if (d.status === 'completed') return 'completed';
    if (!d.targetDate) return 'unknown';
    const target = parseISO(d.targetDate);
    const daysLeft = differenceInDays(target, today);
    if (daysLeft < 0) return 'overdue';
    if (daysLeft <= 7) return 'at_risk';
    return 'on_track';
  };

  const healthColors: Record<string, string> = {
    completed: 'bg-green-500',
    on_track: 'bg-green-400',
    at_risk: 'bg-amber-400',
    overdue: 'bg-red-500',
    unknown: 'bg-gray-300 dark:bg-gray-600',
  };

  return (
    <div className="flex items-center gap-0.5">
      {deadlines.map((d) => {
        const health = getStageHealth(d);
        const daysInfo = d.targetDate
          ? `${differenceInDays(parseISO(d.targetDate), today)}d`
          : '?';
        return (
          <div
            key={d.stage}
            className={`h-2 flex-1 rounded-sm ${healthColors[health]}`}
            title={`${STAGE_LABELS[d.stage] || d.stage}: ${health} (${daysInfo})`}
          />
        );
      })}
    </div>
  );
}

export function TimelineHealth({ deadlines }: TimelineIndicatorProps) {
  if (!deadlines || deadlines.length === 0) return null;

  const today = new Date();
  const overdue = deadlines.filter(d =>
    d.status !== 'completed' && d.targetDate && differenceInDays(parseISO(d.targetDate), today) < 0
  );
  const atRisk = deadlines.filter(d =>
    d.status !== 'completed' && d.targetDate &&
    differenceInDays(parseISO(d.targetDate), today) >= 0 &&
    differenceInDays(parseISO(d.targetDate), today) <= 7
  );

  if (overdue.length > 0) {
    return <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-0 text-xs">Delayed</Badge>;
  }
  if (atRisk.length > 0) {
    return <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-0 text-xs">At Risk</Badge>;
  }
  return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0 text-xs">On Track</Badge>;
}
