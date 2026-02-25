import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data", type: "flowNode", position: { x: 150, y: 0 }, data: { label: "Fetch Data", type: "data", items: ["GET /api/projects", "GET /api/asana/field-options/ahjStatus", "GET /api/escalation-tickets", "GET /api/task-actions/ahj", "GET /api/workflow-config"] } },

  { id: "filter", type: "flowNode", position: { x: 150, y: 180 }, data: { label: "Filter & Gate", type: "filter", description: "AHJ/Permitting dependency gating", items: ["installType = 'install', residential only", "Check workflow dependencies (e.g. UC done)", "Blocked → WaitingDepsCard", "Active → AHJ cards with status tracking"] } },

  { id: "card", type: "flowNode", position: { x: 150, y: 360 }, data: { label: "AHJ Card", type: "component", description: "Permit tracking card for each project", items: ["AHJ status badge + due indicator", "Status dropdown for ahjStatus", "Follow-up tracking with due dates", "EscalationDialog ('I'm Stuck')", "EscalationBadge for open tickets"] } },

  { id: "status", type: "flowNode", position: { x: 0, y: 540 }, data: { label: "Status Change", type: "action", items: ["PATCH /api/projects/:id with ahjStatus", "Pushes to Asana custom field", "Invalidates projects cache"] } },

  { id: "followup", type: "flowNode", position: { x: 300, y: 540 }, data: { label: "Follow-Up", type: "action", items: ["POST /api/task-actions (viewType: ahj)", "Sets follow-up date for reappear", "Split fields: action taken + next steps"] } },

  { id: "files", type: "flowNode", position: { x: 500, y: 360 }, data: { label: "File Uploads", type: "action", items: ["POST /api/projects/:id/files", "Category: ahj", "Permit documents stored locally"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data", target: "filter", animated: true },
  { id: "e2", source: "filter", target: "card" },
  { id: "e3", source: "card", target: "status" },
  { id: "e4", source: "card", target: "followup" },
  { id: "e5", source: "card", target: "files" },
].map(e => ({ ...e, style: { stroke: "#94a3b8", strokeWidth: 1.5 } }));

export default function AhjFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-ahj">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">AHJ / Permitting — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Page: client/src/pages/ahj-view.tsx</p>
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
