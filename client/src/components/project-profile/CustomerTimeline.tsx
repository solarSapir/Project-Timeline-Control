import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ChevronDown, ChevronUp, FileUp, X } from "lucide-react";
import { format } from "date-fns";
import type { TaskAction } from "@shared/schema";

interface TimelineEntry {
  id: string;
  timestamp: Date;
  source: "task_action" | "uc_completion" | "rebate_completion";
  viewType: string;
  actionType: string;
  staffName: string | null;
  notes: string | null;
  toStatus: string | null;
  fromStatus: string | null;
}

interface UcCompletion {
  id: string;
  projectId: string;
  staffName: string;
  actionType: string;
  fromStatus: string | null;
  toStatus: string | null;
  notes: string | null;
  completedAt: string | null;
}

interface RebateCompletion {
  id: string;
  projectId: string;
  staffName: string;
  actionType: string;
  fromStatus: string | null;
  toStatus: string | null;
  notes: string | null;
  followUpDate: string | null;
  completedAt: string | null;
}

const SOURCE_COLORS: Record<string, string> = {
  task_action: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  uc_completion: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  rebate_completion: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const SOURCE_LABELS: Record<string, string> = {
  task_action: "Action",
  uc_completion: "UC",
  rebate_completion: "Rebate",
};

const ACTION_LABELS: Record<string, string> = {
  status_change: "Status Change",
  follow_up: "Follow-Up",
  follow_up_push: "Follow-Up Push",
  document_upload: "Document Upload",
  completed: "Completed",
  contract_approved: "Contract Approved",
};

function NotesPanel({ entry, onClose }: { entry: TimelineEntry; onClose: () => void }) {
  return (
    <div className="mt-1.5 mb-2 ml-6 border rounded-md bg-muted/30 p-3 relative" data-testid="panel-timeline-notes">
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        data-testid="button-close-timeline-notes"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="pr-6">
        {entry.toStatus && (
          <div className="flex items-center gap-2 mb-1.5">
            {entry.fromStatus && (
              <span className="text-xs text-muted-foreground">{entry.fromStatus}</span>
            )}
            {entry.fromStatus && <span className="text-xs text-muted-foreground">→</span>}
            <span className="text-xs font-medium">{entry.toStatus}</span>
          </div>
        )}
        {entry.notes ? (
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed" data-testid="text-timeline-notes">
            {entry.notes}
          </pre>
        ) : (
          <p className="text-xs text-muted-foreground italic">No notes recorded.</p>
        )}
      </div>
    </div>
  );
}

export function CustomerTimeline({ projectId, taskActions }: { projectId: string; taskActions: TaskAction[] }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const { data: ucCompletions = [] } = useQuery<UcCompletion[]>({
    queryKey: ["/api/uc/completions", projectId],
  });

  const { data: rebateCompletions = [] } = useQuery<RebateCompletion[]>({
    queryKey: ["/api/rebate/completions", projectId],
  });

  const entries: TimelineEntry[] = [];

  for (const ta of taskActions) {
    entries.push({
      id: `ta-${ta.id}`,
      timestamp: ta.completedAt ? new Date(ta.completedAt) : new Date(),
      source: "task_action",
      viewType: ta.viewType,
      actionType: ta.actionType,
      staffName: ta.completedBy || null,
      notes: ta.notes || null,
      toStatus: null,
      fromStatus: null,
    });
  }

  for (const uc of ucCompletions) {
    entries.push({
      id: `uc-${uc.id}`,
      timestamp: uc.completedAt ? new Date(uc.completedAt) : new Date(),
      source: "uc_completion",
      viewType: "uc",
      actionType: uc.actionType,
      staffName: uc.staffName,
      notes: uc.notes || null,
      toStatus: uc.toStatus || null,
      fromStatus: uc.fromStatus || null,
    });
  }

  for (const rc of rebateCompletions) {
    entries.push({
      id: `rb-${rc.id}`,
      timestamp: rc.completedAt ? new Date(rc.completedAt) : new Date(),
      source: "rebate_completion",
      viewType: "rebates",
      actionType: rc.actionType,
      staffName: rc.staffName,
      notes: rc.notes || null,
      toStatus: rc.toStatus || null,
      fromStatus: rc.fromStatus || null,
    });
  }

  entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const displayed = expanded ? entries : entries.slice(0, 15);

  if (entries.length === 0) return null;

  const groupedByDate = displayed.reduce<Record<string, TimelineEntry[]>>((acc, entry) => {
    const dateKey = format(entry.timestamp, "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(entry);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <Card data-testid="section-customer-timeline">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Customer Timeline ({entries.length} actions)
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="space-y-4 max-h-[500px] overflow-auto">
          {sortedDates.map(dateKey => (
            <div key={dateKey} data-testid={`timeline-day-${dateKey}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {format(new Date(dateKey + "T12:00:00"), "EEE, MMM d, yyyy")}
                </span>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                  {groupedByDate[dateKey].length}
                </Badge>
              </div>
              <div className="space-y-0.5 ml-2 border-l-2 border-muted pl-3">
                {groupedByDate[dateKey].map(entry => {
                  const isExpanded = expandedEntry === entry.id;
                  const isUpload = entry.actionType === "document_upload";
                  return (
                    <div key={entry.id}>
                      <div
                        className={`flex items-center gap-2 text-[12px] cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-muted/50 ${isExpanded ? "bg-muted/50" : ""}`}
                        onClick={() => setExpandedEntry(prev => prev === entry.id ? null : entry.id)}
                        data-testid={`timeline-entry-${entry.id}`}
                      >
                        <span className="text-[10px] text-muted-foreground/60 font-mono w-[62px] flex-shrink-0">
                          {format(entry.timestamp, "h:mm a")}
                        </span>
                        <Badge className={`text-[9px] px-1.5 py-0 ${SOURCE_COLORS[entry.source]}`} variant="secondary">
                          {SOURCE_LABELS[entry.source]}
                        </Badge>
                        {isUpload && <FileUp className="h-3 w-3 text-purple-500 flex-shrink-0" />}
                        <span className="text-muted-foreground truncate">
                          {ACTION_LABELS[entry.actionType] || entry.actionType}
                        </span>
                        {entry.toStatus && (
                          <span className="text-muted-foreground/70 truncate">
                            → {entry.toStatus}
                          </span>
                        )}
                        {entry.staffName && (
                          <span className="text-muted-foreground/50 ml-auto flex-shrink-0">
                            {entry.staffName}
                          </span>
                        )}
                      </div>
                      {isExpanded && <NotesPanel entry={entry} onClose={() => setExpandedEntry(null)} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {entries.length > 15 && (
          <div className="mt-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              data-testid="button-toggle-timeline"
            >
              {expanded ? (
                <><ChevronUp className="h-4 w-4 mr-1" /> Show Less</>
              ) : (
                <><ChevronDown className="h-4 w-4 mr-1" /> Show All {entries.length} Actions</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
