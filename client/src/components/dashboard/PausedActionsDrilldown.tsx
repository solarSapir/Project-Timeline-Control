import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ChevronRight, ChevronDown, Layers } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { PauseLog, Project } from "@shared/schema";

const ACTION_LABELS: Record<string, string> = {
  reason: "Reason Logged",
  follow_up: "Follow-Up",
  timer_reset: "Timer Reset",
  marked_lost: "Marked Lost",
};

const ACTION_COLORS: Record<string, string> = {
  reason: "hsl(45, 93%, 47%)",
  follow_up: "hsl(210, 80%, 55%)",
  timer_reset: "hsl(150, 60%, 50%)",
  marked_lost: "hsl(0, 72%, 51%)",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pauseLogs: PauseLog[];
  projects: Project[];
}

interface LogEntry {
  date: string;
  time: string;
  staffName: string;
  actionType: string;
  projectName: string;
  reason: string | null;
  note: string | null;
  actionRequired: string | null;
  nextSteps: string | null;
  followUpDate: string | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatTime(isoStr: string): string {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function NotesPanel({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  return (
    <div className="mt-2 mb-3 ml-2 border rounded-md bg-muted/30 p-3 relative" data-testid="panel-pause-action-notes">
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        data-testid="button-close-pause-notes"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="pr-6 space-y-1.5">
        <div className="flex items-center gap-2 mb-2">
          <Badge
            variant={entry.actionType === "marked_lost" ? "destructive" : "outline"}
            className="text-[9px] px-1.5 py-0"
          >
            {ACTION_LABELS[entry.actionType] || entry.actionType}
          </Badge>
          <span className="text-xs font-medium">{entry.projectName}</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{entry.staffName} · {formatTime(entry.time)}</span>
        </div>
        {entry.reason && (
          <div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Reason</span>
            <p className="text-xs text-muted-foreground">{entry.reason}</p>
          </div>
        )}
        {entry.note && (
          <div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Why Paused</span>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{entry.note}</p>
          </div>
        )}
        {entry.actionRequired && (
          <div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Action Required</span>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{entry.actionRequired}</p>
          </div>
        )}
        {entry.nextSteps && (
          <div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Next Steps</span>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{entry.nextSteps}</p>
          </div>
        )}
        {entry.followUpDate && (
          <div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Follow-Up</span>
            <p className="text-xs text-muted-foreground">{entry.followUpDate}</p>
          </div>
        )}
        {!entry.reason && !entry.note && !entry.actionRequired && !entry.nextSteps && (
          <p className="text-xs text-muted-foreground italic">No details recorded for this action.</p>
        )}
      </div>
    </div>
  );
}

function EntryRow({ entry, entryKey }: { entry: LogEntry; entryKey: string }) {
  const [notesOpen, setNotesOpen] = useState(false);

  return (
    <div>
      <div
        className={`flex items-center gap-2 text-[12px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-muted/50 ${notesOpen ? "bg-muted/50" : ""}`}
        onClick={() => setNotesOpen(prev => !prev)}
        data-testid={`pause-drilldown-entry-${entryKey}`}
      >
        {entry.time && (
          <span className="text-[10px] text-muted-foreground/60 font-mono w-[62px] flex-shrink-0">
            {formatTime(entry.time)}
          </span>
        )}
        <Badge
          variant={entry.actionType === "marked_lost" ? "destructive" : entry.actionType === "reason" ? "default" : "outline"}
          className="text-[9px] px-1.5 py-0 cursor-pointer"
        >
          {ACTION_LABELS[entry.actionType] || entry.actionType}
        </Badge>
        <span className="text-muted-foreground truncate max-w-[200px]" title={entry.projectName}>
          {entry.projectName}
        </span>
        {entry.reason && (
          <span className="text-muted-foreground/70 truncate max-w-[150px]" title={entry.reason}>
            {entry.reason}
          </span>
        )}
        <span className="text-muted-foreground/50 ml-auto flex-shrink-0">
          {entry.staffName || "Unknown"}
        </span>
      </div>
      {notesOpen && <NotesPanel entry={entry} onClose={() => setNotesOpen(false)} />}
    </div>
  );
}

function SessionGroupRow({ entries, groupKey, projectName, staffName }: {
  entries: LogEntry[];
  groupKey: string;
  projectName: string;
  staffName: string;
}) {
  const [open, setOpen] = useState(false);
  const count = entries.length;
  const actionTypes = [...new Set(entries.map(e => ACTION_LABELS[e.actionType] || e.actionType))];

  return (
    <div>
      <div
        className="flex items-center gap-2 text-[12px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-muted/50"
        onClick={() => setOpen(prev => !prev)}
        data-testid={`pause-drilldown-session-${groupKey}`}
      >
        <span className="text-[10px] text-muted-foreground/60 font-mono w-[62px] flex-shrink-0">
          {entries[0].time ? formatTime(entries[0].time) : ""}
        </span>
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        )}
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <Layers className="h-2.5 w-2.5" />
          {count} actions
        </Badge>
        <span className="text-muted-foreground truncate max-w-[200px]" title={projectName}>
          {projectName}
        </span>
        <span className="text-[10px] text-muted-foreground/50">{actionTypes.join(", ")}</span>
        <span className="text-muted-foreground/50 ml-auto flex-shrink-0">
          {staffName || "Unknown"}
        </span>
      </div>
      {open && (
        <div className="ml-[68px] border-l-2 border-amber-200 dark:border-amber-800 pl-3 mt-0.5 mb-1 space-y-0.5">
          {entries.map((entry, i) => (
            <EntryRow key={`${groupKey}-${i}`} entry={entry} entryKey={`${groupKey}-${i}`} />
          ))}
        </div>
      )}
    </div>
  );
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

interface SessionGroup {
  entries: LogEntry[];
  projectName: string;
  staffName: string;
}

function groupIntoSessions(entries: LogEntry[]): SessionGroup[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => {
    const ta = a.time ? new Date(a.time).getTime() : 0;
    const tb = b.time ? new Date(b.time).getTime() : 0;
    return ta - tb;
  });
  const groups: SessionGroup[] = [];
  let current: LogEntry[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    const entry = sorted[i];
    const sameProject = prev.projectName === entry.projectName;
    const sameStaff = prev.staffName === entry.staffName;
    const prevTime = prev.time ? new Date(prev.time).getTime() : 0;
    const entryTime = entry.time ? new Date(entry.time).getTime() : 0;
    const withinWindow = entryTime - prevTime <= THIRTY_MINUTES_MS;

    if (sameProject && sameStaff && withinWindow) {
      current.push(entry);
    } else {
      groups.push({ entries: current, projectName: current[0].projectName, staffName: current[0].staffName });
      current = [entry];
    }
  }
  groups.push({ entries: current, projectName: current[0].projectName, staffName: current[0].staffName });
  return groups;
}

export function PausedActionsDrilldown({ open, onOpenChange, pauseLogs, projects }: Props) {
  const [staffFilter, setStaffFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d");

  const projectNameMap = new Map<string, string>();
  for (const p of projects) {
    projectNameMap.set(p.id, p.name);
  }

  const timeRangeCutoff = timeRange === "all" ? 0
    : timeRange === "30d" ? Date.now() - 30 * 86400000
    : Date.now() - 7 * 86400000;

  const entries: LogEntry[] = pauseLogs
    .filter(log => log.pausedAt && new Date(log.pausedAt).getTime() >= timeRangeCutoff)
    .map(log => {
      const dateObj = new Date(log.pausedAt!);
      return {
        date: dateObj.toISOString().split("T")[0],
        time: log.pausedAt!.toString(),
        staffName: log.staffName || "Unknown",
        actionType: log.actionType || "reason",
        projectName: projectNameMap.get(log.projectId) || log.projectId,
        reason: log.reason,
        note: log.note,
        actionRequired: log.actionRequired,
        nextSteps: log.nextSteps,
        followUpDate: log.followUpDate,
      };
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const staffNames = [...new Set(entries.map(e => e.staffName))].sort();

  const staffActionCounts: Record<string, number> = {};
  for (const name of staffNames) {
    staffActionCounts[name] = entries.filter(e => e.staffName === name).length;
  }

  const filtered = staffFilter === "all"
    ? entries
    : entries.filter(e => e.staffName === staffFilter);

  const actionTypes = [...new Set(filtered.map(e => e.actionType))];
  const dates = [...new Set(filtered.map(e => e.date))].sort();
  const last30 = dates.slice(-30);

  const chartData = last30.map(date => {
    const dayItems = filtered.filter(e => e.date === date);
    const row: Record<string, string | number> = {
      date: formatDate(date),
    };
    for (const at of actionTypes) {
      row[at] = dayItems.filter(e => e.actionType === at).length;
    }
    row.total = dayItems.length;
    return row;
  });

  const groupedByDate = last30.reduce<Record<string, LogEntry[]>>((acc, date) => {
    acc[date] = filtered.filter(e => e.date === date);
    return acc;
  }, {});

  const uniqueProjects = new Set(filtered.map(e => e.projectName)).size;

  const sessionsByDate: Record<string, SessionGroup[]> = {};
  for (const date of last30) {
    sessionsByDate[date] = groupIntoSessions(groupedByDate[date]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="dialog-paused-actions-drilldown">
        <DialogHeader>
          <DialogTitle data-testid="text-paused-drilldown-title">Paused Project Actions</DialogTitle>
          <DialogDescription>Daily activity breakdown for paused project follow-ups, reason logging, and reviews</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-sm text-muted-foreground">Filter by staff:</span>
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="w-56 h-8 text-sm" data-testid="select-pause-staff-filter">
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff ({staffNames.length})</SelectItem>
              {staffNames.map(name => (
                <SelectItem key={name} value={name}>{name} ({staffActionCounts[name]} actions)</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={(v: "7d" | "30d" | "all") => setTimeRange(v)}>
            <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-pause-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} actions across {uniqueProjects} projects
          </span>
        </div>

        {chartData.length > 0 ? (
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2">Daily Actions by Type</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {actionTypes.map(at => (
                  <Bar
                    key={at}
                    dataKey={at}
                    stackId="a"
                    fill={ACTION_COLORS[at] || "hsl(150, 60%, 50%)"}
                    name={ACTION_LABELS[at] || at}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground mb-6" data-testid="text-no-pause-drilldown-data">
            <p>No pause activity data yet. Actions will appear here as staff process paused projects.</p>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-medium">Activity Log</h3>
          <p className="text-xs text-muted-foreground -mt-2">Actions on the same project within 30 minutes are grouped together. Click to expand details.</p>
          {last30.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity recorded.</p>
          )}
          {[...last30].reverse().map(date => {
            const sessions = sessionsByDate[date];
            const dayActions = groupedByDate[date].length;
            const dayProjects = new Set(groupedByDate[date].map(e => e.projectName)).size;
            const dayStaff = [...new Set(groupedByDate[date].map(e => e.staffName))];

            return (
              <div key={date} data-testid={`pause-drilldown-day-${date}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-medium">{formatDate(date)}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {dayActions} action{dayActions !== 1 ? "s" : ""} · {dayProjects} project{dayProjects !== 1 ? "s" : ""}
                  </Badge>
                  {staffFilter === "all" && dayStaff.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      {dayStaff.map(s => `${s} (${groupedByDate[date].filter(e => e.staffName === s).length})`).join(", ")}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5 ml-2 border-l-2 border-muted pl-3">
                  {sessions.map((session, si) => {
                    const groupKey = `${date}-${si}`;
                    if (session.entries.length === 1) {
                      return <EntryRow key={groupKey} entry={session.entries[0]} entryKey={groupKey} />;
                    }
                    return (
                      <SessionGroupRow
                        key={groupKey}
                        entries={session.entries}
                        groupKey={groupKey}
                        projectName={session.projectName}
                        staffName={session.staffName}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
