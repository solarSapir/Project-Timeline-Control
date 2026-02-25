import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDaysUntilDue, formatShortDate, daysSince } from "@/utils/dates";
import { isUcComplete } from "@/utils/stages";
import { FolderOpen, Maximize2 } from "lucide-react";
import { Link } from "wouter";
import { DueIndicator } from "./DueIndicator";
import { HydroInfoSection } from "./HydroInfoSection";
import { UcDocChecklist } from "./UcDocChecklist";
import { FollowUpDialog } from "./FollowUpDialog";
import { SubtaskPanel } from "./SubtaskPanel";
import { EscalationDialog } from "@/components/shared/EscalationDialog";
import { EscalationBadge } from "@/components/shared/EscalationBadge";
import type { Project } from "@shared/schema";

export function UCProjectCard({ project, statusOptions, isExpanded, onToggleExpand, onExpand, onStatusChange }: {
  project: Project;
  statusOptions: string[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onExpand: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const completed = isUcComplete(project.ucStatus);
  const isOverdue = !completed && (getDaysUntilDue(project.ucDueDate) ?? 1) < 0;
  const isSubmitted = project.ucStatus?.toLowerCase() === 'submitted';
  const submittedDays = daysSince(project.ucSubmittedDate);
  const needsFollowUp = isSubmitted && submittedDays !== null && submittedDays >= 7;

  const ucTeam = project.ucTeam;
  const isOffGrid = ucTeam?.toLowerCase().includes('off grid') || ucTeam?.toLowerCase().includes('no/');

  return (
    <Card
      className={`transition-colors ${completed ? "opacity-50" : ""} ${
        needsFollowUp ? "border-l-4 border-l-amber-400" :
        isOverdue ? "border-l-4 border-l-red-400" : ""
      }`}
      data-testid={`card-project-${project.id}`}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/project/${project.id}`} className="font-medium text-sm text-primary hover:underline truncate" data-testid={`link-profile-${project.id}`}>
                {project.name}
              </Link>
              {ucTeam && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  isOffGrid ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                }`}>
                  {ucTeam}
                </span>
              )}
              <EscalationBadge projectId={project.id} />
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
              {project.province && <span>{project.province}</span>}
              {project.province && project.projectCreatedDate && <span>·</span>}
              {project.projectCreatedDate && <span>Created {formatShortDate(project.projectCreatedDate)}</span>}
              {(project.province || project.projectCreatedDate) && project.ucDueDate && !completed && <span>·</span>}
              <DueIndicator dueDate={project.ucDueDate} completed={completed} />
            </div>

            {isSubmitted && project.ucSubmittedDate && (
              <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                <span className="text-muted-foreground">
                  Submitted {formatShortDate(project.ucSubmittedDate)}
                  {project.ucSubmittedBy && ` by ${project.ucSubmittedBy}`}
                  {submittedDays !== null && ` (${submittedDays}d ago)`}
                </span>
                {needsFollowUp && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    — follow-up needed
                  </span>
                )}
              </div>
            )}

            <HydroInfoSection project={project} />
            <UcDocChecklist project={project} />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={project.ucStatus || ''} onValueChange={(v) => onStatusChange(project.id, v)}>
              <SelectTrigger className="w-[160px] h-7 text-xs" data-testid={`select-uc-status-${project.id}`}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {isSubmitted && <FollowUpDialog project={project} />}
            <EscalationDialog projectId={project.id} projectName={project.name} viewType="uc" />
            <Button
              size="sm"
              variant={isExpanded ? "secondary" : "ghost"}
              className="h-7 text-xs gap-1 px-2"
              onClick={onToggleExpand}
              data-testid={`button-subtasks-${project.id}`}
            >
              <FolderOpen className="h-3 w-3" />
              Subtasks
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 px-2"
              onClick={onExpand}
              data-testid={`button-expand-${project.id}`}
            >
              <Maximize2 className="h-3 w-3" />
              Expand
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t">
            <SubtaskPanel projectId={project.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
