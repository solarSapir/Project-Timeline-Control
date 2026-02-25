import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronRight, CheckCircle2, Calendar } from "lucide-react";

interface DecisionTimeEntry {
  projectName: string;
  projectId: string;
  submittedDate: string;
  decisionDate: string;
  decision: string;
  days: number;
  month: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: DecisionTimeEntry[];
  overallAvg: number | null;
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function getDaysColor(days: number): string {
  if (days <= 7) return "text-green-600 dark:text-green-400";
  if (days <= 21) return "text-yellow-600 dark:text-yellow-400";
  if (days <= 45) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getDecisionBadge(decision: string) {
  if (decision === "Approved") {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">{decision}</Badge>;
  }
  return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">{decision}</Badge>;
}

export function DecisionTimeDrilldown({ open, onOpenChange, details, overallAvg }: Props) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const monthGroups = details.reduce<Record<string, DecisionTimeEntry[]>>((acc, entry) => {
    if (!acc[entry.month]) acc[entry.month] = [];
    acc[entry.month].push(entry);
    return acc;
  }, {});

  const monthlyStats = Object.entries(monthGroups)
    .map(([month, entries]) => {
      const avg = Math.round((entries.reduce((s, e) => s + e.days, 0) / entries.length) * 10) / 10;
      const min = Math.round(Math.min(...entries.map(e => e.days)) * 10) / 10;
      const max = Math.round(Math.max(...entries.map(e => e.days)) * 10) / 10;
      const approved = entries.filter(e => e.decision === "Approved").length;
      const rejected = entries.filter(e => e.decision === "Rejected").length;
      return { month, avg, min, max, count: entries.length, approved, rejected };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  const chartData = monthlyStats.map(m => ({
    month: formatMonth(m.month).replace(/\s\d{4}$/, ""),
    monthKey: m.month,
    avg: m.avg,
    count: m.count,
  }));

  const toggleMonth = (month: string) => {
    setExpandedMonth(prev => (prev === month ? null : month));
  };

  const totalApproved = details.filter(d => d.decision === "Approved").length;
  const totalRejected = details.filter(d => d.decision === "Rejected").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" data-testid="dialog-decision-time-drilldown">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Days to Decision — Detailed Breakdown
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Overall average: <strong>{overallAvg !== null ? `${overallAvg} days` : "--"}</strong> across {details.length} decisions
            {totalApproved > 0 && <span className="ml-2 text-green-600">({totalApproved} approved</span>}
            {totalRejected > 0 && <span className="text-red-600">, {totalRejected} rejected)</span>}
            {totalApproved > 0 && totalRejected === 0 && <span>)</span>}
          </p>
        </DialogHeader>

        {chartData.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Average Days to Decision by Month</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis label={{ value: "Days", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border rounded-md p-2 text-sm shadow-md">
                        <p className="font-medium">{label}</p>
                        <p>Avg: <strong>{data.avg} days</strong></p>
                        <p className="text-muted-foreground">{data.count} decisions</p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="avg"
                  fill="hsl(142, 60%, 45%)"
                  name="avg"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    if (data?.monthKey) toggleMonth(data.monthKey);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center">Click a bar to expand that month's projects</p>
          </div>
        )}

        <div className="space-y-1 mt-2">
          <h3 className="text-sm font-medium mb-2">Monthly Breakdown</h3>
          {monthlyStats.slice().reverse().map((m) => {
            const isExpanded = expandedMonth === m.month;
            const projects = (monthGroups[m.month] || []).sort((a, b) => b.days - a.days);

            return (
              <div key={m.month} className="border rounded-md" data-testid={`decision-month-group-${m.month}`}>
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => toggleMonth(m.month)}
                  data-testid={`button-toggle-decision-month-${m.month}`}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{formatMonth(m.month)}</span>
                    <Badge variant="secondary" className="text-xs">{m.count} decisions</Badge>
                    {m.approved > 0 && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">{m.approved} ✓</Badge>}
                    {m.rejected > 0 && <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">{m.rejected} ✗</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={getDaysColor(m.avg)}>
                      avg <strong>{m.avg}</strong> days
                    </span>
                    <span className="text-muted-foreground text-xs">
                      range: {m.min}–{m.max}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-3 pb-3">
                    <table className="w-full text-sm mt-2">
                      <thead>
                        <tr className="text-left text-muted-foreground text-xs">
                          <th className="pb-2 font-medium">Project</th>
                          <th className="pb-2 font-medium">Submitted</th>
                          <th className="pb-2 font-medium">Decision</th>
                          <th className="pb-2 font-medium">Outcome</th>
                          <th className="pb-2 font-medium text-right">Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => (
                          <tr key={p.projectId} className="border-t border-muted/30" data-testid={`row-decision-${p.projectId}`}>
                            <td className="py-2 pr-2 font-medium truncate max-w-[180px]" title={p.projectName}>
                              {p.projectName}
                            </td>
                            <td className="py-2 pr-2 text-muted-foreground">{formatDate(p.submittedDate)}</td>
                            <td className="py-2 pr-2 text-muted-foreground">{formatDate(p.decisionDate)}</td>
                            <td className="py-2 pr-2">{getDecisionBadge(p.decision)}</td>
                            <td className={`py-2 text-right font-bold ${getDaysColor(p.days)}`}>
                              {p.days}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-2 pt-2 border-t border-muted/30 flex justify-between text-xs text-muted-foreground">
                      <span>{projects.length} decisions this month</span>
                      <span>Month avg: <strong className={getDaysColor(m.avg)}>{m.avg} days</strong></span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {details.length === 0 && (
          <div className="text-center text-muted-foreground py-8" data-testid="text-no-decision-data">
            No decision time data available yet. Run the KPI backfill to populate historical data from Asana.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
