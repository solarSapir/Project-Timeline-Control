import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { HrspChecklist } from "./HrspChecklist";
import { HrspSubtaskPanel } from "@/components/shared/SubtaskExpandPanel";
import { RebateFollowUpDialog } from "./RebateFollowUpDialog";
import type { Project, RebateWorkflowRule } from "@shared/schema";
import { daysSince } from "@/utils/dates";

interface Props {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getRebateStatusColor(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes('not required')) return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  if (lower.includes('new') || lower.includes('check')) return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  if (lower.includes('complete')) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (lower === 'close-off - submitted' || lower === 'close-off submitted') return "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300";
  if (lower.includes('in-progress') || lower.includes('submitted')) return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  return "bg-muted text-muted-foreground";
}

export function RebateProjectModal({ project, open, onOpenChange }: Props) {
  const { data: workflowRules } = useQuery<RebateWorkflowRule[]>({
    queryKey: ['/api/rebate/workflow-rules'],
  });

  if (!project) return null;

  const followUpThreshold = workflowRules?.find(r => r.enabled && r.triggerAction === 'follow_up_submitted')?.hideDays ?? 5;
  const status = project.rebateStatus || project.hrspStatus || '';
  const needsFollowUp = ['in-progress', 'submitted', 'close-off - submitted', 'close-off submitted'].some(s => status.toLowerCase().includes(s));
  const days = daysSince(project.rebateSubmittedDate);
  const followUpDue = needsFollowUp && days !== null && days >= followUpThreshold;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid={`modal-rebate-${project.id}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{project.name}</span>
            {status && (
              <Badge className={`text-[10px] ${getRebateStatusColor(status)}`} data-testid="badge-modal-rebate-status">
                {status}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">Rebate project details and document checklist</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div>Province: <span className="text-foreground font-medium">{project.province || 'N/A'}</span></div>
            <div>UC Team: <span className="text-foreground font-medium">{project.ucTeam || 'N/A'}</span></div>
            <div>PM Status: <span className="text-foreground font-medium">{project.pmStatus || 'N/A'}</span></div>
            <div>Install Stage: <span className="text-foreground font-medium">{project.installTeamStage || 'N/A'}</span></div>
          </div>

          {needsFollowUp && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border" data-testid="section-follow-up-info">
              <div className="text-xs">
                <span className="font-medium">
                  {followUpDue ? 'Follow-up due' : 'In follow-up cycle'}
                </span>
                {days !== null && (
                  <span className={`ml-1 ${followUpDue ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
                    — {days}d since status change
                  </span>
                )}
              </div>
              <RebateFollowUpDialog project={project} />
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Document Checklist</h3>
            <HrspChecklist project={project} />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">HRSP Subtask Activity</h3>
            <HrspSubtaskPanel projectId={project.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
