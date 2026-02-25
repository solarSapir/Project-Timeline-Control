import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity, TrendingUp, Clock, AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { CompletionsDrilldown } from "./CompletionsDrilldown";

interface RebateKpiStats {
  dailyCounts: Record<string, Record<string, number>>;
  recentCompletions: { date: string; time: string; staffName: string; actionType: string; projectName: string; toStatus: string | null; notes: string | null }[];
  completionsThisWeek: number;
  completionsThisMonth: number;
  avgTasksPerDay: number;
  avgDaysToSubmit: number | null;
  avgDaysToApproval: number | null;
  avgDaysCloseOffToSubmit: number | null;
  rejectionCount: number;
  rejectionRate: number | null;
  totalCompletions: number;
  totalRebateProjects: number;
}

export function RebateKpiSection() {
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const { data: stats, isLoading } = useQuery<RebateKpiStats>({
    queryKey: ["/api/rebate/kpi-stats"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="rebate-kpi-loading">
        <h2 className="text-lg font-semibold">Rebate Team KPIs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const dailyData = (() => {
    const counts = stats.dailyCounts;
    const dates = Object.keys(counts).sort();
    const last30 = dates.slice(-30);
    return last30.map((date) => {
      const dayEntries = counts[date];
      const total = Object.values(dayEntries).reduce((a, b) => a + b, 0);
      return {
        date: new Date(date + "T12:00:00").toLocaleDateString("en-US", {
          month: "short", day: "numeric",
        }),
        completions: total,
      };
    });
  })();

  const formatStat = (val: number | null) =>
    val !== null ? `${val} days` : "--";

  return (
    <div className="space-y-4" data-testid="section-rebate-kpi">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold" data-testid="text-rebate-kpi-title">
          Rebate Team KPIs
        </h2>
        <span className="text-xs text-muted-foreground">
          ({stats.totalRebateProjects} rebate-eligible projects)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card
          className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
          onClick={() => setDrilldownOpen(true)}
          data-testid="card-rebate-completions-week"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rebate-completions-week">
              {stats.completionsThisWeek}
            </div>
            <p className="text-xs text-muted-foreground">completions · click for details</p>
          </CardContent>
        </Card>

        <Card data-testid="card-rebate-avg-tasks">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Tasks/Day</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rebate-avg-tasks-day">
              {stats.avgTasksPerDay}
            </div>
            <p className="text-xs text-muted-foreground">across active days</p>
          </CardContent>
        </Card>

        <Card data-testid="card-rebate-avg-submit">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Days to Submit</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rebate-avg-submit">
              {formatStat(stats.avgDaysToSubmit)}
            </div>
            <p className="text-xs text-muted-foreground">from project creation</p>
          </CardContent>
        </Card>

        <Card data-testid="card-rebate-avg-approval">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Days to Hear Back</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rebate-avg-approval">
              {formatStat(stats.avgDaysToApproval)}
            </div>
            <p className="text-xs text-muted-foreground">from submission</p>
          </CardContent>
        </Card>

        <Card data-testid="card-rebate-rejection-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejection Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rebate-rejection-rate">
              {stats.rejectionRate !== null ? `${stats.rejectionRate}%` : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.rejectionCount} rejection{stats.rejectionCount !== 1 ? "s" : ""} total
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-rebate-closeoff-submit">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Close-off to Submit</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rebate-closeoff-submit">
              {formatStat(stats.avgDaysCloseOffToSubmit)}
            </div>
            <p className="text-xs text-muted-foreground">avg days to submit close-off</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rebate Daily Completions (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completions" fill="hsl(270, 60%, 55%)" name="Completions" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground" data-testid="text-no-rebate-daily-data">
              <p>No rebate completion data yet. KPIs will populate as status changes are tracked.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CompletionsDrilldown
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        completions={stats.recentCompletions || []}
        dailyCounts={stats.dailyCounts}
      />
    </div>
  );
}
