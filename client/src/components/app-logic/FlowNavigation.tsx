import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const tabs = [
  { label: "UC", path: "/app-logic/flow/uc" },
  { label: "Rebates", path: "/app-logic/flow/rebates" },
  { label: "Contracts", path: "/app-logic/flow/contracts" },
  { label: "Site Visits", path: "/app-logic/flow/site-visits" },
  { label: "AHJ", path: "/app-logic/flow/ahj" },
  { label: "Installs", path: "/app-logic/flow/installs" },
  { label: "Close-off", path: "/app-logic/flow/close-off" },
  { label: "Escalated", path: "/app-logic/flow/escalated" },
  { label: "Dashboard", path: "/app-logic/flow/dashboard" },
  { label: "Settings", path: "/app-logic/flow/settings" },
];

export function FlowNavigation() {
  const [location] = useLocation();

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="nav-flow-tabs">
      <Link href="/app-logic">
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" data-testid="button-back-app-logic">
          <ArrowLeft className="h-3.5 w-3.5" />
          App Logic
        </Button>
      </Link>
      <div className="h-4 w-px bg-border" />
      {tabs.map((tab) => (
        <Link key={tab.path} href={tab.path}>
          <Button
            variant={location === tab.path ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            data-testid={`button-flow-${tab.label.toLowerCase().replace(/[\s\/]+/g, '-')}`}
          >
            {tab.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}
