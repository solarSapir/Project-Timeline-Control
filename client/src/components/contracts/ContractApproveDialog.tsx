import { useState } from "react";
import type { Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShieldCheck } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ContractApproveDialogProps {
  project: Project;
  hasDocUpload: boolean;
  isApproved: boolean;
}

export function ContractApproveDialog({ project, hasDocUpload, isApproved }: ContractApproveDialogProps) {
  const [open, setOpen] = useState(false);
  const [approvedBy, setApprovedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (!hasDocUpload || isApproved) return null;

  const handleSubmit = async () => {
    if (!approvedBy.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/contract-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy, notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to approve contract');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/task-actions', 'contracts'] });
      toast({ title: "Contract approved", description: "Approval posted to Asana — ready to send via DocuSign" });
      setOpen(false);
      setApprovedBy("");
      setNotes("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="h-8 text-xs w-full bg-green-600 hover:bg-green-700" data-testid={`button-approve-contract-${project.id}`}>
          <ShieldCheck className="h-3 w-3 mr-1" />
          Approve Contract
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Contract - {project.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Confirm you have reviewed the contract, proposal, and site plan. This will post an approval comment to the Asana task.
          </p>
          <div>
            <Label htmlFor="approvedBy">Your Name</Label>
            <Input id="approvedBy" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Enter your name" data-testid="input-approve-name" />
          </div>
          <div>
            <Label htmlFor="approveNotes">Review Notes (optional)</Label>
            <Textarea id="approveNotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes or conditions for the contract..." data-testid="input-approve-notes" />
          </div>
          <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleSubmit} disabled={submitting} data-testid="button-submit-approve">
            {submitting ? "Posting Approval to Asana..." : "Approve & Post to Asana"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
