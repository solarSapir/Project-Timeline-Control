import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data-stats", type: "flowNode", position: { x: 0, y: 0 }, data: { label: "Dashboard Stats", type: "data", items: ["GET /api/dashboard/stats", "totalProjects, overdueCount, onTrack", "Stage breakdowns, UC/AHJ breakdowns"] } },
  { id: "data-projects", type: "flowNode", position: { x: 300, y: 0 }, data: { label: "Projects + Deadlines", type: "data", items: ["GET /api/projects", "GET /api/deadlines", "For recent projects table + timeline"] } },
  { id: "data-uc-kpi", type: "flowNode", position: { x: 600, y: 0 }, data: { label: "UC KPI Stats", type: "data", items: ["GET /api/uc/kpi-stats", "dailyCounts, avgDaysToSubmit", "avgDaysToApprove, rejectionsByUtility", "completionsThisWeek, totalUcProjects"] } },
  { id: "data-rebate-kpi", type: "flowNode", position: { x: 900, y: 0 }, data: { label: "Rebate KPI Stats", type: "data", items: ["GET /api/rebate/kpi-stats", "avgDaysToSubmit, avgDaysToApproval", "rejectionRate, completionsThisWeek", "dailyCounts for bar chart"] } },

  { id: "summary-cards", type: "flowNode", position: { x: 0, y: 200 }, data: { label: "Summary Cards", type: "component", description: "Top-level stats row", items: ["Total Projects", "Install Projects", "Overdue Tasks (red)", "On Track (green)"] } },

  { id: "uc-kpi", type: "flowNode", position: { x: 300, y: 200 }, data: { label: "UcKpiSection", type: "component", description: "UC Team KPI dashboard section", items: ["5 KPI cards: This Week, Tasks/Day, Submit Time, Decision Time, Close-Off Time", "Daily completions bar chart (30 days)", "Rejections by utility bar chart", "Click 'This Week' → CompletionsDrilldown dialog"] } },

  { id: "drilldown", type: "flowNode", position: { x: 300, y: 420 }, data: { label: "CompletionsDrilldown", type: "dialog", description: "Detailed completions breakdown", items: ["Daily stacked bar chart by action type", "Staff filter dropdown", "Activity log with project names", "Status transitions listed"] } },

  { id: "rebate-kpi", type: "flowNode", position: { x: 600, y: 200 }, data: { label: "RebateKpiSection", type: "component", description: "Rebate Team KPI dashboard section", items: ["5 KPI cards: This Week, Tasks/Day, Submit Time, Hear Back, Rejection Rate", "Daily completions bar chart (30 days)", "Data from rebate_completions table"] } },

  { id: "recent-table", type: "flowNode", position: { x: 700, y: 420 }, data: { label: "Recent Projects Table", type: "component", description: "Last 10 install projects", items: ["Project name, UC status, AHJ status", "Province, timeline indicator", "Timeline health indicator", "Links to project profile"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data-stats", target: "summary-cards", animated: true },
  { id: "e2", source: "data-uc-kpi", target: "uc-kpi", animated: true },
  { id: "e3", source: "data-rebate-kpi", target: "rebate-kpi", animated: true },
  { id: "e4", source: "data-projects", target: "recent-table" },
  { id: "e5", source: "uc-kpi", target: "drilldown", label: "click This Week" },
].map(e => ({ ...e, style: { stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function DashboardFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-dashboard">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Dashboard — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Page: client/src/pages/dashboard.tsx | Components: client/src/components/dashboard/</p>
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
