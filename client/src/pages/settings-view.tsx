import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle2, Loader2, Clock, Zap, GitBranch, FileCheck, Workflow, Users, Receipt, Wifi, Database, AlertTriangle, FileText } from "lucide-react";
import WorkflowEditor from "@/components/settings/WorkflowEditor";
import HrspConfigEditor from "@/components/settings/HrspConfigEditor";
import UcWorkflowLogicEditor from "@/components/settings/UcWorkflowLogicEditor";
import RebateWorkflowLogicEditor from "@/components/settings/RebateWorkflowLogicEditor";
import EscalationSettingsEditor from "@/components/settings/EscalationSettingsEditor";
import { StaffManager } from "@/components/settings/StaffManager";
import { WebhookManager } from "@/components/settings/WebhookManager";
import { CollapsibleSection } from "@/components/settings/CollapsibleSection";
import { DocumentTemplateManager } from "@/components/settings/DocumentTemplateManager";

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

interface BackfillResult {
  created: number;
  skipped: number;
  errors: number;
  totalProjects: number;
}

export default function SyncView() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [backfilling, setBackfilling] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);

  const handleBackfill = async (type: "uc" | "rebate") => {
    setBackfilling(type);
    setBackfillResult(null);
    try {
      const res = await apiRequest("POST", `/api/${type}/backfill`);
      const data: BackfillResult = await res.json();
      setBackfillResult(data);
      queryClient.invalidateQueries({ queryKey: [`/api/${type}/kpi-stats`] });
      queryClient.invalidateQueries({ queryKey: [`/api/${type}/completions`] });
      toast({ title: `${type.toUpperCase()} backfill: ${data.created} records created from Asana history` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Backfill failed", description: message, variant: "destructive" });
    } finally {
      setBackfilling(null);
    }
  };

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

      <CollapsibleSection title="Staff Members" icon={<Users className="h-4 w-4" />} testId="section-staff">
        <StaffManager />
      </CollapsibleSection>

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

      <CollapsibleSection title="KPI Data Backfill" icon={<Database className="h-4 w-4" />} defaultOpen={false} testId="section-backfill">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Populate UC and Rebate KPI data from Asana project history. This reads status change events from Asana task timelines and creates completion records. Projects that already have records are skipped. Safe to run multiple times.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={() => handleBackfill("uc")} disabled={backfilling !== null} variant="outline" data-testid="button-backfill-uc">
              {backfilling === "uc" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Backfilling UC...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" />Backfill UC KPIs</>
              )}
            </Button>
            <Button onClick={() => handleBackfill("rebate")} disabled={backfilling !== null} variant="outline" data-testid="button-backfill-rebate">
              {backfilling === "rebate" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Backfilling Rebates...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" />Backfill Rebate KPIs</>
              )}
            </Button>
          </div>
          {backfillResult && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm" data-testid="text-backfill-result">
                Created {backfillResult.created} records from {backfillResult.totalProjects} projects
                {backfillResult.skipped > 0 && ` (${backfillResult.skipped} already had data)`}
                {backfillResult.errors > 0 && ` — ${backfillResult.errors} errors`}
              </span>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Real-Time Webhook" icon={<Wifi className="h-4 w-4" />} testId="section-webhook">
        <WebhookManager />
      </CollapsibleSection>

      <CollapsibleSection title="Auto-Sync (Backup)" icon={<Clock className="h-4 w-4" />} defaultOpen={false} testId="section-auto-sync">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-auto-sync">Active</Badge>
            <span className="text-sm text-muted-foreground">Every 15 minutes</span>
          </div>
          <p className="text-sm text-muted-foreground">
            As a backup to real-time webhooks, the app also does a full sync of all projects every 15 minutes.
            This catches anything that webhooks may have missed. Any status changes you make in this app
            are pushed to Asana immediately.
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

      <CollapsibleSection title="Rebate Workflow Logic" icon={<Receipt className="h-4 w-4" />} defaultOpen={false} testId="section-rebate-workflow">
        <RebateWorkflowLogicEditor />
      </CollapsibleSection>

      <CollapsibleSection title="Escalation Settings" icon={<AlertTriangle className="h-4 w-4" />} defaultOpen={false} testId="section-escalation-settings">
        <EscalationSettingsEditor />
      </CollapsibleSection>

      <CollapsibleSection title="Document Templates" icon={<FileText className="h-4 w-4" />} defaultOpen={false} testId="section-document-templates">
        <p className="text-sm text-muted-foreground mb-4">
          Upload PDF or image files as templates, place fillable fields on them, and generate completed documents for any project.
        </p>
        <DocumentTemplateManager />
      </CollapsibleSection>
    </div>
  );
}
