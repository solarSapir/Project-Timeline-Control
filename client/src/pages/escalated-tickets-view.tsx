import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/logo-spinner";
import { AlertTriangle, Search, MessageSquare, CheckCircle2, Clock, Loader2, Maximize2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EscalationTicket, Project } from "@shared/schema";
import { ESCALATION_VIEW_LABELS } from "@shared/schema";

const VIEW_TYPE_ROUTES: Record<string, string> = {
  uc: "/uc",
  contracts: "/contracts",
  payments: "/rebates",
  rebates: "/rebates",
  ahj: "/ahj",
  installs: "/installs",
  site_visits: "/site-visits",
  close_off: "/close-off",
};

function TicketCard({ ticket, project }: { ticket: EscalationTicket; project?: Project }) {
  const [respondOpen, setRespondOpen] = useState(false);
  const [response, setResponse] = useState("");
  const [respondedBy, setRespondedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleRespond = async () => {
    if (!response.trim() || !respondedBy.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("PATCH", `/api/escalation-tickets/${ticket.id}/respond`, {
        managerResponse: response.trim(),
        respondedBy: respondedBy.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });
      toast({ title: "Response sent" });
      setRespondOpen(false);
      setResponse("");
      setRespondedBy("");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to respond";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      await apiRequest("PATCH", `/api/escalation-tickets/${ticket.id}/resolve`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });
      toast({ title: "Ticket resolved" });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to resolve";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  };

  const statusColors = {
    open: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    responded: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    resolved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  };

  const borderColor = ticket.status === "open"
    ? "border-l-4 border-l-red-400"
    : ticket.status === "responded"
      ? "border-l-4 border-l-amber-400"
      : "border-l-4 border-l-green-400";

  return (
    <Card className={`${borderColor} ${ticket.status === "resolved" ? "opacity-60" : ""}`} data-testid={`card-ticket-${ticket.id}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/project/${ticket.projectId}`} className="font-medium text-sm text-primary hover:underline truncate" data-testid={`link-ticket-project-${ticket.id}`}>
                {project?.name || ticket.projectId}
              </Link>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5" data-testid={`badge-ticket-view-${ticket.id}`}>
                {ESCALATION_VIEW_LABELS[ticket.viewType] || ticket.viewType}
              </Badge>
              <Badge className={`text-[10px] px-1.5 py-0.5 border-0 ${statusColors[ticket.status as keyof typeof statusColors] || statusColors.open}`} data-testid={`badge-ticket-status-${ticket.id}`}>
                {ticket.status === "open" ? "Open" : ticket.status === "responded" ? "Responded" : "Resolved"}
              </Badge>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Created by {ticket.createdBy} on{" "}
              {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Unknown'}
            </div>
            <div className="mt-2 p-2.5 rounded bg-muted text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Issue:</p>
              {ticket.issue}
            </div>
            {ticket.status === "responded" && ticket.managerResponse && (
              <div className="mt-2 p-2.5 rounded bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                  Response from {ticket.respondedBy}
                  {ticket.respondedAt && (
                    <span className="font-normal ml-1">
                      ({new Date(ticket.respondedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})
                    </span>
                  )}
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">{ticket.managerResponse}</p>
              </div>
            )}
            {ticket.status === "resolved" && ticket.managerResponse && (
              <div className="mt-2 p-2.5 rounded bg-muted/50 text-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1">Response from {ticket.respondedBy}:</p>
                <p className="text-muted-foreground">{ticket.managerResponse}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {ticket.status === "open" && (
              <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => setRespondOpen(true)} data-testid={`button-respond-${ticket.id}`}>
                <MessageSquare className="h-3 w-3" />
                Respond
              </Button>
            )}
            {(ticket.status === "open" || ticket.status === "responded") && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleResolve} disabled={resolving} data-testid={`button-resolve-${ticket.id}`}>
                {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Resolve
              </Button>
            )}
            {VIEW_TYPE_ROUTES[ticket.viewType] && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => navigate(`${VIEW_TYPE_ROUTES[ticket.viewType]}?focus=${ticket.projectId}&ticket=${ticket.id}`)}
                data-testid={`button-focus-${ticket.id}`}
              >
                <Maximize2 className="h-3 w-3" />
                Focus
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={respondOpen} onOpenChange={setRespondOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Respond to Escalation</DialogTitle>
            <DialogDescription>Provide guidance to help the team member with their issue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-2.5 rounded bg-muted text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Issue from {ticket.createdBy}:</p>
              {ticket.issue}
            </div>
            <div>
              <Label htmlFor="respondedBy">Your Name</Label>
              <Input id="respondedBy" value={respondedBy} onChange={(e) => setRespondedBy(e.target.value)} placeholder="Enter your name" data-testid="input-respond-name" />
            </div>
            <div>
              <Label htmlFor="managerResponse">Your Response</Label>
              <Textarea id="managerResponse" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Provide guidance, instructions, or the answer to their question..." rows={4} data-testid="input-respond-message" />
            </div>
            <Button className="w-full" onClick={handleRespond} disabled={submitting} data-testid="button-submit-response">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              {submitting ? "Sending..." : "Send Response"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function EscalatedTicketsView() {
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");

  const { data: tickets, isLoading } = useQuery<EscalationTicket[]>({
    queryKey: ["/api/escalation-tickets"],
  });

  const { data: projects } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const projectMap = new Map((projects || []).map(p => [p.id, p]));

  const allTickets = tickets || [];
  const openCount = allTickets.filter(t => t.status === "open").length;
  const respondedCount = allTickets.filter(t => t.status === "responded").length;
  const resolvedCount = allTickets.filter(t => t.status === "resolved").length;

  const filtered = allTickets.filter(t => {
    if (filter !== "all" && t.status !== filter) return false;
    if (search) {
      const project = projectMap.get(t.projectId);
      const projectName = project?.name || "";
      if (!projectName.toLowerCase().includes(search.toLowerCase()) &&
          !t.issue.toLowerCase().includes(search.toLowerCase()) &&
          !t.createdBy.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  if (isLoading) {
    return <PageLoader title="Loading escalated tickets..." />;
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-escalated-title">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          Escalated Tickets
        </h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {openCount > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{openCount} open</span>}
          {respondedCount > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{respondedCount} responded</span>}
          <span>{resolvedCount} resolved</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-tickets" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-ticket-filter">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open ({openCount})</SelectItem>
            <SelectItem value="responded">Responded ({respondedCount})</SelectItem>
            <SelectItem value="resolved">Resolved ({resolvedCount})</SelectItem>
            <SelectItem value="all">All ({allTickets.length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            {filter === "open" ? <><AlertTriangle className="h-3.5 w-3.5" /> Open ({filtered.length})</>
            : filter === "responded" ? <><Clock className="h-3.5 w-3.5" /> Responded ({filtered.length})</>
            : filter === "resolved" ? <><CheckCircle2 className="h-3.5 w-3.5" /> Resolved ({filtered.length})</>
            : <>All ({filtered.length})</>}
          </p>
          {filtered.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} project={projectMap.get(ticket.projectId)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>{filter === "open" ? "No open escalation tickets — the team is doing great!" : "No tickets match this filter."}</p>
        </div>
      )}
    </div>
  );
}
