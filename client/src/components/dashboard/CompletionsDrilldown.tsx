import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ChevronRight, ChevronDown, Layers } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface CompletionEntry {
  date: string;
  time: string;
  staffName: string;
  actionType: string;
  projectName: string;
  toStatus: string | null;
  notes: string | null;
}

interface SessionGroup {
  id: string;
  entries: CompletionEntry[];
  projectName: string;
  staffName: string;
  startTime: Date;
  endTime: Date;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completions: CompletionEntry[];
  dailyCounts: Record<string, Record<string, number>>;
}

const ACTION_LABELS: Record<string, string> = {
  status_change: "Status Change",
  follow_up: "Follow-Up",
  follow_up_push: "Follow-Up Push",
  document_upload: "Document Upload",
  escalation: "Escalation",
};

const ACTION_COLORS: Record<string, string> = {
  status_change: "hsl(33, 93%, 54%)",
  follow_up: "hsl(210, 80%, 55%)",
  follow_up_push: "hsl(150, 60%, 50%)",
  document_upload: "hsl(270, 60%, 55%)",
  escalation: "hsl(0, 72%, 51%)",
};

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatTime(isoStr: string): string {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function parseTime(entry: CompletionEntry): Date {
  if (entry.time) return new Date(entry.time);
  return new Date(entry.date + "T12:00:00");
}

function groupIntoSessions(entries: CompletionEntry[]): SessionGroup[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => parseTime(a).getTime() - parseTime(b).getTime());
  const groups: SessionGroup[] = [];
  let current: CompletionEntry[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    const entry = sorted[i];
    const sameProject = prev.projectName === entry.projectName;
    const sameStaff = prev.staffName === entry.staffName;
    const withinWindow = parseTime(entry).getTime() - parseTime(prev).getTime() <= THIRTY_MINUTES_MS;

    if (sameProject && sameStaff && withinWindow) {
      current.push(entry);
    } else {
      groups.push(makeGroup(current));
      current = [entry];
    }
  }
  groups.push(makeGroup(current));
  return groups;
}

function makeGroup(entries: CompletionEntry[]): SessionGroup {
  const sorted = [...entries].sort((a, b) => parseTime(a).getTime() - parseTime(b).getTime());
  return {
    id: sorted.map((_, i) => i).join("+") + "-" + sorted[0].projectName,
    entries: sorted,
    projectName: sorted[0].projectName,
    staffName: sorted[0].staffName,
    startTime: parseTime(sorted[0]),
    endTime: parseTime(sorted[sorted.length - 1]),
  };
}

function NotesPanel({ entry, onClose }: { entry: CompletionEntry; onClose: () => void }) {
  return (
    <div className="mt-2 mb-3 ml-2 border rounded-md bg-muted/30 p-3 relative" data-testid="panel-action-notes">
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        data-testid="button-close-notes"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="pr-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge
            variant={entry.actionType === "status_change" ? "default" : "outline"}
            className="text-[9px] px-1.5 py-0"
          >
            {ACTION_LABELS[entry.actionType] || entry.actionType}
          </Badge>
          <span className="text-xs font-medium">{entry.projectName}</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{entry.staffName} · {formatTime(entry.time)}</span>
        </div>
        {entry.notes ? (
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed" data-testid="text-action-notes">
            {entry.notes}
          </pre>
        ) : (
          <p className="text-xs text-muted-foreground italic" data-testid="text-no-notes">No notes recorded for this action.</p>
        )}
      </div>
    </div>
  );
}

function SingleEntryRow({ entry, entryKey, isExpanded, onToggle }: {
  entry: CompletionEntry; entryKey: string; isExpanded: boolean; onToggle: () => void;
}) {
  return (
    <div>
      <div
        className={`flex items-center gap-2 text-[12px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-muted/50 ${isExpanded ? 'bg-muted/50' : ''}`}
        onClick={onToggle}
        data-testid={`drilldown-entry-${entryKey}`}
      >
        {entry.time && (
          <span className="text-[10px] text-muted-foreground/60 font-mono w-[62px] flex-shrink-0">
            {formatTime(entry.time)}
          </span>
        )}
        <Badge
          variant={entry.actionType === "status_change" ? "default" : entry.actionType === "escalation" ? "destructive" : "outline"}
          className="text-[9px] px-1.5 py-0 cursor-pointer"
        >
          {ACTION_LABELS[entry.actionType] || entry.actionType}
        </Badge>
        <span className="text-muted-foreground truncate max-w-[200px]" title={entry.projectName}>
          {entry.projectName}
        </span>
        {entry.toStatus && (
          <span className="text-muted-foreground/70">
            → {entry.toStatus}
          </span>
        )}
        <span className="text-muted-foreground/50 ml-auto flex-shrink-0">
          {entry.staffName}
        </span>
      </div>
      {isExpanded && <NotesPanel entry={entry} onClose={onToggle} />}
    </div>
  );
}

function SessionGroupRow({ group, groupKey }: { group: SessionGroup; groupKey: string }) {
  const [open, setOpen] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const count = group.entries.length;
  const actionTypes = [...new Set(group.entries.map(e => ACTION_LABELS[e.actionType] || e.actionType))];
  const duration = Math.round((group.endTime.getTime() - group.startTime.getTime()) / 60000);

  return (
    <div>
      <div
        className="flex items-center gap-2 text-[12px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-muted/50"
        onClick={() => setOpen(prev => !prev)}
        data-testid={`drilldown-session-${groupKey}`}
      >
        <span className="text-[10px] text-muted-foreground/60 font-mono w-[62px] flex-shrink-0">
          {formatTime(group.entries[0].time)}
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
        <span className="text-muted-foreground truncate max-w-[200px]" title={group.projectName}>
          {group.projectName}
        </span>
        <span className="text-[10px] text-muted-foreground/50">{actionTypes.join(", ")}</span>
        {duration > 0 && (
          <span className="text-[10px] text-muted-foreground/40">({duration}m)</span>
        )}
        <span className="text-muted-foreground/50 ml-auto flex-shrink-0">
          {group.staffName}
        </span>
      </div>
      {open && (
        <div className="ml-[68px] border-l-2 border-amber-200 dark:border-amber-800 pl-3 mt-0.5 mb-1 space-y-0.5">
          {group.entries.map((entry, i) => {
            const key = `${groupKey}-${i}`;
            return (
              <SingleEntryRow
                key={key}
                entry={entry}
                entryKey={key}
                isExpanded={expandedEntry === key}
                onToggle={() => setExpandedEntry(prev => prev === key ? null : key)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CompletionsDrilldown({ open, onOpenChange, completions, dailyCounts }: Props) {
  const [staffFilter, setStaffFilter] = useState("all");

  const staffNames = [...new Set(completions.map(c => c.staffName))].sort();

  const filtered = staffFilter === "all"
    ? completions
    : completions.filter(c => c.staffName === staffFilter);

  const actionTypes = [...new Set(filtered.map(c => c.actionType))];
  const dates = [...new Set(filtered.map(c => c.date))].sort();
  const last30 = dates.slice(-30);

  const chartData = last30.map(date => {
    const dayItems = filtered.filter(c => c.date === date);
    const row: Record<string, string | number> = {
      date: formatDate(date),
    };
    for (const at of actionTypes) {
      row[at] = dayItems.filter(c => c.actionType === at).length;
    }
    row.total = dayItems.length;
    return row;
  });

  const groupedByDate = last30.reduce<Record<string, CompletionEntry[]>>((acc, date) => {
    acc[date] = filtered.filter(c => c.date === date);
    return acc;
  }, {});

  let totalSessions = 0;
  const sessionsByDate: Record<string, SessionGroup[]> = {};
  for (const date of last30) {
    const sessions = groupIntoSessions(groupedByDate[date]);
    sessionsByDate[date] = sessions;
    totalSessions += sessions.length;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="dialog-completions-drilldown">
        <DialogHeader>
          <DialogTitle data-testid="text-drilldown-title">Completions Breakdown</DialogTitle>
          <DialogDescription>Daily activity breakdown by staff and action type</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-muted-foreground">Filter by staff:</span>
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="w-48 h-8 text-sm" data-testid="select-staff-filter">
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} actions in {totalSessions} tasks
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
          <div className="flex items-center justify-center h-32 text-muted-foreground mb-6" data-testid="text-no-drilldown-data">
            <p>No completion data yet. Actions will appear here as staff process tasks.</p>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-medium">Activity Log</h3>
          <p className="text-xs text-muted-foreground -mt-2">Actions on the same project within 30 minutes are grouped together. Click to expand.</p>
          {last30.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity recorded.</p>
          )}
          {[...last30].reverse().map(date => {
            const sessions = sessionsByDate[date];
            const dayActions = groupedByDate[date].length;

            return (
              <div key={date} data-testid={`drilldown-day-${date}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-medium">{formatDate(date)}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {dayActions} action{dayActions !== 1 ? "s" : ""} · {sessions.length} task{sessions.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="space-y-0.5 ml-2 border-l-2 border-muted pl-3">
                  {sessions.map((session, si) => {
                    const groupKey = `${date}-${si}`;
                    if (session.entries.length === 1) {
                      return (
                        <SingleEntryInline key={groupKey} entry={session.entries[0]} entryKey={groupKey} />
                      );
                    }
                    return <SessionGroupRow key={groupKey} group={session} groupKey={groupKey} />;
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

function SingleEntryInline({ entry, entryKey }: { entry: CompletionEntry; entryKey: string }) {
  const [notesOpen, setNotesOpen] = useState(false);

  return (
    <div>
      <div
        className={`flex items-center gap-2 text-[12px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-muted/50 ${notesOpen ? 'bg-muted/50' : ''}`}
        onClick={() => setNotesOpen(prev => !prev)}
        data-testid={`drilldown-entry-${entryKey}`}
      >
        {entry.time && (
          <span className="text-[10px] text-muted-foreground/60 font-mono w-[62px] flex-shrink-0">
            {formatTime(entry.time)}
          </span>
        )}
        <Badge
          variant={entry.actionType === "status_change" ? "default" : entry.actionType === "escalation" ? "destructive" : "outline"}
          className="text-[9px] px-1.5 py-0 cursor-pointer"
        >
          {ACTION_LABELS[entry.actionType] || entry.actionType}
        </Badge>
        <span className="text-muted-foreground truncate max-w-[200px]" title={entry.projectName}>
          {entry.projectName}
        </span>
        {entry.toStatus && (
          <span className="text-muted-foreground/70">
            → {entry.toStatus}
          </span>
        )}
        <span className="text-muted-foreground/50 ml-auto flex-shrink-0">
          {entry.staffName}
        </span>
      </div>
      {notesOpen && <NotesPanel entry={entry} onClose={() => setNotesOpen(false)} />}
    </div>
  );
}
