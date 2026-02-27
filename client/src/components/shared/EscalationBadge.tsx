import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Eye, CheckCircle2, MessageSquare, Loader2, CalendarClock, Upload, Paperclip, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EscalationTicket } from "@shared/schema";

interface EscalationBadgeProps {
  projectId: string;
  tickets?: EscalationTicket[];
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function EscalationBadge({ projectId, tickets: ticketsProp }: EscalationBadgeProps) {
  const [viewOpen, setViewOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [replyMode, setReplyMode] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyBy, setReplyBy] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const [replying, setReplying] = useState(false);
  const [snoozeMode, setSnoozeMode] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState("");
  const [snoozing, setSnoozing] = useState(false);
  const { toast } = useToast();

  const today = toLocalDateString(new Date());
  const maxSnooze = new Date();
  maxSnooze.setDate(maxSnooze.getDate() + 14);
  const maxSnoozeStr = toLocalDateString(maxSnooze);

  const { data: allTickets } = useQuery<EscalationTicket[]>({
    queryKey: ["/api/escalation-tickets"],
    enabled: !ticketsProp,
    staleTime: 60000,
  });

  const tickets = ticketsProp || allTickets;

  const projectTickets = tickets?.filter(t => t.projectId === projectId) || [];
  const activeTicket = projectTickets.find(t => t.status === "open" || t.status === "responded");
  const openCount = projectTickets.filter(t => t.status === "open" || t.status === "responded").length;
  const resolvedCount = projectTickets.filter(t => t.status === "resolved").length;

  if (!activeTicket && resolvedCount === 0) return null;

  const handleResolve = async () => {
    setResolving(true);
    try {
      const formData = new FormData();
      formData.append("resolutionNote", `Resolved after reviewing manager response: "${activeTicket!.managerResponse || 'N/A'}"`);
      formData.append("resolvedBy", activeTicket!.respondedBy || "Staff");
      const res = await fetch(`/api/escalation-tickets/${activeTicket!.id}/resolve`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to resolve");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });
      toast({ title: "Ticket resolved" });
      setViewOpen(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to resolve ticket";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !replyBy.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setReplying(true);
    try {
      const formData = new FormData();
      formData.append("replyText", replyText.trim());
      formData.append("replyBy", replyBy.trim());
      for (const file of replyFiles) {
        formData.append("files", file);
      }
      const res = await fetch(`/api/escalation-tickets/${activeTicket!.id}/staff-reply`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to reply");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });
      toast({ title: "Reply sent" });
      setReplyMode(false);
      setReplyText("");
      setReplyBy("");
      setReplyFiles([]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to send reply";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setReplying(false);
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
      const res = await fetch(`/api/escalation-tickets/${activeTicket!.id}/snooze`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hideUntil: hideUntil.toISOString() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to snooze");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/escalation-tickets"] });
      toast({ title: `Hidden until ${new Date(snoozeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` });
      setSnoozeMode(false);
      setSnoozeDate("");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to snooze";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSnoozing(false);
    }
  };

  const resetDialogState = (open: boolean) => {
    setViewOpen(open);
    if (!open) {
      setReplyMode(false);
      setReplyText("");
      setReplyBy("");
      setReplyFiles([]);
      setSnoozeMode(false);
      setSnoozeDate("");
    }
  };

  if (!activeTicket && resolvedCount > 0) {
    return (
      <Badge
        className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0"
        data-testid={`badge-tickets-resolved-${projectId}`}
      >
        <CheckCircle2 className="h-3 w-3 mr-0.5" />
        {resolvedCount} resolved
      </Badge>
    );
  }

  const hideUntilDate = activeTicket?.hideUntil ? new Date(activeTicket.hideUntil) : null;
  const isCurrentlyHidden = hideUntilDate && hideUntilDate > new Date();

  const renderDialog = () => (
    <Dialog open={viewOpen} onOpenChange={resetDialogState}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {activeTicket!.status === "responded" ? (
              <><MessageSquare className="h-5 w-5 text-amber-500" /> Manager Response</>
            ) : (
              <><AlertTriangle className="h-5 w-5 text-red-500" /> Escalation Ticket</>
            )}
          </DialogTitle>
          <DialogDescription>
            {activeTicket!.status === "responded"
              ? "A manager has responded to your escalation ticket."
              : "This ticket is awaiting a manager response."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-md bg-muted">
            <p className="text-xs font-medium text-muted-foreground mb-1">Your issue:</p>
            <p className="text-sm whitespace-pre-wrap">{activeTicket!.issue}</p>
          </div>

          {activeTicket!.managerResponse && (
            <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                Response from {activeTicket!.respondedBy}
                {activeTicket!.respondedAt && (
                  <span className="font-normal ml-1">
                    ({new Date(activeTicket!.respondedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})
                  </span>
                )}
              </p>
              <p className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap">{activeTicket!.managerResponse}</p>
            </div>
          )}

          {isCurrentlyHidden && hideUntilDate && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              Hidden until {hideUntilDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}

          {replyMode ? (
            <div className="space-y-3 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
              <p className="text-xs font-medium">Reply to Manager</p>
              <div>
                <Label htmlFor="replyBy" className="text-xs">Your Name</Label>
                <Input id="replyBy" value={replyBy} onChange={(e) => setReplyBy(e.target.value)} placeholder="Enter your name" className="mt-1" data-testid="input-badge-reply-name" />
              </div>
              <div>
                <Label htmlFor="replyText" className="text-xs">Your Reply</Label>
                <Textarea id="replyText" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write your reply..." rows={3} className="mt-1" data-testid="input-badge-reply-text" />
              </div>
              <div>
                <input type="file" ref={replyFileRef} className="hidden" multiple onChange={(e) => { if (e.target.files) setReplyFiles(prev => [...prev, ...Array.from(e.target.files!)]); if (replyFileRef.current) replyFileRef.current.value = ""; }} data-testid="input-badge-reply-files" />
                <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={() => replyFileRef.current?.click()} data-testid="button-badge-reply-attach">
                  <Upload className="h-3 w-3" /> Attach Files
                </Button>
                {replyFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {replyFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                        <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate flex-1">{f.name}</span>
                        <span className="text-muted-foreground flex-shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
                        <button type="button" onClick={() => setReplyFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleReply} disabled={replying || !replyText.trim() || !replyBy.trim()} data-testid="button-badge-send-reply">
                  {replying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-1" />}
                  {replying ? "Sending..." : "Send Reply"}
                </Button>
                <Button variant="outline" onClick={() => { setReplyMode(false); setReplyText(""); setReplyBy(""); setReplyFiles([]); }}>Cancel</Button>
              </div>
            </div>
          ) : snoozeMode ? (
            <div className="space-y-3 p-3 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
              <p className="text-xs font-medium">Extend Hide Duration</p>
              <div>
                <Label htmlFor="badgeSnoozeDate" className="text-xs">Return Date (max 14 days)</Label>
                <Input
                  id="badgeSnoozeDate"
                  type="date"
                  min={today}
                  max={maxSnoozeStr}
                  value={snoozeDate}
                  onChange={(e) => setSnoozeDate(e.target.value)}
                  className="mt-1"
                  data-testid="input-badge-snooze-date"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  The project will stay hidden from the team view until end of this day.
                </p>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleSnooze} disabled={snoozing || !snoozeDate} data-testid="button-badge-submit-snooze">
                  {snoozing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-1" />}
                  {snoozing ? "Setting..." : "Set Return Date"}
                </Button>
                <Button variant="outline" onClick={() => { setSnoozeMode(false); setSnoozeDate(""); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeTicket!.status === "responded" && (
                <Button variant="outline" className="w-full gap-1" onClick={() => setReplyMode(true)} data-testid="button-badge-reply">
                  <MessageSquare className="h-4 w-4" />
                  Reply to Manager
                </Button>
              )}
              <Button variant="outline" className="w-full gap-1" onClick={() => setSnoozeMode(true)} data-testid="button-badge-snooze">
                <CalendarClock className="h-4 w-4" />
                Extend Hide
              </Button>
              <Button className="w-full" onClick={handleResolve} disabled={resolving} data-testid="button-resolve-ticket">
                {resolving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                {resolving ? "Resolving..." : "Mark as Resolved & Continue"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (activeTicket!.status === "responded") {
    return (
      <div className="flex items-center gap-1">
        <Badge
          className="text-[10px] px-1.5 py-0.5 cursor-pointer bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-0"
          onClick={() => setViewOpen(true)}
          data-testid={`badge-response-available-${projectId}`}
        >
          <Eye className="h-3 w-3 mr-1" />
          Response Available
        </Badge>
        {resolvedCount > 0 && (
          <Badge
            className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0"
            data-testid={`badge-tickets-resolved-${projectId}`}
          >
            {resolvedCount} resolved
          </Badge>
        )}
        {renderDialog()}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Badge
        className="text-[10px] px-1.5 py-0.5 cursor-pointer bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-0"
        onClick={() => setViewOpen(true)}
        data-testid={`badge-escalated-${projectId}`}
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        {openCount > 1 ? `${openCount} open` : "Escalated"}
      </Badge>
      {resolvedCount > 0 && (
        <Badge
          className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0"
          data-testid={`badge-tickets-resolved-${projectId}`}
        >
          {resolvedCount} resolved
        </Badge>
      )}
      {renderDialog()}
    </div>
  );
}
