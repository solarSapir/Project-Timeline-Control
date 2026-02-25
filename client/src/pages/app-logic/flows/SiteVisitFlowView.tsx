import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data", type: "flowNode", position: { x: 150, y: 0 }, data: { label: "Fetch Data", type: "data", items: ["GET /api/projects", "GET /api/asana/field-options/siteVisitStatus", "GET /api/escalation-tickets", "GET /api/task-actions/site_visits", "GET /api/workflow-config"] } },

  { id: "filter", type: "flowNode", position: { x: 150, y: 180 }, data: { label: "Filter & Gate", type: "filter", description: "Dependency gating for site visits", items: ["installType = 'install', residential only", "Check workflow dependencies", "Blocked projects → WaitingDepsCard", "Active projects → site visit cards"] } },

  { id: "card", type: "flowNode", position: { x: 150, y: 360 }, data: { label: "Site Visit Card", type: "component", description: "Each project card in site visits view", items: ["Status badge + due indicator", "Site visit date display", "Status dropdown for siteVisitStatus", "Follow-up tracking", "EscalationDialog ('I'm Stuck')", "File uploads (category: site_visit)"] } },

  { id: "status", type: "flowNode", position: { x: 0, y: 540 }, data: { label: "Status Change", type: "action", items: ["PATCH /api/projects/:id with siteVisitStatus", "Pushes to Asana", "Invalidates projects cache"] } },

  { id: "followup", type: "flowNode", position: { x: 300, y: 540 }, data: { label: "Follow-Up", type: "action", items: ["POST /api/task-actions (viewType: site_visits)", "Sets follow-up date", "Notes posted to Asana"] } },

  { id: "files", type: "flowNode", position: { x: 500, y: 360 }, data: { label: "File Uploads", type: "action", items: ["POST /api/projects/:id/files", "Category: site_visit", "Stored locally at data/uploads/"] } },

  { id: "escalation", type: "flowNode", position: { x: 500, y: 540 }, data: { label: "Escalation Flow", type: "action", description: "\"I'm Stuck\" → ticket → hide → manager → reappear", items: ["EscalationDialog: staff enters name + issue", "POST /api/escalation-tickets (viewType: site_visits)", "Project hidden 48h from Needs Action list", "EscalationBadge: red 'Escalated' badge on card", "Manager responds → badge turns green 'Response Available'", "Staff clicks 'Mark Resolved' → project reappears", "See: Escalated Tickets flow for full lifecycle"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data", target: "filter", animated: true },
  { id: "e2", source: "filter", target: "card" },
  { id: "e3", source: "card", target: "status" },
  { id: "e4", source: "card", target: "followup" },
  { id: "e5", source: "card", target: "files" },
  { id: "e6", source: "card", target: "escalation", label: "I'm Stuck" },
  { id: "e7", source: "escalation", target: "filter", label: "hides project 48h", style: { strokeDasharray: "5 5" } },
].map(e => ({ ...e, style: { ...e.style, stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function SiteVisitFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-site-visits">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Site Visits — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Page: client/src/pages/site-visits-view.tsx</p>
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
