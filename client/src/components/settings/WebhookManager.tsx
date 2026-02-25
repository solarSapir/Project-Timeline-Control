import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wifi, WifiOff, RefreshCw, Trash2 } from "lucide-react";

interface WebhookStatus {
  active: boolean;
  webhookGid: string | null;
  lastEventAt: string | null;
  eventsProcessed: number;
  asanaWebhooks: Array<{
    gid: string;
    target: string;
    active: boolean;
    resourceGid: string;
    resourceName: string;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
  }>;
}

export function WebhookManager() {
  const { toast } = useToast();
  const [setting, setSetting] = useState(false);
  const [tearing, setTearing] = useState(false);

  const { data: status, isLoading } = useQuery<WebhookStatus>({
    queryKey: ['/api/webhooks/status'],
    refetchInterval: 15000,
  });

  const handleSetup = async () => {
    setSetting(true);
    try {
      const syncRes = await fetch('/api/asana/sync-status');
      const syncData = await syncRes.json();
      const projectGid = syncData.cachedProjectGid;
      if (!projectGid) {
        toast({ title: "No project found", description: "Run a sync first so the app knows which Asana project to watch.", variant: "destructive" });
        return;
      }
      await apiRequest("POST", "/api/webhooks/setup", { projectGid });
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks/status'] });
      toast({ title: "Webhook connected", description: "Asana will now push updates in real-time." });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast({ title: "Webhook setup failed", description: msg, variant: "destructive" });
    } finally {
      setSetting(false);
    }
  };

  const handleTeardown = async () => {
    setTearing(true);
    try {
      await apiRequest("DELETE", "/api/webhooks/teardown");
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks/status'] });
      toast({ title: "Webhook disconnected" });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast({ title: "Teardown failed", description: msg, variant: "destructive" });
    } finally {
      setTearing(false);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading webhook status...</div>;

  const hasActiveWebhooks = status?.asanaWebhooks?.some(w => w.active) || false;
  const isConnected = status?.active || hasActiveWebhooks;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Webhooks give you real-time updates from Asana. Instead of waiting for the 15-minute auto-sync,
        changes in Asana are pushed to this app instantly — only the changed project gets updated.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        {isConnected ? (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1" data-testid="badge-webhook-active">
            <Wifi className="h-3 w-3" /> Connected
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground" data-testid="badge-webhook-inactive">
            <WifiOff className="h-3 w-3" /> Not connected
          </Badge>
        )}
        {status?.eventsProcessed ? (
          <span className="text-xs text-muted-foreground" data-testid="text-events-count">
            {status.eventsProcessed} events processed
          </span>
        ) : null}
        {status?.lastEventAt && (
          <span className="text-xs text-muted-foreground" data-testid="text-last-event">
            Last event: {formatTime(status.lastEventAt)}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {!isConnected ? (
          <Button onClick={handleSetup} disabled={setting} size="sm" data-testid="button-webhook-setup">
            {setting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5 mr-1.5" />}
            Connect Webhook
          </Button>
        ) : (
          <>
            <Button onClick={handleSetup} disabled={setting} size="sm" variant="outline" data-testid="button-webhook-reconnect">
              {setting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Reconnect
            </Button>
            <Button onClick={handleTeardown} disabled={tearing} size="sm" variant="outline" className="text-destructive" data-testid="button-webhook-teardown">
              {tearing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Disconnect
            </Button>
          </>
        )}
      </div>

      {status?.asanaWebhooks && status.asanaWebhooks.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Resource</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Last Success</th>
                <th className="text-left p-2 font-medium">Last Failure</th>
              </tr>
            </thead>
            <tbody>
              {status.asanaWebhooks.map((w) => (
                <tr key={w.gid} className="border-t" data-testid={`row-webhook-${w.gid}`}>
                  <td className="p-2 truncate max-w-[180px]">{w.resourceName || w.resourceGid}</td>
                  <td className="p-2">
                    {w.active ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5 py-0">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">Inactive</Badge>
                    )}
                  </td>
                  <td className="p-2 text-muted-foreground">{formatTime(w.lastSuccessAt)}</td>
                  <td className="p-2 text-muted-foreground">{formatTime(w.lastFailureAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
