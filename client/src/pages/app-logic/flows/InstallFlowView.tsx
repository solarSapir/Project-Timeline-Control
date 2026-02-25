import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data", type: "flowNode", position: { x: 150, y: 0 }, data: { label: "Fetch Data", type: "data", items: ["GET /api/projects", "GET /api/asana/field-options/installTeamStage", "GET /api/install-schedules", "GET /api/escalation-tickets", "GET /api/task-actions/installs", "GET /api/workflow-config"] } },

  { id: "filter", type: "flowNode", position: { x: 150, y: 200 }, data: { label: "Filter & Gate", type: "filter", description: "Install coordination dependencies", items: ["installType = 'install', residential only", "Check workflow dependencies (AHJ, contract done)", "Blocked → WaitingDepsCard", "Active → Install cards"] } },

  { id: "card", type: "flowNode", position: { x: 150, y: 380 }, data: { label: "Install Card", type: "component", description: "Install coordination project card", items: ["Install team stage badge", "Install dates (start, end, D/R, final inspection)", "Equipment arrival tracking", "Status dropdown for installTeamStage", "EscalationDialog + EscalationBadge"] } },

  { id: "schedule", type: "flowNode", position: { x: 500, y: 200 }, data: { label: "Install Calendar", type: "component", description: "Monthly calendar view (/install-calendar)", items: ["GET /api/install-schedules", "PUT /api/install-schedules for scheduling", "Calendar grid with install projects", "Cascading target dates if overdue", "Shows team lead, dates, project name"] } },

  { id: "status", type: "flowNode", position: { x: 0, y: 560 }, data: { label: "Status Change", type: "action", items: ["PATCH /api/projects/:id with installTeamStage", "Updates date fields as needed", "Pushes to Asana"] } },

  { id: "followup", type: "flowNode", position: { x: 300, y: 560 }, data: { label: "Follow-Up / Scheduling", type: "action", items: ["POST /api/task-actions (viewType: installs)", "PUT /api/install-schedules for dates", "Install date scheduling"] } },

  { id: "files", type: "flowNode", position: { x: 500, y: 380 }, data: { label: "File Uploads", type: "action", items: ["POST /api/projects/:id/files", "Category: install", "Installation photos, documents"] } },

  { id: "escalation", type: "flowNode", position: { x: 500, y: 560 }, data: { label: "Escalation Flow", type: "action", description: "\"I'm Stuck\" → ticket → hide → manager → reappear", items: ["EscalationDialog: staff enters name + issue", "POST /api/escalation-tickets (viewType: installs)", "Project hidden 48h from Needs Action list", "EscalationBadge: red 'Escalated' → green 'Response Available'", "Manager responds on /escalated page", "Staff clicks 'Mark Resolved' → project reappears", "See: Escalated Tickets flow for full lifecycle"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data", target: "filter", animated: true },
  { id: "e2", source: "data", target: "schedule" },
  { id: "e3", source: "filter", target: "card" },
  { id: "e4", source: "card", target: "status" },
  { id: "e5", source: "card", target: "followup" },
  { id: "e6", source: "card", target: "files" },
  { id: "e7", source: "card", target: "escalation", label: "I'm Stuck" },
  { id: "e8", source: "escalation", target: "filter", label: "hides project 48h", style: { strokeDasharray: "5 5" } },
].map(e => ({ ...e, style: { ...e.style, stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function InstallFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-installs">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Install Coordination — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Pages: installs-view.tsx, install-calendar.tsx</p>
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
