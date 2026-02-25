import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data", type: "flowNode", position: { x: 150, y: 0 }, data: { label: "Fetch Data", type: "data", items: ["GET /api/projects", "GET /api/escalation-tickets", "GET /api/task-actions/close_off", "GET /api/workflow-config"] } },

  { id: "filter", type: "flowNode", position: { x: 150, y: 180 }, data: { label: "Filter & Gate", type: "filter", description: "Close-off stage dependencies", items: ["installType = 'install', residential only", "Depends on installation completion", "Blocked → WaitingDepsCard", "Active → Close-off cards"] } },

  { id: "card", type: "flowNode", position: { x: 150, y: 360 }, data: { label: "Close-Off Card", type: "component", description: "Final stage tracking card", items: ["PM status display", "Close-off due date indicator", "Payment collection checkboxes (4 payment types)", "Final inspection date", "EscalationDialog + EscalationBadge"] } },

  { id: "payments", type: "flowNode", position: { x: 0, y: 540 }, data: { label: "Payment Tracking", type: "action", description: "Toggle payment collection status", items: ["PATCH /api/projects/:id", "permitPaymentCollected: boolean", "engineeringFeeCollected: boolean", "milestonePaymentCollected: boolean", "finalPaymentCollected: boolean"] } },

  { id: "status", type: "flowNode", position: { x: 300, y: 540 }, data: { label: "Complete Project", type: "action", description: "Mark project as complete", items: ["PATCH pmStatus → 'Complete'", "Sets all close-off fields", "Pushes to Asana", "Project removed from active views"] } },

  { id: "files", type: "flowNode", position: { x: 500, y: 360 }, data: { label: "File Uploads", type: "action", items: ["POST /api/projects/:id/files", "Category: close_off", "Final documents, certificates"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data", target: "filter", animated: true },
  { id: "e2", source: "filter", target: "card" },
  { id: "e3", source: "card", target: "payments" },
  { id: "e4", source: "card", target: "status" },
  { id: "e5", source: "card", target: "files" },
].map(e => ({ ...e, style: { stroke: "#94a3b8", strokeWidth: 1.5 } }));

export default function CloseOffFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-close-off">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Close-off — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Page: client/src/pages/close-off-view.tsx</p>
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
