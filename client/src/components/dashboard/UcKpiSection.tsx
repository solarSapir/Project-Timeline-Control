import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity, TrendingUp, Clock, CheckCircle2, Timer } from "lucide-react";
import { FormulaTooltip } from "./FormulaTooltip";
import { CompletionsDrilldown } from "./CompletionsDrilldown";
import { SubmitTimeDrilldown } from "./SubmitTimeDrilldown";
import { DecisionTimeDrilldown } from "./DecisionTimeDrilldown";

interface CompletionEntry {
  date: string;
  time: string;
  staffName: string;
  actionType: string;
  projectName: string;
  toStatus: string | null;
  notes: string | null;
}

interface SubmitTimeEntry {
  projectName: string;
  projectId: string;
  createdDate: string;
  submittedDate: string;
  days: number;
  month: string;
}

interface DecisionTimeEntry {
  projectName: string;
  projectId: string;
  submittedDate: string;
  decisionDate: string;
  decision: string;
  days: number;
  month: string;
}

interface UcKpiStats {
  dailyCounts: Record<string, Record<string, number>>;
  recentCompletions: CompletionEntry[];
  completionsThisWeek: number;
  completionsThisMonth: number;
  avgTasksPerDay: number;
  avgDaysToSubmit: number | null;
  submitTimeDetails: SubmitTimeEntry[];
  avgDaysToDecision: number | null;
  decisionTimeDetails: DecisionTimeEntry[];
  avgDaysToApprove: number | null;
  avgDaysToReject: number | null;
  avgDaysToClose: number | null;
  closeOffPending: number;
  rejectionsByUtility: Record<string, number>;
  totalCompletions: number;
  totalUcProjects: number;
}

export function UcKpiSection() {
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [submitDrilldownOpen, setSubmitDrilldownOpen] = useState(false);
  const [decisionDrilldownOpen, setDecisionDrilldownOpen] = useState(false);
  const { data: stats, isLoading } = useQuery<UcKpiStats>({
    queryKey: ["/api/uc/kpi-stats"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="uc-kpi-loading">
        <h2 className="text-lg font-semibold">UC Team KPIs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

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

  const rejectionData = Object.entries(stats.rejectionsByUtility)
    .map(([utility, count]) => ({ utility, count }))
    .sort((a, b) => b.count - a.count);

  const formatStat = (val: number | null) =>
    val !== null ? `${val} days` : "--";

  return (
    <div className="space-y-4" data-testid="section-uc-kpi">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold" data-testid="text-uc-kpi-title">
          UC Team KPIs
        </h2>
        <span className="text-xs text-muted-foreground">
          ({stats.totalUcProjects} projects requiring UC)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
          onClick={() => setDrilldownOpen(true)}
          data-testid="card-completions-week"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Week
            </CardTitle>
            <div className="flex items-center gap-1">
              <FormulaTooltip formula={"Count of all UC status changes recorded in the last 7 days.\n\nFormula: COUNT(completions) WHERE completedAt >= (today - 7 days)"} />
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-uc-completions-week">
              {stats.completionsThisWeek}
            </div>
            <p className="text-xs text-muted-foreground">completions · click for details</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Tasks/Day
            </CardTitle>
            <div className="flex items-center gap-1">
              <FormulaTooltip formula={"Total completions divided by the number of days that had at least one completion.\n\nFormula: Total Completions / Days With Activity"} />
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-uc-avg-tasks-day">
              {stats.avgTasksPerDay}
            </div>
            <p className="text-xs text-muted-foreground">across active days</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
          onClick={() => setSubmitDrilldownOpen(true)}
          data-testid="card-avg-submit"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Days to Submit
            </CardTitle>
            <div className="flex items-center gap-1">
              <FormulaTooltip formula={"Average days from project creation (or last unpause) to UC submitted date.\n\nFormula: AVG(ucSubmittedDate - projectCreatedDate) for residential Install projects"} />
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-uc-avg-submit">
              {formatStat(stats.avgDaysToSubmit)}
            </div>
            <p className="text-xs text-muted-foreground">from project creation · click for details</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
          onClick={() => setDecisionDrilldownOpen(true)}
          data-testid="card-avg-decision"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Days to Decision
            </CardTitle>
            <div className="flex items-center gap-1">
              <FormulaTooltip formula={"Average days from UC submitted to approval or rejection.\n\nFormula: AVG(decisionDate - submittedDate)"} />
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-uc-avg-decision">
              {formatStat(stats.avgDaysToDecision)}
            </div>
            <p className="text-xs text-muted-foreground">from submission · click for details</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Close-Off Time
            </CardTitle>
            <div className="flex items-center gap-1">
              <FormulaTooltip formula={"Average days from entering Close-Off status to Closed.\n\nFormula: AVG(closedDate - closeOffDate)"} />
              <Timer className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-uc-avg-close">
              {formatStat(stats.avgDaysToClose)}
            </div>
            <p className="text-xs text-muted-foreground">
              close-off → closed{stats.closeOffPending > 0 ? ` · ${stats.closeOffPending} pending` : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Completions (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="completions" fill="hsl(33, 93%, 54%)" name="Completions" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground" data-testid="text-no-daily-data">
                <p>No completion data yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rejections by Utility</CardTitle>
          </CardHeader>
          <CardContent>
            {rejectionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rejectionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="utility" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(0, 84%, 60%)" name="Rejections" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground" data-testid="text-no-rejection-data">
                <p>No rejection data recorded.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CompletionsDrilldown
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        completions={stats.recentCompletions || []}
        dailyCounts={stats.dailyCounts}
      />

      <SubmitTimeDrilldown
        open={submitDrilldownOpen}
        onOpenChange={setSubmitDrilldownOpen}
        details={stats.submitTimeDetails || []}
        overallAvg={stats.avgDaysToSubmit}
      />

      <DecisionTimeDrilldown
        open={decisionDrilldownOpen}
        onOpenChange={setDecisionDrilldownOpen}
        details={stats.decisionTimeDetails || []}
        overallAvg={stats.avgDaysToDecision}
      />
    </div>
  );
}
