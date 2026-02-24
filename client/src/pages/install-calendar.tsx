import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import type { Project } from "@shared/schema";

function isAhjComplete(status: string | null) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('permit issued') || s.includes('closed') || s.includes('not required') || s.includes('permit close off');
}

type InstallStatus = "on-track" | "late" | "overdue";

function getInstallStatus(expectedDate: string, targetDate: string | null): InstallStatus {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expected = new Date(expectedDate);
  if (targetDate) {
    const target = new Date(targetDate);
    if (expected > target) {
      return expected < now ? "overdue" : "late";
    }
  }
  return expected < now ? "overdue" : "on-track";
}

const STATUS_STYLES: Record<InstallStatus, string> = {
  "on-track": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  "late": "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  "overdue": "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

const STATUS_DOT: Record<InstallStatus, string> = {
  "on-track": "bg-emerald-500",
  "late": "bg-amber-500",
  "overdue": "bg-red-500",
};

interface CalendarProject {
  id: string;
  name: string;
  expectedDate: string;
  targetDate: string | null;
  status: InstallStatus;
  province: string | null;
  ahjStatus: string | null;
  installTeamStage: string | null;
  siteVisitStatus: string | null;
  ucStatus: string | null;
  daysLate: number | null;
  reason: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getStageLabel(reason: string): string {
  switch (reason) {
    case "scheduled": return "Scheduled";
    case "ahj-complete": return "AHJ Done → Install";
    case "sv-complete": return "Site Visit Done → AHJ";
    case "contract-done": return "Contract Done → SV";
    case "contract-sent": return "Contract Sent";
    case "uc-complete": return "UC Done → Contract";
    case "uc-pending": return "UC Pending";
    default: return reason;
  }
}

export default function InstallCalendar() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: taskActions } = useQuery<any[]>({
    queryKey: ['/api/task-actions', 'ahj'],
  });

  const { data: siteVisitActions } = useQuery<any[]>({
    queryKey: ['/api/task-actions', 'site-visits'],
  });

  const { data: ucActions } = useQuery<any[]>({
    queryKey: ['/api/task-actions', 'uc'],
  });

  const calendarProjects = useMemo(() => {
    if (!projects) return [];

    const excludedPmStatuses = ['complete', 'project paused', 'project lost', 'close-off'];
    const installProjects = projects.filter((p) =>
      p.installType?.toLowerCase() === 'install' &&
      (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
      !excludedPmStatuses.includes(p.pmStatus?.toLowerCase() || '')
    );

    const UC_COMPLETE = ['approved', 'complete', 'not required', 'closed', 'close off'];
    const isUcDone = (s: string | null) => s ? UC_COMPLETE.some(k => s.toLowerCase().includes(k)) : false;

    const CONTRACT_DONE_STAGES = ['pending deposit', 'deposit collected', 'pending site visit', 'active install', 'complete'];
    const isContractDone = (s: string | null) => s ? CONTRACT_DONE_STAGES.some(k => s.toLowerCase().includes(k)) : false;

    const SV_DONE = ['visit complete', 'not required', 'visit booked'];
    const isSvDone = (s: string | null) => s ? SV_DONE.some(k => s.toLowerCase().includes(k)) : false;

    const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
    const toDateStr = (d: Date) => d.toISOString().split('T')[0];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const STAGE_GAPS = { ucToContract: 7, contractToSv: 7, svToAhj: 14, ahjToInstall: 7 };
    const LATE_PUSH = 7;
    const AHJ_NOT_REQUIRED = ['not required', 'closed', 'permit close off'];

    const result: CalendarProject[] = [];

    for (const p of installProjects) {
      if (p.installStartDate) {
        const status = getInstallStatus(p.installStartDate, p.installDueDate);
        let daysLate: number | null = null;
        if (p.installDueDate) {
          const diff = Math.round((new Date(p.installStartDate).getTime() - new Date(p.installDueDate).getTime()) / (1000 * 60 * 60 * 24));
          if (diff > 0) daysLate = diff;
        }
        result.push({ id: p.id, name: p.name, expectedDate: p.installStartDate, targetDate: p.installDueDate, status, province: p.province, ahjStatus: p.ahjStatus, installTeamStage: p.installTeamStage, siteVisitStatus: p.siteVisitStatus, ucStatus: p.ucStatus, daysLate, reason: "scheduled" });
        continue;
      }

      const ucDone = isUcDone(p.ucStatus);
      const contractDone = isContractDone(p.installTeamStage);
      const svDone = isSvDone(p.siteVisitStatus);
      const ahjDone = isAhjComplete(p.ahjStatus);

      const ahjIsNotRequired = p.ahjStatus ? AHJ_NOT_REQUIRED.some(k => p.ahjStatus!.toLowerCase().includes(k)) : false;
      const effectiveSvToAhj = ahjIsNotRequired ? 0 : STAGE_GAPS.svToAhj;

      let adjustedUcTarget = p.ucDueDate ? new Date(p.ucDueDate) : addDays(now, 21);
      let adjustedContractTarget = p.contractDueDate ? new Date(p.contractDueDate) : addDays(adjustedUcTarget, STAGE_GAPS.ucToContract);
      let adjustedSvTarget = p.siteVisitDueDate ? new Date(p.siteVisitDueDate) : addDays(adjustedContractTarget, STAGE_GAPS.contractToSv);
      let adjustedAhjTarget = p.ahjDueDate ? new Date(p.ahjDueDate) : addDays(adjustedSvTarget, effectiveSvToAhj);
      let adjustedInstallTarget = p.installDueDate ? new Date(p.installDueDate) : addDays(adjustedAhjTarget, STAGE_GAPS.ahjToInstall);

      let reason: string;
      let cascadeFrom: Date | null = null;

      if (!ucDone) {
        if (adjustedUcTarget < now) {
          adjustedUcTarget = addDays(now, LATE_PUSH);
          cascadeFrom = adjustedUcTarget;
        }
        reason = "uc-pending";
      } else if (!contractDone) {
        if (adjustedContractTarget < now) {
          adjustedContractTarget = addDays(now, LATE_PUSH);
          cascadeFrom = adjustedContractTarget;
        }
        reason = "uc-complete";
      } else if (!svDone) {
        if (adjustedSvTarget < now) {
          adjustedSvTarget = addDays(now, LATE_PUSH);
          cascadeFrom = adjustedSvTarget;
        }
        reason = "contract-done";
      } else if (!ahjDone) {
        if (adjustedAhjTarget < now) {
          adjustedAhjTarget = addDays(now, LATE_PUSH);
          cascadeFrom = adjustedAhjTarget;
        }
        reason = "sv-complete";
      } else {
        reason = "ahj-complete";
      }

      if (cascadeFrom) {
        if (reason === "uc-pending") {
          adjustedContractTarget = addDays(cascadeFrom, STAGE_GAPS.ucToContract);
          adjustedSvTarget = addDays(adjustedContractTarget, STAGE_GAPS.contractToSv);
          adjustedAhjTarget = addDays(adjustedSvTarget, effectiveSvToAhj);
          adjustedInstallTarget = addDays(adjustedAhjTarget, STAGE_GAPS.ahjToInstall);
        } else if (reason === "uc-complete") {
          adjustedSvTarget = addDays(cascadeFrom, STAGE_GAPS.contractToSv);
          adjustedAhjTarget = addDays(adjustedSvTarget, effectiveSvToAhj);
          adjustedInstallTarget = addDays(adjustedAhjTarget, STAGE_GAPS.ahjToInstall);
        } else if (reason === "contract-done") {
          adjustedAhjTarget = addDays(cascadeFrom, effectiveSvToAhj);
          adjustedInstallTarget = addDays(adjustedAhjTarget, STAGE_GAPS.ahjToInstall);
        } else if (reason === "sv-complete") {
          adjustedInstallTarget = addDays(cascadeFrom, STAGE_GAPS.ahjToInstall);
        }
      }

      let expectedDate: string;

      if (ahjDone && svDone && contractDone && ucDone) {
        expectedDate = toDateStr(addDays(now, STAGE_GAPS.ahjToInstall));
      } else {
        expectedDate = toDateStr(adjustedInstallTarget);
      }

      const status = getInstallStatus(expectedDate, p.installDueDate);
      let daysLate: number | null = null;
      if (p.installDueDate) {
        const diff = Math.round((new Date(expectedDate).getTime() - new Date(p.installDueDate).getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 0) daysLate = diff;
      }
      result.push({ id: p.id, name: p.name, expectedDate, targetDate: p.installDueDate, status, province: p.province, ahjStatus: p.ahjStatus, installTeamStage: p.installTeamStage, siteVisitStatus: p.siteVisitStatus, ucStatus: p.ucStatus, daysLate, reason });
    }

    return result;
  }, [projects, taskActions, siteVisitActions, ucActions]);

  const projectsByDate = useMemo(() => {
    const map: Record<string, CalendarProject[]> = {};
    for (const p of calendarProjects) {
      const dateKey = p.expectedDate;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(p);
    }
    return map;
  }, [calendarProjects]);

  const monthProjects = useMemo(() => {
    return calendarProjects.filter((p) => {
      const d = new Date(p.expectedDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [calendarProjects, currentMonth, currentYear]);

  const onTrackCount = monthProjects.filter(p => p.status === "on-track").length;
  const lateCount = monthProjects.filter(p => p.status === "late").length;
  const overdueCount = monthProjects.filter(p => p.status === "overdue").length;

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const selectedDayProjects = selectedDate ? (projectsByDate[selectedDate] || []) : [];

  if (projectsLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Install Calendar</h1>
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(
      <div key={`empty-${i}`} className="min-h-[100px] border-r border-b border-border/50" />
    );
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayProjects = projectsByDate[dateStr] || [];
    const isToday = dateStr === todayStr;
    const isWeekend = (firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6;

    calendarCells.push(
      <div
        key={day}
        className={`min-h-[100px] border-r border-b border-border/50 p-1 cursor-pointer hover:bg-accent/30 transition-colors ${
          isToday ? "bg-primary/5" : isWeekend ? "bg-muted/30" : ""
        }`}
        data-testid={`cell-day-${dateStr}`}
        onClick={() => dayProjects.length > 0 && setSelectedDate(dateStr)}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-medium ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
            {day}
          </span>
          {dayProjects.length > 0 && (
            <span className="text-[9px] font-medium text-muted-foreground bg-muted rounded-full px-1.5">
              {dayProjects.length}
            </span>
          )}
        </div>
        <div className="space-y-0.5">
          {dayProjects.slice(0, 3).map((p) => (
            <Tooltip key={p.id}>
              <TooltipTrigger asChild>
                <div
                  className={`text-[10px] leading-tight px-1 py-0.5 rounded-sm truncate cursor-pointer hover:opacity-80 ${STATUS_STYLES[p.status]}`}
                  data-testid={`event-project-${p.id}`}
                  onClick={(e) => { e.stopPropagation(); }}
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
                  <p className="text-xs">Stage: {getStageLabel(p.reason)}</p>
                  <p className="text-xs">AHJ: {p.ahjStatus || 'N/A'}</p>
                  <Badge className={`text-[10px] ${STATUS_STYLES[p.status]}`}>
                    {p.status === "on-track" ? "On Track" : p.status === "late" ? "Running Late" : "Overdue"}
                  </Badge>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
          {dayProjects.length > 3 && (
            <button
              className="text-[10px] text-primary hover:underline px-1 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setSelectedDate(dateStr); }}
              data-testid={`button-more-${dateStr}`}
            >
              +{dayProjects.length - 3} more
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalCells = calendarCells.length;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < remainingCells; i++) {
    calendarCells.push(
      <div key={`trailing-${i}`} className="min-h-[100px] border-r border-b border-border/50" />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold" data-testid="text-install-calendar-title">Install Calendar</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {onTrackCount > 0 && (
            <Badge className={STATUS_STYLES["on-track"]} data-testid="badge-on-track-count">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              On Track: {onTrackCount}
            </Badge>
          )}
          {lateCount > 0 && (
            <Badge className={STATUS_STYLES["late"]} data-testid="badge-late-count">
              <Clock className="h-3 w-3 mr-1" />
              Late: {lateCount}
            </Badge>
          )}
          {overdueCount > 0 && (
            <Badge className={STATUS_STYLES["overdue"]} data-testid="badge-overdue-count">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Overdue: {overdueCount}
            </Badge>
          )}
          <Badge variant="secondary" data-testid="badge-total-count">
            Total: {monthProjects.length}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Shows expected install dates based on actual stage completions and due dates. Projects are placed where they're realistically expected based on their current progress. Click any day to see the full list.
      </p>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={prevMonth} data-testid="button-prev-month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold min-w-[180px] text-center" data-testid="text-current-month">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
              <Button size="icon" variant="ghost" onClick={nextMonth} data-testid="button-next-month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-go-today">
              Today
            </Button>
          </div>

          <div className="border border-border/50 rounded-md overflow-hidden">
            <div className="grid grid-cols-7">
              {DAY_NAMES.map((day) => (
                <div key={day} className="text-xs font-medium text-muted-foreground text-center py-2 border-b border-r border-border/50 bg-muted/20">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarCells}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <span className="text-xs text-muted-foreground">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT["on-track"]}`} />
              <span className="text-xs text-muted-foreground">On Track</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT["late"]}`} />
              <span className="text-xs text-muted-foreground">Behind Target</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT["overdue"]}`} />
              <span className="text-xs text-muted-foreground">Overdue</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogDescription className="sr-only">Projects expected to start installation on this day</DialogDescription>
            <DialogTitle data-testid="text-day-detail-title">
              {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({selectedDayProjects.length} project{selectedDayProjects.length !== 1 ? 's' : ''})
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-6 px-6 space-y-2">
            {selectedDayProjects
              .sort((a, b) => {
                const order: Record<InstallStatus, number> = { "overdue": 0, "late": 1, "on-track": 2 };
                return order[a.status] - order[b.status];
              })
              .map((p) => (
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
                    {p.province && (
                      <span className="text-xs text-muted-foreground">{p.province}</span>
                    )}
                    <Badge variant="outline" className="text-[10px] h-5">
                      {getStageLabel(p.reason)}
                    </Badge>
                    {p.ahjStatus && (
                      <span className="text-xs text-muted-foreground">AHJ: {p.ahjStatus}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-4 flex-wrap">
                    {p.ucStatus && (
                      <span className="text-xs text-muted-foreground">UC: {p.ucStatus}</span>
                    )}
                    {p.installTeamStage && (
                      <span className="text-xs text-muted-foreground">Contract: {p.installTeamStage}</span>
                    )}
                    {p.siteVisitStatus && (
                      <span className="text-xs text-muted-foreground">SV: {p.siteVisitStatus}</span>
                    )}
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
    </div>
  );
}
