import { useCallback } from "react";
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data-projects", type: "flowNode", position: { x: 0, y: 0 }, data: { label: "Fetch Projects", type: "data", description: "GET /api/projects → all projects from DB", items: ["useQuery queryKey: ['/api/projects']", "Returns Project[] array"] } },
  { id: "data-options", type: "flowNode", position: { x: 300, y: 0 }, data: { label: "Fetch UC Status Options", type: "data", description: "GET /api/asana/field-options/ucStatus", items: ["Dropdown options from Asana custom field", "Used in status change Select"] } },
  { id: "data-tickets", type: "flowNode", position: { x: 600, y: 0 }, data: { label: "Fetch Escalation Tickets", type: "data", description: "GET /api/escalation-tickets", items: ["Filters for viewType='uc'", "Open tickets hide projects for 48h"] } },
  { id: "data-completions", type: "flowNode", position: { x: 900, y: 0 }, data: { label: "Fetch UC Completions", type: "data", description: "GET /api/uc/completions", items: ["Used for hide/reappear logic", "hideDays + completedAt = hideUntil"] } },

  { id: "filter", type: "flowNode", position: { x: 300, y: 180 }, data: { label: "Filter Projects", type: "filter", description: "Only show relevant UC projects", items: ["installType = 'install' OR 'diy'", "propertySector: residential, multi-residential (or null)", "DIY projects only appear in UC tab", "Exclude: complete, paused, lost", "Hide: escalation-hidden + workflow-hidden"] } },

  { id: "planner-gate", type: "flowNode", position: { x: 0, y: 180 }, data: { label: "Waiting for Planner Gate", type: "logic", description: "isPlannerIncomplete() hides Install projects missing planner prerequisites", items: ["Checks: scope, proposal, site plan defined", "Checks: total cost, contractor payout set", "Checks: contractor assigned", "Checks: contract sent & signed", "NS projects: electrical permit required", "Install projects only (not DIY)", "Incomplete → hidden from UC view until planner done"] } },

  { id: "sort", type: "flowNode", position: { x: 600, y: 180 }, data: { label: "Sort Projects", type: "logic", description: "Priority-based sorting", items: ["Follow-up needed (7+ days submitted) → top", "Overdue (past due date) → next", "By days until due date ascending"] } },

  { id: "card", type: "flowNode", position: { x: 300, y: 380 }, data: { label: "UCProjectCard", type: "component", description: "Renders each project as a card", items: ["Status badge + due date indicator", "Province badge (e.g. ON, NS)", "Property sector badge (residential, multi-residential)", "Contractor badge (assigned contractor name)", "ClaimButton (task claiming for KPI tracking)", "Hydro bill info section", "UC document checklist", "Subtask expand panel", "Escalation badge", "Status change dropdown"] } },

  { id: "status-change", type: "flowNode", position: { x: 0, y: 580 }, data: { label: "handleStatusChange()", type: "action", description: "Intercepts status dropdown changes", items: ["If 'Approved' → open ApprovalDialog", "If 'Rejected' → open RejectionDialog", "If 'Submitted' → open StatusChangeDialog (requires screenshot proof)", "DIY projects: only appear in UC tab (no install stage)", "Otherwise → PATCH /api/projects/:id"] } },

  { id: "status-change-dialog", type: "flowNode", position: { x: -300, y: 580 }, data: { label: "StatusChangeDialog", type: "dialog", description: "Modal for UC Submitted status requiring file proof", items: ["requireFile: true (screenshot proof required)", "Fields: action done, next steps, staff name", "Upload screenshot → POST /api/projects/:id/pm-status-change", "PATCH project ucStatus to Submitted", "Sets ucSubmittedDate on project", "Logs completion (7d hide)", "Invalidates projects + completions cache"] } },

  { id: "approval-dialog", type: "flowNode", position: { x: 0, y: 800 }, data: { label: "UcApprovalDialog", type: "dialog", description: "Modal when status → Approved", items: ["Fields: staff name, connection fee, files", "PATCH project (ucStatus=Approved)", "POST files to /api/projects/:id/files (category=UC)", "POST /api/uc/complete-action (hideDays=14)", "Invalidates projects + completions cache"] } },

  { id: "rejection-dialog", type: "flowNode", position: { x: 350, y: 800 }, data: { label: "UcRejectionDialog", type: "dialog", description: "Modal when status → Rejected", items: ["Fields: staff name, files, notes", "PATCH project status", "POST files (category=UC)", "POST /api/uc/complete-action", "Auto-creates escalation ticket", "Invalidates projects + completions + tickets"] } },

  { id: "followup-dialog", type: "flowNode", position: { x: 700, y: 580 }, data: { label: "FollowUpDialog", type: "dialog", description: "Follow-up for submitted projects (7+ days)", items: ["Fields: 'What has been done' + 'Next Steps'", "Posts comment to UC subtask via Asana API", "POST /api/uc/complete-action (follow_up, 7d hide)", "Invalidates completions cache"] } },

  { id: "hide-logic", type: "flowNode", position: { x: 700, y: 380 }, data: { label: "Hide/Reappear Logic", type: "logic", description: "Projects hidden after workflow actions", items: ["Latest completion.completedAt + hideDays > now → hidden", "7 days for submitted, 14 days for approved", "'Hidden' filter shows hidden projects", "Escalation hide: 48h from ticket creation"] } },

  { id: "hydro-section", type: "flowNode", position: { x: 700, y: 800 }, data: { label: "HydroInfoSection", type: "component", description: "Hydro bill upload + AI extraction", items: ["Upload image → POST /api/projects/:id/hydro-bill", "OpenAI Vision extracts: company, account#, customer", "Manual edit fields also available", "Stored on project record"] } },

  { id: "doc-checklist", type: "flowNode", position: { x: 1000, y: 580 }, data: { label: "UcDocChecklist", type: "component", description: "Document requirements on each card", items: ["(1) Hydro Bill / Account# — links to hydro upload", "(2) Meterbase Photo — POST /api/projects/:id/meterbase", "(3) Electrical Permit (NS only) — required for Nova Scotia projects", "Meterbase required for Alectra, optional otherwise", "Legacy statuses → grayed out (assumed collected)"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data-projects", target: "filter", animated: true },
  { id: "e2", source: "data-tickets", target: "filter" },
  { id: "e3", source: "data-completions", target: "hide-logic" },
  { id: "e4", source: "filter", target: "sort" },
  { id: "e4b", source: "planner-gate", target: "filter", label: "hides incomplete", style: { strokeDasharray: "5 5" } },
  { id: "e5", source: "sort", target: "card" },
  { id: "e6", source: "card", target: "status-change" },
  { id: "e7", source: "status-change", target: "approval-dialog", label: "Approved" },
  { id: "e8", source: "status-change", target: "rejection-dialog", label: "Rejected" },
  { id: "e8b", source: "status-change", target: "status-change-dialog", label: "Submitted" },
  { id: "e9", source: "card", target: "followup-dialog" },
  { id: "e10", source: "hide-logic", target: "filter", label: "hides projects", style: { strokeDasharray: "5 5" } },
  { id: "e11", source: "card", target: "hydro-section" },
  { id: "e12", source: "card", target: "doc-checklist" },
  { id: "e13", source: "approval-dialog", target: "hide-logic", label: "14d hide" },
  { id: "e14", source: "rejection-dialog", target: "data-tickets", label: "creates ticket" },
  { id: "e15", source: "followup-dialog", target: "hide-logic", label: "7d hide" },
  { id: "e16", source: "status-change-dialog", target: "hide-logic", label: "7d hide" },
].map(e => ({ ...e, style: { ...e.style, stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function UcFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-uc">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">UC Applications — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Page: client/src/pages/uc-view.tsx | Components: client/src/components/uc/</p>
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
