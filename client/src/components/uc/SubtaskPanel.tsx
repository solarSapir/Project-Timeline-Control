import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, ChevronDown, ChevronRight, ListTodo } from "lucide-react";
import { SubtaskDetail } from "./SubtaskDetail";

interface Subtask {
  gid: string;
  name: string;
  completed: boolean;
}

export function SubtaskPanel({ projectId, maxHeight }: { projectId: string; maxHeight?: string }) {
  const [openSubtaskGid, setOpenSubtaskGid] = useState<string | null>(null);

  const { data: subtasks = [], isLoading } = useQuery<Subtask[]>({
    queryKey: ['/api/projects', projectId, 'uc-subtasks'],
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    );
  }

  if (subtasks.length === 0) {
    return (
      <div>
        <p className="text-xs text-muted-foreground py-1">No UC subtasks found for this project.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined} data-testid={`subtask-panel-${projectId}`}>
      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
        <ListTodo className="h-3 w-3" /> UC Subtasks ({subtasks.length})
      </p>
      {subtasks.map((st) => (
        <div key={st.gid}>
          <button
            onClick={() => setOpenSubtaskGid(openSubtaskGid === st.gid ? null : st.gid)}
            className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors ${
              st.completed ? 'opacity-50' : 'hover:bg-muted/60'
            } ${openSubtaskGid === st.gid ? 'bg-muted' : ''}`}
            data-testid={`button-subtask-${st.gid}`}
          >
            {openSubtaskGid === st.gid ? (
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
          {openSubtaskGid === st.gid && (
            <SubtaskDetail subtaskGid={st.gid} subtaskName={st.name} onClose={() => setOpenSubtaskGid(null)} />
          )}
        </div>
      ))}
    </div>
  );
}
