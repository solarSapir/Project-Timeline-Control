import { useState, useEffect, useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, ArrowDown, Save, RotateCcw, Info } from "lucide-react";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import { PROJECT_STAGES, STAGE_LABELS } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWorkflowConfig } from "@/hooks/use-workflow-config";
import { STAGE_COMPLETION_CRITERIA } from "@/lib/stage-dependencies";
import { STAGE_COLORS, defaultConfigs, mergeWithDefaults } from "@/utils/workflow-config";
import type { StageConfig } from "@/utils/workflow-config";
import StageCard from "./StageCard";
import TimelineOverview from "./TimelineOverview";

/** Visual workflow editor for configuring stage dependencies and timelines. */
export default function WorkflowEditor() {
  const { toast } = useToast();
  const { data: savedConfigs, isLoading } = useWorkflowConfig();

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
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const updateDays = useCallback((stage: string, days: number) => {
    setConfigs(prev => prev.map(c => c.stage === stage ? { ...c, targetDays: days } : c));
    setHasChanges(true);
  }, []);

  const updateGapRelativeTo = useCallback((stage: string, relativeTo: string) => {
    setConfigs(prev => prev.map(c => {
      if (c.stage !== stage) return c;
      const newDeps = c.dependsOn.includes(relativeTo) ? c.dependsOn : [...c.dependsOn, relativeTo];
      return { ...c, gapRelativeTo: relativeTo, dependsOn: newDeps };
    }));
    setHasChanges(true);
  }, []);

  const toggleDependency = useCallback((stage: string, dep: string) => {
    setConfigs(prev => prev.map(c => {
      if (c.stage !== stage) return c;
      const hasDep = c.dependsOn.includes(dep);
      let newDeps: string[];
      let newGapRelativeTo = c.gapRelativeTo;
      if (hasDep) {
        newDeps = c.dependsOn.filter(d => d !== dep);
        if (c.gapRelativeTo === dep) {
          newGapRelativeTo = newDeps.length > 0 ? newDeps[newDeps.length - 1] : null;
        }
      } else {
        newDeps = [...c.dependsOn, dep];
      }
      return { ...c, dependsOn: newDeps, gapRelativeTo: newGapRelativeTo };
    }));
    setHasChanges(true);
  }, []);

  const updateCompletionCriteria = useCallback((stage: string, criteria: string[]) => {
    setConfigs(prev => prev.map(c => c.stage === stage ? { ...c, completionCriteria: criteria } : c));
    setHasChanges(true);
  }, []);

  const parallelGroups = useMemo(() => {
    const groups: StageConfig[][] = [];
    const placed = new Set<string>();
    while (placed.size < configs.length) {
      const group: StageConfig[] = [];
      for (const c of configs) {
        if (placed.has(c.stage)) continue;
        if (c.dependsOn.every(d => placed.has(d))) group.push(c);
      }
      if (group.length === 0) break;
      groups.push(group);
      group.forEach(g => placed.add(g.stage));
    }
    return groups;
  }, [configs]);

  const cumulativeDays = useMemo(() => {
    const cumMap: Record<string, number> = {};
    const configMap = new Map(configs.map(c => [c.stage, c]));
    const resolve = (stage: string): number => {
      if (cumMap[stage] !== undefined) return cumMap[stage];
      const c = configMap.get(stage);
      if (!c || c.dependsOn.length === 0) {
        cumMap[stage] = c?.targetDays ?? 0;
        return cumMap[stage];
      }
      const relTo = c.gapRelativeTo && c.dependsOn.includes(c.gapRelativeTo) ? c.gapRelativeTo : null;
      const baseDays = relTo ? resolve(relTo) : Math.max(...c.dependsOn.map(d => resolve(d)));
      cumMap[stage] = baseDays + c.targetDays;
      return cumMap[stage];
    };
    configs.forEach(c => resolve(c.stage));
    return cumMap;
  }, [configs]);

  const maxDays = useMemo(() => Math.max(...Object.values(cumulativeDays), 1), [cumulativeDays]);

  if (isLoading) {
    return <LogoSpinner size="sm" className="py-8" />;
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
              <p>Each stage's due date is calculated relative to the previous stage. For example, if UC takes 21 days and Contract is 7 days after UC, the contract deadline is 28 days from project start. When AHJ is "Not Required", its due date equals the site visit's.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setConfigs(defaultConfigs()); setHasChanges(true); }} data-testid="button-reset-workflow">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset to Defaults
          </Button>
          <Button size="sm" onClick={() => saveMutation.mutate(configs)} disabled={!hasChanges || saveMutation.isPending} data-testid="button-save-workflow">
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
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
              {group.map(config => (
                <StageCard
                  key={config.stage}
                  config={config}
                  cumulativeDays={cumulativeDays[config.stage] || 0}
                  maxDays={maxDays}
                  onUpdateDays={updateDays}
                  onUpdateGapRelativeTo={updateGapRelativeTo}
                  onToggleDependency={toggleDependency}
                />
              ))}
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

      <TimelineOverview configs={configs} cumulativeDays={cumulativeDays} maxDays={maxDays} />
    </div>
  );
}
