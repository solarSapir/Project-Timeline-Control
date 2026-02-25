import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle2, Loader2, Clock, Zap, GitBranch, FileCheck } from "lucide-react";
import WorkflowEditor from "@/components/settings/WorkflowEditor";
import HrspConfigEditor from "@/components/settings/HrspConfigEditor";

interface SyncStatus {
  lastSyncTime: string | null;
  cachedProjectGid: string | null;
}

interface SyncResult {
  synced: number;
}

function formatSyncTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/** Settings page with Asana sync controls and workflow configuration. */
export default function SyncView() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['/api/asana/sync-status'],
    refetchInterval: 30000,
  });

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiRequest("POST", "/api/asana/sync-all");
      const data: SyncResult = await res.json();
      setSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/asana/sync-status'] });
      toast({ title: `Synced ${data.synced} projects from Asana` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "Sync failed", description: message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
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
            <Button onClick={handleSync} disabled={syncing} size="lg" data-testid="button-sync">
              {syncing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing from Asana...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" />Sync Now</>
              )}
            </Button>
            {syncStatus?.lastSyncTime && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last synced: {formatSyncTime(syncStatus.lastSyncTime)}
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

      <div className="space-y-1">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <FileCheck className="h-4 w-4" />
          HRSP Document Configuration
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure required documents for HRSP rebate applications and update the invoice template.
        </p>
      </div>
      <HrspConfigEditor />
    </div>
  );
}
