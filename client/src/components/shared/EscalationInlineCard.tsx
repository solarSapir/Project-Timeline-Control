import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, MessageSquare, CheckCircle2, Loader2, Upload, Paperclip, X } from "lucide-react";
import { EscalationSlaTimer } from "./EscalationSlaTimer";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EscalationTicket } from "@shared/schema";
import { EscalationIssueDisplay } from "./EscalationIssueDisplay";

interface Props {
  ticketId: string;
}

export function EscalationInlineCard({ ticketId }: Props) {
  const [respondOpen, setRespondOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [response, setResponse] = useState("");
  const [respondedBy, setRespondedBy] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolvedBy, setResolvedBy] = useState("");
  const [respondFiles, setRespondFiles] = useState<File[]>([]);
  const [resolveFiles, setResolveFiles] = useState<File[]>([]);
  const respondFileRef = useRef<HTMLInputElement>(null);
  const resolveFileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const { toast } = useToast();

  const { data: ticket } = useQuery<EscalationTicket>({
    queryKey: ['/api/escalation-tickets', ticketId],
  });

  if (!ticket) return null;

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

  return (
    <>
      <Card className="border-l-4 border-l-red-400 bg-red-50/50 dark:bg-red-950/20" data-testid={`inline-ticket-${ticket.id}`}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">Escalation Ticket</span>
            <Badge className={`text-[10px] px-1.5 py-0.5 border-0 ${statusColors[ticket.status as keyof typeof statusColors] || statusColors.open}`}>
              {ticket.status === "open" ? "Open" : ticket.status === "responded" ? "Responded" : "Resolved"}
            </Badge>
            <EscalationSlaTimer createdAt={ticket.createdAt} status={ticket.status} />
            <span className="text-[11px] text-muted-foreground ml-auto">
              by {ticket.createdBy} · {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
            </span>
          </div>
          <EscalationIssueDisplay issue={ticket.issue} projectId={ticket.projectId} ticketId={ticket.id} />
          {(ticket.status === "responded" || ticket.status === "resolved") && ticket.managerResponse && (
            <div className="p-2.5 rounded bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 mb-2">
              <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                Response from {ticket.respondedBy}
              </p>
              <p className="text-sm text-green-800 dark:text-green-200">{ticket.managerResponse}</p>
            </div>
          )}
          {ticket.status === "resolved" && ticket.resolutionNote && (
            <div className="p-2.5 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 mb-2">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                Resolution by {ticket.resolvedBy}
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">{ticket.resolutionNote}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            {ticket.status === "open" && (
              <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => setRespondOpen(true)} data-testid={`button-inline-respond-${ticket.id}`}>
                <MessageSquare className="h-3 w-3" />
                Respond
              </Button>
            )}
            {(ticket.status === "open" || ticket.status === "responded") && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setResolveOpen(true)} data-testid={`button-inline-resolve-${ticket.id}`}>
                <CheckCircle2 className="h-3 w-3" />
                Resolve
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
              <Label htmlFor="inlineRespondedBy">Your Name</Label>
              <Input id="inlineRespondedBy" value={respondedBy} onChange={(e) => setRespondedBy(e.target.value)} placeholder="Enter your name" data-testid="input-inline-respond-name" />
            </div>
            <div>
              <Label htmlFor="inlineManagerResponse">Your Response</Label>
              <Textarea id="inlineManagerResponse" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Provide guidance..." rows={4} data-testid="input-inline-respond-message" />
            </div>
            <div>
              <Label>Attachments</Label>
              <input type="file" ref={respondFileRef} className="hidden" multiple onChange={(e) => { if (e.target.files) setRespondFiles(prev => [...prev, ...Array.from(e.target.files!)]); if (respondFileRef.current) respondFileRef.current.value = ""; }} data-testid="input-inline-respond-files" />
              <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs gap-1 mt-1" onClick={() => respondFileRef.current?.click()} data-testid="button-inline-respond-attach">
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
            <Button className="w-full" onClick={handleRespond} disabled={submitting} data-testid="button-inline-submit-response">
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
              <Label htmlFor="inlineResolvedBy">Your Name</Label>
              <Input id="inlineResolvedBy" value={resolvedBy} onChange={(e) => setResolvedBy(e.target.value)} placeholder="Enter your name" data-testid="input-inline-resolved-by" />
            </div>
            <div>
              <Label htmlFor="inlineResolutionNote">Resolution Description</Label>
              <Textarea id="inlineResolutionNote" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="Describe what was done to resolve this issue..." rows={4} data-testid="input-inline-resolution-note" />
            </div>
            <div>
              <Label>Attachments</Label>
              <input type="file" ref={resolveFileRef} className="hidden" multiple onChange={(e) => { if (e.target.files) setResolveFiles(prev => [...prev, ...Array.from(e.target.files!)]); if (resolveFileRef.current) resolveFileRef.current.value = ""; }} data-testid="input-inline-resolve-files" />
              <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs gap-1 mt-1" onClick={() => resolveFileRef.current?.click()} data-testid="button-inline-resolve-attach">
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
            <Button className="w-full" onClick={handleResolve} disabled={resolving || !resolutionNote.trim() || !resolvedBy.trim()} data-testid="button-inline-submit-resolve">
              {resolving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {resolving ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
