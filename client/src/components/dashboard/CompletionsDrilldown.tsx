import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completions: CompletionEntry[];
  dailyCounts: Record<string, Record<string, number>>;
}

const ACTION_LABELS: Record<string, string> = {
  status_change: "Status Change",
  follow_up: "Follow-Up",
};

const ACTION_COLORS: Record<string, string> = {
  status_change: "hsl(33, 93%, 54%)",
  follow_up: "hsl(210, 80%, 55%)",
};

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

export function CompletionsDrilldown({ open, onOpenChange, completions, dailyCounts }: Props) {
  const [staffFilter, setStaffFilter] = useState("all");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

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

  const toggleEntry = (key: string) => {
    setExpandedEntry(prev => prev === key ? null : key);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="dialog-completions-drilldown">
        <DialogHeader>
          <DialogTitle data-testid="text-drilldown-title">Completions Breakdown</DialogTitle>
          <p className="text-sm text-muted-foreground">Daily activity breakdown by staff and action type</p>
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
            {filtered.length} total actions
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
            <p>No completion data yet. Actions will appear here as staff process UC tasks.</p>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-medium">Activity Log</h3>
          <p className="text-xs text-muted-foreground -mt-2">Click any action to see the notes</p>
          {last30.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity recorded.</p>
          )}
          {[...last30].reverse().map(date => (
            <div key={date} data-testid={`drilldown-day-${date}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-medium">{formatDate(date)}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {groupedByDate[date].length} action{groupedByDate[date].length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="space-y-0.5 ml-2 border-l-2 border-muted pl-3">
                {[...groupedByDate[date]].sort((a, b) => (a.time || '').localeCompare(b.time || '')).map((c, i) => {
                  const entryKey = `${date}-${i}`;
                  const isExpanded = expandedEntry === entryKey;
                  return (
                    <div key={i}>
                      <div
                        className={`flex items-center gap-2 text-[12px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-muted/50 ${isExpanded ? 'bg-muted/50' : ''}`}
                        onClick={() => toggleEntry(entryKey)}
                        data-testid={`drilldown-entry-${date}-${i}`}
                      >
                        {c.time && (
                          <span className="text-[10px] text-muted-foreground/60 font-mono w-[62px] flex-shrink-0" data-testid={`text-time-${date}-${i}`}>
                            {formatTime(c.time)}
                          </span>
                        )}
                        <Badge
                          variant={c.actionType === "status_change" ? "default" : "outline"}
                          className="text-[9px] px-1.5 py-0 cursor-pointer"
                        >
                          {ACTION_LABELS[c.actionType] || c.actionType}
                        </Badge>
                        <span className="text-muted-foreground truncate max-w-[200px]" title={c.projectName}>
                          {c.projectName}
                        </span>
                        {c.toStatus && (
                          <span className="text-muted-foreground/70">
                            → {c.toStatus}
                          </span>
                        )}
                        <span className="text-muted-foreground/50 ml-auto flex-shrink-0">
                          {c.staffName}
                        </span>
                      </div>
                      {isExpanded && <NotesPanel entry={c} onClose={() => setExpandedEntry(null)} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
