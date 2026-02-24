import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import type { CalendarProject } from "@/utils/install-dates";
import { STATUS_STYLES, STATUS_DOT, getCalendarStageLabel } from "@/utils/install-dates";

interface CalendarDayCellProps {
  day: number;
  dateStr: string;
  isToday: boolean;
  isWeekend: boolean;
  projects: CalendarProject[];
  onSelectDate: (date: string) => void;
}

/** A single day cell in the calendar grid. */
export default function CalendarDayCell({ day, dateStr, isToday, isWeekend, projects, onSelectDate }: CalendarDayCellProps) {
  return (
    <div
      className={`min-h-[100px] border-r border-b border-border/50 p-1 cursor-pointer hover:bg-accent/30 transition-colors ${
        isToday ? "bg-primary/5" : isWeekend ? "bg-muted/30" : ""
      }`}
      data-testid={`cell-day-${dateStr}`}
      onClick={() => projects.length > 0 && onSelectDate(dateStr)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-medium ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{day}</span>
        {projects.length > 0 && (
          <span className="text-[9px] font-medium text-muted-foreground bg-muted rounded-full px-1.5">{projects.length}</span>
        )}
      </div>
      <div className="space-y-0.5">
        {projects.slice(0, 3).map((p) => (
          <Tooltip key={p.id}>
            <TooltipTrigger asChild>
              <div
                className={`text-[10px] leading-tight px-1 py-0.5 rounded-sm truncate cursor-pointer hover:opacity-80 ${STATUS_STYLES[p.status]}`}
                data-testid={`event-project-${p.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Link href={`/project/${p.id}`} className="flex items-center">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 flex-shrink-0 ${STATUS_DOT[p.status]}`} />
                  <span className="truncate">{p.name}</span>
                </Link>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[280px]">
              <div className="space-y-1">
                <p className="font-medium text-sm">{p.name}</p>
                {p.province && <p className="text-xs text-muted-foreground">{p.province}</p>}
                <p className="text-xs">Expected Install: {new Date(p.expectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                {p.targetDate && (
                  <p className="text-xs text-muted-foreground">Original Target: {new Date(p.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                )}
                {p.daysLate && p.daysLate > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">{p.daysLate} days behind target</p>
                )}
                <p className="text-xs">Stage: {getCalendarStageLabel(p.reason)}</p>
                <p className="text-xs">AHJ: {p.ahjStatus || 'N/A'}</p>
                <Badge className={`text-[10px] ${STATUS_STYLES[p.status]}`}>
                  {p.status === "on-track" ? "On Track" : p.status === "late" ? "Running Late" : "Overdue"}
                </Badge>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        {projects.length > 3 && (
          <button
            className="text-[10px] text-primary hover:underline px-1 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onSelectDate(dateStr); }}
            data-testid={`button-more-${dateStr}`}
          >
            +{projects.length - 3} more
          </button>
        )}
      </div>
    </div>
  );
}
