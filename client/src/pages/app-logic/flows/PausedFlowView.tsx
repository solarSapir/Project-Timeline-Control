import { useCallback } from "react";
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data-projects", type: "flowNode", position: { x: 0, y: 0 }, data: { label: "Fetch Projects", type: "data", description: "GET /api/projects", items: ["useQuery queryKey: ['/api/projects']", "Returns Project[] array"] } },
  { id: "data-reasons", type: "flowNode", position: { x: 300, y: 0 }, data: { label: "Fetch Pause Reasons", type: "data", description: "GET /api/pause-reasons", items: ["Returns PauseReason[] array", "id, name, createdAt", "Used in pause reason dropdown"] } },
  { id: "data-logs", type: "flowNode", position: { x: 600, y: 0 }, data: { label: "Fetch Pause Logs", type: "data", description: "GET /api/pause-reasons/logs", items: ["Returns pause/unpause event log", "Tracks duration of each pause", "Used for AI insights analysis"] } },

  { id: "filter", type: "flowNode", position: { x: 300, y: 180 }, data: { label: "Filter Paused Projects", type: "filter", description: "Only show paused projects", items: ["pmStatus = 'project paused'", "Projects with pauseReason set", "Shows pause duration from pauseReasonSetAt"] } },

  { id: "paused-card", type: "flowNode", position: { x: 300, y: 360 }, data: { label: "PausedCard", type: "component", description: "Renders each paused project as a card", items: ["Project name + customer info", "Pause reason (from pauseReason field)", "Pause note (from pauseNote field)", "Pause duration (days since pauseReasonSetAt)", "Unpause button to resume project"] } },

  { id: "reasons-crud", type: "flowNode", position: { x: 0, y: 360 }, data: { label: "Pause Reasons CRUD", type: "action", description: "Manage available pause reasons", items: ["GET /api/pause-reasons — list all reasons", "POST /api/pause-reasons — create new reason", "DELETE /api/pause-reasons/:id — delete reason", "Reasons populate the pause reason dropdown"] } },

  { id: "pause-logs", type: "flowNode", position: { x: 600, y: 360 }, data: { label: "Pause Logs", type: "action", description: "Track pause/unpause events", items: ["POST /api/pause-reasons/logs", "Records: projectId, reason, timestamp", "Tracks pause start and end times", "Used to calculate total paused duration"] } },

  { id: "unpause-action", type: "flowNode", position: { x: 300, y: 560 }, data: { label: "Unpause Action", type: "action", description: "Resume a paused project", items: ["PATCH /api/projects/:id", "Sets pmStatus back to previous status", "Clears pauseReason, pauseNote", "Creates unpause log entry", "Invalidates projects cache"] } },

  { id: "ai-insights", type: "flowNode", position: { x: 600, y: 560 }, data: { label: "AI Insights", type: "logic", description: "POST /api/pause-reasons/insights", items: ["Analyzes pause patterns across projects", "Identifies repeat pausers", "Detects common pause reasons", "Surfaces trends and recommendations", "Uses pause logs + project data"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data-projects", target: "filter", animated: true },
  { id: "e2", source: "data-reasons", target: "filter" },
  { id: "e3", source: "data-logs", target: "ai-insights" },
  { id: "e4", source: "filter", target: "paused-card" },
  { id: "e5", source: "reasons-crud", target: "paused-card", label: "populates dropdown" },
  { id: "e6", source: "paused-card", target: "unpause-action", label: "unpause click" },
  { id: "e7", source: "paused-card", target: "pause-logs", label: "logs events" },
  { id: "e8", source: "unpause-action", target: "data-projects", label: "invalidates cache", style: { strokeDasharray: "5 5" } },
  { id: "e9", source: "pause-logs", target: "ai-insights", label: "feeds analysis" },
  { id: "e10", source: "data-reasons", target: "reasons-crud" },
].map(e => ({ ...e, style: { ...e.style, stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function PausedFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-paused">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Paused Projects & Insights — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Page: client/src/pages/paused-projects-view.tsx | API: server/routes/pause-reasons.ts</p>
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
