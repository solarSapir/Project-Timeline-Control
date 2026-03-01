import { useState } from "react";
import type { Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

async function logContractCompletion(projectId: string, actionType: string, staffName?: string) {
  try {
    await fetch('/api/contracts/complete-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, actionType, staffName: staffName || 'System' }),
    });
    queryClient.invalidateQueries({ queryKey: ['/api/contracts/completions'] });
    queryClient.invalidateQueries({ queryKey: ['/api/contracts/kpi-stats'] });
  } catch {}
}

export function useContractActions() {
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const handleContractSent = async (project: Project, checked: boolean) => {
    setUpdating(project.id + '-sent');
    try {
      const newStage = checked ? 'Pending Contract to be signed' : 'Need contract';
      await apiRequest("PATCH", `/api/projects/${project.id}`, { installTeamStage: newStage });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      if (checked) await logContractCompletion(project.id, 'contract_sent');
      toast({ title: checked ? "Contract marked as sent — pending signature" : "Contract marked as not sent" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const handleContractSigned = async (project: Project, checked: boolean) => {
    setUpdating(project.id + '-contract');
    try {
      const newStage = checked ? 'Pending Deposit (from customer)' : 'Pending Contract to be signed';
      await apiRequest("PATCH", `/api/projects/${project.id}`, { installTeamStage: newStage });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      if (checked) await logContractCompletion(project.id, 'contract_signed');
      toast({ title: checked ? "Contract marked as signed — awaiting deposit" : "Contract marked as unsigned" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const handleDepositCollected = async (project: Project, checked: boolean) => {
    setUpdating(project.id + '-deposit');
    try {
      let newStage: string;
      if (checked) {
        const sv = (project.siteVisitStatus || '').toLowerCase();
        const siteVisitDone = sv.includes('visit complete') || sv.includes('visit booked');
        newStage = siteVisitDone ? 'Active Install' : 'Pending site visit';
      } else {
        newStage = 'Pending Deposit (from customer)';
      }
      await apiRequest("PATCH", `/api/projects/${project.id}`, { installTeamStage: newStage });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      if (checked) await logContractCompletion(project.id, 'deposit_collected');
      if (checked && newStage === 'Pending site visit') {
        toast({ title: "Deposit collected — pending site visit", description: "Project moved to Site Visits tab" });
      } else if (checked) {
        toast({ title: "Deposit collected — project is Active Install" });
      } else {
        toast({ title: "Deposit uncollected" });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  return { updating, handleContractSent, handleContractSigned, handleDepositCollected };
}
