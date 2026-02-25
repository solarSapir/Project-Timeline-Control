import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { computeExpectedDates } from "@/hooks/use-expected-dates";
import { GanttChart } from "@/components/project-profile/GanttChart";
import { StageSection } from "@/components/project-profile/StageSection";
import { InfoRow, ExpectedDueRow, formatProfileDate } from "@/components/project-profile/InfoRow";
import { ProjectHeader } from "@/components/project-profile/ProjectHeader";
import { InstallationSection } from "@/components/project-profile/InstallationSection";
import { ActivitySection } from "@/components/project-profile/ActivitySection";
import { DocumentsSection } from "@/components/project-profile/DocumentsSection";
import type { Project, TaskAction, InstallSchedule } from "@shared/schema";
import { ArrowLeft, Calendar, CheckCircle2, FileText, Shield, DollarSign, Camera } from "lucide-react";

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

  const pmStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}`, { pmStatus: newStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "PM Status updated", description: "Change synced to Asana" });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating PM Status", description: err.message, variant: "destructive" });
    },
  });

  if (projectLoading || actionsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>
      <ProjectHeader project={project} pmOptions={pmOptions} pmStatusMutation={pmStatusMutation} />
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" /> Project Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4"><GanttChart stages={stages} /></CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StageSection title="UC Application" icon={FileText} status={stages.uc_application.status}>
          <InfoRow label="Status" value={<StatusBadge status={project.ucStatus} />} testId="text-uc-status" />
          <InfoRow label="UC Team" value={project.ucTeam} testId="text-uc-team" />
          <InfoRow label="Target Due" value={formatProfileDate(project.ucDueDate)} testId="text-uc-target" />
          <ExpectedDueRow target={project.ucDueDate} expected={stages.uc_application.expected} testId="text-uc-expected" />
          {project.ucSubmittedDate && (
            <InfoRow label="Submitted" value={`${formatProfileDate(project.ucSubmittedDate)}${project.ucSubmittedBy ? ` by ${project.ucSubmittedBy}` : ""}`} />
          )}
        </StageSection>
        <StageSection title="Rebates & Payment" icon={DollarSign} status={stages.rebates_payment.status}>
          <InfoRow label="Rebate Status" value={<StatusBadge status={project.rebateStatus} />} testId="text-rebate-status" />
          <InfoRow label="Payment Method" value={project.paymentMethod} testId="text-payment-method" />
          {project.hrspStatus && <InfoRow label="HRSP Status" value={project.hrspStatus} testId="text-hrsp-status" />}
        </StageSection>
        <StageSection title="Contract & Permit Payment" icon={FileText} status={stages.contract_signing.status}>
          <InfoRow label="Contract Status" value={<StatusBadge status={project.installTeamStage} />} testId="text-contract-status" />
          <InfoRow label="Target Due" value={formatProfileDate(project.contractDueDate)} testId="text-contract-target" />
          <ExpectedDueRow target={project.contractDueDate} expected={stages.contract_signing.expected} testId="text-contract-expected" />
          <InfoRow label="Permit Payment" value={project.permitPaymentCollected ? "Collected" : "Pending"} testId="text-permit-payment" />
          <InfoRow label="Engineering Fee" value={project.engineeringFeeCollected ? "Collected" : "Pending"} testId="text-engineering-fee" />
        </StageSection>
        <StageSection title="Site Visit" icon={Camera} status={stages.site_visit.status}>
          <InfoRow label="Status" value={<StatusBadge status={project.siteVisitStatus} />} testId="text-sv-status" />
          <InfoRow label="Target Due" value={formatProfileDate(project.siteVisitDueDate)} testId="text-sv-target" />
          <ExpectedDueRow target={project.siteVisitDueDate} expected={stages.site_visit.expected} testId="text-sv-expected" />
          {project.siteVisitDate && <InfoRow label="Visit Date" value={formatProfileDate(project.siteVisitDate)} testId="text-sv-date" />}
        </StageSection>
        <StageSection title="AHJ / Permitting" icon={Shield} status={stages.ahj_permitting.status}>
          <InfoRow label="Status" value={<StatusBadge status={project.ahjStatus} />} testId="text-ahj-status" />
          <InfoRow label="Target Due" value={formatProfileDate(project.ahjDueDate)} testId="text-ahj-target" />
          <ExpectedDueRow target={project.ahjDueDate} expected={stages.ahj_permitting.expected} testId="text-ahj-expected" />
        </StageSection>
        <InstallationSection project={project} stages={stages} schedules={schedules} />
        <StageSection title="Close-off" icon={CheckCircle2} status={stages.close_off.status}>
          <InfoRow label="Target Due" value={formatProfileDate(project.closeOffDueDate)} testId="text-closeoff-target" />
          <ExpectedDueRow target={project.closeOffDueDate} expected={stages.close_off.expected} testId="text-closeoff-expected" />
          <InfoRow label="Milestone Payment" value={project.milestonePaymentCollected ? "Collected" : "Pending"} testId="text-milestone-payment" />
          <InfoRow label="Final Payment" value={project.finalPaymentCollected ? "Collected" : "Pending"} testId="text-final-payment" />
        </StageSection>
      </div>
      <DocumentsSection project={project} projectId={projectId!} />
      <ActivitySection taskActions={taskActions} />
      {project.customerNotes && (
        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-medium">Customer Notes</CardTitle></CardHeader>
          <CardContent className="py-2 px-4">
            <p className="text-sm whitespace-pre-wrap" data-testid="text-customer-notes">{project.customerNotes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
