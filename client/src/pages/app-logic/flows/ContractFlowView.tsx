import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data", type: "flowNode", position: { x: 150, y: 0 }, data: { label: "Fetch Data", type: "data", items: ["GET /api/projects", "GET /api/asana/field-options/contractStatus", "GET /api/workflow-config", "GET /api/escalation-tickets", "GET /api/task-actions/contracts", "GET /api/contracts/completions", "GET /api/contracts/workflow-rules"] } },

  { id: "filter", type: "flowNode", position: { x: 150, y: 200 }, data: { label: "Filter & Gate", type: "filter", description: "Dependency gating + status filters + hide logic", items: ["installType = 'install', residential only", "Check workflow_config dependencies", "Projects not meeting deps → WaitingDepsCard", "Passed deps → ContractCard", "Filters: To Create, Ready for Review, Needs Follow-up, Hidden, All", "isHiddenByWorkflow: latest completion hideDays + completedAt > now"] } },

  { id: "waiting-card", type: "flowNode", position: { x: 0, y: 400 }, data: { label: "WaitingDepsCard", type: "component", description: "Shows blocked projects", items: ["Displays which dependencies are unmet", "e.g. 'Waiting on UC Approval'", "No actions available, view-only"] } },

  { id: "contract-card", type: "flowNode", position: { x: 300, y: 400 }, data: { label: "ContractCard", type: "component", description: "Active contract project card", items: ["Status badge + due indicator", "ContractActions: follow-up, document, approve buttons", "Ready for Review button (when docs uploaded, not yet reviewed)", "Review status badge: Under Review / Needs Follow-up", "EscalationBadge + EscalationDialog", "Follow-up needed indicator"] } },

  { id: "ready-review", type: "flowNode", position: { x: 0, y: 600 }, data: { label: "Ready for Review", type: "action", description: "Mark contract ready for manager review", items: ["POST /api/contracts/complete-action", "actionType: ready_for_review", "hideDays from contract_workflow_rules (default 1)", "Project hidden for 24h", "Logs contract_completions record"] } },

  { id: "review-followup", type: "flowNode", position: { x: 300, y: 600 }, data: { label: "ContractReviewFollowUpDialog", type: "dialog", description: "Follow-up after review period expires", items: ["Appears when project reappears after hide", "Fields: 'What was reviewed' + 'Next Steps'", "POST /api/contracts/complete-action (follow_up)", "Can re-hide or approve contract"] } },

  { id: "approve-dialog", type: "flowNode", position: { x: 0, y: 800 }, data: { label: "ContractApproveDialog", type: "dialog", description: "Approve a contract", items: ["Fields: staff name, notes", "PATCH contractStatus → Approved", "Creates task_action + contract_completion record", "Invalidates projects cache"] } },

  { id: "followup-dialog", type: "flowNode", position: { x: 300, y: 800 }, data: { label: "ContractFollowUpDialog", type: "dialog", description: "Log follow-up activity", items: ["Fields: 'What has been done' + 'Next Steps'", "POST /api/task-actions", "Sets follow-up date for reappear", "Comment posted to Asana task"] } },

  { id: "docs-dialog", type: "flowNode", position: { x: 600, y: 600 }, data: { label: "ContractDocumentsDialog", type: "dialog", description: "Upload contract documents", items: ["POST /api/projects/:id/files (category=contract)", "Multiple file upload", "Files stored locally at data/uploads/", "Logs contract_completion (document_upload)"] } },

  { id: "status-change", type: "flowNode", position: { x: 900, y: 400 }, data: { label: "Status Change", type: "action", description: "Change contract status", items: ["PATCH /api/projects/:id with contractStatus", "Pushes to Asana custom field", "Invalidates projects cache"] } },

  { id: "escalation", type: "flowNode", position: { x: 900, y: 600 }, data: { label: "Escalation Flow", type: "action", description: "\"I'm Stuck\" lifecycle", items: ["EscalationDialog: staff enters name + issue", "POST /api/escalation-tickets (viewType: contracts)", "Project hidden 48h from Needs Action list", "Manager responds on /escalated page", "Staff clicks 'Mark Resolved' → project reappears", "See: Escalated Tickets flow for full lifecycle"] } },

  { id: "kpi", type: "flowNode", position: { x: 600, y: 800 }, data: { label: "Contract KPI Dashboard", type: "data", description: "Dashboard section with contract metrics", items: ["GET /api/contracts/kpi-stats", "This Week (completions count)", "Avg Tasks/Day, Avg Days to Upload", "Avg Days to Review, Sign, Deposit", "Daily completions bar chart (30 days)", "CompletionsDrilldown dialog"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data", target: "filter", animated: true },
  { id: "e2", source: "filter", target: "waiting-card", label: "deps not met" },
  { id: "e3", source: "filter", target: "contract-card", label: "deps met" },
  { id: "e4", source: "contract-card", target: "ready-review", label: "docs uploaded" },
  { id: "e5", source: "contract-card", target: "review-followup", label: "reappeared" },
  { id: "e6", source: "contract-card", target: "docs-dialog" },
  { id: "e7", source: "contract-card", target: "status-change" },
  { id: "e8", source: "contract-card", target: "escalation", label: "I'm Stuck" },
  { id: "e9", source: "ready-review", target: "filter", label: "hides 24h", style: { strokeDasharray: "5 5" } },
  { id: "e10", source: "review-followup", target: "approve-dialog", label: "approve" },
  { id: "e11", source: "review-followup", target: "followup-dialog", label: "follow-up" },
  { id: "e12", source: "escalation", target: "filter", label: "hides 48h", style: { strokeDasharray: "5 5" } },
  { id: "e13", source: "data", target: "kpi", label: "KPI stats", style: { strokeDasharray: "5 5" } },
].map(e => ({ ...e, style: { ...e.style, stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function ContractFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-contracts">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Contracts — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Pages: payment-method-view.tsx, contracts-view.tsx | Components: client/src/components/contracts/</p>
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
