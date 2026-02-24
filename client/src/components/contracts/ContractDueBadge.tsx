import type { Project } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { CalendarClock } from "lucide-react";
import { getDaysUntilDue } from "@/utils/dates";
import { getContractDueDate } from "./contract-helpers";

export function ContractDueBadge({ project }: { project: Project }) {
  const dueDate = getContractDueDate(project);
  const daysLeft = getDaysUntilDue(dueDate);
  if (daysLeft === null || !dueDate) return null;

  const formattedDate = new Date(dueDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  if (daysLeft < 0) {
    return (
      <Badge variant="destructive" className="text-xs flex items-center gap-1" data-testid="badge-contract-overdue">
        <CalendarClock className="h-3 w-3" />
        {Math.abs(daysLeft)}d overdue ({formattedDate})
      </Badge>
    );
  }
  if (daysLeft <= 3) {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs flex items-center gap-1" data-testid="badge-contract-due-soon">
        <CalendarClock className="h-3 w-3" />
        Due in {daysLeft}d ({formattedDate})
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid="badge-contract-due">
      <CalendarClock className="h-3 w-3" />
      Due {formattedDate}
    </Badge>
  );
}
