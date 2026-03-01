import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, CheckCircle2, Timer, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { CollapsibleKpiSection } from "./CollapsibleKpiSection";

interface EscalationKpiStats {
  totalTickets: number;
  openCount: number;
  resolvedCount: number;
  overdueCount: number;
  avgResponseHours: number | null;
  avgResolutionHours: number | null;
  slaRate: number | null;
  byView: Record<string, number>;
  slaHours: number;
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

export function EscalationKpiSection() {
  const { data: stats, isLoading } = useQuery<EscalationKpiStats>({
    queryKey: ["/api/escalation/kpi-stats"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="escalation-kpi-loading">
        <h2 className="text-lg font-semibold">Escalation KPIs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="card-kpi-open-tickets">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Tickets</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.openCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-open-tickets">{stats.openCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.totalTickets} total all-time</p>
          </CardContent>
        </Card>

        <Card className={hasOverdue ? "border-red-300 dark:border-red-800" : ""} data-testid="card-kpi-overdue-tickets">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Past {stats.slaHours}h SLA</CardTitle>
            <Timer className={`h-4 w-4 ${hasOverdue ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${hasOverdue ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-overdue-tickets">{stats.overdueCount}</div>
            <p className="text-xs text-muted-foreground mt-1">of {stats.openCount} open tickets</p>
          </CardContent>
        </Card>

        <Card data-testid="card-kpi-avg-response">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-response">{formatHours(stats.avgResponseHours)}</div>
            <p className="text-xs text-muted-foreground mt-1">time to first response</p>
          </CardContent>
        </Card>

        <Card data-testid="card-kpi-avg-resolution">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Resolution Time</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-resolution">{formatHours(stats.avgResolutionHours)}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.resolvedCount} tickets resolved</p>
          </CardContent>
        </Card>

        <Card data-testid="card-kpi-sla-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SLA Compliance</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-sla-rate">
              {stats.slaRate !== null ? `${Math.round(stats.slaRate)}%` : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">resolved within {stats.slaHours}h</p>
          </CardContent>
        </Card>
      </div>
    </CollapsibleKpiSection>
  );
}
