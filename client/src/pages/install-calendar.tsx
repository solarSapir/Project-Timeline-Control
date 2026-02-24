import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Project } from "@shared/schema";

function getDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isAhjComplete(status: string | null) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('permit issued') || s.includes('closed') || s.includes('not required') || s.includes('permit close off');
}

function getExpectedInstallDate(ahjCompletionDate: string | null): string | null {
  if (!ahjCompletionDate) return null;
  const d = new Date(ahjCompletionDate);
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

type InstallStatus = "on-track" | "late" | "overdue" | "no-date";

function getInstallStatus(expectedDate: string | null, targetDate: string | null): InstallStatus {
  if (!expectedDate && !targetDate) return "no-date";
  const effectiveDate = expectedDate || targetDate;
  const days = getDaysUntilDue(effectiveDate);
  if (days !== null && days < 0) return "overdue";
  if (expectedDate && targetDate && new Date(expectedDate) > new Date(targetDate)) return "late";
  return "on-track";
}

const STATUS_STYLES: Record<InstallStatus, string> = {
  "on-track": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  "late": "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  "overdue": "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  "no-date": "bg-muted text-muted-foreground",
};

const STATUS_DOT: Record<InstallStatus, string> = {
  "on-track": "bg-emerald-500",
  "late": "bg-amber-500",
  "overdue": "bg-red-500",
  "no-date": "bg-muted-foreground",
};

interface CalendarProject {
  id: string;
  name: string;
  expectedDate: string | null;
  targetDate: string | null;
  displayDate: string;
  status: InstallStatus;
  province: string | null;
  ahjStatus: string | null;
  installStartDate: string | null;
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

export default function InstallCalendar() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: ahjActions } = useQuery<any[]>({
    queryKey: ['/api/task-actions', 'ahj'],
  });

  const calendarProjects = useMemo(() => {
    if (!projects) return [];

    const installProjects = projects.filter((p) =>
      p.installType?.toLowerCase() === 'install' &&
      (!p.propertySector || p.propertySector.toLowerCase() === 'residential')
    );

    const ahjCompletionDates: Record<string, string> = {};
    if (ahjActions) {
      for (const action of ahjActions) {
        if (action.actionType === 'completed' && action.completedAt) {
          const existing = ahjCompletionDates[action.projectId];
          const actionDate = new Date(action.completedAt).toISOString().split('T')[0];
          if (!existing || actionDate < existing) {
            ahjCompletionDates[action.projectId] = actionDate;
          }
        }
      }
    }

    return installProjects.map((p): CalendarProject => {
      const ahjDone = isAhjComplete(p.ahjStatus);
      const ahjCompDate = ahjCompletionDates[p.id] || null;
      const expectedDate = ahjDone ? getExpectedInstallDate(ahjCompDate) : null;
      const displayDate = p.installStartDate || expectedDate || p.installDueDate || null;
      const status = getInstallStatus(expectedDate, p.installDueDate);

      return {
        id: p.id,
        name: p.name,
        expectedDate,
        targetDate: p.installDueDate,
        displayDate: displayDate || "",
        status,
        province: p.province,
        ahjStatus: p.ahjStatus,
        installStartDate: p.installStartDate,
      };
    }).filter((p) => p.displayDate);
  }, [projects, ahjActions]);

  const projectsByDate = useMemo(() => {
    const map: Record<string, CalendarProject[]> = {};
    for (const p of calendarProjects) {
      if (!p.displayDate) continue;
      const dateKey = p.displayDate;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(p);
    }
    return map;
  }, [calendarProjects]);

  const monthProjects = useMemo(() => {
    return calendarProjects.filter((p) => {
      if (!p.displayDate) return false;
      const d = new Date(p.displayDate);
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
        className={`min-h-[100px] border-r border-b border-border/50 p-1 ${
          isToday ? "bg-primary/5" : isWeekend ? "bg-muted/30" : ""
        }`}
        data-testid={`cell-day-${dateStr}`}
      >
        <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
          {day}
        </div>
        <div className="space-y-0.5">
          {dayProjects.slice(0, 3).map((p) => (
            <Tooltip key={p.id}>
              <TooltipTrigger asChild>
                <div
                  className={`text-[10px] leading-tight px-1 py-0.5 rounded-sm truncate cursor-default ${STATUS_STYLES[p.status]}`}
                  data-testid={`event-project-${p.id}`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${STATUS_DOT[p.status]}`} />
                  {p.name}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[250px]">
                <div className="space-y-1">
                  <p className="font-medium text-sm">{p.name}</p>
                  {p.province && <p className="text-xs text-muted-foreground">{p.province}</p>}
                  {p.installStartDate && (
                    <p className="text-xs">Install Start: {new Date(p.installStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  )}
                  {p.expectedDate && (
                    <p className="text-xs">Expected: {new Date(p.expectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  )}
                  {p.targetDate && (
                    <p className="text-xs">Target: {new Date(p.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  )}
                  <p className="text-xs">AHJ: {p.ahjStatus || 'N/A'}</p>
                  <Badge className={`text-[10px] ${STATUS_STYLES[p.status]}`}>
                    {p.status === "on-track" ? "On Track" : p.status === "late" ? "Late" : p.status === "overdue" ? "Overdue" : "No Date"}
                  </Badge>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
          {dayProjects.length > 3 && (
            <div className="text-[10px] text-muted-foreground px-1">
              +{dayProjects.length - 3} more
            </div>
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
              <span className="text-xs text-muted-foreground">Late</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT["overdue"]}`} />
              <span className="text-xs text-muted-foreground">Overdue</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
