import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, MessageSquare, Loader2, CalendarClock, Upload, Paperclip, X, Minimize2, Maximize2 } from "lucide-react";
import { ESCALATION_VIEW_LABELS } from "@shared/schema";
import type { EscalationTicket } from "@shared/schema";
import { EscalationIssueDisplay } from "@/components/shared/EscalationIssueDisplay";
import { EscalationSlaTimer } from "@/components/shared/EscalationSlaTimer";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [collapsed, setCollapsed] = useState(false);
  if (tickets.length === 0) return null;

  return (
    <Card data-testid="section-escalation-tickets">
      <CardHeader className="py-3 px-4">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className="w-full flex items-center gap-2 text-sm font-medium cursor-pointer select-none"
          data-testid="toggle-escalation-tickets"
        >
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
            {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>
      </CardHeader>
      {!collapsed && (
        <CardContent className="py-2 px-4 space-y-3">
          {sorted.map(ticket => (
            <TicketSummary key={ticket.id} ticket={ticket} showActions />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export function EscalationTicketsInline({ projectId }: { projectId: string }) {
  const { tickets, open, resolved, sorted } = useProjectTickets(projectId);
  const [minimized, setMinimized] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  if (tickets.length === 0) return null;

  return (
    <>
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
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => setFocusOpen(true)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Open in focus mode"
              data-testid="button-escalation-focus"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMinimized(!minimized)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={minimized ? "Expand tickets" : "Minimize tickets"}
              data-testid="button-escalation-minimize"
            >
              {minimized ? <ChevronDown className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        {!minimized && (
          <div className="space-y-2">
            {sorted.map(ticket => (
              <TicketSummary key={ticket.id} ticket={ticket} showActions />
            ))}
          </div>
        )}
      </div>

      <Dialog open={focusOpen} onOpenChange={setFocusOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Escalation Tickets
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
            </DialogTitle>
            <DialogDescription>View and manage all escalation tickets for this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {sorted.map(ticket => (
              <TicketSummary key={ticket.id} ticket={ticket} showActions />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function TicketSummary({ ticket, showActions }: { ticket: EscalationTicket; showActions?: boolean }) {
  const [respondOpen, setRespondOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [response, setResponse] = useState("");
  const [respondedBy, setRespondedBy] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolvedBy, setResolvedBy] = useState("");
  const [snoozeDate, setSnoozeDate] = useState("");
  const [respondFiles, setRespondFiles] = useState<File[]>([]);
  const [resolveFiles, setResolveFiles] = useState<File[]>([]);
  const respondFileRef = useRef<HTMLInputElement>(null);
  const resolveFileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const { toast } = useToast();

  const today = toLocalDateString(new Date());
  const maxSnooze = new Date();
  maxSnooze.setDate(maxSnooze.getDate() + 14);
  const maxSnoozeStr = toLocalDateString(maxSnooze);

  const handleRespond = async () => {
    if (!response.trim() || !respondedBy.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("managerResponse", response.trim());
      formData.append("respondedBy", respondedBy.trim());
      for (const file of respondFiles) {
        formData.append("files", file);
      }
      const res = await fetch(`/api/escalation-tickets/${ticket.id}/respond`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to respond");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });
      toast({ title: "Response sent" });
      setRespondOpen(false);
      setResponse("");
      setRespondedBy("");
      setRespondFiles([]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to respond";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNote.trim() || !resolvedBy.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setResolving(true);
    try {
      const formData = new FormData();
      formData.append("resolutionNote", resolutionNote.trim());
      formData.append("resolvedBy", resolvedBy.trim());
      for (const file of resolveFiles) {
        formData.append("files", file);
      }
      const res = await fetch(`/api/escalation-tickets/${ticket.id}/resolve`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to resolve");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });
      toast({ title: "Ticket resolved" });
      setResolveOpen(false);
      setResolutionNote("");
      setResolvedBy("");
      setResolveFiles([]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to resolve";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  };

  const handleSnooze = async () => {
    if (!snoozeDate) {
      toast({ title: "Please select a date", variant: "destructive" });
      return;
    }
    setSnoozing(true);
    try {
      const hideUntil = new Date(snoozeDate + "T23:59:59");
      await apiRequest("PATCH", `/api/escalation-tickets/${ticket.id}/snooze`, {
        hideUntil: hideUntil.toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });
      toast({ title: `Hidden until ${new Date(snoozeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` });
      setSnoozeOpen(false);
      setSnoozeDate("");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to snooze";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSnoozing(false);
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

  const isActionable = ticket.status === "open" || ticket.status === "responded";

  const hideUntilDate = ticket.hideUntil ? new Date(ticket.hideUntil) : null;
  const isCurrentlyHidden = hideUntilDate && hideUntilDate > new Date();

  return (
    <>
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
          <EscalationSlaTimer createdAt={ticket.createdAt} status={ticket.status} />
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

        {showActions && isActionable && (
          <div className="mt-2 space-y-2">
            {isCurrentlyHidden && hideUntilDate && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                Hidden until {hideUntilDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
            <div className="flex gap-2 flex-wrap">
              {ticket.status === "open" && (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setRespondOpen(true)} data-testid={`button-respond-ticket-${ticket.id}`}>
                  <MessageSquare className="h-3 w-3" /> Respond
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setResolveOpen(true)} data-testid={`button-resolve-ticket-${ticket.id}`}>
                <CheckCircle2 className="h-3 w-3" /> Resolve
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setSnoozeOpen(true)} data-testid={`button-snooze-ticket-${ticket.id}`}>
                <CalendarClock className="h-3 w-3" /> Extend Hide
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={respondOpen} onOpenChange={setRespondOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Respond to Ticket</DialogTitle>
            <DialogDescription>Provide guidance or instructions for the staff member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor={`respond-name-${ticket.id}`} className="text-xs">Your Name</Label>
              <Input id={`respond-name-${ticket.id}`} value={respondedBy} onChange={(e) => setRespondedBy(e.target.value)} placeholder="Manager name" className="mt-1" data-testid="input-respond-name" />
            </div>
            <div>
              <Label htmlFor={`respond-msg-${ticket.id}`} className="text-xs">Your Response</Label>
              <Textarea id={`respond-msg-${ticket.id}`} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Provide guidance..." rows={4} className="mt-1" data-testid="input-respond-message" />
            </div>
            <div>
              <Label className="text-xs">Attachments</Label>
              <input type="file" ref={respondFileRef} className="hidden" multiple onChange={(e) => { if (e.target.files) setRespondFiles(prev => [...prev, ...Array.from(e.target.files!)]); if (respondFileRef.current) respondFileRef.current.value = ""; }} data-testid="input-respond-files" />
              <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs gap-1 mt-1" onClick={() => respondFileRef.current?.click()} data-testid="button-respond-attach">
                <Upload className="h-3 w-3" /> Attach Files
              </Button>
              {respondFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {respondFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                      <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-muted-foreground flex-shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
                      <button type="button" onClick={() => setRespondFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleRespond} disabled={submitting} className="w-full" data-testid="button-submit-respond">
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Send Response
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Ticket</DialogTitle>
            <DialogDescription>Describe what was done to resolve this issue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor={`resolve-name-${ticket.id}`} className="text-xs">Your Name</Label>
              <Input id={`resolve-name-${ticket.id}`} value={resolvedBy} onChange={(e) => setResolvedBy(e.target.value)} placeholder="Your name" className="mt-1" data-testid="input-resolve-name" />
            </div>
            <div>
              <Label htmlFor={`resolve-note-${ticket.id}`} className="text-xs">Resolution Description</Label>
              <Textarea id={`resolve-note-${ticket.id}`} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="What was done to resolve this..." rows={4} className="mt-1" data-testid="input-resolve-note" />
            </div>
            <div>
              <Label className="text-xs">Attachments</Label>
              <input type="file" ref={resolveFileRef} className="hidden" multiple onChange={(e) => { if (e.target.files) setResolveFiles(prev => [...prev, ...Array.from(e.target.files!)]); if (resolveFileRef.current) resolveFileRef.current.value = ""; }} data-testid="input-resolve-files" />
              <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs gap-1 mt-1" onClick={() => resolveFileRef.current?.click()} data-testid="button-resolve-attach">
                <Upload className="h-3 w-3" /> Attach Files
              </Button>
              {resolveFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {resolveFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                      <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-muted-foreground flex-shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
                      <button type="button" onClick={() => setResolveFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleResolve} disabled={resolving} className="w-full" data-testid="button-submit-resolve">
              {resolving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Mark as Resolved
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Extend Hide Duration</DialogTitle>
            <DialogDescription>Choose when this project should reappear in the team view. Maximum 14 days from today.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {isCurrentlyHidden && hideUntilDate && (
              <p className="text-xs text-muted-foreground">
                Currently hidden until {hideUntilDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
            <div>
              <Label htmlFor={`snooze-date-${ticket.id}`} className="text-xs">Return Date</Label>
              <Input
                id={`snooze-date-${ticket.id}`}
                type="date"
                min={today}
                max={maxSnoozeStr}
                value={snoozeDate}
                onChange={(e) => setSnoozeDate(e.target.value)}
                className="mt-1"
                data-testid="input-snooze-date"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                The project will stay hidden from the team view until end of this day.
              </p>
            </div>
            <Button onClick={handleSnooze} disabled={snoozing || !snoozeDate} className="w-full" data-testid="button-submit-snooze">
              {snoozing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Set Return Date
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
