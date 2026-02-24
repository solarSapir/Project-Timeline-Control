import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDaysUntilDue, formatShortDate, daysSince } from "@/utils/dates";
import { isUcComplete } from "@/utils/stages";
import { Eye, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { HydroInfoSection } from "./HydroInfoSection";
import { FollowUpDialog } from "./FollowUpDialog";
import { SubtaskPanel } from "./SubtaskPanel";
import type { Project } from "@shared/schema";

interface AsanaCustomField {
  name: string;
  display_value: string | null;
}

function getAsanaField(project: Project, fieldName: string): string | null {
  return (project.asanaCustomFields as AsanaCustomField[] | null)?.find(
    (f) => f.name === fieldName
  )?.display_value ?? null;
}

export function ExpandedProjectView({ project, statusOptions, onStatusChange }: {
  project: Project;
  statusOptions: string[];
  onStatusChange: (id: string, status: string) => void;
}) {
  const completed = isUcComplete(project.ucStatus);
  const isSubmitted = project.ucStatus?.toLowerCase() === 'submitted';
  const submittedDays = daysSince(project.ucSubmittedDate);
  const needsFollowUp = isSubmitted && submittedDays !== null && submittedDays >= 7;
  const ucTeam = project.ucTeam;
  const isOffGrid = ucTeam?.toLowerCase().includes('off grid') || ucTeam?.toLowerCase().includes('no/');

  const utilityFromAsana = getAsanaField(project, 'Utility Name');
  const sharePointLink = getAsanaField(project, 'Share Point Link');
  const ucAction = getAsanaField(project, 'UC Action');
  const ucRep = getAsanaField(project, 'UC REP');
  const dateUcAction = getAsanaField(project, 'Date UC ACTION');
  const disconnectRequest = getAsanaField(project, 'Disconnect Reqeust');

  return (
    <div className="space-y-6" data-testid={`expanded-view-${project.id}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-muted/30 rounded-lg p-4 border space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">Project Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Select value={project.ucStatus || ''} onValueChange={(v) => onStatusChange(project.id, v)}>
                  <SelectTrigger className="w-[160px] h-7 text-xs" data-testid={`select-expanded-status-${project.id}`}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">UC Team</span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  isOffGrid ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                }`}>{ucTeam || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Province</span>
                <span>{project.province || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Utility</span>
                <span>{utilityFromAsana || '—'}</span>
              </div>
              {ucRep && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UC Rep</span>
                  <span>{ucRep}</span>
                </div>
              )}
              {ucAction && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UC Action</span>
                  <span>{ucAction}</span>
                </div>
              )}
              {disconnectRequest && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disconnect Request</span>
                  <span>{disconnectRequest}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{project.projectCreatedDate ? formatShortDate(project.projectCreatedDate) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">UC Due Date</span>
                <span className={(!completed && getDaysUntilDue(project.ucDueDate) !== null && getDaysUntilDue(project.ucDueDate)! < 0) ? 'text-red-600 font-medium' : ''}>
                  {project.ucDueDate ? formatShortDate(project.ucDueDate) : '—'}
                </span>
              </div>
              {isSubmitted && project.ucSubmittedDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span>
                    {formatShortDate(project.ucSubmittedDate)}
                    {project.ucSubmittedBy && ` by ${project.ucSubmittedBy}`}
                  </span>
                </div>
              )}
              {dateUcAction && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last UC Action</span>
                  <span>{new Date(dateUcAction).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              )}
            </div>
            {needsFollowUp && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2 text-xs text-amber-700 dark:text-amber-400">
                Follow-up needed — submitted {submittedDays}d ago
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {isSubmitted && <FollowUpDialog project={project} />}
              <Link href={`/project/${project.id}`}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" data-testid={`button-profile-${project.id}`}>
                  <Eye className="h-3 w-3" /> Full Profile
                </Button>
              </Link>
              {sharePointLink && (
                <a href={sharePointLink} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" data-testid={`button-sharepoint-${project.id}`}>
                    <ExternalLink className="h-3 w-3" /> SharePoint
                  </Button>
                </a>
              )}
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 border">
            <HydroInfoSection project={project} />
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="bg-muted/30 rounded-lg p-4 border">
            <SubtaskPanel projectId={project.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
