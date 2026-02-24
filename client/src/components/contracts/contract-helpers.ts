import type { Project } from "@shared/schema";
import { isUcComplete } from "@/utils/stages";

interface AsanaCustomField {
  name?: string;
  display_value?: string;
}

/** Calculate the contract due date based on UC completion. */
export function getContractDueDate(project: Project): string | null {
  if (!isUcComplete(project.ucStatus)) return null;
  if (project.ucStatus?.toLowerCase().includes('not required')) {
    const base = project.projectCreatedDate || project.createdAt;
    if (!base) return null;
    const d = new Date(base);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }
  const ucDue = project.ucDueDate;
  if (ucDue) {
    const d = new Date(ucDue);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }
  return null;
}

/** Extract the "Date Contract Sent" from Asana custom fields. */
export function getContractSentDate(project: Project): string | null {
  const fields = (project.asanaCustomFields as AsanaCustomField[] | null) || [];
  const field = fields.find((f) =>
    f.name?.toLowerCase().includes('date contract sent')
  );
  return field?.display_value ? field.display_value.split('T')[0] : null;
}

/** Extract the "Date Followed Up On With Contract" from Asana custom fields. */
export function getContractFollowUpDate(project: Project): string | null {
  const fields = (project.asanaCustomFields as AsanaCustomField[] | null) || [];
  const field = fields.find((f) =>
    f.name?.toLowerCase().includes('date followed up on with contract')
  );
  return field?.display_value ? field.display_value.split('T')[0] : null;
}
