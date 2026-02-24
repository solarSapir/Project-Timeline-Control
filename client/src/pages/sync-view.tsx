import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback, useMemo } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw, CheckCircle2, Loader2, Clock, Zap, GitBranch,
  ArrowRight, ArrowDown, Save, RotateCcw, Info
} from "lucide-react";
import {
  PROJECT_STAGES, STAGE_LABELS, DEFAULT_DEADLINES_WEEKS
} from "@shared/schema";
import type { WorkflowConfig } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STAGE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  uc_application: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  rebates_payment: { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  contract_signing: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  site_visit: { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  ahj_permitting: { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  install_booking: { bg: "bg-cyan-50 dark:bg-cyan-950/40", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
  installation: { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
  close_off: { bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
};

type StageConfig = {
  stage: string;
  targetDays: number;
  dependsOn: string[];
};

function defaultConfigs(): StageConfig[] {
  return PROJECT_STAGES.map(stage => {
    const def = DEFAULT_DEADLINES_WEEKS[stage];
    return {
      stage,
      targetDays: def.max * 7,
      dependsOn: def.dependsOn || [],
    };
  });
}

function mergeWithDefaults(saved: WorkflowConfig[]): StageConfig[] {
  const savedMap = new Map(saved.map(s => [s.stage, s]));
  return PROJECT_STAGES.map(stage => {
    const s = savedMap.get(stage);
    if (s) return { stage: s.stage, targetDays: s.targetDays, dependsOn: s.dependsOn || DEFAULT_DEADLINES_WEEKS[stage].dependsOn || [] };
    const def = DEFAULT_DEADLINES_WEEKS[stage];
    return { stage, targetDays: def.max * 7, dependsOn: def.dependsOn || [] };
  });
}

function WorkflowEditor() {
  const { toast } = useToast();
  const { data: savedConfigs, isLoading } = useQuery<WorkflowConfig[]>({
    queryKey: ['/api/workflow-config'],
  });

  const [configs, setConfigs] = useState<StageConfig[]>(defaultConfigs());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (savedConfigs) {
      setConfigs(mergeWithDefaults(savedConfigs));
      setHasChanges(false);
    }
  }, [savedConfigs]);

  const saveMutation = useMutation({
    mutationFn: async (data: StageConfig[]) => {
      const res = await apiRequest("PUT", "/api/workflow-config", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow-config'] });
      setHasChanges(false);
      toast({ title: "Workflow configuration saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const updateDays = useCallback((stage: string, days: number) => {
    setConfigs(prev => prev.map(c => c.stage === stage ? { ...c, targetDays: days } : c));
    setHasChanges(true);
  }, []);

  const resetToDefaults = useCallback(() => {
    setConfigs(defaultConfigs());
    setHasChanges(true);
  }, []);

  const parallelGroups = useMemo(() => {
    const groups: StageConfig[][] = [];
    const placed = new Set<string>();

    while (placed.size < configs.length) {
      const group: StageConfig[] = [];
      for (const c of configs) {
        if (placed.has(c.stage)) continue;
        const depsmet = c.dependsOn.every(d => placed.has(d));
        if (depsmet) group.push(c);
      }
      if (group.length === 0) break;
      groups.push(group);
      group.forEach(g => placed.add(g.stage));
    }
    return groups;
  }, [configs]);

  const maxDays = useMemo(() => Math.max(...configs.map(c => c.targetDays), 1), [configs]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workflow configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold" data-testid="text-workflow-title">Stage Dependencies & Timeline</h3>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-sm">
              <p>This shows how project stages depend on each other. Target days = days from project creation date to stage deadline. Adjust these values to change how deadlines are calculated for new projects.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            data-testid="button-reset-workflow"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset to Defaults
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(configs)}
            disabled={!hasChanges || saveMutation.isPending}
            data-testid="button-save-workflow"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {parallelGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            {groupIdx > 0 && (
              <div className="flex justify-center py-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-6 w-px bg-border" />
                  <ArrowDown className="h-4 w-4" />
                  <div className="h-6 w-px bg-border" />
                </div>
              </div>
            )}

            <div className={`grid gap-3 ${group.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-xl mx-auto'}`}>
              {group.map(config => {
                const colors = STAGE_COLORS[config.stage];
                const weeks = Math.round(config.targetDays / 7 * 10) / 10;
                const barWidth = Math.max(8, (config.targetDays / maxDays) * 100);

                return (
                  <div
                    key={config.stage}
                    className={`rounded-lg border-2 p-4 ${colors.bg} ${colors.border} transition-all`}
                    data-testid={`card-workflow-${config.stage}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-3 w-3 rounded-full ${colors.dot} shrink-0`} />
                        <span className={`font-medium text-sm ${colors.text}`}>
                          {STAGE_LABELS[config.stage]}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 tabular-nums">
                        {weeks}w
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap w-16">Target:</span>
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={config.targetDays}
                        onChange={(e) => updateDays(config.stage, parseInt(e.target.value) || 0)}
                        className="h-8 w-20 text-sm text-center tabular-nums"
                        data-testid={`input-days-${config.stage}`}
                      />
                      <span className="text-xs text-muted-foreground">days from start</span>
                    </div>

                    <div className="h-2 bg-white/60 dark:bg-black/20 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full ${colors.dot} transition-all duration-300`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    {config.dependsOn.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Depends on:</span>
                        {config.dependsOn.map(dep => {
                          const depColors = STAGE_COLORS[dep];
                          return (
                            <span
                              key={dep}
                              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${depColors?.bg || 'bg-gray-100'} ${depColors?.text || 'text-gray-600'}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${depColors?.dot || 'bg-gray-400'}`} />
                              {STAGE_LABELS[dep] || dep}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {config.dependsOn.length === 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Starts immediately (no dependencies)</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {group.length > 1 && (
              <div className="flex justify-center mt-1">
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  These stages run in parallel
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h4 className="text-sm font-medium mb-3">Timeline Overview</h4>
        <div className="space-y-2">
          {configs.map(config => {
            const colors = STAGE_COLORS[config.stage];
            const barWidth = Math.max(4, (config.targetDays / maxDays) * 100);
            return (
              <div key={config.stage} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">
                  {STAGE_LABELS[config.stage]}
                </span>
                <div className="flex-1 h-5 bg-muted rounded overflow-hidden relative">
                  <div
                    className={`h-full rounded ${colors.dot} opacity-80 transition-all duration-300 flex items-center justify-end pr-1`}
                    style={{ width: `${barWidth}%` }}
                  >
                    <span className="text-[9px] font-medium text-white drop-shadow-sm tabular-nums">
                      {config.targetDays}d
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
          <span>Day 0 (Project Created)</span>
          <span>Day {maxDays}</span>
        </div>
      </div>
    </div>
  );
}

export default function SyncView() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const { data: syncStatus } = useQuery<{ lastSyncTime: string | null; cachedProjectGid: string | null }>({
    queryKey: ['/api/asana/sync-status'],
    refetchInterval: 30000,
  });

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiRequest("POST", "/api/asana/sync-all");
      const data = await res.json();
      setSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/asana/sync-status'] });
      toast({ title: `Synced ${data.synced} projects from Asana` });
    } catch (error: any) {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="text-sync-title">Settings</h1>
      <p className="text-muted-foreground">
        Manage Asana sync and configure the project workflow timeline.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Sync from Asana
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button
              onClick={handleSync}
              disabled={syncing}
              size="lg"
              data-testid="button-sync"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing from Asana...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>

            {syncStatus?.lastSyncTime && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last synced: {formatTime(syncStatus.lastSyncTime)}
              </div>
            )}
          </div>

          {syncResult && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm" data-testid="text-sync-result">Successfully synced {syncResult.synced} projects</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Auto-Sync
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-auto-sync">Active</Badge>
              <span className="text-sm text-muted-foreground">Every 15 minutes</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The app automatically syncs all projects from "Project Manage Team" every 15 minutes.
              An initial sync also runs when the server starts. Any status changes you make in this app
              are pushed to Asana immediately — the auto-sync pulls any updates made directly in Asana.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Workflow Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkflowEditor />
        </CardContent>
      </Card>
    </div>
  );
}
