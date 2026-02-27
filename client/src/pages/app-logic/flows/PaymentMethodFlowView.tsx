import { useCallback } from "react";
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "data-projects", type: "flowNode", position: { x: 0, y: 0 }, data: { label: "Fetch Projects", type: "data", description: "GET /api/projects → all projects from DB", items: ["useQuery queryKey: ['/api/projects']", "Returns Project[] array"] } },
  { id: "data-options", type: "flowNode", position: { x: 350, y: 0 }, data: { label: "Fetch Payment Method Options", type: "data", description: "GET /api/asana/field-options/paymentMethod", items: ["Dropdown options from Asana custom field", "Used in payment method Select on each card"] } },

  { id: "filter", type: "flowNode", position: { x: 0, y: 200 }, data: { label: "Filter Projects", type: "filter", description: "Only show relevant payment projects", items: ["installType = 'install'", "propertySector = 'residential' (or null)", "Exclude: complete, paused, lost"] } },

  { id: "search-filter", type: "flowNode", position: { x: 350, y: 200 }, data: { label: "Search & Tab Filter", type: "filter", description: "User-driven filtering", items: ["Text search by project name", "Tab: 'Needs Payment Method' (no paymentMethod)", "Tab: 'Payment Method Set' (has paymentMethod)", "Tab: 'All Projects'"] } },

  { id: "sort", type: "flowNode", position: { x: 175, y: 380 }, data: { label: "Sort Projects", type: "logic", description: "Priority-based sorting", items: ["No payment method → sorted first", "Then by payment due date ascending", "Due date = projectCreatedDate + 7 days", "Null due dates sorted last"] } },

  { id: "due-date", type: "flowNode", position: { x: 525, y: 380 }, data: { label: "getPaymentDueDate()", type: "logic", description: "Calculates payment due date", items: ["projectCreatedDate + 7 days", "Returns ISO date string", "Used for DueIndicator + overdue detection", "Null if no projectCreatedDate"] } },

  { id: "card", type: "flowNode", position: { x: 0, y: 560 }, data: { label: "Payment Project Card", type: "component", description: "Renders each project as a card", items: ["Project name (link to profile)", "Payment method badge (green) or 'No payment method' (red)", "Province + created date + DueIndicator", "Overdue projects get red left border", "Payment method Select dropdown", "TaskActionDialog button"] } },

  { id: "kpi-badges", type: "flowNode", position: { x: 350, y: 560 }, data: { label: "KPI Badges", type: "component", description: "Summary badges in header", items: ["Overdue count badge (destructive)", "Needs attention count badge (outline)", "Overdue = no paymentMethod + due date passed", "Needs attention = no paymentMethod set"] } },

  { id: "handle-payment", type: "flowNode", position: { x: 0, y: 760 }, data: { label: "handlePaymentMethod()", type: "action", description: "Updates payment method on project", items: ["PATCH /api/projects/:id { paymentMethod }", "Syncs to Asana via backend", "Invalidates ['/api/projects'] cache", "Shows success/error toast"] } },

  { id: "task-action", type: "flowNode", position: { x: 350, y: 760 }, data: { label: "TaskActionDialog", type: "dialog", description: "Quick action dialog on each card", items: ["viewType = 'contracts'", "Opens action modal for project", "Allows notes / follow-up actions"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "data-projects", target: "filter", animated: true },
  { id: "e2", source: "data-options", target: "card", label: "dropdown options" },
  { id: "e3", source: "filter", target: "search-filter" },
  { id: "e4", source: "search-filter", target: "sort" },
  { id: "e5", source: "sort", target: "card" },
  { id: "e6", source: "due-date", target: "sort", label: "due date calc", style: { strokeDasharray: "5 5" } },
  { id: "e7", source: "due-date", target: "card", label: "DueIndicator" },
  { id: "e8", source: "card", target: "handle-payment" },
  { id: "e9", source: "card", target: "task-action" },
  { id: "e10", source: "filter", target: "kpi-badges", label: "counts", style: { strokeDasharray: "5 5" } },
  { id: "e11", source: "due-date", target: "kpi-badges", label: "overdue check", style: { strokeDasharray: "5 5" } },
].map(e => ({ ...e, style: { ...e.style, stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function PaymentMethodFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-payment-method">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Payment Method — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Page: client/src/pages/payment-method-view.tsx</p>
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
