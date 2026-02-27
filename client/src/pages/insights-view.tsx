import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, BarChart3, PauseCircle, TrendingUp, Users, Repeat } from "lucide-react";
import { Link } from "wouter";
import type { PauseReason, PauseLog, Project } from "@shared/schema";

interface InsightData {
  totalPaused: number;
  totalLogs: number;
  uniqueProjectsPaused: number;
  repeatPausers: number;
  reasonBreakdown: { reason: string; count: number; pct: number }[];
  aiInsight: string;
}

export default function InsightsView() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightData | null>(null);

  const { data: reasons } = useQuery<PauseReason[]>({ queryKey: ['/api/pause-reasons'] });
  const { data: allLogs } = useQuery<PauseLog[]>({
    queryKey: ['/api/pause-reasons/logs'],
    queryFn: async () => {
      const res = await fetch('/api/pause-reasons/logs');
      return res.json();
    },
  });
  const { data: projects } = useQuery<Project[]>({ queryKey: ['/api/projects'] });

  const generateInsights = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/pause-reasons/insights");
      const data: InsightData = await res.json();
      setInsights(data);
    } catch {
      setInsights(null);
    } finally {
      setLoading(false);
    }
  };

  const pausedCount = (projects || []).filter(p => p.pmStatus?.toLowerCase() === 'project paused').length;
  const recentLogs = (allLogs || []).slice(0, 20);

  const formatLogDate = (d: string | Date | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const getProjectName = (projectId: string) => {
    const p = (projects || []).find(pr => pr.id === projectId);
    return p?.name || projectId;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-insights-title">
          <TrendingUp className="h-6 w-6 text-blue-500" />
          Insights
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered analysis of project pause patterns and trends.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <PauseCircle className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <div className="text-2xl font-bold" data-testid="text-currently-paused">{pausedCount}</div>
            <div className="text-xs text-muted-foreground">Currently Paused</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <div className="text-2xl font-bold" data-testid="text-total-logs">{(allLogs || []).length}</div>
            <div className="text-xs text-muted-foreground">Total Pause Events</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-purple-500" />
            <div className="text-2xl font-bold" data-testid="text-unique-projects">
              {new Set((allLogs || []).map(l => l.projectId)).size}
            </div>
            <div className="text-xs text-muted-foreground">Unique Projects</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Repeat className="h-5 w-5 mx-auto mb-1 text-red-500" />
            <div className="text-2xl font-bold" data-testid="text-repeat-pausers">
              {(() => {
                const counts: Record<string, number> = {};
                (allLogs || []).forEach(l => { counts[l.projectId] = (counts[l.projectId] || 0) + 1; });
                return Object.values(counts).filter(c => c > 1).length;
              })()}
            </div>
            <div className="text-xs text-muted-foreground">Repeat Pausers</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Pause Reason Analysis</span>
            <Button onClick={generateInsights} disabled={loading} variant="outline" size="sm" data-testid="button-generate-insights">
              {loading ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analyzing...</>
              ) : (
                <><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Generate AI Insights</>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {reasons && reasons.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Common Reasons ({reasons.length})</h4>
              <div className="flex flex-wrap gap-1.5">
                {reasons.map(r => (
                  <span key={r.id} className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-200 dark:border-amber-800" data-testid={`badge-reason-${r.id}`}>
                    {r.reason} ({r.usageCount || 0})
                  </span>
                ))}
              </div>
            </div>
          )}

          {insights && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-xl font-bold">{insights.totalPaused}</div>
                  <div className="text-xs text-muted-foreground">Currently Paused</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-xl font-bold">{insights.totalLogs}</div>
                  <div className="text-xs text-muted-foreground">Total Pause Events</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-xl font-bold">{insights.repeatPausers}</div>
                  <div className="text-xs text-muted-foreground">Repeat Pausers</div>
                </div>
              </div>

              {insights.reasonBreakdown.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Reason Breakdown</h4>
                  <div className="space-y-1.5">
                    {insights.reasonBreakdown.map(r => (
                      <div key={r.reason} className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{r.reason}</span>
                            <span className="text-muted-foreground text-xs">{r.count} ({r.pct}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted mt-1">
                            <div className="h-full rounded-full bg-amber-500" style={{ width: `${r.pct}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">AI Analysis</h4>
                <div className="text-sm text-blue-700 dark:text-blue-300 whitespace-pre-wrap" data-testid="text-ai-insight">
                  {insights.aiInsight}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {recentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Pause Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 text-sm p-2.5 rounded bg-muted/30 border" data-testid={`insight-log-${log.id}`}>
                  <PauseCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/project/${log.projectId}`} className="text-primary hover:underline truncate font-medium text-sm">
                        {getProjectName(log.projectId)}
                      </Link>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatLogDate(log.pausedAt)}</span>
                    </div>
                    {log.reason && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 inline-block">
                        {log.reason}
                      </span>
                    )}
                    {log.note && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{log.note}</p>}
                    {log.staffName && <p className="text-xs text-muted-foreground italic">-- {log.staffName}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
