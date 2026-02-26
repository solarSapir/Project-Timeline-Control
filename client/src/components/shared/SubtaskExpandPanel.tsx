import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, ChevronRight, ListTodo, Plus, RefreshCw, Loader2 } from "lucide-react";
import { SubtaskDetail } from "@/components/uc/SubtaskDetail";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [actionLoading, setActionLoading] = useState<"resync" | "create" | null>(null);
  const { toast } = useToast();

  const handleCreate = async () => {
    setActionLoading("create");
    try {
      await apiRequest("POST", `/api/projects/${projectId}/hrsp-create`);
      toast({ title: "HRSP subtask created", description: "Subtask added in Asana and linked" });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "hrsp-subtask"] });
    } catch {
      toast({ title: "Failed to create subtask", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResync = async () => {
    setActionLoading("resync");
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/hrsp-resync`);
      const data = await res.json();
      if (data.found) {
        toast({ title: "HRSP subtask linked", description: `Found and connected: ${data.status || "No status yet"}` });
      } else {
        toast({ title: "No HRSP subtask found", description: "Create one in Asana first, then resync", variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "hrsp-subtask"] });
    } catch {
      toast({ title: "Resync failed", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  if (!isLoading && subtasks.length === 0) {
    return (
      <div className="space-y-3 p-3 border rounded-md bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">No HRSP subtask found for this project.</p>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-amber-300 dark:border-amber-700"
            onClick={handleCreate}
            disabled={!!actionLoading}
            data-testid={`button-modal-hrsp-create-${projectId}`}
          >
            {actionLoading === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Auto-Create Subtask
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-amber-300 dark:border-amber-700"
            onClick={handleResync}
            disabled={!!actionLoading}
            data-testid={`button-modal-hrsp-resync-${projectId}`}
          >
            {actionLoading === "resync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Resync from Asana
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SubtaskExpandPanel
      subtasks={subtasks}
      isLoading={isLoading}
      label="HRSP Subtasks"
      emptyMessage="No HRSP subtask found for this project."
    />
  );
}
