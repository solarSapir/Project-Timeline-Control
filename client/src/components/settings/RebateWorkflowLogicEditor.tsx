import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, ArrowRight, RotateCcw } from "lucide-react";
import type { RebateWorkflowRule } from "@shared/schema";

export default function RebateWorkflowLogicEditor() {
  const { toast } = useToast();
  const [rules, setRules] = useState<RebateWorkflowRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: fetchedRules, isLoading } = useQuery<RebateWorkflowRule[]>({
    queryKey: ['/api/rebate/workflow-rules'],
  });

  useEffect(() => {
    if (fetchedRules) {
      setRules(fetchedRules);
      setDirty(false);
    }
  }, [fetchedRules]);

  const updateRule = (id: string, updates: Partial<RebateWorkflowRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/rebate/workflow-rules", rules);
      queryClient.invalidateQueries({ queryKey: ['/api/rebate/workflow-rules'] });
      setDirty(false);
      toast({ title: "Rebate workflow rules saved" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Failed to save rules", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (fetchedRules) {
      setRules(fetchedRules);
      setDirty(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="rebate-workflow-loading">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const flowOrder = [
    "status_to_in_progress",
    "status_to_submitted",
    "follow_up_submitted",
    "status_to_closeoff_submitted",
    "follow_up_closeoff",
    "closeoff_due_window",
  ];

  const sortedRules = [...rules].sort((a, b) => {
    const ai = flowOrder.indexOf(a.triggerAction);
    const bi = flowOrder.indexOf(b.triggerAction);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const getCardBorder = (rule: RebateWorkflowRule) => {
    if (!rule.enabled) return "opacity-60";
    if (rule.triggerAction.includes("closeoff")) return "border-teal-300 dark:border-teal-800";
    if (rule.triggerAction.includes("follow_up")) return "border-amber-300 dark:border-amber-800";
    return "";
  };

  return (
    <div className="space-y-4" data-testid="rebate-workflow-editor">
      <p className="text-sm text-muted-foreground">
        Configure how rebate workflow transitions behave — follow-up delays, required fields, and auto-escalation.
      </p>

      <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground mb-2">
        <Badge variant="outline" data-testid="badge-rebate-flow-new">New</Badge>
        <ArrowRight className="h-3 w-3" />
        <span className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400" data-testid="badge-rebate-flow-submitted">Submitted</Badge>
          <span>/</span>
          <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400" data-testid="badge-rebate-flow-inprogress">In-Progress</Badge>
        </span>
        <ArrowRight className="h-3 w-3" />
        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400" data-testid="badge-rebate-flow-followup">Follow-up</Badge>
        <ArrowRight className="h-3 w-3" />
        <Badge variant="outline" className="border-teal-500 text-teal-700 dark:text-teal-400" data-testid="badge-rebate-flow-closeoff">Close-off</Badge>
      </div>

      <div className="space-y-3">
        {sortedRules.map((rule) => (
          <Card
            key={rule.id}
            className={getCardBorder(rule)}
            data-testid={`card-rebate-rule-${rule.triggerAction}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span data-testid={`text-rebate-rule-label-${rule.triggerAction}`}>{rule.label}</span>
                  {!rule.enabled && (
                    <Badge variant="secondary" data-testid={`badge-rebate-disabled-${rule.triggerAction}`}>
                      Disabled
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`rebate-enabled-${rule.id}`} className="text-xs text-muted-foreground">
                    Enabled
                  </Label>
                  <Switch
                    id={`rebate-enabled-${rule.id}`}
                    checked={rule.enabled ?? true}
                    onCheckedChange={(checked) => updateRule(rule.id, { enabled: checked })}
                    data-testid={`switch-rebate-enabled-${rule.triggerAction}`}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rule.description && (
                <p className="text-xs text-muted-foreground" data-testid={`text-rebate-rule-desc-${rule.triggerAction}`}>
                  {rule.description}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`rebate-hideDays-${rule.id}`} className="text-xs">
                    {rule.triggerAction === "closeoff_due_window" ? "Due Window (Days)" : "Hide / Follow-up Days"}
                  </Label>
                  <Input
                    id={`rebate-hideDays-${rule.id}`}
                    type="number"
                    min={0}
                    value={rule.hideDays}
                    onChange={(e) => updateRule(rule.id, { hideDays: parseInt(e.target.value) || 0 })}
                    data-testid={`input-rebate-hidedays-${rule.triggerAction}`}
                  />
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <Switch
                    id={`rebate-requiresFiles-${rule.id}`}
                    checked={rule.requiresFiles ?? false}
                    onCheckedChange={(checked) => updateRule(rule.id, { requiresFiles: checked })}
                    data-testid={`switch-rebate-files-${rule.triggerAction}`}
                  />
                  <Label htmlFor={`rebate-requiresFiles-${rule.id}`} className="text-xs">
                    Requires Files
                  </Label>
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <Switch
                    id={`rebate-requiresNotes-${rule.id}`}
                    checked={rule.requiresNotes ?? false}
                    onCheckedChange={(checked) => updateRule(rule.id, { requiresNotes: checked })}
                    data-testid={`switch-rebate-notes-${rule.triggerAction}`}
                  />
                  <Label htmlFor={`rebate-requiresNotes-${rule.id}`} className="text-xs">
                    Requires Notes
                  </Label>
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <Switch
                    id={`rebate-autoEscalate-${rule.id}`}
                    checked={rule.autoEscalate ?? false}
                    onCheckedChange={(checked) => updateRule(rule.id, { autoEscalate: checked })}
                    data-testid={`switch-rebate-escalate-${rule.triggerAction}`}
                  />
                  <Label htmlFor={`rebate-autoEscalate-${rule.id}`} className="text-xs">
                    Auto-Escalate
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {dirty && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-rebate-rules">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Save Changes</>
            )}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={saving} data-testid="button-reset-rebate-rules">
            <RotateCcw className="h-4 w-4 mr-2" />Reset
          </Button>
        </div>
      )}
    </div>
  );
}
