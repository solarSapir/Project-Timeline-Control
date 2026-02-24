import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO, format } from "date-fns";

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  testId?: string;
}

export function InfoRow({ label, value, testId }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium" data-testid={testId}>
        {value || "--"}
      </span>
    </div>
  );
}

interface ExpectedDueRowProps {
  target: string | null;
  expected: string | null;
  testId?: string;
}

export function ExpectedDueRow({ target, expected, testId }: ExpectedDueRowProps) {
  if (!expected) return <InfoRow label="Expected Due" value="--" testId={testId} />;
  const formattedExpected = formatProfileDate(expected);
  const isLate = target && expected && new Date(expected) > new Date(target);
  const isPushed = target && expected && target !== expected;
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">Expected Due</span>
      <span className="flex items-center gap-2" data-testid={testId}>
        <span className={`font-medium ${isLate ? "text-red-600 dark:text-red-400" : isPushed ? "text-amber-600 dark:text-amber-400" : ""}`}>
          {formattedExpected}
        </span>
        {isLate && (
          <Badge variant="destructive" className="text-[10px] px-1.5">
            {differenceInDays(parseISO(expected), parseISO(target!))}d late
          </Badge>
        )}
      </span>
    </div>
  );
}

interface DaysLeftBadgeProps {
  dateStr: string | null | undefined;
}

export function DaysLeftBadge({ dateStr }: DaysLeftBadgeProps) {
  if (!dateStr) return <span className="text-muted-foreground">--</span>;
  const days = differenceInDays(parseISO(dateStr), new Date());
  if (days < 0)
    return (
      <Badge variant="destructive" className="text-xs">
        {Math.abs(days)}d overdue
      </Badge>
    );
  if (days <= 7)
    return (
      <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
        {days}d left
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-xs">
      {days}d left
    </Badge>
  );
}

export function formatProfileDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}
