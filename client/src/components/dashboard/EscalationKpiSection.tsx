import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, CheckCircle2, Timer, ShieldAlert, ChevronRight, ChevronDown, ListChecks } from "lucide-react";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { FormulaTooltip } from "./FormulaTooltip";
import { CollapsibleKpiSection } from "./CollapsibleKpiSection";

interface RecentTicket {
  id: string;
  projectName: string;
  viewType: string;
  status: string;
  staffName: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  issue: string | null;
}

interface ActivityEntry {
  id: string;
  projectName: string;
  viewType: string;
  status: string;
  staffName: string;
  createdAt: string;
  respondedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  issue: string | null;
}

interface EscalationKpiStats {
  totalTickets: number;
  openCount: number;
  resolvedCount: number;
  overdueCount: number;
  resolvedThisWeekCount: number;
  avgResponseHours: number | null;
  avgResolutionHours: number | null;
  slaRate: number | null;
  byView: Record<string, number>;
  slaHours: number;
  dailyCounts: Record<string, { created: number; resolved: number }>;
  recentTickets: RecentTicket[];
  recentActivity: ActivityEntry[];
}

function formatHours(hours: number | null): string {
  if (hours === null) return "--";
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  responded: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const VIEW_LABELS: Record<string, string> = {
  uc: "UC",
  contracts: "Contracts",
  rebates: "Rebates",
  ahj: "AHJ",
  install: "Install",
  close_off: "Close Off",
  payments: "Payments",
  site_visit: "Site Visit",
};

export function EscalationKpiSection() {
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [activityDrilldownOpen, setActivityDrilldownOpen] = useState(false);
  const [staffFilter, setStaffFilter] = useState("all");
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const { data: stats, isLoading } = useQuery<EscalationKpiStats>({
    queryKey: ["/api/escalation/kpi-stats"],
  });

  const dailyData = useMemo(() => {
    if (!stats?.dailyCounts) return [];
    const entries = Object.entries(stats.dailyCounts)
      .map(([date, counts]) => ({
        date: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        created: counts.created,
        resolved: counts.resolved,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return entries;
  }, [stats?.dailyCounts]);

  const staffList = useMemo(() => {
    if (!stats?.recentActivity) return [];
    const names = new Set<string>();
    for (const t of stats.recentActivity) {
      if (t.staffName) names.add(t.staffName);
      if (t.resolvedBy) names.add(t.resolvedBy);
    }
    return Array.from(names).sort();
  }, [stats?.recentActivity]);

  const filteredActivity = useMemo(() => {
    if (!stats?.recentActivity) return [];
    if (staffFilter === "all") return stats.recentActivity;
    return stats.recentActivity.filter(t =>
      t.staffName === staffFilter || t.resolvedBy === staffFilter
    );
  }, [stats?.recentActivity, staffFilter]);

  const activityByDate = useMemo(() => {
    const grouped: Record<string, ActivityEntry[]> = {};
    for (const t of filteredActivity) {
      const dateKey = new Date(t.createdAt).toISOString().slice(0, 10);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(t);
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a));
  }, [filteredActivity]);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="escalation-kpi-loading">
        <h2 className="text-lg font-semibold">Escalation KPIs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const hasOverdue = stats.overdueCount > 0;

  const summaryItems = [
    { label: "Open", value: stats.openCount, color: stats.openCount > 0 ? "hsl(38, 92%, 50%)" : undefined },
    { label: "Overdue", value: stats.overdueCount, color: stats.overdueCount > 0 ? "hsl(0, 84%, 60%)" : undefined },
    { label: "SLA", value: stats.slaRate !== null ? `${Math.round(stats.slaRate)}%` : "--" },
  ];

  return (
    <CollapsibleKpiSection
      storageKey="escalation-kpi"
      title="Escalation KPIs"
      titleTestId="text-escalation-kpi-title"
      titleIcon={<ShieldAlert className="h-5 w-5 text-amber-500" />}
      titleExtra={
        <Link href="/escalated" className="text-xs text-primary hover:underline" data-testid="link-view-all-tickets">
          View All Tickets
        </Link>
      }
      summaryItems={summaryItems}
      testId="escalation-kpi-section"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card
          className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
          onClick={() => setDrilldownOpen(true)}
          data-testid="card-kpi-open-tickets"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Tickets</CardTitle>
            <div className="flex items-center gap-1">
              <FormulaTooltip formula={"Count of escalation tickets currently in \"open\" or \"responded\" status.\n\nFormula: COUNT(tickets) WHERE status IN ('open', 'responded')"} />
              <AlertTriangle className={`h-4 w-4 ${stats.openCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-open-tickets">{stats.openCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.totalTickets} total all-time · click for details</p>
          </CardContent>
        </Card>

        <Card className={hasOverdue ? "border-red-300 dark:border-red-800" : ""} data-testid="card-kpi-overdue-tickets">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Past {stats.slaHours}h SLA</CardTitle>
            <div className="flex items-center gap-1">
              <FormulaTooltip formula={`Count of open tickets where time since creation exceeds ${stats.slaHours} hours.\n\nFormula: COUNT(open tickets) WHERE (now - createdAt) > ${stats.slaHours} hours`} />
              <Timer className={`h-4 w-4 ${hasOverdue ? "text-red-500" : "text-muted-foreground"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${hasOverdue ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-overdue-tickets">{stats.overdueCount}</div>
            <p className="text-xs text-muted-foreground mt-1">of {stats.openCount} open tickets</p>
          </CardContent>
        </Card>

        <Card data-testid="card-kpi-avg-response">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
            <div className="flex items-center gap-1">
              <FormulaTooltip formula={"Average time from ticket creation to first manager response.\n\nFormula: AVG(respondedAt - createdAt)\n\nOnly includes tickets that have received at least one response."} />
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-response">{formatHours(stats.avgResponseHours)}</div>
            <p className="text-xs text-muted-foreground mt-1">time to first response</p>
          </CardContent>
        </Card>

        <Card data-testid="card-kpi-avg-resolution">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Resolution Time</CardTitle>
            <div className="flex items-center gap-1">
              <FormulaTooltip formula={"Average time from ticket creation to resolution.\n\nFormula: AVG(resolvedAt - createdAt)\n\nOnly includes tickets that have been resolved."} />
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-resolution">{formatHours(stats.avgResolutionHours)}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.resolvedCount} tickets resolved</p>
          </CardContent>
        </Card>

        <Card data-testid="card-kpi-sla-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SLA Compliance</CardTitle>
            <div className="flex items-center gap-1">
              <FormulaTooltip formula={`Percentage of resolved tickets that were resolved within the ${stats.slaHours}-hour SLA target.\n\nFormula: (Resolved within ${stats.slaHours}h / Total Resolved) x 100\n\nShows "--" if no tickets have been resolved yet.`} />
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-sla-rate">
              {stats.slaRate !== null ? `${Math.round(stats.slaRate)}%` : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">resolved within {stats.slaHours}h</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
          onClick={() => setActivityDrilldownOpen(true)}
          data-testid="card-kpi-tasks-completed"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Completed</CardTitle>
            <div className="flex items-center gap-1">
              <FormulaTooltip formula={"Count of escalation tickets resolved in the last 7 days.\n\nFormula: COUNT(tickets) WHERE status = 'resolved' AND resolvedAt >= (now - 7 days)\n\nClick to see detailed activity log."} />
              <ListChecks className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-tasks-completed">{stats.resolvedThisWeekCount}</div>
            <p className="text-xs text-muted-foreground mt-1">resolved this week · click for details</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escalation Activity (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="created" fill="hsl(38, 92%, 50%)" name="Created" radius={[2, 2, 0, 0]} />
                <Bar dataKey="resolved" fill="hsl(142, 60%, 45%)" name="Resolved" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground" data-testid="text-no-escalation-daily-data">
              <p>No escalation activity in the last 30 days.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recent Escalation Tickets</DialogTitle>
            <DialogDescription>
              Last 20 escalation tickets across all views
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(stats.recentTickets || []).map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg border"
                data-testid={`row-ticket-${ticket.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ticket.projectName}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.staffName} · {ticket.viewType} · {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="secondary" className={STATUS_COLORS[ticket.status] || ""}>
                  {ticket.status}
                </Badge>
              </div>
            ))}
            {(!stats.recentTickets || stats.recentTickets.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No escalation tickets recorded yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activityDrilldownOpen} onOpenChange={setActivityDrilldownOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Escalation Activity Log
            </DialogTitle>
            <DialogDescription>
              Recent ticket activity across all escalation tickets
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 pb-2">
            <label className="text-xs font-medium text-muted-foreground">Filter by staff:</label>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="h-8 w-[200px] text-sm" data-testid="select-activity-staff-filter">
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {staffList.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Daily Activity (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="created" fill="hsl(38, 92%, 50%)" name="Created" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="resolved" fill="hsl(142, 60%, 45%)" name="Resolved" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No activity in the last 30 days.</p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3 mt-2">
            {activityByDate.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No escalation activity to display.</p>
            ) : (
              activityByDate.map(([dateKey, tickets]) => (
                <div key={dateKey} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground sticky top-0 bg-background py-1">
                    <span>{new Date(dateKey + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                    <span className="text-[10px]">({tickets.length} ticket{tickets.length !== 1 ? "s" : ""})</span>
                  </div>
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="rounded-lg border" data-testid={`activity-ticket-${ticket.id}`}>
                      <div
                        className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                      >
                        {expandedTicket === ticket.id ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <Badge variant="secondary" className={`${STATUS_COLORS[ticket.status] || ""} text-[10px] px-1.5 py-0`}>
                          {ticket.status}
                        </Badge>
                        <span className="text-sm font-medium truncate flex-1">{ticket.projectName}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {VIEW_LABELS[ticket.viewType] || ticket.viewType}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(ticket.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                        </span>
                      </div>
                      {expandedTicket === ticket.id && (
                        <div className="px-4 pb-3 pt-1 border-t space-y-2 bg-muted/20">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Created by:</span>{" "}
                              <span className="font-medium">{ticket.staffName}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Created:</span>{" "}
                              <span className="font-medium">{new Date(ticket.createdAt).toLocaleString()}</span>
                            </div>
                            {ticket.respondedAt && (
                              <div>
                                <span className="text-muted-foreground">Responded:</span>{" "}
                                <span className="font-medium">{new Date(ticket.respondedAt).toLocaleString()}</span>
                              </div>
                            )}
                            {ticket.resolvedAt && (
                              <div>
                                <span className="text-muted-foreground">Resolved:</span>{" "}
                                <span className="font-medium">{new Date(ticket.resolvedAt).toLocaleString()}</span>
                              </div>
                            )}
                            {ticket.resolvedBy && (
                              <div>
                                <span className="text-muted-foreground">Resolved by:</span>{" "}
                                <span className="font-medium">{ticket.resolvedBy}</span>
                              </div>
                            )}
                          </div>
                          {ticket.issue && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Issue:</span>
                              <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{ticket.issue}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </CollapsibleKpiSection>
  );
}
