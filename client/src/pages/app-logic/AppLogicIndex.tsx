import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, GitBranch, Server, Zap, Gift, CreditCard, FileText, MapPin, Building2, Wrench, CheckCircle2, LayoutDashboard, Settings, AlertTriangle, HardHat, PauseCircle, Timer } from "lucide-react";

const flowPages = [
  { title: "UC Applications", url: "/app-logic/flow/uc", icon: Zap, desc: "Status changes, approval/rejection dialogs, hide logic, KPIs" },
  { title: "Rebates", url: "/app-logic/flow/rebates", icon: Gift, desc: "HRSP checklist, follow-up cycle, close-off due dates" },
  { title: "Contracts", url: "/app-logic/flow/contracts", icon: FileText, desc: "Dependency gating, approval, document uploads" },
  { title: "Site Visits", url: "/app-logic/flow/site-visits", icon: MapPin, desc: "Scheduling, photo uploads, status tracking" },
  { title: "AHJ / Permitting", url: "/app-logic/flow/ahj", icon: Building2, desc: "Permit status tracking, follow-up logic" },
  { title: "Install Coordination", url: "/app-logic/flow/installs", icon: Wrench, desc: "Install scheduling, team stages, calendar" },
  { title: "Close-off", url: "/app-logic/flow/close-off", icon: CheckCircle2, desc: "Final payments, completion tracking" },
  { title: "Escalated Tickets", url: "/app-logic/flow/escalated", icon: AlertTriangle, desc: "I'm Stuck lifecycle: create → hide → respond → resolve → reappear" },
  { title: "Dashboard", url: "/app-logic/flow/dashboard", icon: LayoutDashboard, desc: "KPI sections, stats cards, recent projects" },
  { title: "Settings", url: "/app-logic/flow/settings", icon: Settings, desc: "Sync, workflow config, HRSP config, UC rules" },
  { title: "Project Planner", url: "/app-logic/flow/planner", icon: HardHat, desc: "Contractor assignment, scope, proposal, site plan, NS permits" },
  { title: "Paused Projects & Insights", url: "/app-logic/flow/paused", icon: PauseCircle, desc: "Pause reasons, AI insights, repeat pauser detection" },
  { title: "Claims & KPI", url: "/app-logic/flow/claims", icon: Timer, desc: "Task claiming, time tracking, staff productivity" },
  { title: "Payment Method", url: "/app-logic/flow/payment-method", icon: CreditCard, desc: "Payment method tracking and updates" },
];

export default function AppLogicIndex() {
  return (
    <div className="p-6 space-y-6 max-w-6xl" data-testid="page-app-logic">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-app-logic-title">App Logic</h1>
        <p className="text-muted-foreground mt-1">
          Visual documentation of the app's database schema, API routes, and tab-by-tab logic flows.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/app-logic/schema">
          <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all h-full" data-testid="card-schema-link">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <Database className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base">Database Schema</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                18 tables with fields, types, and relationships. Color-coded by domain.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/app-logic/api">
          <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all h-full" data-testid="card-api-link">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <Server className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">API Route Map</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                All endpoints grouped by feature with methods, descriptions, and table usage.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-dashed" data-testid="card-flows-summary">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <GitBranch className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base">Tab Logic Flows</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              14 interactive flow diagrams showing data flow, actions, and wiring per tab.
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Tab Logic Flows</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {flowPages.map((page) => (
            <Link key={page.url} href={page.url}>
              <Card className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all h-full" data-testid={`card-flow-${page.title.toLowerCase().replace(/[\s\/]+/g, '-')}`}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <page.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{page.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{page.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
