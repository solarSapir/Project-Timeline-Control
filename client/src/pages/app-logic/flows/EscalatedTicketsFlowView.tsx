import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";
import { FlowNavigation } from "@/components/app-logic/FlowNavigation";
import { FlowNode } from "@/components/app-logic/FlowNode";

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  { id: "team-tabs", type: "flowNode", position: { x: 0, y: 0 }, data: { label: "Team Tabs (All 7 Views)", type: "component", description: "Every team view has escalation built in", items: ["UC Applications (viewType: 'uc')", "Contracts (viewType: 'contracts')", "Site Visits (viewType: 'site_visits')", "AHJ / Permitting (viewType: 'ahj')", "Install Coordination (viewType: 'installs')", "Payments / Rebates (viewType: 'payments')", "Close-off (viewType: 'close_off')"] } },

  { id: "stuck-button", type: "flowNode", position: { x: 0, y: 260 }, data: { label: "\"I'm Stuck\" Button", type: "action", description: "EscalationDialog component on every card", items: ["Amber outline button with ⚠ icon", "Opens dialog modal on click", "Available on every project card in all 7 views", "Component: client/src/components/shared/EscalationDialog.tsx"] } },

  { id: "dialog-form", type: "flowNode", position: { x: 0, y: 460 }, data: { label: "Escalation Dialog Form", type: "dialog", description: "Staff fills in issue details", items: ["Field 1: Your Name (required)", "Field 2: What are you stuck on? (required, textarea)", "Shows project name for context", "Message: 'Task will be paused 48h while manager reviews'", "Submit → POST /api/escalation-tickets"] } },

  { id: "api-create", type: "flowNode", position: { x: 0, y: 700 }, data: { label: "POST /api/escalation-tickets", type: "api", description: "Server creates the ticket", items: ["Body: { projectId, viewType, createdBy, issue }", "Server sets hideUntil = now + 48 hours", "Status set to 'open'", "Returns full ticket object", "Table: escalation_tickets", "Route: server/routes/escalation.ts"] } },

  { id: "cache-invalidate", type: "flowNode", position: { x: 340, y: 700 }, data: { label: "Cache Invalidation", type: "logic", description: "React Query cache refreshed", items: ["Invalidates ['/api/escalation-tickets']", "Invalidates ['/api/projects']", "All views re-render with updated data", "Toast: 'Escalation ticket created'"] } },

  { id: "hide-effect", type: "flowNode", position: { x: 0, y: 920 }, data: { label: "48h Hide Effect on Team Tab", type: "logic", description: "Project disappears from team's action list", items: ["Each team view fetches GET /api/escalation-tickets", "Checks: ticket.hideUntil > now?", "If yes → project HIDDEN from 'Needs Action' list", "Project still visible in 'Escalated' filter dropdown", "Purpose: prevent team from working on blocked task", "After 48h → project reappears automatically"] } },

  { id: "badge-open", type: "flowNode", position: { x: 340, y: 920 }, data: { label: "EscalationBadge — Open State", type: "component", description: "Red badge on the project card", items: ["Shows red 'Escalated' badge with ⚠ icon", "Visible on the project card in team view", "Non-clickable — just a status indicator", "Queries: GET /api/escalation-tickets?projectId=X", "Component: client/src/components/shared/EscalationBadge.tsx"] } },

  { id: "sidebar-badge", type: "flowNode", position: { x: 340, y: 460 }, data: { label: "Sidebar Badge Counter", type: "component", description: "Red count badge on sidebar nav", items: ["Sidebar fetches GET /api/escalation-tickets", "Counts tickets with status 'open' or 'responded'", "Shows red badge with count on 'Escalated Tickets' link", "Updates in real-time as tickets change", "Component: client/src/components/app-sidebar.tsx"] } },

  { id: "manager-page", type: "flowNode", position: { x: 700, y: 0 }, data: { label: "Escalated Tickets Page (/escalated)", type: "component", description: "Manager's dashboard for all tickets", items: ["GET /api/escalation-tickets → all tickets", "GET /api/projects → match project names", "Filter dropdown: Open / Responded / Resolved / All", "Search bar: by project name, issue, or staff name", "Counts: X open, X responded, X resolved", "Page: client/src/pages/escalated-tickets-view.tsx"] } },

  { id: "ticket-card", type: "flowNode", position: { x: 700, y: 260 }, data: { label: "TicketCard Component", type: "component", description: "Each ticket displayed as a card", items: ["Project name (links to /project/:id)", "View type badge (UC, Contracts, etc.)", "Status badge: red=Open, amber=Responded, green=Resolved", "Created by + timestamp", "Issue description in gray panel", "Manager response (if responded) in green panel", "Buttons: Respond (open only), Resolve (open or responded)"] } },

  { id: "respond-action", type: "flowNode", position: { x: 700, y: 520 }, data: { label: "Manager Clicks 'Respond'", type: "dialog", description: "Opens response dialog on the ticket", items: ["Shows original issue from staff member", "Field 1: Your Name (manager)", "Field 2: Your Response (guidance/instructions)", "Submit → PATCH /api/escalation-tickets/:id/respond"] } },

  { id: "api-respond", type: "flowNode", position: { x: 700, y: 740 }, data: { label: "PATCH /api/escalation-tickets/:id/respond", type: "api", description: "Server records the manager response", items: ["Body: { managerResponse, respondedBy }", "Sets status → 'responded'", "Sets respondedAt → now", "Stores managerResponse text", "hideUntil remains (still within 48h window)", "Invalidates ['/api/escalation-tickets'] cache"] } },

  { id: "badge-responded", type: "flowNode", position: { x: 1050, y: 520 }, data: { label: "EscalationBadge — Responded State", type: "component", description: "Green badge appears on team's card", items: ["Badge changes from red 'Escalated' → green 'Response Available'", "Badge is CLICKABLE in responded state", "Click opens a dialog showing manager's response", "Dialog shows: original issue + manager response + timestamp", "Button: 'Mark as Resolved & Continue'"] } },

  { id: "resolve-action", type: "flowNode", position: { x: 1050, y: 740 }, data: { label: "Resolve Ticket", type: "action", description: "Staff or manager marks ticket resolved", items: ["Two ways to resolve:", "(1) Team member clicks 'Mark as Resolved & Continue' in badge dialog", "(2) Manager clicks 'Resolve' button on escalated tickets page", "Both call: PATCH /api/escalation-tickets/:id/resolve"] } },

  { id: "api-resolve", type: "flowNode", position: { x: 1050, y: 940 }, data: { label: "PATCH /api/escalation-tickets/:id/resolve", type: "api", description: "Server finalizes the ticket", items: ["Sets status → 'resolved'", "Sets resolvedAt → now", "Invalidates ['/api/escalation-tickets'] cache"] } },

  { id: "project-reappears", type: "flowNode", position: { x: 700, y: 940 }, data: { label: "Project Reappears in Team View", type: "logic", description: "Escalation cycle complete", items: ["EscalationBadge returns null (no active ticket)", "Project no longer hidden by escalation filter", "Project returns to normal 'Needs Action' list", "If hideUntil not yet expired, resolve does NOT override it", "Natural 48h expiry + resolve together control visibility", "Staff can now continue working on the project"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "team-tabs", target: "stuck-button", animated: true, label: "each card has button" },
  { id: "e2", source: "stuck-button", target: "dialog-form" },
  { id: "e3", source: "dialog-form", target: "api-create", label: "submit" },
  { id: "e4", source: "api-create", target: "cache-invalidate" },
  { id: "e5", source: "api-create", target: "hide-effect", label: "sets 48h hide" },
  { id: "e6", source: "api-create", target: "badge-open", label: "shows red badge" },
  { id: "e7", source: "api-create", target: "sidebar-badge", label: "increments count", style: { strokeDasharray: "5 5" } },
  { id: "e8", source: "sidebar-badge", target: "manager-page", label: "manager navigates" },
  { id: "e9", source: "manager-page", target: "ticket-card" },
  { id: "e10", source: "ticket-card", target: "respond-action", label: "click Respond" },
  { id: "e11", source: "respond-action", target: "api-respond", label: "submit response" },
  { id: "e12", source: "api-respond", target: "badge-responded", label: "badge turns green" },
  { id: "e13", source: "badge-responded", target: "resolve-action", label: "staff clicks Resolve" },
  { id: "e14", source: "ticket-card", target: "resolve-action", label: "or manager resolves", style: { strokeDasharray: "5 5" } },
  { id: "e15", source: "resolve-action", target: "api-resolve" },
  { id: "e16", source: "api-resolve", target: "project-reappears", label: "ticket closed" },
  { id: "e17", source: "hide-effect", target: "project-reappears", label: "48h expires", style: { strokeDasharray: "5 5" } },
].map(e => ({ ...e, style: { ...e.style, stroke: "#94a3b8", strokeWidth: 1.5 }, labelStyle: { fontSize: 10, fill: "#94a3b8" } }));

export default function EscalatedTicketsFlowView() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" data-testid="page-flow-escalated">
      <div className="p-4 border-b space-y-2">
        <FlowNavigation />
        <h1 className="text-lg font-semibold">Escalated Tickets — Logic Flow</h1>
        <p className="text-xs text-muted-foreground">Page: escalated-tickets-view.tsx | Components: shared/EscalationDialog.tsx, shared/EscalationBadge.tsx | Routes: server/routes/escalation.ts</p>
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
