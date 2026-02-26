import { useQuery } from "@tanstack/react-query";
import { Paperclip, ExternalLink } from "lucide-react";

interface ProjectFile {
  id: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  uploadedBy: string | null;
  notes: string | null;
}

function parseStructuredIssue(issue: string): { doneSoFar: string; stuckOn: string; needFromManager: string } | null {
  const doneMatch = issue.match(/WHAT HAS BEEN DONE SO FAR:\n([\s\S]*?)(?=\n\nWHAT NEXT STEPS ARE YOU STUCK ON:)/);
  const stuckMatch = issue.match(/WHAT NEXT STEPS ARE YOU STUCK ON:\n([\s\S]*?)(?=\n\nWHAT DO YOU NEED FROM THE MANAGER:)/);
  const managerMatch = issue.match(/WHAT DO YOU NEED FROM THE MANAGER:\n([\s\S]*?)$/);

  if (doneMatch && stuckMatch && managerMatch) {
    return {
      doneSoFar: doneMatch[1].trim(),
      stuckOn: stuckMatch[1].trim(),
      needFromManager: managerMatch[1].trim(),
    };
  }
  return null;
}

interface Props {
  issue: string;
  projectId: string;
  ticketId: string;
  compact?: boolean;
}

export function EscalationIssueDisplay({ issue, projectId, ticketId, compact }: Props) {
  const { data: files } = useQuery<ProjectFile[]>({
    queryKey: ['/api/projects', projectId, 'files'],
    select: (allFiles: ProjectFile[]) => allFiles.filter(f => f.notes?.includes(ticketId)),
  });

  const structured = parseStructuredIssue(issue);
  const attachments = files || [];

  if (!structured) {
    return (
      <div className="p-2.5 rounded bg-white dark:bg-muted text-sm mb-2 whitespace-pre-wrap" data-testid={`issue-display-${ticketId}`}>
        {issue}
        {attachments.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <p className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-0.5">
              {attachments.map(f => (
                <a
                  key={f.id}
                  href={`/api/projects/${projectId}/files/${f.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  data-testid={`attachment-link-${f.id}`}
                >
                  <ExternalLink className="h-3 w-3" />
                  {f.fileName.replace(/^ESCALATION-[a-f0-9-]+ - /, '')}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const sections = [
    { label: "What has been done so far", content: structured.doneSoFar, color: "text-blue-700 dark:text-blue-300" },
    { label: "What next steps are you stuck on", content: structured.stuckOn, color: "text-amber-700 dark:text-amber-300" },
    { label: "What do you need from the manager", content: structured.needFromManager, color: "text-purple-700 dark:text-purple-300" },
  ];

  return (
    <div className="space-y-1.5 mb-2" data-testid={`issue-display-${ticketId}`}>
      {sections.map((s, i) => (
        <div key={i} className="p-2 rounded bg-white dark:bg-muted">
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${s.color}`}>
            {s.label}
          </p>
          <p className={`text-sm whitespace-pre-wrap ${compact ? 'line-clamp-2' : ''}`}>{s.content}</p>
        </div>
      ))}
      {attachments.length > 0 && (
        <div className="p-2 rounded bg-white dark:bg-muted">
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-muted-foreground flex items-center gap-1">
            <Paperclip className="h-3 w-3" /> Attachments ({attachments.length})
          </p>
          <div className="space-y-0.5">
            {attachments.map(f => (
              <a
                key={f.id}
                href={`/api/projects/${projectId}/files/${f.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                data-testid={`attachment-link-${f.id}`}
              >
                <ExternalLink className="h-3 w-3" />
                {f.fileName.replace(/^ESCALATION-[a-f0-9-]+ - /, '')}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
