import { useCallback } from "react";
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data-projects", type: "flowNode", position: { x: 0, y: 0 }, data: { label: "Fetch Projects", type: "data", description: "GET /api/projects → all projects from DB", items: ["useQuery queryKey: ['/api/projects']", "Returns Project[] array"] } },
  { id: "data-subtasks", type: "flowNode", position: { x: 350, y: 0 }, data: { label: "Fetch Planning Subtasks", type: "data", description: "GET /api/projects/:id/planning-subtask", items: ["Fetches Asana subtask for planning", "Used in PlanningSubtaskPanel"] } },

  { id: "filter", type: "flowNode", position: { x: 0, y: 200 }, data: { label: "Filter Projects", type: "filter", description: "Only show planner-eligible projects", items: ["installType = 'install'", "propertySector = 'residential'", "Exclude: complete, paused, lost"] } },

  { id: "planner-card", type: "flowNode", position: { x: 0, y: 400 }, data: { label: "PlannerCard", type: "component", description: "Renders each project with planner fields", items: ["Scope checkbox (plannerScope)", "Contractor dropdown (8 options)", "Proposal upload button", "Site plan upload button", "Total cost input (plannerCost)", "Contractor payout input (plannerPayout)", "Contract sent checkbox", "Contract signed checkbox"] } },

  { id: "contractor-options", type: "flowNode", position: { x: 350, y: 200 }, data: { label: "Contractor Dropdown", type: "component", description: "8 contractor options available", items: ["RJ ELECTRIC", "UPGRADIUM", "SUNSHINE", "Power Blitz", "MarkON electric", "Michael Alcrow", "Evolve Energy", "VG Electric"] } },

  { id: "ns-check", type: "flowNode", position: { x: 350, y: 400 }, data: { label: "NS Province Check", type: "logic", description: "isNsProject() adds extra requirement", items: ["Checks if project province = NS (Nova Scotia)", "If NS → adds Electrical Permit requirement", "Electrical permit upload becomes mandatory", "Upload → POST /api/projects/:id/electrical-permit"] } },

  { id: "planner-complete", type: "flowNode", position: { x: 700, y: 400 }, data: { label: "isPlannerComplete()", type: "logic", description: "Gates UC view visibility", items: ["All required fields must be filled:", "scope, proposal, site plan, costs", "contractor, contract sent/signed", "NS projects: electrical permit required", "If incomplete → project hidden from UC view"] } },

  { id: "upload-proposal", type: "flowNode", position: { x: 0, y: 640 }, data: { label: "Upload Proposal", type: "action", description: "POST /api/projects/:id/planner-proposal", items: ["File upload mutation", "Stores proposal document", "Updates plannerProposal field on project", "Invalidates project cache"] } },

  { id: "upload-siteplan", type: "flowNode", position: { x: 350, y: 640 }, data: { label: "Upload Site Plan", type: "action", description: "POST /api/projects/:id/planner-site-plan", items: ["File upload mutation", "Stores site plan document", "Updates plannerSitePlan field on project", "Invalidates project cache"] } },

  { id: "upload-permit", type: "flowNode", position: { x: 700, y: 640 }, data: { label: "Upload Electrical Permit", type: "action", description: "POST /api/projects/:id/electrical-permit", items: ["Only required for NS projects", "File upload mutation", "Updates electricalPermitUrl field", "Sets electricalPermitUploadedAt timestamp"] } },

  { id: "subtask-panel", type: "flowNode", position: { x: 700, y: 200 }, data: { label: "PlanningSubtaskPanel", type: "component", description: "Expandable panel for Asana subtask details", items: ["Shows planning subtask from Asana", "Displays subtask status and assignee", "Links to Asana for full details"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data-projects", target: "filter", animated: true },
  { id: "e2", source: "filter", target: "planner-card" },
  { id: "e3", source: "contractor-options", target: "planner-card", label: "selected contractor" },
  { id: "e4", source: "planner-card", target: "ns-check" },
  { id: "e5", source: "ns-check", target: "planner-complete", label: "NS adds permit req" },
  { id: "e6", source: "planner-card", target: "planner-complete", label: "all fields" },
  { id: "e7", source: "planner-card", target: "upload-proposal" },
  { id: "e8", source: "planner-card", target: "upload-siteplan" },
  { id: "e9", source: "ns-check", target: "upload-permit", label: "NS only" },
  { id: "e10", source: "data-subtasks", target: "subtask-panel", animated: true },
  { id: "e11", source: "subtask-panel", target: "planner-card", style: { strokeDasharray: "5 5" } },
].map(e => ({ ...e, style: { ...e.style, stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function PlannerFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-planner">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Project Planner — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Page: client/src/pages/planner-view.tsx | Components: Planner fields on project cards</p>
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
