import { useQuery } from "@tanstack/react-query";
import type { TaskAction } from "@shared/schema";

/**
 * Fetch task actions for a specific view type.
 * @param viewType - The view type to filter by (e.g., "uc", "ahj", "contracts")
 */
export function useTaskActions(viewType: string) {
  return useQuery<TaskAction[]>({
    queryKey: ['/api/task-actions', viewType],
  });
}

/**
 * Fetch follow-up actions for a specific view type.
 * @param viewType - The view type to filter by
 */
export function useFollowUpActions(viewType: string) {
  return useQuery<TaskAction[]>({
    queryKey: ['/api/task-actions', viewType, 'follow-ups'],
    queryFn: async () => {
      const res = await fetch(`/api/task-actions/${viewType}/follow-ups`);
      if (!res.ok) throw new Error('Failed to fetch follow-ups');
      return res.json();
    },
  });
}

/**
 * Fetch all task actions for a specific project.
 * @param projectId - The project ID
 */
export function useProjectTaskActions(projectId: string) {
  return useQuery<TaskAction[]>({
    queryKey: ['/api/projects', projectId, 'task-actions'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/task-actions`);
      if (!res.ok) throw new Error('Failed to fetch project task actions');
      return res.json();
    },
    enabled: !!projectId,
  });
}
