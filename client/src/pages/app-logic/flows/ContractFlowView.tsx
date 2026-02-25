import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data", type: "flowNode", position: { x: 150, y: 0 }, data: { label: "Fetch Data", type: "data", items: ["GET /api/projects", "GET /api/asana/field-options/contractStatus", "GET /api/workflow-config", "GET /api/escalation-tickets", "GET /api/task-actions/contracts"] } },

  { id: "filter", type: "flowNode", position: { x: 150, y: 180 }, data: { label: "Filter & Gate", type: "filter", description: "Dependency gating + status filters", items: ["installType = 'install', residential only", "Check workflow_config dependencies", "Projects not meeting deps → WaitingDepsCard", "Passed deps → ContractCard", "Filters: Needs Action, Follow-Up Due, etc."] } },

  { id: "waiting-card", type: "flowNode", position: { x: 0, y: 360 }, data: { label: "WaitingDepsCard", type: "component", description: "Shows blocked projects", items: ["Displays which dependencies are unmet", "e.g. 'Waiting on UC Approval'", "No actions available, view-only"] } },

  { id: "contract-card", type: "flowNode", position: { x: 300, y: 360 }, data: { label: "ContractCard", type: "component", description: "Active contract project card", items: ["Status badge + due indicator", "ContractActions: follow-up, document, approve buttons", "EscalationBadge + EscalationDialog", "Follow-up needed indicator", "Status dropdown for contractStatus"] } },

  { id: "approve-dialog", type: "flowNode", position: { x: 0, y: 560 }, data: { label: "ContractApproveDialog", type: "dialog", description: "Approve a contract", items: ["Fields: staff name, notes", "PATCH contractStatus → Approved", "Creates task_action record", "Invalidates projects cache"] } },

  { id: "followup-dialog", type: "flowNode", position: { x: 300, y: 560 }, data: { label: "ContractFollowUpDialog", type: "dialog", description: "Log follow-up activity", items: ["Fields: 'What has been done' + 'Next Steps'", "POST /api/task-actions", "Sets follow-up date for reappear", "Comment posted to Asana task"] } },

  { id: "docs-dialog", type: "flowNode", position: { x: 600, y: 560 }, data: { label: "ContractDocumentsDialog", type: "dialog", description: "Upload contract documents", items: ["POST /api/projects/:id/files (category=contract)", "Multiple file upload", "Files stored locally at data/uploads/"] } },

  { id: "status-change", type: "flowNode", position: { x: 900, y: 360 }, data: { label: "Status Change", type: "action", description: "Change contract status", items: ["PATCH /api/projects/:id with contractStatus", "Pushes to Asana custom field", "Invalidates projects cache"] } },

  { id: "escalation", type: "flowNode", position: { x: 900, y: 560 }, data: { label: "Escalation Flow", type: "action", description: "\"I'm Stuck\" → ticket → hide → manager → reappear", items: ["EscalationDialog: staff enters name + issue", "POST /api/escalation-tickets (viewType: contracts)", "Project hidden 48h from Needs Action list", "EscalationBadge: red 'Escalated' → green 'Response Available'", "Manager responds on /escalated page", "Staff clicks 'Mark Resolved' → project reappears", "See: Escalated Tickets flow for full lifecycle"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data", target: "filter", animated: true },
  { id: "e2", source: "filter", target: "waiting-card", label: "deps not met" },
  { id: "e3", source: "filter", target: "contract-card", label: "deps met" },
  { id: "e4", source: "contract-card", target: "approve-dialog" },
  { id: "e5", source: "contract-card", target: "followup-dialog" },
  { id: "e6", source: "contract-card", target: "docs-dialog" },
  { id: "e7", source: "contract-card", target: "status-change" },
  { id: "e8", source: "contract-card", target: "escalation", label: "I'm Stuck" },
  { id: "e9", source: "escalation", target: "filter", label: "hides project 48h", style: { strokeDasharray: "5 5" } },
].map(e => ({ ...e, style: { ...e.style, stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function ContractFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-contracts">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Contracts — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Pages: contracts-view.tsx, contract-creation-view.tsx | Components: client/src/components/contracts/</p>
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
