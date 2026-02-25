import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Zap,
  CreditCard,
  FileText,
  MapPin,
  Building2,
  Wrench,
  Gift,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Clock,
  CalendarDays,
  List,
  Settings,
  PanelLeftClose,
  Bug,
  AlertTriangle,
  GitBranch,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import logoIcon from "@assets/Untitled_design_(4)_1771966965058.png";
import type { EscalationTicket } from "@shared/schema";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "All Projects", url: "/all", icon: List },
];

const viewNav = [
  { title: "Escalated Tickets", url: "/escalated", icon: AlertTriangle },
  { title: "UC Applications", url: "/uc", icon: Zap },
  { title: "Rebates", url: "/rebates", icon: Gift },
  { title: "Payment Method", url: "/payment-method", icon: CreditCard },
  { title: "Contracts", url: "/contracts", icon: FileText },
  { title: "Site Visits", url: "/site-visits", icon: MapPin },
  { title: "AHJ / Permitting", url: "/ahj", icon: Building2 },
  { title: "Install Coordination", url: "/installs", icon: Wrench },
  { title: "Install Calendar", url: "/install-calendar", icon: CalendarDays },
  { title: "Close-off", url: "/close-off", icon: CheckCircle2 },
];

const settingsNav = [
  { title: "Settings", url: "/settings", icon: Settings },
];

const itNav = [
  { title: "Error Log", url: "/error-log", icon: Bug },
  { title: "App Logic", url: "/app-logic", icon: GitBranch },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const { toggleSidebar } = useSidebar();

  const { data: syncStatus } = useQuery<{ lastSyncTime: string | null }>({
    queryKey: ['/api/asana/sync-status'],
    refetchInterval: 30000,
  });

  const { data: escalationTickets } = useQuery<EscalationTicket[]>({
    queryKey: ['/api/escalation-tickets'],
    refetchInterval: 60000,
  });
  const openTicketCount = (escalationTickets || []).filter(t => t.status === 'open' || t.status === 'responded').length;

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      const res = await apiRequest("POST", "/api/asana/sync-all");
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/asana/sync-status'] });
      toast({ title: `Synced ${data.synced} projects from Asana` });
    } catch (error: any) {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={logoIcon}
              alt="Solar Power Store"
              className="h-8 w-8 flex-shrink-0"
            />
            <div>
              <h2 className="text-sm font-bold text-sidebar-accent-foreground" data-testid="text-app-title">Solar PM</h2>
              <p className="text-[10px] text-sidebar-foreground/60">Project Tracker</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={toggleSidebar}
            data-testid="button-collapse-sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Work Views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {viewNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/[\s\/]+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.url === "/escalated" && openTicketCount > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-[20px] text-[10px] px-1.5 justify-center" data-testid="badge-escalation-count">
                          {openTicketCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>IT</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {itNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleQuickSync}
          disabled={syncing}
          data-testid="button-quick-sync"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
          )}
          {syncing ? "Syncing..." : "Sync from Asana"}
        </Button>
        {syncStatus?.lastSyncTime && (
          <div className="flex items-center gap-1 text-[10px] text-sidebar-foreground/50 mt-1 px-1">
            <Clock className="h-3 w-3" />
            Last: {formatTime(syncStatus.lastSyncTime)}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
