import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data-projects", type: "flowNode", position: { x: 0, y: 0 }, data: { label: "Fetch Projects", type: "data", description: "GET /api/projects", items: ["useQuery queryKey: ['/api/projects']"] } },
  { id: "data-options", type: "flowNode", position: { x: 300, y: 0 }, data: { label: "Fetch Rebate Options", type: "data", description: "GET /api/asana/field-options/rebateStatus", items: ["GRANTS STATUS dropdown values from Asana"] } },

  { id: "filter", type: "flowNode", position: { x: 150, y: 160 }, data: { label: "Filter Projects", type: "filter", description: "Load Displacement ON (Ontario) only", items: ["installType = 'install'", "residential only", "ucTeam includes 'load displacement'", "province includes 'ontario'", "Exclude paused/lost/complete (pmStatus)", "Exclude 'Pre approved, waiting for job to complete'", "Re-appears when status changes to Close-off"] } },

  { id: "sort", type: "flowNode", position: { x: 450, y: 160 }, data: { label: "Sort & Sub-filters", type: "filter", description: "Multiple filter options", items: ["All / Needs Attention / Needs Follow-Up", "HRSP Issues / Not Required", "Follow-up needed → top (amber border)", "HRSP issues → next (red border)"] } },

  { id: "card", type: "flowNode", position: { x: 150, y: 340 }, data: { label: "Rebate Card", type: "component", description: "Each card shows project + HRSP info", items: ["Rebate status badge (from GRANTS STATUS)", "Load Displacement ON badge", "HrspInfo: HRSP subtask status + overdue", "HrspChecklist: document checklist", "Close-off due date (14d from closeOffDate)", "Follow Up button → RebateFollowUpDialog", "EscalationBadge + EscalationDialog", "Focus button → RebateProjectModal"] } },

  { id: "status-change", type: "flowNode", position: { x: 0, y: 520 }, data: { label: "handleRebateStatus()", type: "action", description: "Status dropdown change handler", items: ["PATCH /api/projects/:id with rebateStatus", "If 'Close-off': also sets rebateCloseOffDate", "If 'Close-off - Submitted': opens CloseOffSubmittedDialog", "If '100% complete': auto-completes HRSP subtask", "Pushes to Asana via backend"] } },

  { id: "closeoff-submitted", type: "flowNode", position: { x: 0, y: 720 }, data: { label: "CloseOffSubmittedDialog", type: "dialog", description: "Required when changing to Close-off - Submitted", items: ["Fields: staff name, screenshot upload (required)", "POST files to /api/projects/:id/files (category=rebates)", "POST /api/rebate/complete-action", "Records KPI completion entry", "Status badge = teal"] } },

  { id: "closeoff-due", type: "flowNode", position: { x: 300, y: 520 }, data: { label: "Close-Off Due Date", type: "logic", description: "14 days from close-off status change", items: ["rebateCloseOffDate + 14 days = due date", "Red if overdue, amber if ≤3 days", "Shown on card metadata line", "Different from project creation due date"] } },

  { id: "hrsp-checklist", type: "flowNode", position: { x: 0, y: 920 }, data: { label: "HrspChecklist", type: "component", description: "Two-phase document tracking", items: ["Pre-Approval: Invoice, Participation Doc, Hydro Bill, SLD", "Close-Off: Roof Photos, Panel/Inverter/Battery Nameplates, ESA Cert, Paid Invoice", "Pre-approval grayed when post-approval", "Each doc: upload button → POST /api/projects/:id/hrsp-*", "Invoice/Paid Invoice: generate PDF dialogs"] } },

  { id: "followup", type: "flowNode", position: { x: 300, y: 920 }, data: { label: "Follow-Up System", type: "logic", description: "5-day follow-up cycle", items: ["rebateSubmittedDate tracks status change", "In-progress, Submitted, or Close-off - Submitted → 5d cycle", "Cards show amber border when due", "RebateFollowUpDialog: action taken + next steps", "Posts to HRSP subtask (not main task)", "POST /api/rebate/push-followup"] } },

  { id: "focus-modal", type: "flowNode", position: { x: 600, y: 340 }, data: { label: "RebateProjectModal", type: "dialog", description: "Full project view in modal", items: ["Project details + status info", "HrspChecklist (interactive)", "Follow-up section with dialog", "HRSP subtask stories/comments", "HRSP subtask attachments", "Fetches from /api/subtasks/:gid/*"] } },

  { id: "kpi", type: "flowNode", position: { x: 600, y: 520 }, data: { label: "RebateKpiSection (Dashboard)", type: "component", description: "KPI cards on dashboard page", items: ["This Week completions", "Avg Tasks/Day, Avg Days to Submit", "Avg Days to Hear Back, Rejection Rate", "Daily completions bar chart (30 days)", "GET /api/rebate/kpi-stats"] } },

  { id: "escalation", type: "flowNode", position: { x: 600, y: 720 }, data: { label: "Escalation Flow", type: "action", description: "\"I'm Stuck\" → ticket → hide → manager → reappear", items: ["EscalationDialog: staff enters name + issue", "POST /api/escalation-tickets (viewType: payments)", "Project hidden 48h from Needs Action list", "EscalationBadge: red 'Escalated' → green 'Response Available'", "Manager responds on /escalated page", "Staff clicks 'Mark Resolved' → project reappears", "See: Escalated Tickets flow for full lifecycle"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data-projects", target: "filter", animated: true },
  { id: "e2", source: "data-options", target: "card" },
  { id: "e3", source: "filter", target: "sort" },
  { id: "e4", source: "sort", target: "card" },
  { id: "e5", source: "card", target: "status-change" },
  { id: "e6", source: "status-change", target: "closeoff-due", label: "if close-off" },
  { id: "e11", source: "status-change", target: "closeoff-submitted", label: "if close-off submitted" },
  { id: "e7", source: "card", target: "hrsp-checklist" },
  { id: "e8", source: "card", target: "followup" },
  { id: "e9", source: "card", target: "focus-modal" },
  { id: "e10", source: "kpi", target: "data-projects", label: "reads completions", style: { strokeDasharray: "5 5" } },
  { id: "e12", source: "card", target: "escalation", label: "I'm Stuck" },
  { id: "e13", source: "escalation", target: "filter", label: "hides project 48h", style: { strokeDasharray: "5 5" } },
].map(e => ({ ...e, style: { ...e.style, stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function RebateFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-rebates">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Rebates — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Page: client/src/pages/payments-view.tsx | Components: client/src/components/hrsp/</p>
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
