import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, RotateCcw, AlertTriangle } from "lucide-react";

export default function EscalationSettingsEditor() {
  const { toast } = useToast();
  const [hideHours, setHideHours] = useState(48);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: settings, isLoading } = useQuery<{ hideHours: number }>({
    queryKey: ["/api/escalation-settings"],
  });

  useEffect(() => {
    if (settings) {
      setHideHours(settings.hideHours);
      setDirty(false);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/escalation-settings", { hideHours });
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-settings"] });
      setDirty(false);
      toast({ title: "Escalation settings saved" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Failed to save", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setHideHours(settings.hideHours);
      setDirty(false);
    }
  };

  if (isLoading) {
    return <div className="h-24 animate-pulse bg-muted/30 rounded-lg" />;
  }

  return (
    <div className="space-y-4" data-testid="escalation-settings-editor">
      <p className="text-sm text-muted-foreground">
        Configure how long escalated projects are hidden from team views while waiting for manager review.
      </p>

      <Card className="border-amber-300 dark:border-amber-800" data-testid="card-escalation-hide">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Escalation Hide Duration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            When a staff member creates an escalation ticket, the project is hidden from the team view for this many hours to allow time for manager review.
          </p>
          <div className="space-y-1 max-w-xs">
            <Label htmlFor="escalation-hide-hours" className="text-xs">
              Hide Hours
            </Label>
            <Input
              id="escalation-hide-hours"
              type="number"
              min={1}
              max={720}
              value={hideHours}
              onChange={(e) => {
                setHideHours(parseInt(e.target.value) || 48);
                setDirty(true);
              }}
              data-testid="input-escalation-hide-hours"
            />
            <p className="text-[10px] text-muted-foreground">
              {hideHours} hours = {(hideHours / 24).toFixed(1)} days
            </p>
          </div>
        </CardContent>
      </Card>

      {dirty && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-escalation-settings">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Save Changes</>
            )}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={saving} data-testid="button-reset-escalation-settings">
            <RotateCcw className="h-4 w-4 mr-2" />Reset
          </Button>
        </div>
      )}
    </div>
  );
}
