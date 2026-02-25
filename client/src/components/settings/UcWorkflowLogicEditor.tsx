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
import type { UcWorkflowRule } from "@shared/schema";

export default function UcWorkflowLogicEditor() {
  const { toast } = useToast();
  const [rules, setRules] = useState<UcWorkflowRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: fetchedRules, isLoading } = useQuery<UcWorkflowRule[]>({
    queryKey: ['/api/uc/workflow-rules'],
  });

  useEffect(() => {
    if (fetchedRules) {
      setRules(fetchedRules);
      setDirty(false);
    }
  }, [fetchedRules]);

  const updateRule = (id: string, updates: Partial<UcWorkflowRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/uc/workflow-rules", rules);
      queryClient.invalidateQueries({ queryKey: ['/api/uc/workflow-rules'] });
      setDirty(false);
      toast({ title: "UC workflow rules saved" });
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
      <div className="space-y-4" data-testid="uc-workflow-loading">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const flowOrder = [
    "status_to_submitted",
    "follow_up_submitted",
    "status_to_approved",
    "status_to_rejected",
    "follow_up_approved",
  ];

  const sortedRules = [...rules].sort((a, b) => {
    const ai = flowOrder.indexOf(a.triggerAction);
    const bi = flowOrder.indexOf(b.triggerAction);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <div className="space-y-4" data-testid="uc-workflow-editor">
      <p className="text-sm text-muted-foreground">
        Configure how UC workflow transitions behave — hide durations, required fields, and auto-escalation.
      </p>

      <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground mb-2">
        <Badge variant="outline" data-testid="badge-flow-new">New</Badge>
        <ArrowRight className="h-3 w-3" />
        <Badge variant="outline" data-testid="badge-flow-submitted">Submitted</Badge>
        <ArrowRight className="h-3 w-3" />
        <span className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400" data-testid="badge-flow-approved">Approved</Badge>
          <span>/</span>
          <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-400" data-testid="badge-flow-rejected">Rejected</Badge>
        </span>
        <ArrowRight className="h-3 w-3" />
        <Badge variant="outline" data-testid="badge-flow-followup">Follow-up</Badge>
      </div>

      <div className="space-y-3">
        {sortedRules.map((rule) => {
          const isApproval = rule.triggerAction.includes("approved");
          const isRejection = rule.triggerAction.includes("rejected");
          const borderClass = !rule.enabled
            ? "opacity-60"
            : isRejection
            ? "border-red-300 dark:border-red-800"
            : isApproval
            ? "border-green-300 dark:border-green-800"
            : "";

          return (
            <Card
              key={rule.id}
              className={borderClass}
              data-testid={`card-rule-${rule.triggerAction}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span data-testid={`text-rule-label-${rule.triggerAction}`}>{rule.label}</span>
                    {!rule.enabled && (
                      <Badge variant="secondary" data-testid={`badge-disabled-${rule.triggerAction}`}>
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`enabled-${rule.id}`} className="text-xs text-muted-foreground">
                      Enabled
                    </Label>
                    <Switch
                      id={`enabled-${rule.id}`}
                      checked={rule.enabled ?? true}
                      onCheckedChange={(checked) => updateRule(rule.id, { enabled: checked })}
                      data-testid={`switch-enabled-${rule.triggerAction}`}
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {rule.description && (
                  <p className="text-xs text-muted-foreground" data-testid={`text-rule-desc-${rule.triggerAction}`}>
                    {rule.description}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`hideDays-${rule.id}`} className="text-xs">
                      Hide Days
                    </Label>
                    <Input
                      id={`hideDays-${rule.id}`}
                      type="number"
                      min={0}
                      value={rule.hideDays}
                      onChange={(e) => updateRule(rule.id, { hideDays: parseInt(e.target.value) || 0 })}
                      data-testid={`input-hidedays-${rule.triggerAction}`}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <Switch
                      id={`requiresFiles-${rule.id}`}
                      checked={rule.requiresFiles ?? false}
                      onCheckedChange={(checked) => updateRule(rule.id, { requiresFiles: checked })}
                      data-testid={`switch-files-${rule.triggerAction}`}
                    />
                    <Label htmlFor={`requiresFiles-${rule.id}`} className="text-xs">
                      Requires Files
                    </Label>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <Switch
                      id={`requiresNotes-${rule.id}`}
                      checked={rule.requiresNotes ?? false}
                      onCheckedChange={(checked) => updateRule(rule.id, { requiresNotes: checked })}
                      data-testid={`switch-notes-${rule.triggerAction}`}
                    />
                    <Label htmlFor={`requiresNotes-${rule.id}`} className="text-xs">
                      Requires Notes
                    </Label>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <Switch
                      id={`autoEscalate-${rule.id}`}
                      checked={rule.autoEscalate ?? false}
                      onCheckedChange={(checked) => updateRule(rule.id, { autoEscalate: checked })}
                      data-testid={`switch-escalate-${rule.triggerAction}`}
                    />
                    <Label htmlFor={`autoEscalate-${rule.id}`} className="text-xs">
                      Auto-Escalate
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {dirty && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-uc-rules">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Save Changes</>
            )}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={saving} data-testid="button-reset-uc-rules">
            <RotateCcw className="h-4 w-4 mr-2" />Reset
          </Button>
        </div>
      )}
    </div>
  );
}
