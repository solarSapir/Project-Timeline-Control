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
import PaymentMethodView from "@/pages/payment-method-view";
import ContractsView from "@/pages/contracts-view";
import SiteVisitsView from "@/pages/site-visits-view";
import AHJView from "@/pages/ahj-view";
import InstallsView from "@/pages/installs-view";
import RebatesView from "@/pages/rebates-view";
import CloseOffView from "@/pages/close-off-view";
import SettingsView from "@/pages/settings-view";
import ProjectProfile from "@/pages/project-profile";
import InstallCalendar from "@/pages/install-calendar";
import AllProjectsView from "@/pages/all-projects-view";
import ErrorLogView from "@/pages/error-log-view";
import EscalatedTicketsView from "@/pages/escalated-tickets-view";
import AppLogicIndex from "@/pages/app-logic/AppLogicIndex";
import SchemaView from "@/pages/app-logic/SchemaView";
import ApiMapView from "@/pages/app-logic/ApiMapView";
import UcFlowView from "@/pages/app-logic/flows/UcFlowView";
import RebateFlowView from "@/pages/app-logic/flows/RebateFlowView";
import ContractFlowView from "@/pages/app-logic/flows/ContractFlowView";
import SiteVisitFlowView from "@/pages/app-logic/flows/SiteVisitFlowView";
import AhjFlowView from "@/pages/app-logic/flows/AhjFlowView";
import InstallFlowView from "@/pages/app-logic/flows/InstallFlowView";
import CloseOffFlowView from "@/pages/app-logic/flows/CloseOffFlowView";
import DashboardFlowView from "@/pages/app-logic/flows/DashboardFlowView";
import SettingsFlowView from "@/pages/app-logic/flows/SettingsFlowView";
import EscalatedTicketsFlowView from "@/pages/app-logic/flows/EscalatedTicketsFlowView";

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
        <Route path="/escalated" component={EscalatedTicketsView} />
        <Route path="/uc" component={UCView} />
        <Route path="/rebates" component={RebatesView} />
        <Route path="/payment-method" component={PaymentMethodView} />
        <Route path="/contracts" component={ContractsView} />
        <Route path="/site-visits" component={SiteVisitsView} />
        <Route path="/ahj" component={AHJView} />
        <Route path="/installs" component={InstallsView} />
        <Route path="/close-off" component={CloseOffView} />
        <Route path="/all" component={AllProjectsView} />
        <Route path="/install-calendar" component={InstallCalendar} />
        <Route path="/project/:id" component={ProjectProfile} />
        <Route path="/settings" component={SettingsView} />
        <Route path="/error-log" component={ErrorLogView} />
        <Route path="/app-logic" component={AppLogicIndex} />
        <Route path="/app-logic/schema" component={SchemaView} />
        <Route path="/app-logic/api" component={ApiMapView} />
        <Route path="/app-logic/flow/uc" component={UcFlowView} />
        <Route path="/app-logic/flow/rebates" component={RebateFlowView} />
        <Route path="/app-logic/flow/contracts" component={ContractFlowView} />
        <Route path="/app-logic/flow/site-visits" component={SiteVisitFlowView} />
        <Route path="/app-logic/flow/ahj" component={AhjFlowView} />
        <Route path="/app-logic/flow/installs" component={InstallFlowView} />
        <Route path="/app-logic/flow/close-off" component={CloseOffFlowView} />
        <Route path="/app-logic/flow/dashboard" component={DashboardFlowView} />
        <Route path="/app-logic/flow/settings" component={SettingsFlowView} />
        <Route path="/app-logic/flow/escalated" component={EscalatedTicketsFlowView} />
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
