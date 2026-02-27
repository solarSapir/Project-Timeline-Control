import { useState, useRef } from "react";
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
import { AlertTriangle, Search, MessageSquare, CheckCircle2, Clock, Loader2, Maximize2, CalendarClock, Paperclip, X, Upload } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EscalationTicket, Project } from "@shared/schema";
import { ESCALATION_VIEW_LABELS } from "@shared/schema";
import { EscalationInlineCard } from "@/components/shared/EscalationInlineCard";
import { ExpandedProjectView } from "@/components/uc/ExpandedProjectView";
import { RebateProjectModal } from "@/components/hrsp/RebateProjectModal";
import { InstallTeamSubtaskPanel, AhjSubtaskPanel } from "@/components/shared/SubtaskExpandPanel";
import { EscalationIssueDisplay } from "@/components/shared/EscalationIssueDisplay";
import { EscalationSlaTimer } from "@/components/shared/EscalationSlaTimer";

function TicketCard({ ticket, project, onFocus }: { ticket: EscalationTicket; project?: Project; onFocus: (ticket: EscalationTicket, project: Project) => void }) {
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

  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const maxSnoozeStr = (() => { const d = new Date(); d.setDate(d.getDate()+14); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  const handleSnooze = async () => {
    if (!snoozeDate) { toast({ title: "Please select a date", variant: "destructive" }); return; }
    setSnoozing(true);
    try {
      const hideUntil = new Date(snoozeDate + "T23:59:59");
      await apiRequest("PATCH", `/api/escalation-tickets/${ticket.id}/snooze`, { hideUntil: hideUntil.toISOString() });
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });
      toast({ title: `Hidden until ${new Date(snoozeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` });
      setSnoozeOpen(false);
      setSnoozeDate("");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to snooze";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setSnoozing(false); }
  };

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
              <EscalationSlaTimer createdAt={ticket.createdAt} status={ticket.status} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Created by {ticket.createdBy} on{" "}
              {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Unknown'}
            </div>
            <div className="mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Issue:</p>
              <EscalationIssueDisplay issue={ticket.issue} projectId={ticket.projectId} ticketId={ticket.id} />
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
            {ticket.status === "resolved" && ticket.resolutionNote && (
              <div className="mt-2 p-2.5 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                  Resolution by {ticket.resolvedBy}
                  {ticket.resolvedAt && (
                    <span className="font-normal ml-1">
                      ({new Date(ticket.resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})
                    </span>
                  )}
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">{ticket.resolutionNote}</p>
              </div>
            )}
            {(ticket.status === "open" || ticket.status === "responded") && ticket.hideUntil && new Date(ticket.hideUntil) > new Date() && (
              <p className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                Hidden until {new Date(ticket.hideUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {ticket.status === "open" && (
              <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => setRespondOpen(true)} data-testid={`button-respond-${ticket.id}`}>
                <MessageSquare className="h-3 w-3" />
                Respond
              </Button>
            )}
            {(ticket.status === "open" || ticket.status === "responded") && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setResolveOpen(true)} data-testid={`button-resolve-${ticket.id}`}>
                <CheckCircle2 className="h-3 w-3" />
                Resolve
              </Button>
            )}
            {(ticket.status === "open" || ticket.status === "responded") && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setSnoozeOpen(true)} data-testid={`button-snooze-${ticket.id}`}>
                <CalendarClock className="h-3 w-3" />
                Extend Hide
              </Button>
            )}
            {project && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => onFocus(ticket, project)}
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
            <div>
              <Label>Attachments</Label>
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
            <Button className="w-full" onClick={handleRespond} disabled={submitting} data-testid="button-submit-response">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              {submitting ? "Sending..." : "Send Response"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-resolve-ticket">
          <DialogHeader>
            <DialogTitle>Resolve Escalation Ticket</DialogTitle>
            <DialogDescription>Describe what was done to resolve this issue before marking it as resolved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-2.5 rounded bg-muted text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Issue from {ticket.createdBy}:</p>
              {ticket.issue}
            </div>
            <div>
              <Label htmlFor="resolvedBy">Your Name</Label>
              <Input id="resolvedBy" value={resolvedBy} onChange={(e) => setResolvedBy(e.target.value)} placeholder="Enter your name" data-testid="input-resolved-by" />
            </div>
            <div>
              <Label htmlFor="resolutionNote">Resolution Description</Label>
              <Textarea id="resolutionNote" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="Describe what was done to resolve this issue..." rows={4} data-testid="input-resolution-note" />
            </div>
            <div>
              <Label>Attachments</Label>
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
            <Button className="w-full" onClick={handleResolve} disabled={resolving || !resolutionNote.trim() || !resolvedBy.trim()} data-testid="button-submit-resolve">
              {resolving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {resolving ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend Hide Duration</DialogTitle>
            <DialogDescription>Choose when this project should reappear in the team view. Maximum 14 days from today.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {ticket.hideUntil && new Date(ticket.hideUntil) > new Date() && (
              <p className="text-xs text-muted-foreground">
                Currently hidden until {new Date(ticket.hideUntil).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
            <div>
              <Label htmlFor={`snooze-${ticket.id}`}>Return Date</Label>
              <Input id={`snooze-${ticket.id}`} type="date" min={todayStr} max={maxSnoozeStr} value={snoozeDate} onChange={(e) => setSnoozeDate(e.target.value)} className="mt-1" data-testid="input-snooze-date" />
              <p className="text-[10px] text-muted-foreground mt-1">The project will stay hidden from the team view until end of this day.</p>
            </div>
            <Button className="w-full" onClick={handleSnooze} disabled={snoozing || !snoozeDate} data-testid="button-submit-snooze">
              {snoozing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-2" />}
              {snoozing ? "Setting..." : "Set Return Date"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FocusViewContent({ ticket, project }: { ticket: EscalationTicket; project: Project }) {
  const { data: ucOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/ucStatus'],
    enabled: ticket.viewType === 'uc',
  });
  const statusOptions = Array.isArray(ucOptions) ? ucOptions.map(o => o.name) : [];

  const viewLabel = ESCALATION_VIEW_LABELS[ticket.viewType] || ticket.viewType;

  return (
    <div className="space-y-4">
      <EscalationInlineCard ticketId={ticket.id} />

      <div className="border-t pt-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">{viewLabel} — Project Details</p>

        {ticket.viewType === 'uc' && (
          <ExpandedProjectView project={project} statusOptions={statusOptions} onStatusChange={() => {}} />
        )}

        {(ticket.viewType === 'contracts' || ticket.viewType === 'site_visits' || ticket.viewType === 'installs') && (
          <InstallTeamSubtaskPanel
            projectId={project.id}
            subtaskName={ticket.viewType === 'contracts' ? 'Client Contract' : ticket.viewType === 'site_visits' ? 'Site Visit' : 'Install'}
            label={ticket.viewType === 'contracts' ? 'Client Contract Subtask' : ticket.viewType === 'site_visits' ? 'Site Visit Subtask' : 'Install Subtask'}
          />
        )}

        {ticket.viewType === 'ahj' && (
          <AhjSubtaskPanel projectId={project.id} />
        )}

        {(ticket.viewType === 'payments' || ticket.viewType === 'rebates' || ticket.viewType === 'close_off') && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">HRSP Status:</span>{" "}
                <span className="font-medium">{project.hrspStatus || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Province:</span>{" "}
                <span className="font-medium">{project.province || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">UC Status:</span>{" "}
                <span className="font-medium">{project.ucStatus || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">PM Status:</span>{" "}
                <span className="font-medium">{project.pmStatus || '—'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EscalatedTicketsView() {
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [focusTicket, setFocusTicket] = useState<EscalationTicket | null>(null);
  const [focusProject, setFocusProject] = useState<Project | null>(null);

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
  }).sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  });

  const handleFocus = (ticket: EscalationTicket, project: Project) => {
    setFocusTicket(ticket);
    setFocusProject(project);
  };

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
            <TicketCard key={ticket.id} ticket={ticket} project={projectMap.get(ticket.projectId)} onFocus={handleFocus} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>{filter === "open" ? "No open escalation tickets — the team is doing great!" : "No tickets match this filter."}</p>
        </div>
      )}

      <Dialog open={!!focusTicket && !!focusProject} onOpenChange={(open) => { if (!open) { setFocusTicket(null); setFocusProject(null); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ticket-focus">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Maximize2 className="h-5 w-5" />
              {focusProject?.name}
            </DialogTitle>
            <DialogDescription>
              {focusTicket ? `${ESCALATION_VIEW_LABELS[focusTicket.viewType] || focusTicket.viewType} — Escalation ticket and project details` : ''}
            </DialogDescription>
          </DialogHeader>
          {focusTicket && focusProject && (
            <FocusViewContent ticket={focusTicket} project={focusProject} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
