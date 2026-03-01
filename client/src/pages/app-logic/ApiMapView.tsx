import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search } from "lucide-react";

interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  tables: string[];
  usedBy: string[];
}

interface ApiGroup {
  name: string;
  file: string;
  endpoints: ApiEndpoint[];
}

const apiGroups: ApiGroup[] = [
  {
    name: "Asana Sync",
    file: "server/routes/asana.ts",
    endpoints: [
      { method: "GET", path: "/api/asana/sync-status", description: "Get last sync time and cached project GID", tables: [], usedBy: ["Sidebar", "Settings"] },
      { method: "POST", path: "/api/asana/sync-all", description: "Full sync from Asana Project Manage Team", tables: ["projects"], usedBy: ["Settings", "Sidebar"] },
      { method: "GET", path: "/api/asana/field-options/:field", description: "Get dropdown options for an Asana custom field", tables: [], usedBy: ["UC", "Rebates", "Contracts", "AHJ", "Installs"] },
      { method: "GET", path: "/api/hrsp/sync-statuses", description: "Sync HRSP subtask statuses for all projects", tables: ["projects"], usedBy: ["Settings"] },
      { method: "GET", path: "/api/asana/workspaces", description: "List Asana workspaces", tables: [], usedBy: ["Settings"] },
      { method: "GET", path: "/api/asana/projects/:workspaceGid", description: "List projects in workspace", tables: [], usedBy: ["Settings"] },
      { method: "POST", path: "/api/asana/sync/:projectGid", description: "Sync single project", tables: ["projects"], usedBy: ["Settings"] },
      { method: "GET", path: "/api/hrsp/field-options/:subtaskGid", description: "HRSP field options", tables: [], usedBy: ["Rebates"] },
      { method: "PATCH", path: "/api/hrsp/:projectId", description: "Update HRSP status", tables: ["projects"], usedBy: ["Rebates"] },
    ],
  },
  {
    name: "Projects",
    file: "server/routes/projects.ts",
    endpoints: [
      { method: "GET", path: "/api/projects", description: "Get all projects", tables: ["projects"], usedBy: ["All views"] },
      { method: "GET", path: "/api/projects/:id", description: "Get single project by ID", tables: ["projects"], usedBy: ["Project Profile"] },
      { method: "PATCH", path: "/api/projects/:id", description: "Update project fields + push status changes to Asana", tables: ["projects"], usedBy: ["UC", "Rebates", "Contracts", "All views"] },
      { method: "GET", path: "/api/projects/:id/deadlines", description: "Get deadlines for a specific project", tables: ["project_deadlines"], usedBy: ["Project Profile", "Gantt"] },
      { method: "GET", path: "/api/projects/:id/task-actions", description: "Get all task actions for a project", tables: ["task_actions"], usedBy: ["Project Profile"] },
      { method: "GET", path: "/api/projects/:id/install-schedules", description: "Get install schedules for a project", tables: ["install_schedule"], usedBy: ["Project Profile"] },
      { method: "GET", path: "/api/projects/:id/stories", description: "Get Asana stories/comments for a project", tables: [], usedBy: ["Project Profile"] },
      { method: "GET", path: "/api/projects/:id/uc-subtasks", description: "List UC-related subtasks from Asana", tables: [], usedBy: ["UC"] },
      { method: "POST", path: "/api/projects/:id/complete-uc-subtasks", description: "Mark all UC subtasks as complete in Asana", tables: [], usedBy: ["UC"] },
      { method: "GET", path: "/api/projects/:id/install-team-subtask", description: "Find or create Install Team subtask", tables: [], usedBy: ["Installs"] },
      { method: "GET", path: "/api/projects/:id/ahj-subtasks", description: "List AHJ-related subtasks from Asana", tables: [], usedBy: ["AHJ"] },
      { method: "GET", path: "/api/projects/:id/hrsp-subtask", description: "Get HRSP subtask for a project", tables: [], usedBy: ["Rebates"] },
      { method: "GET", path: "/api/projects/contract-file-counts", description: "File counts for contracts", tables: ["project_files"], usedBy: ["Contracts"] },
      { method: "GET", path: "/api/projects/:id/planning-subtask", description: "Planning subtasks", tables: [], usedBy: ["Planner"] },
      { method: "POST", path: "/api/projects/:id/hrsp-resync", description: "Force resync HRSP", tables: ["projects"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-create", description: "Create HRSP subtask", tables: [], usedBy: ["Rebates"] },
    ],
  },
  {
    name: "File Uploads",
    file: "server/routes/uploads.ts",
    endpoints: [
      { method: "POST", path: "/api/projects/:id/hydro-bill", description: "Upload hydro bill image, optionally extract info via OpenAI Vision", tables: ["projects"], usedBy: ["UC"] },
      { method: "POST", path: "/api/projects/:id/meterbase", description: "Upload meterbase photo, stored locally", tables: ["projects", "project_files"], usedBy: ["UC"] },
      { method: "POST", path: "/api/projects/:id/hrsp-auth-doc", description: "Upload participation document", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-sld", description: "Upload SLD document", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-roof-pics", description: "Upload roof installation photos", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-panel-nameplate", description: "Upload panel nameplate photo", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-inverter-nameplate", description: "Upload inverter nameplate", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-battery-nameplate", description: "Upload battery nameplate", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-esa-cert", description: "Upload ESA certificate", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-power-doc", description: "Upload power consumption / hydro bill for HRSP", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-paid-invoice", description: "Upload paid invoice for HRSP close-off", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/follow-up", description: "Upload follow-up screenshot + post comment to Asana", tables: [], usedBy: ["UC", "Rebates"] },
      { method: "POST", path: "/api/projects/:id/status-note", description: "Post a status change note/comment to Asana task", tables: [], usedBy: ["UC", "Contracts"] },
      { method: "POST", path: "/api/projects/:id/contract-documents", description: "Upload contract/proposal/site plan documents", tables: ["project_files"], usedBy: ["Contracts"] },
      { method: "POST", path: "/api/projects/:id/contract-approve", description: "Record contract approval with metadata", tables: ["projects", "project_files"], usedBy: ["Contracts"] },
      { method: "POST", path: "/api/projects/:id/site-visit-photos", description: "Upload site visit photos", tables: ["project_files"], usedBy: ["Site Visits"] },
      { method: "POST", path: "/api/projects/:id/pm-status-change", description: "PM status change with notes", tables: ["projects"], usedBy: ["All views"] },
      { method: "POST", path: "/api/projects/:id/planner-proposal", description: "Upload proposal", tables: ["projects", "project_files"], usedBy: ["Planner"] },
      { method: "POST", path: "/api/projects/:id/planner-site-plan", description: "Upload site plan", tables: ["projects", "project_files"], usedBy: ["Planner"] },
      { method: "POST", path: "/api/projects/:id/electrical-permit", description: "Upload electrical permit", tables: ["projects", "project_files"], usedBy: ["Planner"] },
    ],
  },
  {
    name: "Project Files",
    file: "server/routes/files.ts",
    endpoints: [
      { method: "GET", path: "/api/projects/:id/files", description: "List all files for a project, optionally filter by category", tables: ["project_files"], usedBy: ["Project Profile", "UC", "Rebates"] },
      { method: "POST", path: "/api/projects/:id/files", description: "Upload a file with category, uploadedBy, notes", tables: ["project_files"], usedBy: ["UC Approval/Rejection", "All views"] },
      { method: "GET", path: "/api/projects/:id/files/:fileId/download", description: "Download a specific file", tables: ["project_files"], usedBy: ["Project Profile"] },
      { method: "DELETE", path: "/api/projects/:id/files/:fileId", description: "Delete a file", tables: ["project_files"], usedBy: ["Project Profile"] },
      { method: "POST", path: "/api/projects/:id/files/recover-from-asana", description: "Recover from Asana", tables: ["project_files"], usedBy: ["Project Profile"] },
      { method: "POST", path: "/api/projects/bulk-recover-contracts", description: "Bulk recover contracts", tables: ["project_files"], usedBy: ["Settings"] },
    ],
  },
  {
    name: "HRSP Invoice",
    file: "server/routes/hrsp-invoice.ts",
    endpoints: [
      { method: "POST", path: "/api/projects/:id/hrsp-invoice", description: "Generate HRSP invoice PDF", tables: ["projects", "hrsp_config"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-paid-invoice", description: "Generate paid invoice PDF with install date", tables: ["projects", "hrsp_config"], usedBy: ["Rebates"] },
      { method: "GET", path: "/api/projects/hrsp-invoice/sample", description: "Download sample invoice PDF (no project data)", tables: ["hrsp_config"], usedBy: ["Settings"] },
      { method: "GET", path: "/api/projects/:id/hrsp-invoice/download", description: "Download invoice", tables: ["projects", "hrsp_config"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-invoice-upload", description: "Upload HRSP invoice", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-paid-invoice-upload", description: "Upload paid invoice", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/projects/:id/hrsp-ldc-agreement", description: "Upload LDC agreement", tables: ["projects", "project_files"], usedBy: ["Rebates"] },
    ],
  },
  {
    name: "UC Workflow",
    file: "server/routes/uc-workflow.ts",
    endpoints: [
      { method: "POST", path: "/api/uc/complete-action", description: "Log a UC workflow completion (status change or follow-up)", tables: ["uc_completions"], usedBy: ["UC"] },
      { method: "GET", path: "/api/uc/completions", description: "Get all UC completions, with optional staff/date filters", tables: ["uc_completions"], usedBy: ["UC", "Dashboard"] },
      { method: "GET", path: "/api/uc/completions/:projectId", description: "Project completions", tables: ["uc_completions"], usedBy: ["UC", "Project Profile"] },
      { method: "GET", path: "/api/uc/kpi-stats", description: "Calculate UC KPIs: tasks/day, time-to-submit, rejections by utility", tables: ["uc_completions", "projects"], usedBy: ["Dashboard"] },
      { method: "GET", path: "/api/uc/workflow-rules", description: "Get configurable UC workflow rules", tables: ["uc_workflow_rules"], usedBy: ["UC", "Settings"] },
      { method: "PUT", path: "/api/uc/workflow-rules", description: "Update UC workflow rules (batch upsert)", tables: ["uc_workflow_rules"], usedBy: ["Settings"] },
      { method: "POST", path: "/api/uc/backfill", description: "Backfill completions", tables: ["uc_completions"], usedBy: ["Settings"] },
    ],
  },
  {
    name: "Rebate Workflow",
    file: "server/routes/rebate-workflow.ts",
    endpoints: [
      { method: "POST", path: "/api/rebate/complete-action", description: "Log a rebate workflow completion", tables: ["rebate_completions"], usedBy: ["Rebates"] },
      { method: "POST", path: "/api/rebate/push-followup", description: "Push follow-up date and log completion", tables: ["rebate_completions"], usedBy: ["Rebates"] },
      { method: "GET", path: "/api/rebate/completions", description: "Get rebate completions with optional filters", tables: ["rebate_completions"], usedBy: ["Rebates"] },
      { method: "GET", path: "/api/rebate/completions/:projectId", description: "Get rebate completions for a specific project", tables: ["rebate_completions"], usedBy: ["Rebates"] },
      { method: "GET", path: "/api/rebate/kpi-stats", description: "Calculate rebate KPIs: submit time, approval time, rejection rate", tables: ["rebate_completions", "projects"], usedBy: ["Dashboard"] },
      { method: "GET", path: "/api/rebate/workflow-rules", description: "Get configurable rebate workflow rules", tables: ["rebate_workflow_rules"], usedBy: ["Rebates", "Settings"] },
      { method: "PUT", path: "/api/rebate/workflow-rules", description: "Update rebate workflow rules (batch upsert)", tables: ["rebate_workflow_rules"], usedBy: ["Settings"] },
      { method: "POST", path: "/api/rebate/backfill", description: "Backfill completions", tables: ["rebate_completions"], usedBy: ["Settings"] },
    ],
  },
  {
    name: "Escalation",
    file: "server/routes/escalation.ts",
    endpoints: [
      { method: "GET", path: "/api/escalation-tickets", description: "Get all escalation tickets, optional viewType filter", tables: ["escalation_tickets"], usedBy: ["All views", "Sidebar"] },
      { method: "POST", path: "/api/escalation-tickets", description: "Create escalation ticket with 48h hide period", tables: ["escalation_tickets"], usedBy: ["All views"] },
      { method: "PATCH", path: "/api/escalation-tickets/:id/respond", description: "Manager responds to ticket", tables: ["escalation_tickets"], usedBy: ["Escalated Tickets"] },
      { method: "PATCH", path: "/api/escalation-tickets/:id/resolve", description: "Resolve a ticket", tables: ["escalation_tickets"], usedBy: ["Escalated Tickets"] },
      { method: "GET", path: "/api/escalation-settings", description: "Get settings", tables: ["escalation_tickets"], usedBy: ["Settings"] },
      { method: "PUT", path: "/api/escalation-settings", description: "Update settings", tables: ["escalation_tickets"], usedBy: ["Settings"] },
      { method: "GET", path: "/api/escalation/kpi-stats", description: "KPI stats", tables: ["escalation_tickets"], usedBy: ["Dashboard"] },
      { method: "GET", path: "/api/escalation-tickets/:id", description: "Get ticket details", tables: ["escalation_tickets"], usedBy: ["Escalated Tickets"] },
      { method: "PATCH", path: "/api/escalation-tickets/:id/staff-reply", description: "Staff reply", tables: ["escalation_tickets"], usedBy: ["Escalated Tickets"] },
      { method: "PATCH", path: "/api/escalation-tickets/:id/snooze", description: "Snooze ticket", tables: ["escalation_tickets"], usedBy: ["Escalated Tickets"] },
      { method: "POST", path: "/api/escalation-tickets/:id/generate-summary", description: "AI summary", tables: ["escalation_tickets"], usedBy: ["Escalated Tickets"] },
      { method: "POST", path: "/api/escalation-tickets/generate-all-summaries", description: "Batch AI summaries", tables: ["escalation_tickets"], usedBy: ["Escalated Tickets"] },
    ],
  },
  {
    name: "Dashboard",
    file: "server/routes/dashboard.ts",
    endpoints: [
      { method: "GET", path: "/api/dashboard/stats", description: "Get dashboard stats: totals, overdue, on-track, breakdowns", tables: ["projects"], usedBy: ["Dashboard"] },
    ],
  },
  {
    name: "Workflow Config",
    file: "server/routes/workflow.ts",
    endpoints: [
      { method: "GET", path: "/api/workflow-config", description: "Get all stage workflow configurations", tables: ["workflow_config"], usedBy: ["Settings", "Gantt"] },
      { method: "PUT", path: "/api/workflow-config", description: "Update workflow stage configuration", tables: ["workflow_config"], usedBy: ["Settings"] },
    ],
  },
  {
    name: "HRSP Config",
    file: "server/routes.ts (inline)",
    endpoints: [
      { method: "GET", path: "/api/hrsp-config", description: "Get HRSP document requirements and invoice template", tables: ["hrsp_config"], usedBy: ["Rebates", "Settings"] },
      { method: "PUT", path: "/api/hrsp-config", description: "Update HRSP config (required docs, invoice template)", tables: ["hrsp_config"], usedBy: ["Settings"] },
    ],
  },
  {
    name: "Error Logs",
    file: "server/routes/error-logs.ts",
    endpoints: [
      { method: "GET", path: "/api/error-logs", description: "Get all error logs", tables: ["error_logs"], usedBy: ["Error Log"] },
      { method: "POST", path: "/api/error-logs", description: "Submit a frontend error with breadcrumbs", tables: ["error_logs"], usedBy: ["Error Logger (auto)"] },
      { method: "PATCH", path: "/api/error-logs/:id/resolve", description: "Mark error as resolved", tables: ["error_logs"], usedBy: ["Error Log"] },
      { method: "DELETE", path: "/api/error-logs/resolved", description: "Clear resolved error logs", tables: ["error_logs"], usedBy: ["Error Log"] },
    ],
  },
  {
    name: "Webhooks",
    file: "server/routes/webhook.ts",
    endpoints: [
      { method: "POST", path: "/api/webhooks/asana", description: "Receive Asana webhook events (handles handshake + debounced sync)", tables: ["projects"], usedBy: ["Asana (external)"] },
      { method: "POST", path: "/api/webhooks/setup", description: "Create Asana webhook for Project Manage Team", tables: [], usedBy: ["Settings"] },
      { method: "DELETE", path: "/api/webhooks/teardown", description: "Delete the active Asana webhook", tables: [], usedBy: ["Settings"] },
      { method: "GET", path: "/api/webhooks/status", description: "Check active webhook status and list existing ones", tables: [], usedBy: ["Settings"] },
    ],
  },
  {
    name: "Staff Management",
    file: "server/routes.ts",
    endpoints: [
      { method: "GET", path: "/api/staff", description: "List all staff members", tables: ["staff_members"], usedBy: ["Settings", "UC", "Rebates"] },
      { method: "POST", path: "/api/staff", description: "Create a new staff member", tables: ["staff_members"], usedBy: ["Settings"] },
      { method: "PATCH", path: "/api/staff/:id", description: "Update a staff member (name, role, active)", tables: ["staff_members"], usedBy: ["Settings"] },
      { method: "DELETE", path: "/api/staff/:id", description: "Delete a staff member", tables: ["staff_members"], usedBy: ["Settings"] },
    ],
  },
  {
    name: "Pause Reasons",
    file: "server/routes/pause-reasons.ts",
    endpoints: [
      { method: "GET", path: "/api/pause-reasons", description: "List reasons", tables: ["pause_reasons"], usedBy: ["Paused Projects"] },
      { method: "POST", path: "/api/pause-reasons", description: "Create reason", tables: ["pause_reasons"], usedBy: ["Settings"] },
      { method: "DELETE", path: "/api/pause-reasons/:id", description: "Delete reason", tables: ["pause_reasons"], usedBy: ["Settings"] },
      { method: "GET", path: "/api/pause-reasons/logs", description: "Get pause logs", tables: ["pause_reasons"], usedBy: ["Paused Projects", "Insights"] },
      { method: "POST", path: "/api/pause-reasons/logs", description: "Create pause log", tables: ["pause_reasons"], usedBy: ["All views"] },
      { method: "POST", path: "/api/pause-reasons/insights", description: "AI insights", tables: ["pause_reasons"], usedBy: ["Insights"] },
    ],
  },
  {
    name: "Contract Workflow",
    file: "server/routes/contract-workflow.ts",
    endpoints: [
      { method: "POST", path: "/api/contracts/complete-action", description: "Log a contract workflow completion (ready_for_review, follow_up, approved, etc.)", tables: ["contract_completions"], usedBy: ["Contracts"] },
      { method: "GET", path: "/api/contracts/completions", description: "List all contract completions with optional filters", tables: ["contract_completions"], usedBy: ["Contracts", "Dashboard", "Sidebar"] },
      { method: "GET", path: "/api/contracts/completions/:projectId", description: "Get completions for a specific project", tables: ["contract_completions"], usedBy: ["Contracts"] },
      { method: "GET", path: "/api/contracts/kpi-stats", description: "Calculate contract KPI metrics (throughput, avg times)", tables: ["contract_completions", "projects"], usedBy: ["Dashboard"] },
      { method: "GET", path: "/api/contracts/workflow-rules", description: "Get configurable contract workflow rules", tables: ["contract_workflow_rules"], usedBy: ["Settings", "Contracts"] },
      { method: "PUT", path: "/api/contracts/workflow-rules", description: "Update contract workflow rules (batch upsert)", tables: ["contract_workflow_rules"], usedBy: ["Settings"] },
      { method: "POST", path: "/api/contracts/backfill", description: "Backfill contract completions from existing task_actions", tables: ["contract_completions", "task_actions"], usedBy: ["Settings"] },
    ],
  },
  {
    name: "Claims",
    file: "server/routes/claims.ts",
    endpoints: [
      { method: "GET", path: "/api/claims", description: "Active claims", tables: ["task_claims"], usedBy: ["All views"] },
      { method: "POST", path: "/api/claims", description: "Create claim", tables: ["task_claims"], usedBy: ["All views"] },
      { method: "POST", path: "/api/claims/:id/complete", description: "Complete claim", tables: ["task_claims"], usedBy: ["All views"] },
      { method: "POST", path: "/api/claims/:id/release", description: "Release claim", tables: ["task_claims"], usedBy: ["All views"] },
      { method: "POST", path: "/api/claims/complete-by-project", description: "Complete by project", tables: ["task_claims"], usedBy: ["All views"] },
      { method: "GET", path: "/api/claims/history", description: "Claim history", tables: ["task_claims"], usedBy: ["Dashboard"] },
      { method: "GET", path: "/api/claims/kpi-stats", description: "KPI stats", tables: ["task_claims"], usedBy: ["Dashboard"] },
    ],
  },
  {
    name: "Misc (inline routes)",
    file: "server/routes.ts",
    endpoints: [
      { method: "PUT", path: "/api/deadlines", description: "Upsert a project deadline", tables: ["project_deadlines"], usedBy: ["Settings", "Gantt"] },
      { method: "GET", path: "/api/deadlines", description: "Get all project deadlines", tables: ["project_deadlines"], usedBy: ["Dashboard", "Project Profile"] },
      { method: "GET", path: "/api/install-schedules", description: "Get all install schedules", tables: ["install_schedule"], usedBy: ["Install Calendar"] },
      { method: "PUT", path: "/api/install-schedules", description: "Upsert install schedule entry", tables: ["install_schedule"], usedBy: ["Install Calendar"] },
      { method: "GET", path: "/api/subtasks/:gid/stories", description: "Fetch Asana subtask comments", tables: [], usedBy: ["UC", "Rebates"] },
      { method: "GET", path: "/api/subtasks/:gid/attachments", description: "Fetch Asana subtask attachments", tables: [], usedBy: ["UC", "Rebates"] },
      { method: "POST", path: "/api/subtasks/:gid/comment", description: "Post comment to Asana subtask", tables: [], usedBy: ["UC", "Rebates"] },
      { method: "POST", path: "/api/task-actions", description: "Create a task action (follow-up, status change)", tables: ["task_actions"], usedBy: ["All views"] },
      { method: "GET", path: "/api/task-actions/:viewType", description: "Get task actions for a view", tables: ["task_actions"], usedBy: ["All views"] },
      { method: "GET", path: "/api/task-actions/:viewType/follow-ups", description: "Get follow-up actions due today", tables: ["task_actions"], usedBy: ["All views"] },
      { method: "GET", path: "/api/asana/asset/:assetId", description: "Proxy Asana asset", tables: [], usedBy: ["All views"] },
      { method: "POST", path: "/api/subtasks/:gid/attachment", description: "Upload subtask attachment", tables: [], usedBy: ["UC", "Rebates"] },
    ],
  },
  {
    name: "Document Templates",
    file: "server/routes/document-templates.ts",
    endpoints: [
      { method: "POST", path: "/api/document-templates", description: "Upload a new template file (PDF/image)", tables: ["document_templates"], usedBy: ["Settings"] },
      { method: "GET", path: "/api/document-templates", description: "List templates, optional ?viewType filter", tables: ["document_templates", "template_fields"], usedBy: ["Settings", "Project Profile"] },
      { method: "GET", path: "/api/document-templates/:id", description: "Get template with its fields", tables: ["document_templates", "template_fields"], usedBy: ["Settings"] },
      { method: "DELETE", path: "/api/document-templates/:id", description: "Delete template and all fields", tables: ["document_templates", "template_fields"], usedBy: ["Settings"] },
      { method: "PATCH", path: "/api/document-templates/:id", description: "Update template metadata (name, enabled)", tables: ["document_templates"], usedBy: ["Settings"] },
      { method: "PUT", path: "/api/document-templates/:id/fields", description: "Bulk upsert all fields for a template", tables: ["template_fields"], usedBy: ["Settings"] },
      { method: "GET", path: "/api/document-templates/:id/preview", description: "Serve raw template file for visual editor", tables: ["document_templates"], usedBy: ["Settings"] },
      { method: "POST", path: "/api/document-templates/:id/generate", description: "Generate filled overlay document from template and values", tables: ["document_templates", "template_fields", "project_files"], usedBy: ["Project Profile"] },
      { method: "POST", path: "/api/document-templates/:id/generate-contract", description: "Upload client-generated contract PDF with signature audit", tables: ["document_templates", "project_files"], usedBy: ["Project Profile"] },
      { method: "POST", path: "/api/document-templates/:id/import-docx", description: "Import Word .docx file, convert to HTML via mammoth", tables: ["document_templates"], usedBy: ["Settings"] },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  POST: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  PATCH: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function ApiMapView() {
  const [search, setSearch] = useState("");

  const filteredGroups = apiGroups.map((g) => ({
    ...g,
    endpoints: g.endpoints.filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return e.path.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
        || e.tables.some((t) => t.includes(q)) || e.usedBy.some((u) => u.toLowerCase().includes(q));
    }),
  })).filter((g) => g.endpoints.length > 0);

  const totalEndpoints = apiGroups.reduce((sum, g) => sum + g.endpoints.length, 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl" data-testid="page-api-map">
      <div className="flex items-center gap-3">
        <Link href="/app-logic">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" data-testid="button-back-api">
            <ArrowLeft className="h-3.5 w-3.5" />
            App Logic
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">API Route Map</h1>
        <span className="text-xs text-muted-foreground">{totalEndpoints} endpoints</span>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search routes, tables, views..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-api"
        />
      </div>

      {filteredGroups.map((group) => (
        <Card key={group.name} data-testid={`card-api-group-${group.name.toLowerCase().replace(/[\s\/()]+/g, '-')}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{group.name}</CardTitle>
              <span className="text-[10px] text-muted-foreground font-mono">{group.file}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {group.endpoints.map((ep, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b last:border-0 border-border/50">
                <Badge className={`${methodColors[ep.method]} text-[10px] px-1.5 py-0 font-mono min-w-[42px] justify-center`}>
                  {ep.method}
                </Badge>
                <div className="flex-1 min-w-0">
                  <code className="text-[11px] font-mono text-foreground">{ep.path}</code>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{ep.description}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {ep.tables.map((t) => (
                      <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">{t}</span>
                    ))}
                    {ep.usedBy.map((u) => (
                      <span key={u} className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">{u}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
