import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle2, Loader2, FolderOpen } from "lucide-react";

export default function SyncView() {
  const { toast } = useToast();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const { data: workspaces, isLoading: workspacesLoading } = useQuery<any[]>({
    queryKey: ['/api/asana/workspaces'],
  });

  const { data: asanaProjects, isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ['/api/asana/projects', selectedWorkspace],
    enabled: !!selectedWorkspace,
  });

  const handleSync = async () => {
    if (!selectedProject) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiRequest("POST", `/api/asana/sync/${selectedProject}`);
      const data = await res.json();
      setSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: `Synced ${data.synced} projects from Asana` });
    } catch (error: any) {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="text-sync-title">Asana Sync</h1>
      <p className="text-muted-foreground">Connect to your Asana workspace and sync projects to this app.</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1: Select Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          {workspacesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
            </div>
          ) : workspaces && workspaces.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {workspaces.map((ws: any) => (
                <Button
                  key={ws.gid}
                  variant={selectedWorkspace === ws.gid ? "default" : "outline"}
                  onClick={() => {
                    setSelectedWorkspace(ws.gid);
                    setSelectedProject(null);
                    setSyncResult(null);
                  }}
                  data-testid={`button-workspace-${ws.gid}`}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  {ws.name}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No workspaces found. Make sure your Asana account is connected.</p>
          )}
        </CardContent>
      </Card>

      {selectedWorkspace && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 2: Select Project</CardTitle>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : asanaProjects && asanaProjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {asanaProjects.map((proj: any) => (
                  <Button
                    key={proj.gid}
                    variant={selectedProject === proj.gid ? "default" : "outline"}
                    onClick={() => {
                      setSelectedProject(proj.gid);
                      setSyncResult(null);
                    }}
                    data-testid={`button-project-${proj.gid}`}
                  >
                    {proj.name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No projects found in this workspace.</p>
            )}
          </CardContent>
        </Card>
      )}

      {selectedProject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 3: Sync Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will pull all tasks from the selected Asana project and sync their custom fields into this app.
              Existing projects will be updated, new ones will be created with default deadlines.
            </p>
            <Button
              onClick={handleSync}
              disabled={syncing}
              data-testid="button-sync"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>

            {syncResult && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm" data-testid="text-sync-result">Successfully synced {syncResult.synced} projects</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
