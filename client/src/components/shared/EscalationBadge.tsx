import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Eye, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EscalationTicket } from "@shared/schema";

interface EscalationBadgeProps {
  projectId: string;
}

export function EscalationBadge({ projectId }: EscalationBadgeProps) {
  const [viewOpen, setViewOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const { toast } = useToast();

  const { data: tickets } = useQuery<EscalationTicket[]>({
    queryKey: ["/api/escalation-tickets", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/escalation-tickets?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
  });

  const activeTicket = tickets?.find(t => t.status === "open" || t.status === "responded");
  if (!activeTicket) return null;

  const handleResolve = async () => {
    setResolving(true);
    try {
      await apiRequest("PATCH", `/api/escalation-tickets/${activeTicket.id}/resolve`, {});
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

  if (activeTicket.status === "responded") {
    return (
      <>
        <Badge
          className="text-[10px] px-1.5 py-0.5 cursor-pointer bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800 border-0"
          onClick={() => setViewOpen(true)}
          data-testid={`badge-response-available-${projectId}`}
        >
          <Eye className="h-3 w-3 mr-1" />
          Response Available
        </Badge>
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Manager Response
              </DialogTitle>
              <DialogDescription>A manager has responded to your escalation ticket.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-muted">
                <p className="text-xs font-medium text-muted-foreground mb-1">Your issue:</p>
                <p className="text-sm">{activeTicket.issue}</p>
              </div>
              <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                  Response from {activeTicket.respondedBy}
                  {activeTicket.respondedAt && (
                    <span className="font-normal ml-1">
                      ({new Date(activeTicket.respondedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})
                    </span>
                  )}
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">{activeTicket.managerResponse}</p>
              </div>
              <Button className="w-full" onClick={handleResolve} disabled={resolving} data-testid="button-resolve-ticket">
                {resolving ? "Resolving..." : "Mark as Resolved & Continue"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Badge
      className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-0"
      data-testid={`badge-escalated-${projectId}`}
    >
      <AlertTriangle className="h-3 w-3 mr-1" />
      Escalated
    </Badge>
  );
}
