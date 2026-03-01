import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { Activity, TrendingUp, Upload, Clock, FileCheck, Banknote } from "lucide-react";
import { CompletionsDrilldown } from "./CompletionsDrilldown";
import { FormulaTooltip } from "./FormulaTooltip";

interface ContractKpiStats {
  dailyCounts: Record<string, Record<string, number>>;
  recentCompletions: { date: string; time: string; staffName: string; actionType: string; projectName: string; toStatus: string | null; notes: string | null }[];
  completionsThisWeek: number;
  completionsThisMonth: number;
  avgTasksPerDay: number;
  avgDaysToUpload: number | null;
  avgDaysToReview: number | null;
  avgDaysToSign: number | null;
  avgDaysToDeposit: number | null;
  totalCompletions: number;
  totalContractProjects: number;
}

export function ContractKpiSection() {
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const { data: stats, isLoading } = useQuery<ContractKpiStats>({
    queryKey: ["/api/contracts/kpi-stats"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="contract-kpi-loading">
        <h2 className="text-lg font-semibold">Contract Team KPIs</h2>
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
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4" data-testid="section-contract-kpi">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold" data-testid="text-contract-kpi-title">
            Contract Team KPIs
          </h2>
          <span className="text-xs text-muted-foreground">
            ({stats.totalContractProjects} contract-stage projects)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card
            className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            onClick={() => setDrilldownOpen(true)}
            data-testid="card-contract-completions-week"
          >
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
              <div className="flex items-center gap-1">
                <FormulaTooltip formula={"Count of all contract workflow actions recorded in the last 7 days.\n\nFormula: COUNT(completions) WHERE completedAt >= (today - 7 days)"} />
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-contract-completions-week">
                {stats.completionsThisWeek}
              </div>
              <p className="text-xs text-muted-foreground">completions · click for details</p>
            </CardContent>
          </Card>

          <Card data-testid="card-contract-avg-tasks">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Tasks/Day</CardTitle>
              <div className="flex items-center gap-1">
                <FormulaTooltip formula={"Total completions divided by the number of days that had at least one completion.\n\nFormula: Total Completions / Days With Activity"} />
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-contract-avg-tasks-day">
                {stats.avgTasksPerDay}
              </div>
              <p className="text-xs text-muted-foreground">across active days</p>
            </CardContent>
          </Card>

          <Card data-testid="card-contract-avg-upload">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Days to Upload</CardTitle>
              <div className="flex items-center gap-1">
                <FormulaTooltip formula={"Average days from UC approval to first contract document upload.\n\nFormula: AVG(firstUploadDate - ucApprovedDate)\n\nOnly includes projects with both UC approval and at least one document upload recorded."} />
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-contract-avg-upload">
                {formatStat(stats.avgDaysToUpload)}
              </div>
              <p className="text-xs text-muted-foreground">from UC approval</p>
            </CardContent>
          </Card>

          <Card data-testid="card-contract-avg-review">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Days to Review</CardTitle>
              <div className="flex items-center gap-1">
                <FormulaTooltip formula={"Average days from marking \"Ready for Review\" to manager approval.\n\nFormula: AVG(approvedDate - readyForReviewDate)\n\nRequires both a \"ready_for_review\" and \"contract_approved\" completion for the same project."} />
                <FileCheck className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-contract-avg-review">
                {formatStat(stats.avgDaysToReview)}
              </div>
              <p className="text-xs text-muted-foreground">review turnaround</p>
            </CardContent>
          </Card>

          <Card data-testid="card-contract-avg-sign">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Days to Sign</CardTitle>
              <div className="flex items-center gap-1">
                <FormulaTooltip formula={"Average days from contract sent to customer to contract signed.\n\nFormula: AVG(signedDate - contractSentDate)\n\nRequires both events to be recorded as completions."} />
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-contract-avg-sign">
                {formatStat(stats.avgDaysToSign)}
              </div>
              <p className="text-xs text-muted-foreground">from sent to signed</p>
            </CardContent>
          </Card>

          <Card data-testid="card-contract-avg-deposit">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Days to Deposit</CardTitle>
              <div className="flex items-center gap-1">
                <FormulaTooltip formula={"Average days from contract signed to deposit collected.\n\nFormula: AVG(depositDate - signedDate)\n\nRequires both events to be recorded as completions."} />
                <Banknote className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-contract-avg-deposit">
                {formatStat(stats.avgDaysToDeposit)}
              </div>
              <p className="text-xs text-muted-foreground">from signed to deposit</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract Daily Completions (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="completions" fill="hsl(180, 60%, 45%)" name="Completions" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground" data-testid="text-no-contract-daily-data">
                <p>No contract completion data yet. KPIs will populate as workflow actions are tracked.</p>
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
    </TooltipProvider>
  );
}
