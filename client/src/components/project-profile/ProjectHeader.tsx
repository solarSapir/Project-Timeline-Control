import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatProfileDate } from "./InfoRow";
import { MapPin } from "lucide-react";
import type { Project } from "@shared/schema";

function getPmStatusColor(pmStatus: string | null): string {
  const s = pmStatus?.toLowerCase() ?? "";
  if (s.includes("complete")) return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700";
  if (s.includes("install")) return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700";
  if (s.includes("paused")) return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700";
  if (s.includes("lost")) return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700";
  return "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600";
}

interface ProjectHeaderProps {
  project: Project;
  pmOptions: { gid: string; name: string }[];
  pmStatusMutation: { mutate: (v: string) => void; isPending: boolean };
}

export function ProjectHeader({ project, pmOptions, pmStatusMutation }: ProjectHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-project-name">{project.name}</h1>
        <StatusBadge status={project.installType} />
        {project.province && (
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {project.province}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
        {project.projectCreatedDate && (
          <span data-testid="text-created-date">Created: {formatProfileDate(project.projectCreatedDate)}</span>
        )}
        {project.installTeamStage && (
          <Badge variant="outline" className="text-xs" data-testid="text-install-stage">{project.installTeamStage}</Badge>
        )}
        <div className="flex items-center gap-1.5" data-testid="pm-status-select">
          <span className="text-xs text-muted-foreground">PM Status:</span>
          <Select
            value={project.pmStatus || ""}
            onValueChange={(v) => pmStatusMutation.mutate(v)}
            disabled={pmStatusMutation.isPending}
          >
            <SelectTrigger
              className={`h-6 w-auto min-w-[120px] text-xs border px-2 py-0 ${getPmStatusColor(project.pmStatus)}`}
              data-testid="select-pm-status"
            >
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              {pmOptions.map((opt) => (
                <SelectItem key={opt.gid} value={opt.name}>{opt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
