import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  "New Application": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Missing Information": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "Submitted": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "Approved": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Complete": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  "Rejected": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Not Required": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  "Close-off": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "New Project": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Ready for P.eng": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  "Submitted to P.eng": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "P.eng Complete - Pending City Submission": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "Submitted to City": "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  "pending": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "completed": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "overdue": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "on_track": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "at_risk": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "Install": "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  "DIY": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

export function StatusBadge({ status, className }: { status: string | null; className?: string }) {
  if (!status) return <Badge variant="outline" className={className}>--</Badge>;
  const colorClass = statusColors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  return (
    <Badge variant="outline" className={`${colorClass} border-0 ${className || ''}`} data-testid={`badge-status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
      {status}
    </Badge>
  );
}
