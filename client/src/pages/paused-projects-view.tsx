import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageLoader } from "@/components/ui/logo-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Search, PauseCircle } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { formatShortDate } from "@/utils/dates";
import { EscalationBadge } from "@/components/shared/EscalationBadge";
import type { Project } from "@shared/schema";

function PausedCard({ project }: { project: Project }) {
  return (
    <Card data-testid={`card-paused-${project.id}`}>
      <CardContent className="py-3 px-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/project/${project.id}`} className="font-medium text-sm text-primary hover:underline break-all" data-testid={`link-paused-profile-${project.id}`}>
              {project.name}
            </Link>
            {project.province && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {project.province}
              </span>
            )}
            {project.installType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                {project.installType}
              </span>
            )}
            <EscalationBadge projectId={project.id} />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {project.projectCreatedDate && <span>Created {formatShortDate(project.projectCreatedDate)}</span>}
            {project.lastUnpausedDate && <span>Last Unpaused {formatShortDate(project.lastUnpausedDate)}</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">UC:</span>
            <StatusBadge status={project.ucStatus} />
            <span className="text-muted-foreground">AHJ:</span>
            <StatusBadge status={project.ahjStatus} />
            {project.contractStatus && project.contractStatus !== 'A. Not Assign' && (
              <>
                <span className="text-muted-foreground">Contractor:</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-medium">
                  {project.contractStatus}
                </span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PausedProjectsView() {
  const [search, setSearch] = useState("");
  const { data: projects, isLoading } = useQuery<Project[]>({ queryKey: ['/api/projects'] });

  if (isLoading) {
    return <PageLoader title="Loading paused projects..." />;
  }

  const pausedProjects = (projects || []).filter(p =>
    p.pmStatus?.toLowerCase() === 'project paused'
  );

  const filtered = pausedProjects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-paused-title">
          <PauseCircle className="h-6 w-6 text-amber-500" />
          Paused Projects
        </h1>
        <span className="text-sm text-muted-foreground" data-testid="text-paused-count">{pausedProjects.length} paused</span>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search paused projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-paused" />
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <PauseCircle className="h-3.5 w-3.5 text-amber-500" /> Paused ({sorted.length})
          </p>
          {sorted.map(p => <PausedCard key={p.id} project={p} />)}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>{search ? "No paused projects match your search." : "No projects are currently paused."}</p>
        </div>
      )}
    </div>
  );
}
