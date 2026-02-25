import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { initGlobalErrorHandlers, trackNavigation } from "./lib/error-logger";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import UCView from "@/pages/uc-view";
import ContractsView from "@/pages/contracts-view";
import ContractCreationView from "@/pages/contract-creation-view";
import SiteVisitsView from "@/pages/site-visits-view";
import AHJView from "@/pages/ahj-view";
import InstallsView from "@/pages/installs-view";
import PaymentsView from "@/pages/payments-view";
import CloseOffView from "@/pages/close-off-view";
import SyncView from "@/pages/sync-view";
import ProjectProfile from "@/pages/project-profile";
import InstallCalendar from "@/pages/install-calendar";
import AllProjectsView from "@/pages/all-projects-view";
import ErrorLogView from "@/pages/error-log-view";

initGlobalErrorHandlers();

function NavigationTracker() {
  const [location] = useLocation();
  useEffect(() => { trackNavigation(location); }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <NavigationTracker />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/uc" component={UCView} />
        <Route path="/contracts" component={ContractsView} />
        <Route path="/contract-creation" component={ContractCreationView} />
        <Route path="/site-visits" component={SiteVisitsView} />
        <Route path="/ahj" component={AHJView} />
        <Route path="/installs" component={InstallsView} />
        <Route path="/payments" component={PaymentsView} />
        <Route path="/close-off" component={CloseOffView} />
        <Route path="/all" component={AllProjectsView} />
        <Route path="/install-calendar" component={InstallCalendar} />
        <Route path="/project/:id" component={ProjectProfile} />
        <Route path="/sync" component={SyncView} />
        <Route path="/error-log" component={ErrorLogView} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center gap-1 p-2 border-b">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
