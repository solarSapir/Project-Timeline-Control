import { Clock, AlertTriangle } from "lucide-react";

const SLA_HOURS = 48;

interface Props {
  createdAt: string | Date | null;
  status: string;
}

export function EscalationSlaTimer({ createdAt, status }: Props) {
  if (!createdAt || status === "resolved") return null;

  const created = new Date(createdAt);
  const now = new Date();
  const elapsedMs = now.getTime() - created.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const remainingHours = SLA_HOURS - elapsedHours;
  const isOverdue = remainingHours <= 0;

  const formatDuration = (hours: number) => {
    const absHours = Math.abs(hours);
    if (absHours < 1) {
      const mins = Math.floor(absHours * 60);
      return `${mins}m`;
    }
    const h = Math.floor(absHours);
    const m = Math.floor((absHours - h) * 60);
    if (h >= 24) {
      const d = Math.floor(h / 24);
      const rh = h % 24;
      return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
    }
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400" data-testid="sla-overdue">
        <AlertTriangle className="h-3 w-3" />
        {formatDuration(remainingHours)} overdue
      </span>
    );
  }

  const isUrgent = remainingHours <= 6;
  const isWarning = remainingHours <= 12;

  const colorClass = isUrgent
    ? "text-red-500 dark:text-red-400"
    : isWarning
      ? "text-amber-500 dark:text-amber-400"
      : "text-muted-foreground";

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${colorClass}`} data-testid="sla-remaining">
      <Clock className="h-3 w-3" />
      {formatDuration(remainingHours)} left
    </span>
  );
}
