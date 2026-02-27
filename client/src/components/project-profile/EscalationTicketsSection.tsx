import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ESCALATION_VIEW_LABELS } from "@shared/schema";
import type { EscalationTicket } from "@shared/schema";
import { EscalationIssueDisplay } from "@/components/shared/EscalationIssueDisplay";

function useProjectTickets(projectId: string) {
  const { data: allTickets } = useQuery<EscalationTicket[]>({
    queryKey: ["/api/escalation-tickets"],
    staleTime: 60000,
  });

  const tickets = (allTickets || []).filter(t => t.projectId === projectId);
  const open = tickets.filter(t => t.status === "open" || t.status === "responded");
  const resolved = tickets.filter(t => t.status === "resolved");
  const sorted = [...tickets].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
  return { tickets, open, resolved, sorted };
}

export function EscalationTicketsSection({ projectId }: { projectId: string }) {
  const { tickets, open, resolved, sorted } = useProjectTickets(projectId);
  if (tickets.length === 0) return null;

  return (
    <Card data-testid="section-escalation-tickets">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Escalation Tickets
          <div className="flex items-center gap-2 ml-auto">
            {open.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5" data-testid="badge-tickets-open">
                {open.length} open
              </Badge>
            )}
            {resolved.length > 0 && (
              <Badge className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0" data-testid="badge-tickets-resolved">
                {resolved.length} resolved
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4 space-y-3">
        {sorted.map(ticket => (
          <TicketSummary key={ticket.id} ticket={ticket} />
        ))}
      </CardContent>
    </Card>
  );
}

export function EscalationTicketsInline({ projectId }: { projectId: string }) {
  const { tickets, open, resolved, sorted } = useProjectTickets(projectId);
  if (tickets.length === 0) return null;

  return (
    <div className="bg-muted/30 rounded-lg p-4 border space-y-2" data-testid="inline-escalation-tickets">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          Escalation Tickets
        </h4>
        {open.length > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
            {open.length} open
          </Badge>
        )}
        {resolved.length > 0 && (
          <Badge className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0">
            {resolved.length} resolved
          </Badge>
        )}
      </div>
      <div className="space-y-2">
        {sorted.map(ticket => (
          <TicketSummary key={ticket.id} ticket={ticket} />
        ))}
      </div>
    </div>
  );
}

function TicketSummary({ ticket }: { ticket: EscalationTicket }) {
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
    <div className={`${borderColor} bg-muted/30 p-3 ${ticket.status === "resolved" ? "opacity-70" : ""}`} data-testid={`ticket-summary-${ticket.id}`}>
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
          {ESCALATION_VIEW_LABELS[ticket.viewType] || ticket.viewType}
        </Badge>
        <Badge className={`text-[10px] px-1.5 py-0.5 border-0 ${statusColors[ticket.status as keyof typeof statusColors] || statusColors.open}`}>
          {ticket.status === "open" ? (
            <><AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Open</>
          ) : ticket.status === "responded" ? (
            "Responded"
          ) : (
            <><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Resolved</>
          )}
        </Badge>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
        </span>
      </div>
      <div className="text-xs text-muted-foreground mb-1">
        Opened by {ticket.createdBy}
      </div>
      <div className="text-sm">
        <EscalationIssueDisplay issue={ticket.issue} projectId={ticket.projectId} ticketId={ticket.id} compact />
      </div>

      {ticket.managerResponse && (
        <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
          <p className="text-[10px] font-medium text-green-700 dark:text-green-300 mb-0.5">
            Response from {ticket.respondedBy}
          </p>
          <p className="text-xs text-green-800 dark:text-green-200">{ticket.managerResponse}</p>
        </div>
      )}

      {ticket.status === "resolved" && ticket.resolutionNote && (
        <div className="mt-2 p-2 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <p className="text-[10px] font-medium text-blue-700 dark:text-blue-300 mb-0.5">
            Resolution by {ticket.resolvedBy}
            {ticket.resolvedAt && (
              <span className="font-normal ml-1">
                ({new Date(ticket.resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
              </span>
            )}
          </p>
          <p className="text-xs text-blue-800 dark:text-blue-200">{ticket.resolutionNote}</p>
        </div>
      )}
    </div>
  );
}
