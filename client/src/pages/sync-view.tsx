import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle2, Loader2, Clock, Zap, GitBranch, FileCheck, Workflow } from "lucide-react";
import WorkflowEditor from "@/components/settings/WorkflowEditor";
import HrspConfigEditor from "@/components/settings/HrspConfigEditor";
import UcWorkflowLogicEditor from "@/components/settings/UcWorkflowLogicEditor";
import { CollapsibleSection } from "@/components/settings/CollapsibleSection";

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
        Manage Asana sync, workflow configuration, and HRSP document settings.
      </p>

      <CollapsibleSection title="Sync from Asana" icon={<Zap className="h-4 w-4" />} testId="section-sync">
        <div className="space-y-4">
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
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Auto-Sync" icon={<Clock className="h-4 w-4" />} defaultOpen={false} testId="section-auto-sync">
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
      </CollapsibleSection>

      <CollapsibleSection title="Workflow Configuration" icon={<GitBranch className="h-4 w-4" />} defaultOpen={false} testId="section-workflow">
        <WorkflowEditor />
      </CollapsibleSection>

      <CollapsibleSection title="HRSP Document Configuration" icon={<FileCheck className="h-4 w-4" />} defaultOpen={false} testId="section-hrsp">
        <p className="text-sm text-muted-foreground mb-4">
          Configure required documents for HRSP pre-approval applications and close-off submissions. Update the invoice template used for PDF generation.
        </p>
        <HrspConfigEditor />
      </CollapsibleSection>

      <CollapsibleSection title="UC Workflow Logic" icon={<Workflow className="h-4 w-4" />} defaultOpen={false} testId="section-uc-workflow">
        <UcWorkflowLogicEditor />
      </CollapsibleSection>
    </div>
  );
}
