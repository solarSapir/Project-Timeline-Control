import { useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface TableColumn {
  name: string;
  type: string;
  note?: string;
}

interface TableDef {
  name: string;
  domain: string;
  columns: TableColumn[];
}

const tables: TableDef[] = [
  {
    name: "users", domain: "core",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "username", type: "text unique" },
      { name: "password", type: "text" },
    ],
  },
  {
    name: "projects", domain: "core",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "asanaGid", type: "text unique" },
      { name: "name", type: "text" },
      { name: "installType", type: "text" },
      { name: "pmStatus", type: "text" },
      { name: "ucStatus / ahjStatus / ...", type: "text", note: "7 status fields" },
      { name: "province", type: "text" },
      { name: "projectCreatedDate", type: "date" },
      { name: "*DueDate (x6)", type: "date", note: "uc, ahj, contract, siteVisit, install, closeOff" },
      { name: "ucTeam", type: "text" },
      { name: "ucSubmittedDate", type: "text" },
      { name: "rebateSubmittedDate", type: "text" },
      { name: "rebateCloseOffDate", type: "text" },
      { name: "hrspStatus / hrspSubtaskGid", type: "text" },
      { name: "hrsp*Url (x10)", type: "text", note: "Invoice, auth, SLD, roof, etc." },
      { name: "hydroBill* (x4)", type: "text", note: "url, company, account, customer" },
      { name: "payment booleans (x4)", type: "boolean" },
      { name: "asanaCustomFields", type: "jsonb" },
      { name: "lastSyncedAt / createdAt", type: "timestamp" },
      { name: "lastUnpausedDate", type: "text" },
      { name: "ucConnectionFee", type: "text" },
      { name: "ucMeterbaseUrl", type: "text" },
      { name: "planner* (x9)", type: "text/boolean", note: "scope, proposal, sitePlan, cost, payout, contractSent, contractSigned" },
      { name: "electricalPermitUrl", type: "text" },
      { name: "electricalPermitUploadedAt", type: "timestamp" },
      { name: "pauseReason", type: "text" },
      { name: "pauseNote", type: "text" },
      { name: "pauseReasonSetAt", type: "timestamp" },
    ],
  },
  {
    name: "project_deadlines", domain: "core",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "projectId", type: "varchar FK→projects" },
      { name: "stage", type: "text" },
      { name: "targetDate / actualDate", type: "date" },
      { name: "status", type: "text" },
    ],
  },
  {
    name: "task_actions", domain: "workflow",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "projectId", type: "varchar FK→projects" },
      { name: "viewType", type: "text" },
      { name: "actionType", type: "text" },
      { name: "completedBy", type: "text" },
      { name: "followUpDate", type: "date" },
      { name: "notes", type: "text" },
      { name: "completedAt", type: "timestamp" },
    ],
  },
  {
    name: "install_schedule", domain: "workflow",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "projectId", type: "varchar FK→projects" },
      { name: "taskType", type: "text" },
      { name: "scheduledDate", type: "date" },
      { name: "duration", type: "integer" },
      { name: "status", type: "text", note: "default: pending" },
      { name: "installerName", type: "text" },
      { name: "notes", type: "text" },
    ],
  },
  {
    name: "workflow_config", domain: "workflow",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "stage", type: "text unique" },
      { name: "targetDays", type: "integer" },
      { name: "dependsOn", type: "text[]" },
      { name: "gapRelativeTo", type: "text" },
      { name: "completionCriteria", type: "text[]" },
    ],
  },
  {
    name: "project_files", domain: "documents",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "projectId", type: "varchar FK→projects" },
      { name: "category", type: "text" },
      { name: "fileName / storedName", type: "text" },
      { name: "mimeType", type: "text" },
      { name: "fileSize", type: "integer" },
      { name: "uploadedBy / notes", type: "text" },
      { name: "createdAt", type: "timestamp" },
    ],
  },
  {
    name: "hrsp_config", domain: "documents",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "invoiceTemplate", type: "jsonb" },
      { name: "requiredDocuments", type: "jsonb" },
      { name: "updatedAt", type: "timestamp" },
    ],
  },
  {
    name: "escalation_tickets", domain: "escalation",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "projectId", type: "varchar FK→projects" },
      { name: "viewType", type: "text" },
      { name: "createdBy / issue", type: "text" },
      { name: "status", type: "text", note: "open/responded/resolved" },
      { name: "managerResponse", type: "text" },
      { name: "respondedBy", type: "text" },
      { name: "respondedAt / resolvedAt", type: "timestamp" },
      { name: "hideUntil", type: "timestamp" },
      { name: "staffReply", type: "text" },
      { name: "staffReplyAt", type: "timestamp" },
      { name: "snoozedUntil", type: "timestamp" },
      { name: "aiSummary", type: "text" },
      { name: "createdAt", type: "timestamp" },
    ],
  },
  {
    name: "uc_completions", domain: "kpi",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "projectId", type: "varchar FK→projects" },
      { name: "staffName", type: "text" },
      { name: "actionType", type: "text", note: "status_change/follow_up" },
      { name: "fromStatus / toStatus", type: "text" },
      { name: "notes", type: "text" },
      { name: "hideDays", type: "integer" },
      { name: "completedAt", type: "timestamp" },
    ],
  },
  {
    name: "uc_workflow_rules", domain: "kpi",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "triggerAction", type: "text unique" },
      { name: "hideDays", type: "integer" },
      { name: "requiresFiles/Notes", type: "boolean" },
      { name: "autoEscalate", type: "boolean" },
      { name: "label / description", type: "text" },
      { name: "enabled", type: "boolean" },
    ],
  },
  {
    name: "rebate_completions", domain: "kpi",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "projectId", type: "varchar FK→projects" },
      { name: "staffName", type: "text" },
      { name: "actionType", type: "text", note: "status_change/follow_up_push" },
      { name: "fromStatus / toStatus", type: "text" },
      { name: "notes", type: "text" },
      { name: "hideDays", type: "integer" },
      { name: "followUpDate", type: "text" },
      { name: "completedAt", type: "timestamp" },
    ],
  },
  {
    name: "rebate_workflow_rules", domain: "kpi",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "triggerAction", type: "text unique" },
      { name: "hideDays", type: "integer", note: "default: 5" },
      { name: "requiresFiles/Notes", type: "boolean" },
      { name: "autoEscalate", type: "boolean" },
      { name: "label / description", type: "text" },
      { name: "enabled", type: "boolean" },
    ],
  },
  {
    name: "error_logs", domain: "system",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "errorMessage", type: "text" },
      { name: "errorSource", type: "text" },
      { name: "pageUrl", type: "text" },
      { name: "userActions", type: "jsonb" },
      { name: "apiEndpoint / apiMethod", type: "text" },
      { name: "apiPayload", type: "text" },
      { name: "stackTrace", type: "text" },
      { name: "resolved", type: "boolean" },
      { name: "resolvedNote", type: "text" },
      { name: "createdAt", type: "timestamp" },
    ],
  },
  {
    name: "staff_members", domain: "system",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "name", type: "text" },
      { name: "role", type: "text" },
      { name: "active", type: "boolean", note: "default: true" },
      { name: "createdAt", type: "timestamp" },
    ],
  },
  {
    name: "pause_reasons", domain: "workflow",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "name", type: "text" },
      { name: "createdAt", type: "timestamp" },
    ],
  },
  {
    name: "pause_logs", domain: "workflow",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "projectId", type: "varchar FK→projects" },
      { name: "reason", type: "text" },
      { name: "note", type: "text" },
      { name: "staffName", type: "text" },
      { name: "pausedAt", type: "timestamp" },
    ],
  },
  {
    name: "task_claims", domain: "kpi",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "projectId", type: "varchar FK→projects" },
      { name: "viewType", type: "text" },
      { name: "staffName", type: "text" },
      { name: "active", type: "boolean", note: "default: true" },
      { name: "completionAction", type: "text" },
      { name: "claimedAt", type: "timestamp" },
      { name: "completedAt", type: "timestamp" },
    ],
  },
  {
    name: "contract_completions", domain: "kpi",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "projectId", type: "varchar FK→projects" },
      { name: "staffName", type: "text" },
      { name: "actionType", type: "text", note: "ready_for_review, follow_up, contract_approved, etc." },
      { name: "fromStatus", type: "text" },
      { name: "toStatus", type: "text" },
      { name: "notes", type: "text" },
      { name: "hideDays", type: "integer", note: "default: 0" },
      { name: "completedAt", type: "timestamp" },
    ],
  },
  {
    name: "contract_workflow_rules", domain: "kpi",
    columns: [
      { name: "id", type: "varchar PK" },
      { name: "triggerAction", type: "text unique" },
      { name: "hideDays", type: "integer", note: "default: 1" },
      { name: "requiresFiles", type: "boolean" },
      { name: "requiresNotes", type: "boolean" },
      { name: "autoEscalate", type: "boolean" },
      { name: "label", type: "text" },
      { name: "description", type: "text" },
      { name: "enabled", type: "boolean" },
    ],
  },
];

const domainColors: Record<string, { bg: string; border: string; label: string }> = {
  core: { bg: "#dbeafe", border: "#3b82f6", label: "Core" },
  workflow: { bg: "#dcfce7", border: "#22c55e", label: "Workflow" },
  documents: { bg: "#f3e8ff", border: "#a855f7", label: "Documents" },
  escalation: { bg: "#fef3c7", border: "#f59e0b", label: "Escalation" },
  kpi: { bg: "#ffedd5", border: "#f97316", label: "KPI" },
  system: { bg: "#f3f4f6", border: "#6b7280", label: "System" },
};

function TableNode({ data }: { data: { table: TableDef } }) {
  const t = data.table;
  const dc = domainColors[t.domain];
  return (
    <div
      style={{ borderColor: dc.border, backgroundColor: dc.bg, minWidth: 220 }}
      className="rounded-lg border-2 shadow-md text-xs"
    >
      <div
        style={{ backgroundColor: dc.border }}
        className="px-3 py-1.5 rounded-t-md text-white font-bold text-[11px] flex items-center justify-between"
      >
        <span>{t.name}</span>
        <span className="text-[9px] opacity-80">{dc.label}</span>
      </div>
      <div className="px-2 py-1.5 space-y-0.5">
        {t.columns.map((col, i) => (
          <div key={i} className="flex justify-between gap-2 text-[10px] leading-tight">
            <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{col.name}</span>
            <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{col.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const nodeTypes = { tableNode: TableNode };

const positions: Record<string, { x: number; y: number }> = {
  users: { x: 0, y: 0 },
  projects: { x: 300, y: 0 },
  project_deadlines: { x: 700, y: 0 },
  task_actions: { x: 0, y: 420 },
  install_schedule: { x: 280, y: 420 },
  workflow_config: { x: 560, y: 420 },
  pause_reasons: { x: 840, y: 420 },
  pause_logs: { x: 840, y: 700 },
  project_files: { x: 0, y: 700 },
  hrsp_config: { x: 280, y: 700 },
  escalation_tickets: { x: 560, y: 700 },
  uc_completions: { x: 1100, y: 0 },
  uc_workflow_rules: { x: 1100, y: 280 },
  rebate_completions: { x: 1100, y: 520 },
  rebate_workflow_rules: { x: 1100, y: 780 },
  task_claims: { x: 1100, y: 1020 },
  error_logs: { x: 0, y: 1020 },
  staff_members: { x: 280, y: 1020 },
  contract_completions: { x: 550, y: 1200 },
  contract_workflow_rules: { x: 830, y: 1200 },
};

const initialNodes: Node[] = tables.map((t) => ({
  id: t.name,
  type: "tableNode",
  position: positions[t.name] || { x: 0, y: 0 },
  data: { table: t },
}));

const fkEdges: Edge[] = [
  "project_deadlines", "task_actions", "install_schedule", "project_files",
  "escalation_tickets", "uc_completions", "rebate_completions", "task_claims", "pause_logs",
  "contract_completions",
].map((source) => ({
  id: `${source}-projects`,
  source,
  target: "projects",
  animated: true,
  style: { stroke: "#94a3b8", strokeWidth: 1.5 },
  label: "projectId",
  labelStyle: { fontSize: 9, fill: "#94a3b8" },
}));

export default function SchemaView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(fkEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-schema">
      <div className="p-4 border-b flex items-center gap-3">
        <Link href="/app-logic">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" data-testid="button-back-schema">
            <ArrowLeft className="h-3.5 w-3.5" />
            App Logic
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Database Schema</h1>
        <span className="text-xs text-muted-foreground">{tables.length} tables</span>
        <div className="flex gap-2 ml-auto">
          {Object.entries(domainColors).map(([key, dc]) => (
            <div key={key} className="flex items-center gap-1 text-[10px]">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: dc.border }} />
              <span className="text-muted-foreground">{dc.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={2}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeStrokeWidth={2}
            nodeColor={(node) => {
              const t = tables.find((t) => t.name === node.id);
              return t ? domainColors[t.domain].border : "#ccc";
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
