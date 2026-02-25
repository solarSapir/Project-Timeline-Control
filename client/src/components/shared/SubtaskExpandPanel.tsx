import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, ChevronDown, ChevronRight, ListTodo } from "lucide-react";
import { SubtaskDetail } from "@/components/uc/SubtaskDetail";

interface Subtask {
  gid: string;
  name: string;
  completed: boolean;
}

interface SubtaskExpandPanelProps {
  subtasks: Subtask[];
  isLoading: boolean;
  label: string;
  emptyMessage?: string;
}

export function SubtaskExpandPanel({ subtasks, isLoading, label, emptyMessage }: SubtaskExpandPanelProps) {
  const [openGid, setOpenGid] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    );
  }

  if (subtasks.length === 0) {
    return <p className="text-xs text-muted-foreground py-1">{emptyMessage || `No ${label.toLowerCase()} found.`}</p>;
  }

  return (
    <div className="space-y-1" data-testid={`subtask-expand-panel`}>
      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
        <ListTodo className="h-3 w-3" /> {label} ({subtasks.length})
      </p>
      {subtasks.map((st) => (
        <div key={st.gid}>
          <button
            onClick={() => setOpenGid(openGid === st.gid ? null : st.gid)}
            className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors ${
              st.completed ? 'opacity-50' : 'hover:bg-muted/60'
            } ${openGid === st.gid ? 'bg-muted' : ''}`}
            data-testid={`button-subtask-${st.gid}`}
          >
            {openGid === st.gid ? (
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            )}
            {st.completed ? (
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
            ) : (
              <div className="h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-blue-400" />
            )}
            <span className="flex-1 truncate">{st.name}</span>
            {st.completed && <span className="text-[10px] text-green-600 dark:text-green-400">Done</span>}
          </button>
          {openGid === st.gid && (
            <SubtaskDetail subtaskGid={st.gid} subtaskName={st.name} onClose={() => setOpenGid(null)} />
          )}
        </div>
      ))}
    </div>
  );
}

interface InstallTeamSubtaskPanelProps {
  projectId: string;
  subtaskName: string;
  label: string;
}

export function InstallTeamSubtaskPanel({ projectId, subtaskName, label }: InstallTeamSubtaskPanelProps) {
  const { data, isLoading } = useQuery<Subtask>({
    queryKey: ['/api/projects', projectId, 'install-team-subtask', subtaskName],
    queryFn: () => fetch(`/api/projects/${projectId}/install-team-subtask?name=${encodeURIComponent(subtaskName)}`).then(r => r.json()),
  });

  const subtasks = data ? [data] : [];

  return <SubtaskExpandPanel subtasks={subtasks} isLoading={isLoading} label={label} />;
}

interface AhjSubtaskPanelProps {
  projectId: string;
}

export function AhjSubtaskPanel({ projectId }: AhjSubtaskPanelProps) {
  const { data: subtasks = [], isLoading } = useQuery<Subtask[]>({
    queryKey: ['/api/projects', projectId, 'ahj-subtasks'],
  });

  return (
    <SubtaskExpandPanel
      subtasks={subtasks}
      isLoading={isLoading}
      label="AHJ Subtasks"
      emptyMessage="No AHJ subtasks found for this project."
    />
  );
}

interface HrspSubtaskPanelProps {
  projectId: string;
}

export function HrspSubtaskPanel({ projectId }: HrspSubtaskPanelProps) {
  const { data: subtasks = [], isLoading } = useQuery<Subtask[]>({
    queryKey: ['/api/projects', projectId, 'hrsp-subtask'],
  });

  return (
    <SubtaskExpandPanel
      subtasks={subtasks}
      isLoading={isLoading}
      label="HRSP Subtasks"
      emptyMessage="No HRSP subtask found for this project."
    />
  );
}
