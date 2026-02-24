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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
];

const viewNav = [
  { title: "UC Applications", url: "/uc", icon: Zap },
  { title: "Rebates", url: "/payments", icon: Gift },
  { title: "Payment Method", url: "/contracts", icon: CreditCard },
  { title: "Contracts", url: "/contract-creation", icon: FileText },
  { title: "Site Visits", url: "/site-visits", icon: MapPin },
  { title: "AHJ / Permitting", url: "/ahj", icon: Building2 },
  { title: "Install Coordination", url: "/installs", icon: Wrench },
  { title: "Close-off", url: "/close-off", icon: CheckCircle2 },
];

const settingsNav = [
  { title: "Asana Sync", url: "/sync", icon: RefreshCw },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const { data: syncStatus } = useQuery<{ lastSyncTime: string | null }>({
    queryKey: ['/api/asana/sync-status'],
    refetchInterval: 30000,
  });

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
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold" data-testid="text-app-title">Solar PM</h2>
            <p className="text-xs text-muted-foreground">Project Tracker</p>
          </div>
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
                      <span>{item.title}</span>
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
      </SidebarContent>
      <SidebarFooter className="p-3 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
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
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 px-1">
            <Clock className="h-3 w-3" />
            Last: {formatTime(syncStatus.lastSyncTime)}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
