import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, BarChart3 } from "lucide-react";
import type { PauseReason } from "@shared/schema";

interface InsightData {
  totalPaused: number;
  withReason: number;
  withNote: number;
  reasonBreakdown: { reason: string; count: number; pct: number }[];
  aiInsight: string;
}

export function PauseInsights() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightData | null>(null);

  const { data: reasons } = useQuery<PauseReason[]>({ queryKey: ['/api/pause-reasons'] });

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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        View patterns in why projects get paused. AI analyzes the pause reasons and notes across all paused projects to surface common trends and actionable recommendations.
      </p>

      {reasons && reasons.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Common Pause Reasons ({reasons.length})</h4>
          <div className="flex flex-wrap gap-1.5">
            {reasons.map(r => (
              <span key={r.id} className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-200 dark:border-amber-800" data-testid={`badge-reason-${r.id}`}>
                {r.reason} ({r.usageCount || 0})
              </span>
            ))}
          </div>
        </div>
      )}

      <Button onClick={generateInsights} disabled={loading} variant="outline" data-testid="button-generate-insights">
        {loading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
        ) : (
          <><BarChart3 className="h-4 w-4 mr-2" />Generate AI Insights</>
        )}
      </Button>

      {insights && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold" data-testid="text-total-paused">{insights.totalPaused}</div>
              <div className="text-xs text-muted-foreground">Total Paused</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold" data-testid="text-with-reason">{insights.withReason}</div>
              <div className="text-xs text-muted-foreground">With Reason</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold" data-testid="text-with-note">{insights.withNote}</div>
              <div className="text-xs text-muted-foreground">With Notes</div>
            </div>
          </div>

          {insights.reasonBreakdown.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Reason Breakdown</h4>
              <div className="space-y-1.5">
                {insights.reasonBreakdown.map(r => (
                  <div key={r.reason} className="flex items-center gap-2" data-testid={`breakdown-${r.reason}`}>
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
    </div>
  );
}
