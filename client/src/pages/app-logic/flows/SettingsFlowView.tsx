import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "page", type: "flowNode", position: { x: 350, y: 0 }, data: { label: "Settings Page (sync-view.tsx)", type: "component", description: "CollapsibleSection layout with 8 sections", items: ["Sync from Asana", "Real-Time Webhook", "Auto-Sync (Backup)", "Workflow Configuration", "HRSP Document Configuration", "UC Workflow Logic", "Rebate Workflow Logic", "Staff Members"] } },

  { id: "sync", type: "flowNode", position: { x: 0, y: 200 }, data: { label: "Sync from Asana", type: "action", description: "Manual full sync trigger", items: ["POST /api/asana/sync-all", "Syncs all tasks from 'Project Manage Team'", "Maps Asana custom fields to DB columns", "Updates projects table", "Shows synced count result"] } },

  { id: "auto-sync", type: "flowNode", position: { x: 0, y: 420 }, data: { label: "Auto-Sync (Backup)", type: "logic", description: "Automatic background sync", items: ["Every 15 minutes (server-side timer)", "Initial sync on server start", "Pulls Asana changes automatically", "Status changes in app → pushed immediately"] } },

  { id: "webhooks", type: "flowNode", position: { x: 0, y: 600 }, data: { label: "Webhook Management", type: "action", description: "Asana webhook for real-time sync", items: ["POST /api/webhooks/setup → create webhook", "DELETE /api/webhooks/teardown → remove webhook", "GET /api/webhooks/status → check status", "Receives events at /api/webhooks/asana", "Debounced 2s event queue", "Single-task sync on change", "Auto-setup on server start"] } },

  { id: "workflow", type: "flowNode", position: { x: 300, y: 200 }, data: { label: "WorkflowEditor", type: "component", description: "Visual stage dependency editor", items: ["GET /api/workflow-config", "PUT /api/workflow-config", "Define dependsOn for each stage", "Set gapDays between stages", "Timeline overview visualization", "StageCard for each workflow stage"] } },

  { id: "hrsp", type: "flowNode", position: { x: 300, y: 440 }, data: { label: "HrspConfigEditor", type: "component", description: "HRSP document & invoice config", items: ["GET /api/hrsp-config", "PUT /api/hrsp-config", "Toggle required docs on/off per phase", "Edit invoice template values", "Company info, equipment specs, pricing", "Download sample invoice PDF"] } },

  { id: "uc-rules", type: "flowNode", position: { x: 600, y: 200 }, data: { label: "UcWorkflowLogicEditor", type: "component", description: "UC workflow rule configuration", items: ["GET /api/uc/workflow-rules", "PUT /api/uc/workflow-rules", "Edit hideDays per trigger action", "Toggle requiresFiles, requiresNotes", "Toggle autoEscalate per rule", "Enable/disable individual rules"] } },

  { id: "rebate-rules", type: "flowNode", position: { x: 600, y: 440 }, data: { label: "RebateWorkflowLogicEditor", type: "component", description: "Rebate workflow rule configuration", items: ["GET /api/rebate/workflow-rules", "PUT /api/rebate/workflow-rules", "6 rules: status_to_in_progress, status_to_submitted, etc.", "Configure followUpDays, closeoff_due_window", "All delay values read by rebate view + backend"] } },

  { id: "staff", type: "flowNode", position: { x: 600, y: 660 }, data: { label: "StaffManager", type: "component", description: "Staff member management", items: ["GET /api/staff", "POST /api/staff (create)", "PATCH /api/staff/:id (update)", "DELETE /api/staff/:id", "Name, role, active toggle", "Used in completion dialogs for staff selection"] } },

  { id: "db-workflow", type: "flowNode", position: { x: 300, y: 660 }, data: { label: "Tables Used", type: "data", description: "Database tables modified by settings", items: ["workflow_config → stage dependencies", "hrsp_config → document requirements", "uc_workflow_rules → UC hide/escalation rules", "rebate_workflow_rules → rebate delays", "staff_members → team roster", "projects → updated during sync"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "page", target: "sync" },
  { id: "e2", source: "page", target: "workflow" },
  { id: "e3", source: "page", target: "uc-rules" },
  { id: "e4", source: "sync", target: "auto-sync", label: "related" },
  { id: "e9", source: "page", target: "webhooks" },
  { id: "e10", source: "auto-sync", target: "webhooks", label: "real-time alternative", style: { strokeDasharray: "5 5" } },
  { id: "e5", source: "page", target: "hrsp" },
  { id: "e11", source: "page", target: "rebate-rules" },
  { id: "e12", source: "page", target: "staff" },
  { id: "e6", source: "workflow", target: "db-workflow" },
  { id: "e7", source: "hrsp", target: "db-workflow" },
  { id: "e8", source: "uc-rules", target: "db-workflow" },
  { id: "e13", source: "rebate-rules", target: "db-workflow" },
  { id: "e14", source: "staff", target: "db-workflow" },
].map(e => ({ ...e, style: { stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function SettingsFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-settings">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Settings — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Page: client/src/pages/sync-view.tsx | Components: client/src/components/settings/</p>
      </div>
      <div className="flex-1">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypes} fitView minZoom={0.2} maxZoom={2}>
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
