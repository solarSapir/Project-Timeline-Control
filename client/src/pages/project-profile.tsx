import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/logo-spinner";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { computeExpectedDates } from "@/hooks/use-expected-dates";
import { GanttChart } from "@/components/project-profile/GanttChart";
import { StageSection } from "@/components/project-profile/StageSection";
import { InfoRow, ExpectedDueRow, formatProfileDate } from "@/components/project-profile/InfoRow";
import { ProjectHeader } from "@/components/project-profile/ProjectHeader";
import { InstallationSection } from "@/components/project-profile/InstallationSection";
import { ActivitySection } from "@/components/project-profile/ActivitySection";
import { CustomerTimeline } from "@/components/project-profile/CustomerTimeline";
import { DocumentsSection } from "@/components/project-profile/DocumentsSection";
import { MainTimeline } from "@/components/project-profile/MainTimeline";
import { ExpandedProjectView } from "@/components/uc/ExpandedProjectView";
import { ContractExpandedView } from "@/components/contracts/ContractExpandedView";
import { useContractActions } from "@/hooks/use-contract-actions";
import { useTaskActions } from "@/hooks/use-task-actions";
import { hasAction, findAction, getLastFollowUp } from "@/hooks/use-contract-filters";
import { SubtaskPanel } from "@/components/uc/SubtaskPanel";
import { EscalationTicketsSection } from "@/components/project-profile/EscalationTicketsSection";
import type { Project, TaskAction, InstallSchedule } from "@shared/schema";
import type { ContractFileCounts } from "@/pages/contracts-view";
import { ArrowLeft, Calendar, CheckCircle2, FileText, Shield, DollarSign, CreditCard, Camera } from "lucide-react";
import { isUcComplete, isAhjComplete, isVisitComplete, isVisitBooked, isPermitIssued, isContractSent } from "@/utils/stages";

function computeTabVisibility(p: Project) {
  const pm = p.pmStatus?.toLowerCase() ?? '';
  const excluded = ['complete', 'project paused', 'project lost'].some(s => pm.includes(s));
  const installType = p.installType?.toLowerCase() || '';
  const isUcEligible = ['install', 'diy'].includes(installType);
  const excludedSectors = ['commercial', 'industrial', 'agricultural', 'institutional'];
  const sectorExcluded = p.propertySector ? excludedSectors.some(s => p.propertySector!.toLowerCase().includes(s)) : false;

  const isEligible = isUcEligible && !sectorExcluded && !excluded;
  const isDiy = installType === 'diy';
  const isInstallEligible = isEligible && !isDiy;

  return {
    uc: isEligible && !isUcComplete(p.ucStatus),
    rebates: isInstallEligible,
    payment: isInstallEligible && !p.paymentMethod,
    contracts: isInstallEligible && !isContractSent(p.installTeamStage),
    siteVisit: isInstallEligible,
    ahj: isInstallEligible && !isAhjComplete(p.ahjStatus),
    installation: isInstallEligible && isPermitIssued(p.ahjStatus),
    closeOff: !excluded && !isDiy && pm.includes('close'),
  };
}

export default function ProjectProfile() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { toast } = useToast();

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });
  const { data: taskActions = [], isLoading: actionsLoading } = useQuery<TaskAction[]>({
    queryKey: ["/api/projects", projectId, "task-actions"],
  });
  const { data: schedules = [] } = useQuery<InstallSchedule[]>({
    queryKey: ["/api/projects", projectId, "install-schedules"],
  });
  const { data: pmOptions = [] } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ["/api/asana/field-options/pmStatus"],
  });

  const [pmPending, setPmPending] = useState(false);
  const [focusStage, setFocusStage] = useState<string | null>(null);

  const { data: ucOptions } = useQuery<{ gid: string; name: string }[]>({ queryKey: ['/api/asana/field-options/ucStatus'] });
  const { data: contractTaskActions } = useTaskActions('contracts');
  const { data: contractFileCounts } = useQuery<ContractFileCounts>({ queryKey: ['/api/projects/contract-file-counts'] });
  const { updating, handleContractSent, handleContractSigned, handleDepositCollected } = useContractActions();
  const ucStatusOptions = Array.isArray(ucOptions) ? ucOptions.map(o => o.name) : [];
  const fileCounts = contractFileCounts || {};

  const handlePmStatusChange = async (newStatus: string, note: string, staffName: string, files: File[]) => {
    setPmPending(true);
    try {
      const formData = new FormData();
      formData.append('newStatus', newStatus);
      formData.append('oldStatus', project?.pmStatus || '');
      formData.append('note', note);
      formData.append('staffName', staffName);
      files.forEach(f => formData.append('files', f));

      const res = await fetch(`/api/projects/${projectId}/pm-status-change`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: 'Failed to update' }));
        throw new Error(data.message || 'Failed to update');
      }
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stories"] });
      toast({ title: "PM Status updated", description: "Change posted to Asana timeline" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error updating PM Status", description: msg, variant: "destructive" });
      throw err;
    } finally {
      setPmPending(false);
    }
  };

  if (projectLoading || actionsLoading) {
    return <PageLoader title="Loading project..." />;
  }

  if (!project) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="text-center py-12 text-muted-foreground"><p>Project not found.</p></div>
      </div>
    );
  }

  const stages = computeExpectedDates(project, taskActions);
  const tabVis = computeTabVisibility(project);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>
      <ProjectHeader project={project} pmOptions={pmOptions} onPmStatusChange={handlePmStatusChange} isPending={pmPending} />
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" /> Project Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4"><GanttChart stages={stages} /></CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StageSection title="UC Application" icon={FileText} status={stages.uc_application.status} onFocus={() => setFocusStage('uc')} activeInTab={tabVis.uc}>
          <InfoRow label="Status" value={<StatusBadge status={project.ucStatus} />} testId="text-uc-status" />
          <InfoRow label="UC Team" value={project.ucTeam} testId="text-uc-team" />
          <InfoRow label="Target Due" value={formatProfileDate(project.ucDueDate)} testId="text-uc-target" />
          <ExpectedDueRow target={project.ucDueDate} expected={stages.uc_application.expected} testId="text-uc-expected" />
          {project.ucSubmittedDate && (
            <InfoRow label="Submitted" value={`${formatProfileDate(project.ucSubmittedDate)}${project.ucSubmittedBy ? ` by ${project.ucSubmittedBy}` : ""}`} />
          )}
        </StageSection>
        <StageSection title="Rebates" icon={DollarSign} status={stages.rebates.status} onFocus={() => setFocusStage('rebates')} activeInTab={tabVis.rebates}>
          <InfoRow label="Rebate Status" value={<StatusBadge status={project.rebateStatus} />} testId="text-rebate-status" />
          {project.hrspStatus && <InfoRow label="HRSP Status" value={project.hrspStatus} testId="text-hrsp-status" />}
        </StageSection>
        <StageSection title="Payment Method" icon={CreditCard} status={stages.payment.status} onFocus={() => setFocusStage('payment')} activeInTab={tabVis.payment}>
          <InfoRow label="Payment Method" value={project.paymentMethod} testId="text-payment-method" />
        </StageSection>
        <StageSection title="Contract & Permit Payment" icon={FileText} status={stages.contract_signing.status} onFocus={() => setFocusStage('contract')} activeInTab={tabVis.contracts}>
          <InfoRow label="Contract Status" value={<StatusBadge status={project.installTeamStage} />} testId="text-contract-status" />
          <InfoRow label="Target Due" value={formatProfileDate(project.contractDueDate)} testId="text-contract-target" />
          <ExpectedDueRow target={project.contractDueDate} expected={stages.contract_signing.expected} testId="text-contract-expected" />
          <InfoRow label="Permit Payment" value={project.permitPaymentCollected ? "Collected" : "Pending"} testId="text-permit-payment" />
          <InfoRow label="Engineering Fee" value={project.engineeringFeeCollected ? "Collected" : "Pending"} testId="text-engineering-fee" />
        </StageSection>
        <StageSection title="Site Visit" icon={Camera} status={stages.site_visit.status} onFocus={() => setFocusStage('site_visit')} activeInTab={tabVis.siteVisit}>
          <InfoRow label="Status" value={<StatusBadge status={project.siteVisitStatus} />} testId="text-sv-status" />
          <InfoRow label="Target Due" value={formatProfileDate(project.siteVisitDueDate)} testId="text-sv-target" />
          <ExpectedDueRow target={project.siteVisitDueDate} expected={stages.site_visit.expected} testId="text-sv-expected" />
          {project.siteVisitDate && <InfoRow label="Visit Date" value={formatProfileDate(project.siteVisitDate)} testId="text-sv-date" />}
        </StageSection>
        <StageSection title="AHJ / Permitting" icon={Shield} status={stages.ahj_permitting.status} onFocus={() => setFocusStage('ahj')} activeInTab={tabVis.ahj}>
          <InfoRow label="Status" value={<StatusBadge status={project.ahjStatus} />} testId="text-ahj-status" />
          <InfoRow label="Target Due" value={formatProfileDate(project.ahjDueDate)} testId="text-ahj-target" />
          <ExpectedDueRow target={project.ahjDueDate} expected={stages.ahj_permitting.expected} testId="text-ahj-expected" />
        </StageSection>
        <InstallationSection project={project} stages={stages} schedules={schedules} onFocus={() => setFocusStage('installation')} activeInTab={tabVis.installation} />
        <StageSection title="Close-off" icon={CheckCircle2} status={stages.close_off.status} onFocus={() => setFocusStage('close_off')} activeInTab={tabVis.closeOff}>
          <InfoRow label="Target Due" value={formatProfileDate(project.closeOffDueDate)} testId="text-closeoff-target" />
          <ExpectedDueRow target={project.closeOffDueDate} expected={stages.close_off.expected} testId="text-closeoff-expected" />
          <InfoRow label="Milestone Payment" value={project.milestonePaymentCollected ? "Collected" : "Pending"} testId="text-milestone-payment" />
          <InfoRow label="Final Payment" value={project.finalPaymentCollected ? "Collected" : "Pending"} testId="text-final-payment" />
        </StageSection>
      </div>
      <EscalationTicketsSection projectId={projectId!} />
      <DocumentsSection project={project} projectId={projectId!} />
      <CustomerTimeline projectId={projectId!} taskActions={taskActions} />
      <MainTimeline projectId={projectId!} asanaGid={project.asanaGid} />
      {project.customerNotes && (
        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-medium">Customer Notes</CardTitle></CardHeader>
          <CardContent className="py-2 px-4">
            <p className="text-sm whitespace-pre-wrap" data-testid="text-customer-notes">{project.customerNotes}</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={focusStage === 'uc'} onOpenChange={(open) => !open && setFocusStage(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>UC Application — {project.name}</DialogTitle>
            <DialogDescription>Full UC application details, subtasks, and actions.</DialogDescription>
          </DialogHeader>
          <ExpandedProjectView
            project={project}
            statusOptions={ucStatusOptions}
            onStatusChange={async (id, status) => {
              await apiRequest('PATCH', `/api/projects/${id}`, { ucStatus: status });
              queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
              toast({ title: "UC status updated" });
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={focusStage === 'contract'} onOpenChange={(open) => !open && setFocusStage(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract & Permit Payment — {project.name}</DialogTitle>
            <DialogDescription>Contract details, document upload, approval, and subtasks.</DialogDescription>
          </DialogHeader>
          <ContractExpandedView
            project={project}
            docUploaded={fileCounts[project.id] ? fileCounts[project.id].total > 0 : false}
            uploadedCount={fileCounts[project.id] ? (fileCounts[project.id].contract ? 1 : 0) + (fileCounts[project.id].proposal ? 1 : 0) + (fileCounts[project.id].sitePlan ? 1 : 0) : 0}
            docUploadAction={findAction(contractTaskActions, project.id, 'document_upload')}
            approved={hasAction(contractTaskActions, project.id, 'contract_approved')}
            approvalAction={findAction(contractTaskActions, project.id, 'contract_approved')}
            lastFollowUp={getLastFollowUp(contractTaskActions, project.id)}
            updating={updating}
            onContractSent={handleContractSent}
            onContractSigned={handleContractSigned}
            onDepositCollected={handleDepositCollected}
          />
        </DialogContent>
      </Dialog>

      {['rebates', 'payment', 'site_visit', 'ahj', 'installation', 'close_off'].includes(focusStage || '') && (
        <Dialog open={true} onOpenChange={(open) => !open && setFocusStage(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {focusStage === 'rebates' ? 'Rebates' : focusStage === 'payment' ? 'Payment Method' : focusStage === 'site_visit' ? 'Site Visit' : focusStage === 'ahj' ? 'AHJ / Permitting' : focusStage === 'installation' ? 'Installation' : 'Close-off'} — {project.name}
              </DialogTitle>
              <DialogDescription>Subtasks and detailed information for this stage.</DialogDescription>
            </DialogHeader>
            <SubtaskPanel projectId={project.id} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
