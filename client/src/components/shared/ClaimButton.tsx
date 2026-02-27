import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserCheck, Hand, Loader2, X, Clock } from "lucide-react";
import { StaffSelect } from "@/components/shared/StaffSelect";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TaskClaim } from "@shared/schema";

interface ClaimButtonProps {
  projectId: string;
  projectName: string;
  viewType: string;
}

export function ClaimButton({ projectId, projectName, viewType }: ClaimButtonProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("");

  const { data: activeClaims = [] } = useQuery<TaskClaim[]>({
    queryKey: ['/api/claims'],
  });

  const existingClaim = activeClaims.find(c => c.projectId === projectId && c.viewType === viewType);

  const claimMutation = useMutation({
    mutationFn: async (staffName: string) => {
      const res = await apiRequest("POST", "/api/claims", { projectId, viewType, staffName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/claims'] });
      setDialogOpen(false);
      setSelectedStaff("");
      toast({ title: "Task claimed" });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot claim", description: err.message, variant: "destructive" });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const res = await apiRequest("POST", `/api/claims/${claimId}/release`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/claims'] });
      toast({ title: "Task released" });
    },
  });

  if (existingClaim) {
    const claimedAt = existingClaim.claimedAt ? new Date(existingClaim.claimedAt) : null;
    const elapsed = claimedAt ? Math.round((Date.now() - claimedAt.getTime()) / 60000) : 0;
    const elapsedStr = elapsed < 60 ? `${elapsed}m` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <Badge
              variant="secondary"
              className="h-6 text-[10px] px-2 gap-1 bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300 cursor-default"
              data-testid={`badge-claimed-${projectId}`}
            >
              <UserCheck className="h-3 w-3" />
              {existingClaim.staffName.split(' ')[0]}
              <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {elapsedStr}
              </span>
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => releaseMutation.mutate(existingClaim.id)}
              disabled={releaseMutation.isPending}
              data-testid={`button-release-${projectId}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{existingClaim.staffName} is working on this</p>
          {claimedAt && <p className="text-xs text-muted-foreground">Started {claimedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 px-2"
        onClick={() => setDialogOpen(true)}
        data-testid={`button-claim-${projectId}`}
      >
        <Hand className="h-3 w-3" />
        <span className="hidden sm:inline">Claim</span>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Claim Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              You are claiming <span className="font-medium text-foreground">{projectName}</span> in the <span className="font-medium text-foreground capitalize">{viewType.replace(/_/g, ' ')}</span> view.
            </p>
            <p className="text-sm text-muted-foreground">
              This lets the team know you are currently working on this task. You can only claim one task at a time.
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Who are you?</label>
              <StaffSelect value={selectedStaff} onChange={setSelectedStaff} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} data-testid="button-cancel-claim">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => { if (selectedStaff) claimMutation.mutate(selectedStaff); }}
              disabled={!selectedStaff || claimMutation.isPending}
              data-testid="button-confirm-claim"
            >
              {claimMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Hand className="h-3 w-3 mr-1" />}
              Claim Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
