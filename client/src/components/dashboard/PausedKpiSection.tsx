import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  PauseCircle, AlertTriangle, BellOff, Timer,
  CheckCircle2, BarChart3, TrendingUp, XCircle,
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
    const lostProjects = projects.filter(p => p.pmStatus?.toLowerCase() === 'project lost');
    if (total === 0) return { total: 0, activeCount: 0, snoozedCount: 0, avgDaysPaused: 0, actionsThisWeek: 0, over30: 0, over60: 0, over90: 0, lostTotal: lostProjects.length, topStaff: null as { name: string; count: number } | null, reasonBreakdown: [] as [string, number][] };

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

    const reasonCounts: Record<string, number> = {};
    for (const p of pausedProjects) {
      if (p.pauseReason) {
        reasonCounts[p.pauseReason] = (reasonCounts[p.pauseReason] || 0) + 1;
      }
    }

    let avgDaysPaused = 0;
    const daysPausedArr: number[] = [];
    const nowMs = Date.now();
    for (const p of pausedProjects) {
      const pLogs = allPauseLogs.filter(l => l.projectId === p.id);
      const latestReset = pLogs
        .filter(l => l.actionType === "timer_reset")
        .sort((a, b) => new Date(b.pausedAt!).getTime() - new Date(a.pausedAt!).getTime())[0];
      let startMs: number | null = null;
      if (p.pauseTimerStartDate) startMs = new Date(p.pauseTimerStartDate).getTime();
      else if (latestReset?.pausedAt) startMs = new Date(latestReset.pausedAt).getTime();
      else if (p.pauseReasonSetAt) startMs = new Date(p.pauseReasonSetAt).getTime();
      else if (p.projectCreatedDate) startMs = new Date(p.projectCreatedDate).getTime();
      if (startMs) daysPausedArr.push(Math.floor((nowMs - startMs) / 86400000));
    }
    if (daysPausedArr.length > 0) {
      avgDaysPaused = Math.round(daysPausedArr.reduce((a, b) => a + b, 0) / daysPausedArr.length);
    }

    let over30 = 0, over60 = 0, over90 = 0;
    for (const d of daysPausedArr) {
      if (d >= 90) over90++;
      else if (d >= 60) over60++;
      else if (d >= 30) over30++;
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
      over30,
      over60,
      over90,
      lostTotal: lostProjects.length,
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
              <FormulaTooltip formula="AVG(today - pauseTimerStart) for all paused projects. Timer resets when customer confirms likely to proceed." />
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

        <Card data-testid="dash-kpi-duration-alert">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Duration Alert
              <FormulaTooltip formula="Projects paused 30+ days (yellow), 60+ days (red), 90+ days (critical)." />
            </CardTitle>
            <Timer className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs">
              {stats.over30 > 0 && <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 font-medium">30d: {stats.over30}</span>}
              {stats.over60 > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-medium">60d: {stats.over60}</span>}
              {stats.over90 > 0 && <span className="px-1.5 py-0.5 rounded bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200 font-bold">90d: {stats.over90}</span>}
              {stats.over30 === 0 && stats.over60 === 0 && stats.over90 === 0 && <span className="text-muted-foreground">all under 30d</span>}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="dash-kpi-projects-lost">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Projects Lost
              <FormulaTooltip formula="Projects with PM Status = 'Project Lost'." />
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.lostTotal > 0 ? "text-red-600" : ""}`}>{stats.lostTotal}</div>
            <p className="text-xs text-muted-foreground">total lost projects</p>
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
