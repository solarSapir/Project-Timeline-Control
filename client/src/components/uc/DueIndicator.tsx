import { getDaysUntilDue, formatShortDate } from "@/utils/dates";

export function DueIndicator({ dueDate, completed }: { dueDate: string | null; completed: boolean }) {
  if (completed || !dueDate) return null;
  const daysLeft = getDaysUntilDue(dueDate);
  if (daysLeft === null) return null;

  if (daysLeft < 0) {
    return <span className="text-[11px] font-medium text-red-600 dark:text-red-400">{Math.abs(daysLeft)}d overdue</span>;
  }
  if (daysLeft <= 7) {
    return <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Due in {daysLeft}d</span>;
  }
  return <span className="text-[11px] text-muted-foreground">Due {formatShortDate(dueDate)}</span>;
}
