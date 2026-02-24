import { useQuery } from "@tanstack/react-query";
import type { Project } from "@shared/schema";

const NON_RESIDENTIAL_SECTORS = [
  'commercial', 'industrial', 'agricultural', 'institutional', 'multi-residential',
];

const EXCLUDED_PM_STATUSES = ['complete', 'project paused', 'project lost', 'close-off'];

/** Filter to residential-only install projects, excluding completed/paused/lost. */
function filterResidentialInstallProjects(projects: Project[]): Project[] {
  return projects.filter(p => {
    if (p.installType?.toLowerCase() !== 'install') return false;
    const sector = p.propertySector?.toLowerCase() ?? '';
    if (NON_RESIDENTIAL_SECTORS.some(s => sector.includes(s))) return false;
    const pm = p.pmStatus?.toLowerCase() ?? '';
    if (EXCLUDED_PM_STATUSES.some(s => pm.includes(s))) return false;
    return true;
  });
}

/**
 * Fetch all projects from the API.
 * Returns the raw project list and a filtered residential-only list.
 */
export function useProjects() {
  const query = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const residentialProjects = query.data
    ? filterResidentialInstallProjects(query.data)
    : [];

  return {
    ...query,
    allProjects: query.data ?? [],
    residentialProjects,
  };
}
