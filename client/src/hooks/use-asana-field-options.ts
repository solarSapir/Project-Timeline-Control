import { useQuery } from "@tanstack/react-query";

interface AsanaFieldOption {
  gid: string;
  name: string;
}

/**
 * Fetch Asana enum options for a specific custom field.
 * @param fieldName - The local field name (e.g., "ucStatus", "ahjStatus")
 */
export function useAsanaFieldOptions(fieldName: string) {
  return useQuery<AsanaFieldOption[]>({
    queryKey: ['/api/asana/field-options', fieldName],
    queryFn: async () => {
      const res = await fetch(`/api/asana/field-options/${fieldName}`);
      if (!res.ok) throw new Error(`Failed to fetch options for ${fieldName}`);
      return res.json();
    },
    enabled: !!fieldName,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * Fetch HRSP/grants field options for a specific subtask.
 * @param subtaskGid - The Asana subtask GID
 */
export function useHrspFieldOptions(subtaskGid: string | null) {
  return useQuery<AsanaFieldOption[]>({
    queryKey: ['/api/hrsp/field-options', subtaskGid],
    queryFn: async () => {
      const res = await fetch(`/api/hrsp/field-options/${subtaskGid}`);
      if (!res.ok) throw new Error('Failed to fetch HRSP options');
      return res.json();
    },
    enabled: !!subtaskGid,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
