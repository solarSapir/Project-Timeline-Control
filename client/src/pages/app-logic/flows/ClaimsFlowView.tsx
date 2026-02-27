import { useCallback } from "react";
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "claim-button", type: "flowNode", position: { x: 0, y: 0 }, data: { label: "ClaimButton Component", type: "component", description: "Rendered on each project card in work views (UC, Contracts, Rebates, etc.)", items: ["Shows 'Claim' button when unclaimed", "Shows claimed staff name when active", "Shows 'Release' option for claimed user", "Embedded in project cards across views"] } },

  { id: "data-claims", type: "flowNode", position: { x: 350, y: 0 }, data: { label: "Fetch Active Claims", type: "data", description: "GET /api/claims", items: ["Returns all active claims", "Each claim has projectId, viewType, staffName", "Used to show claim status on cards"] } },

  { id: "data-history", type: "flowNode", position: { x: 700, y: 0 }, data: { label: "Fetch Claim History", type: "data", description: "GET /api/claims/history", items: ["Returns completed claims with duration", "Used in CompletionsDrilldown", "Includes claimedAt, completedAt timestamps"] } },

  { id: "data-kpi", type: "flowNode", position: { x: 1050, y: 0 }, data: { label: "Fetch KPI Stats", type: "data", description: "GET /api/claims/kpi-stats", items: ["Average minutes per claim", "Staff breakdown (claims per person)", "View breakdown (claims per view type)", "Completed this week count"] } },

  { id: "create-claim", type: "flowNode", position: { x: 0, y: 220 }, data: { label: "Create Claim", type: "action", description: "POST /api/claims", items: ["Select staff name from dropdown", "Associates projectId + viewType", "One claim per staff at a time", "One claim per projectId+viewType at a time", "Sets claimedAt timestamp"] } },

  { id: "constraint-staff", type: "flowNode", position: { x: 350, y: 220 }, data: { label: "Staff Constraint", type: "logic", description: "One active claim per staff member", items: ["Staff cannot claim another project", "Must complete or release current claim first", "Prevents multitasking overload", "Enforced server-side"] } },

  { id: "constraint-project", type: "flowNode", position: { x: 700, y: 220 }, data: { label: "Project+View Constraint", type: "logic", description: "One claim per projectId+viewType", items: ["Same project in same view can't be double-claimed", "Different views can claim same project", "Prevents duplicate work on same task"] } },

  { id: "working", type: "flowNode", position: { x: 0, y: 420 }, data: { label: "Working State", type: "component", description: "Card shows claimed status while staff works", items: ["Displays staff name on card", "Timer running from claimedAt", "Release button available", "Complete triggered by status change"] } },

  { id: "complete-claim", type: "flowNode", position: { x: 350, y: 420 }, data: { label: "Complete Claim", type: "action", description: "POST /api/claims/:id/complete", items: ["Sets completedAt timestamp", "Sets completionAction (what was done)", "Sets active = false", "Calculates duration from claimedAt to completedAt"] } },

  { id: "release-claim", type: "flowNode", position: { x: 700, y: 420 }, data: { label: "Release Claim", type: "action", description: "POST /api/claims/:id/release", items: ["Sets active = false", "No completionAction recorded", "Frees staff for new claims", "Frees project+viewType for others"] } },

  { id: "auto-complete", type: "flowNode", position: { x: 350, y: 620 }, data: { label: "Auto-Complete on Status Change", type: "logic", description: "POST /api/claims/complete-by-project", items: ["Triggered when project status changes", "Finds active claim for projectId+viewType", "Automatically completes the claim", "Records the status change as completionAction"] } },

  { id: "session-grouping", type: "flowNode", position: { x: 0, y: 620 }, data: { label: "Session Grouping", type: "logic", description: "CompletionsDrilldown groups claims into sessions", items: ["Same project + same staff within 30min = 1 session", "Merges rapid successive claims", "Shows session duration (first claim to last complete)", "Provides more accurate productivity metrics"] } },

  { id: "completions-drilldown", type: "flowNode", position: { x: 700, y: 620 }, data: { label: "CompletionsDrilldown", type: "component", description: "Dashboard component for claim analytics", items: ["Shows completed claims grouped by session", "Staff productivity breakdown", "Average time per claim by view type", "Weekly completion trends"] } },

  { id: "kpi-display", type: "flowNode", position: { x: 1050, y: 420 }, data: { label: "KPI Stats Display", type: "component", description: "Dashboard KPI cards for claims", items: ["Avg minutes per claim", "Staff leaderboard", "View type distribution", "Completed this week counter"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "claim-button", target: "create-claim", label: "click Claim" },
  { id: "e2", source: "data-claims", target: "claim-button", label: "active claims" },
  { id: "e3", source: "create-claim", target: "constraint-staff" },
  { id: "e4", source: "create-claim", target: "constraint-project" },
  { id: "e5", source: "create-claim", target: "working", label: "claim created" },
  { id: "e6", source: "working", target: "complete-claim", label: "status change" },
  { id: "e7", source: "working", target: "release-claim", label: "release" },
  { id: "e8", source: "auto-complete", target: "complete-claim", label: "triggers" },
  { id: "e9", source: "complete-claim", target: "data-history", label: "recorded", style: { strokeDasharray: "5 5" } },
  { id: "e10", source: "data-history", target: "completions-drilldown" },
  { id: "e11", source: "data-history", target: "session-grouping" },
  { id: "e12", source: "session-grouping", target: "completions-drilldown", label: "grouped sessions" },
  { id: "e13", source: "data-kpi", target: "kpi-display" },
  { id: "e14", source: "complete-claim", target: "data-kpi", label: "updates stats", style: { strokeDasharray: "5 5" } },
].map(e => ({ ...e, style: { ...e.style, stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function ClaimsFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-claims">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Claims & KPI — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Components: client/src/components/shared/ClaimButton.tsx | client/src/components/dashboard/CompletionsDrilldown.tsx</p>
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
