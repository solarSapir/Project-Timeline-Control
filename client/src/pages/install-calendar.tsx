import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { computeCalendarProjects, STATUS_STYLES, STATUS_DOT } from "@/utils/install-dates";
import type { CalendarProject } from "@/utils/install-dates";
import CalendarDayCell from "@/components/calendar/CalendarDayCell";
import DayDetailDialog from "@/components/calendar/DayDetailDialog";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Monthly calendar view showing expected install start dates for all active projects. */
export default function InstallCalendar() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { allProjects, isLoading } = useProjects();

  const calendarProjects = useMemo(() => computeCalendarProjects(allProjects), [allProjects]);

  const projectsByDate = useMemo(() => {
    const map: Record<string, CalendarProject[]> = {};
    for (const p of calendarProjects) {
      if (!map[p.expectedDate]) map[p.expectedDate] = [];
      map[p.expectedDate].push(p);
    }
    return map;
  }, [calendarProjects]);

  const monthProjects = useMemo(
    () => calendarProjects.filter(p => { const d = new Date(p.expectedDate); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }),
    [calendarProjects, currentMonth, currentYear],
  );

  const onTrackCount = monthProjects.filter(p => p.status === "on-track").length;
  const lateCount = monthProjects.filter(p => p.status === "late").length;
  const overdueCount = monthProjects.filter(p => p.status === "overdue").length;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  const prevMonth = () => { setCurrentMonth(m => m === 0 ? (setCurrentYear(y => y - 1), 11) : m - 1); };
  const nextMonth = () => { setCurrentMonth(m => m === 11 ? (setCurrentYear(y => y + 1), 0) : m + 1); };
  const goToToday = () => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()); };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  if (isLoading) {
    return <div className="p-6 space-y-4"><h1 className="text-2xl font-semibold">Install Calendar</h1><Skeleton className="h-[600px]" /></div>;
  }

  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="min-h-[100px] border-r border-b border-border/50" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isWeekend = (firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6;
    calendarCells.push(
      <CalendarDayCell key={day} day={day} dateStr={dateStr} isToday={dateStr === todayStr} isWeekend={isWeekend} projects={projectsByDate[dateStr] || []} onSelectDate={setSelectedDate} />
    );
  }
  const totalCells = calendarCells.length;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < remainingCells; i++) {
    calendarCells.push(<div key={`trailing-${i}`} className="min-h-[100px] border-r border-b border-border/50" />);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold" data-testid="text-install-calendar-title">Install Calendar</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {onTrackCount > 0 && <Badge className={STATUS_STYLES["on-track"]} data-testid="badge-on-track-count"><CheckCircle2 className="h-3 w-3 mr-1" />On Track: {onTrackCount}</Badge>}
          {lateCount > 0 && <Badge className={STATUS_STYLES["late"]} data-testid="badge-late-count"><Clock className="h-3 w-3 mr-1" />Late: {lateCount}</Badge>}
          {overdueCount > 0 && <Badge className={STATUS_STYLES["overdue"]} data-testid="badge-overdue-count"><AlertTriangle className="h-3 w-3 mr-1" />Overdue: {overdueCount}</Badge>}
          <Badge variant="secondary" data-testid="badge-total-count">Total: {monthProjects.length}</Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Shows expected install dates based on actual stage completions and due dates. Projects are placed where they're realistically expected based on their current progress. Click any day to see the full list.
      </p>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={prevMonth} data-testid="button-prev-month"><ChevronLeft className="h-4 w-4" /></Button>
              <h2 className="text-lg font-semibold min-w-[180px] text-center" data-testid="text-current-month">{MONTH_NAMES[currentMonth]} {currentYear}</h2>
              <Button size="icon" variant="ghost" onClick={nextMonth} data-testid="button-next-month"><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-go-today">Today</Button>
          </div>

          <div className="border border-border/50 rounded-md overflow-hidden">
            <div className="grid grid-cols-7">
              {DAY_NAMES.map(day => (
                <div key={day} className="text-xs font-medium text-muted-foreground text-center py-2 border-b border-r border-border/50 bg-muted/20">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">{calendarCells}</div>
          </div>

          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <span className="text-xs text-muted-foreground">Legend:</span>
            {(["on-track", "late", "overdue"] as const).map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[s]}`} />
                <span className="text-xs text-muted-foreground">{s === "on-track" ? "On Track" : s === "late" ? "Behind Target" : "Overdue"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <DayDetailDialog selectedDate={selectedDate} projects={selectedDate ? (projectsByDate[selectedDate] || []) : []} onClose={() => setSelectedDate(null)} />
    </div>
  );
}
