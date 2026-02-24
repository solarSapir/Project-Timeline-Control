import { useQuery } from "@tanstack/react-query";
import type { WorkflowConfig } from "@shared/schema";

/**
 * Fetch the workflow configuration from the API.
 * Used to determine stage dependencies, gap days, and completion criteria.
 */
export function useWorkflowConfig() {
  return useQuery<WorkflowConfig[]>({
    queryKey: ['/api/workflow-config'],
  });
}
