import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { Link } from "wouter";
import type { CalendarProject, InstallStatus } from "@/utils/install-dates";
import { STATUS_STYLES, STATUS_DOT, getCalendarStageLabel } from "@/utils/install-dates";

interface DayDetailDialogProps {
  selectedDate: string | null;
  projects: CalendarProject[];
  onClose: () => void;
}

/** Dialog showing all projects expected to start installation on a given day. */
export default function DayDetailDialog({ selectedDate, projects, onClose }: DayDetailDialogProps) {
  const sorted = [...projects].sort((a, b) => {
    const order: Record<InstallStatus, number> = { "overdue": 0, "late": 1, "on-track": 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <Dialog open={!!selectedDate} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogDescription className="sr-only">Projects expected to start installation on this day</DialogDescription>
          <DialogTitle data-testid="text-day-detail-title">
            {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({projects.length} project{projects.length !== 1 ? 's' : ''})
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-6 px-6 space-y-2">
          {sorted.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                p.status === 'overdue' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30' :
                p.status === 'late' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30' :
                'border-border'
              }`}
              data-testid={`day-detail-project-${p.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[p.status]}`} />
                  <Link href={`/project/${p.id}`}>
                    <span className="text-sm font-medium hover:underline cursor-pointer truncate" data-testid={`link-day-project-${p.id}`}>
                      {p.name}
                    </span>
                  </Link>
                </div>
                <div className="flex items-center gap-2 mt-1 ml-4 flex-wrap">
                  {p.province && <span className="text-xs text-muted-foreground">{p.province}</span>}
                  <Badge variant="outline" className="text-[10px] h-5">{getCalendarStageLabel(p.reason)}</Badge>
                  {p.ahjStatus && <span className="text-xs text-muted-foreground">AHJ: {p.ahjStatus}</span>}
                </div>
                <div className="flex items-center gap-2 mt-1 ml-4 flex-wrap">
                  {p.ucStatus && <span className="text-xs text-muted-foreground">UC: {p.ucStatus}</span>}
                  {p.installTeamStage && <span className="text-xs text-muted-foreground">Contract: {p.installTeamStage}</span>}
                  {p.siteVisitStatus && <span className="text-xs text-muted-foreground">SV: {p.siteVisitStatus}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <Badge className={`text-[10px] ${STATUS_STYLES[p.status]}`}>
                  {p.status === "on-track" ? "On Track" : p.status === "late" ? "Late" : "Overdue"}
                </Badge>
                {p.daysLate && p.daysLate > 0 && (
                  <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">{p.daysLate}d behind</span>
                )}
                {p.targetDate && (
                  <span className="text-[10px] text-muted-foreground">Target: {new Date(p.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                )}
                <Link href={`/project/${p.id}`}>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
