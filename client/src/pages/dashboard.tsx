import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Wrench, Zap } from "lucide-react";
import { UcKpiSection } from "@/components/dashboard/UcKpiSection";
import { RebateKpiSection } from "@/components/dashboard/RebateKpiSection";
import { type Project, type ProjectDeadline } from "@shared/schema";
import { TimelineIndicator, TimelineHealth } from "@/components/timeline-indicator";
import { StatusBadge } from "@/components/status-badge";

interface DashboardStats {
  totalProjects: number;
  totalInstallProjects: number;
  overdueCount: number;
  onTrackCount: number;
  stageBreakdown: Record<string, { total: number; overdue: number; onTrack: number }>;
  ucBreakdown: Record<string, number>;
  ahjBreakdown: Record<string, number>;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: deadlines } = useQuery<ProjectDeadline[]>({
    queryKey: ['/api/deadlines'],
  });

  if (statsLoading || projectsLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const excludedPmStatuses = ['complete', 'project paused', 'project lost'];
  const installProjects = (projects || []).filter((p) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
    !excludedPmStatuses.includes(p.pmStatus?.toLowerCase() || '')
  );
  const recentProjects = [...installProjects]
    .sort((a, b) => new Date(b.lastSyncedAt || b.createdAt || 0).getTime() - new Date(a.lastSyncedAt || a.createdAt || 0).getTime())
    .slice(0, 10);

  const getProjectDeadlines = (projectId: string) => {
    return (deadlines || []).filter(d => d.projectId === projectId);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
        <Badge variant="outline" data-testid="badge-install-count">{installProjects.length} Install Projects</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-projects">{stats?.totalProjects || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Install Projects</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-install-projects">{stats?.totalInstallProjects || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Tasks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-overdue-count">{stats?.overdueCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">On Track</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-on-track">
              {stats?.onTrackCount || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <UcKpiSection />

      <RebateKpiSection />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Install Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {recentProjects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-recent-projects">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Project</th>
                    <th className="pb-2 font-medium text-muted-foreground">UC Status</th>
                    <th className="pb-2 font-medium text-muted-foreground">AHJ Status</th>
                    <th className="pb-2 font-medium text-muted-foreground">Province</th>
                    <th className="pb-2 font-medium text-muted-foreground">Timeline</th>
                    <th className="pb-2 font-medium text-muted-foreground">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProjects.map((p) => {
                    const projDeadlines = getProjectDeadlines(p.id);
                    return (
                      <tr key={p.id} className="border-b last:border-0" data-testid={`row-project-${p.id}`}>
                        <td className="py-2 font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</td>
                        <td className="py-2"><StatusBadge status={p.ucStatus} /></td>
                        <td className="py-2"><StatusBadge status={p.ahjStatus} /></td>
                        <td className="py-2 text-muted-foreground" data-testid={`text-province-${p.id}`}>{p.province || '--'}</td>
                        <td className="py-2 w-32">
                          <TimelineIndicator deadlines={projDeadlines} />
                        </td>
                        <td className="py-2">
                          <TimelineHealth deadlines={projDeadlines} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-projects">No projects synced yet. Go to Asana Sync to import your projects.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
