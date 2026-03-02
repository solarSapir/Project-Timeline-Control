import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  PauseCircle, AlertTriangle, BellOff, Timer,
  CheckCircle2, Users, BarChart3, TrendingUp,
} from "lucide-react";
import { FormulaTooltip } from "./FormulaTooltip";
import { CollapsibleKpiSection } from "./CollapsibleKpiSection";
import type { Project, PauseLog } from "@shared/schema";

export function PausedKpiSection() {
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  const { data: pauseLogs, isLoading: logsLoading } = useQuery<PauseLog[]>({
    queryKey: ["/api/pause-reasons/logs"],
  });

  const isLoading = projectsLoading || logsLoading;

  const stats = useMemo(() => {
    if (!projects) return null;

    const allPauseLogs = pauseLogs || [];
    const pausedProjects = projects.filter(p => p.pmStatus?.toLowerCase() === 'project paused');
    const total = pausedProjects.length;
    if (total === 0) return { total: 0, activeCount: 0, snoozedCount: 0, avgDaysPaused: 0, actionsThisWeek: 0, withoutReason: 0, topReason: null as { reason: string; count: number } | null, topStaff: null as { name: string; count: number } | null, reasonBreakdown: [] as [string, number][] };

    const todayStr = new Date().toISOString().split("T")[0];
    const projectFollowUps = new Map<string, string>();
    for (const log of allPauseLogs) {
      if (log.followUpDate) {
        const existing = projectFollowUps.get(log.projectId);
        if (!existing || log.followUpDate > existing) {
          projectFollowUps.set(log.projectId, log.followUpDate);
        }
      }
    }

    let activeCount = 0;
    let snoozedCount = 0;
    for (const p of pausedProjects) {
      const fu = projectFollowUps.get(p.id);
      if (fu && fu > todayStr) snoozedCount++;
      else activeCount++;
    }

    const withReason = pausedProjects.filter(p => p.pauseReason).length;
    const withoutReason = total - withReason;

    const reasonCounts: Record<string, number> = {};
    for (const p of pausedProjects) {
      if (p.pauseReason) {
        reasonCounts[p.pauseReason] = (reasonCounts[p.pauseReason] || 0) + 1;
      }
    }
    const topReasonEntry = Object.entries(reasonCounts).sort(([, a], [, b]) => b - a)[0];

    let avgDaysPaused = 0;
    const daysPausedArr: number[] = [];
    const nowMs = Date.now();
    for (const p of pausedProjects) {
      const created = p.projectCreatedDate ? new Date(p.projectCreatedDate) : null;
      if (created) {
        daysPausedArr.push(Math.floor((nowMs - created.getTime()) / 86400000));
      }
    }
    if (daysPausedArr.length > 0) {
      avgDaysPaused = Math.round(daysPausedArr.reduce((a, b) => a + b, 0) / daysPausedArr.length);
    }

    const sevenDaysAgoMs = Date.now() - 7 * 86400000;
    let actionsThisWeek = 0;
    const staffCounts: Record<string, number> = {};
    for (const log of allPauseLogs) {
      if (log.pausedAt && new Date(log.pausedAt).getTime() >= sevenDaysAgoMs) {
        actionsThisWeek++;
        if (log.staffName) staffCounts[log.staffName] = (staffCounts[log.staffName] || 0) + 1;
      }
    }
    const topStaffEntry = Object.entries(staffCounts).sort(([, a], [, b]) => b - a)[0];

    return {
      total,
      activeCount,
      snoozedCount,
      avgDaysPaused,
      actionsThisWeek,
      withoutReason,
      topReason: topReasonEntry ? { reason: topReasonEntry[0], count: topReasonEntry[1] } : null,
      topStaff: topStaffEntry ? { name: topStaffEntry[0], count: topStaffEntry[1] } : null,
      reasonBreakdown: Object.entries(reasonCounts).sort(([, a], [, b]) => b - a) as [string, number][],
    };
  }, [projects, pauseLogs]);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="paused-kpi-loading">
        <h2 className="text-lg font-semibold">Paused Projects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats || stats.total === 0) return null;

  return (
    <CollapsibleKpiSection
      storageKey="paused-dashboard-kpi"
      title="Paused Projects"
      titleIcon={<PauseCircle className="h-5 w-5 text-amber-500" />}
      titleExtra={
        <Link href="/paused" className="text-xs text-primary hover:underline" data-testid="link-view-paused">
          View All
        </Link>
      }
      summaryItems={[
        { label: "Total", value: stats.total },
        { label: "Active", value: stats.activeCount, color: stats.activeCount > 0 ? "hsl(45, 93%, 47%)" : undefined },
        { label: "Snoozed", value: stats.snoozedCount, color: "hsl(220, 70%, 50%)" },
        { label: "Avg Hold", value: `${stats.avgDaysPaused}d` },
      ]}
      testId="paused-kpi-section"
      accentColor="hsl(45, 93%, 47%)"
      titleTestId="text-paused-kpi-title"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <Card data-testid="dash-kpi-total-paused">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Total Paused
              <FormulaTooltip formula="Count of projects with PM Status = 'Project Paused'" />
            </CardTitle>
            <PauseCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">projects currently paused</p>
          </CardContent>
        </Card>

        <Card data-testid="dash-kpi-active">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Needs Attention
              <FormulaTooltip formula="Paused projects with overdue follow-ups or no follow-up date set." />
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.activeCount > 0 ? "text-amber-600" : ""}`}>{stats.activeCount}</div>
            <p className="text-xs text-muted-foreground">require action</p>
          </CardContent>
        </Card>

        <Card data-testid="dash-kpi-snoozed">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Snoozed
              <FormulaTooltip formula="Projects with a future follow-up date. Hidden until the follow-up date arrives." />
            </CardTitle>
            <BellOff className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.snoozedCount}</div>
            <p className="text-xs text-muted-foreground">hidden until follow-up</p>
          </CardContent>
        </Card>

        <Card data-testid="dash-kpi-avg-days">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Avg Days Paused
              <FormulaTooltip formula="AVG(today - projectCreatedDate) for all paused projects." />
            </CardTitle>
            <Timer className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDaysPaused}d</div>
            <p className="text-xs text-muted-foreground">average hold time</p>
          </CardContent>
        </Card>

        <Card data-testid="dash-kpi-actions-week">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Actions (7d)
              <FormulaTooltip formula="Pause logs created in the last 7 days. Measures staff engagement." />
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.actionsThisWeek}</div>
            <p className="text-xs text-muted-foreground">actions this week</p>
          </CardContent>
        </Card>

        <Card data-testid="dash-kpi-no-reason">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              No Reason
              <FormulaTooltip formula="Paused projects without a pause reason set." />
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withoutReason}</div>
            <p className="text-xs text-muted-foreground">missing pause reason</p>
          </CardContent>
        </Card>

        <Card data-testid="dash-kpi-top-reason">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Top Reason
              <FormulaTooltip formula="Most common pause reason across all currently paused projects." />
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold truncate" title={stats.topReason?.reason}>
              {stats.topReason?.reason || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.topReason ? `${stats.topReason.count} project${stats.topReason.count !== 1 ? "s" : ""}` : "no reasons logged"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="dash-kpi-top-staff">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Top Staff (7d)
              <FormulaTooltip formula="Staff member with the most follow-up actions in the last 7 days." />
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold truncate" title={stats.topStaff?.name}>
              {stats.topStaff?.name || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.topStaff ? `${stats.topStaff.count} action${stats.topStaff.count !== 1 ? "s" : ""}` : "no activity"}
            </p>
          </CardContent>
        </Card>
      </div>

      {stats.reasonBreakdown.length > 1 && (
        <div className="mt-3 p-3 rounded-md bg-muted/30 border">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <BarChart3 className="h-3 w-3" /> Pause Reason Breakdown
          </p>
          <div className="space-y-1.5">
            {stats.reasonBreakdown.map(([reason, count]) => (
              <div key={reason} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs truncate">{reason}</span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500/70"
                      style={{ width: `${Math.round((count / stats.total) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </CollapsibleKpiSection>
  );
}
