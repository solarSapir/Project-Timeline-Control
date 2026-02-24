import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS, PROJECT_STAGES } from "@shared/schema";
import { differenceInDays, parseISO, format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  MapPin,
  Shield,
  Wrench,
  DollarSign,
  Camera,
  Truck,
} from "lucide-react";
import { Link } from "wouter";

type Project = Record<string, any>;

function getExpectedDateFromActions(
  actions: any[],
  viewType: string,
  actionType: string,
  offsetDays: number
): string | null {
  const relevant = actions.filter(
    (a: any) => a.viewType === viewType && a.actionType === actionType && a.completedAt
  );
  if (relevant.length === 0) return null;
  relevant.sort(
    (a: any, b: any) =>
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );
  const earliest = new Date(relevant[0].completedAt);
  earliest.setDate(earliest.getDate() + offsetDays);
  return earliest.toISOString().split("T")[0];
}

function computeExpectedDates(project: Project, taskActions: any[]) {
  const stages: Record<string, { target: string | null; expected: string | null; status: string }> = {};

  stages.uc_application = {
    target: project.ucDueDate,
    expected: project.ucDueDate,
    status: getStageStatus(project.ucStatus, ["approved", "complete", "not required", "closed"]),
  };

  stages.rebates_payment = {
    target: project.ucDueDate,
    expected: project.ucDueDate,
    status: getStageStatus(project.rebateStatus, ["complete", "not required", "approved"]),
  };

  stages.contract_signing = {
    target: project.contractDueDate,
    expected: project.contractDueDate,
    status: getStageStatus(project.contractStatus, ["signed", "complete", "sent"]),
  };

  const svCompletionDate = getExpectedDateFromActions(taskActions, "site_visits", "completed", 0);
  stages.site_visit = {
    target: project.siteVisitDueDate,
    expected: project.siteVisitDate || svCompletionDate || project.siteVisitDueDate,
    status: project.siteVisitStatus?.toLowerCase().includes("visit complete")
      ? "completed"
      : "pending",
  };

  const expectedAhj = svCompletionDate
    ? getExpectedDateFromActions(taskActions, "site_visits", "completed", 21)
    : null;
  stages.ahj_permitting = {
    target: project.ahjDueDate,
    expected: expectedAhj || project.ahjDueDate,
    status: getStageStatus(project.ahjStatus, [
      "permit issued",
      "closed",
      "not required",
      "permit close off",
      "approved",
      "complete",
    ]),
  };

  const ahjCompletionDate = getExpectedDateFromActions(taskActions, "ahj", "completed", 0);
  const expectedInstall = ahjCompletionDate
    ? getExpectedDateFromActions(taskActions, "ahj", "completed", 7)
    : null;
  stages.install_booking = {
    target: project.installDueDate,
    expected: expectedInstall || project.installDueDate,
    status: project.installStartDate ? "completed" : "pending",
  };

  stages.installation = {
    target: project.installDueDate,
    expected: project.installStartDate || expectedInstall || project.installDueDate,
    status: project.installTeamStage?.toLowerCase().includes("active install")
      ? "completed"
      : project.installTeamStage?.toLowerCase().includes("complete")
        ? "completed"
        : "pending",
  };

  stages.close_off = {
    target: project.closeOffDueDate,
    expected: project.closeOffDueDate,
    status:
      project.pmStatus?.toLowerCase().includes("close") ||
      project.pmStatus?.toLowerCase().includes("complete")
        ? "completed"
        : "pending",
  };

  return stages;
}

function getStageStatus(fieldValue: string | null | undefined, completedKeywords: string[]): string {
  if (!fieldValue) return "pending";
  const lower = fieldValue.toLowerCase();
  if (completedKeywords.some((kw) => lower.includes(kw))) return "completed";
  return "in_progress";
}

const stageIcons: Record<string, any> = {
  uc_application: FileText,
  rebates_payment: DollarSign,
  contract_signing: FileText,
  site_visit: Camera,
  ahj_permitting: Shield,
  install_booking: Calendar,
  installation: Wrench,
  close_off: CheckCircle2,
};

function GanttChart({
  stages,
  projectCreatedDate,
}: {
  stages: Record<string, { target: string | null; expected: string | null; status: string }>;
  projectCreatedDate: string | null;
}) {
  const allDates: Date[] = [];
  const startDate = projectCreatedDate ? parseISO(projectCreatedDate) : new Date();
  allDates.push(startDate);

  for (const key of PROJECT_STAGES) {
    const s = stages[key];
    if (s?.target) allDates.push(parseISO(s.target));
    if (s?.expected) allDates.push(parseISO(s.expected));
  }
  allDates.push(new Date());

  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
  const rangeMs = maxDate.getTime() - minDate.getTime() || 1;
  const paddedRange = rangeMs * 1.1;
  const chartStart = new Date(minDate.getTime() - rangeMs * 0.05);

  const toPercent = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = parseISO(dateStr);
    return ((d.getTime() - chartStart.getTime()) / paddedRange) * 100;
  };

  const todayPercent = ((new Date().getTime() - chartStart.getTime()) / paddedRange) * 100;

  const months: { label: string; percent: number }[] = [];
  const monthStart = new Date(chartStart.getFullYear(), chartStart.getMonth(), 1);
  const chartEnd = new Date(chartStart.getTime() + paddedRange);
  let current = new Date(monthStart);
  while (current <= chartEnd) {
    const pct = ((current.getTime() - chartStart.getTime()) / paddedRange) * 100;
    if (pct >= 0 && pct <= 100) {
      months.push({ label: format(current, "MMM yyyy"), percent: pct });
    }
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return (
    <div className="space-y-1" data-testid="gantt-chart">
      <div className="relative h-6 mb-2">
        {months.map((m) => (
          <div
            key={m.label}
            className="absolute text-[10px] text-muted-foreground"
            style={{ left: `${Math.max(0, Math.min(95, m.percent))}%` }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {PROJECT_STAGES.map((stageKey) => {
        const stage = stages[stageKey];
        if (!stage) return null;
        const targetPct = toPercent(stage.target);
        const expectedPct = toPercent(stage.expected);
        const Icon = stageIcons[stageKey] || Clock;
        const isCompleted = stage.status === "completed";
        const isLate =
          stage.target && stage.expected
            ? new Date(stage.expected) > new Date(stage.target)
            : false;

        return (
          <div key={stageKey} className="flex items-center gap-2" data-testid={`gantt-row-${stageKey}`}>
            <div className="w-[140px] flex items-center gap-1.5 flex-shrink-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs truncate">{STAGE_LABELS[stageKey] || stageKey}</span>
            </div>
            <div className="flex-1 relative h-6 rounded-md bg-muted/40">
              <div
                className="absolute top-0 bottom-0 w-px bg-blue-400 z-10"
                style={{ left: `${Math.max(0, Math.min(100, todayPercent))}%` }}
                title="Today"
              />

              {targetPct !== null && (
                <div
                  className={`absolute top-1 h-4 w-1.5 rounded-sm ${
                    isCompleted
                      ? "bg-green-500"
                      : "bg-muted-foreground/40"
                  }`}
                  style={{ left: `${Math.max(0, Math.min(99, targetPct))}%` }}
                  title={`Target: ${stage.target}`}
                />
              )}

              {expectedPct !== null && (
                <div
                  className={`absolute top-1 h-4 w-1.5 rounded-sm ${
                    isCompleted
                      ? "bg-green-500"
                      : isLate
                        ? "bg-red-500"
                        : "bg-blue-500"
                  }`}
                  style={{ left: `${Math.max(0, Math.min(99, expectedPct))}%` }}
                  title={`Expected: ${stage.expected}`}
                />
              )}

              {targetPct !== null && expectedPct !== null && targetPct !== expectedPct && (
                <div
                  className={`absolute top-[10px] h-1 rounded-full ${
                    isCompleted
                      ? "bg-green-300 dark:bg-green-700"
                      : isLate
                        ? "bg-red-300 dark:bg-red-700"
                        : "bg-blue-300 dark:bg-blue-700"
                  }`}
                  style={{
                    left: `${Math.max(0, Math.min(99, Math.min(targetPct, expectedPct)))}%`,
                    width: `${Math.max(0.5, Math.abs(expectedPct - targetPct))}%`,
                  }}
                />
              )}
            </div>
            <div className="w-[60px] flex-shrink-0">
              {isCompleted ? (
                <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-1.5">
                  Done
                </Badge>
              ) : isLate ? (
                <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-1.5">
                  Late
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5">
                  {stage.target
                    ? `${differenceInDays(parseISO(stage.target), new Date())}d`
                    : "--"}
                </Badge>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-4 mt-3 pt-2 border-t text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-3 rounded-sm bg-muted-foreground/40" />
          <span>Target</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-3 rounded-sm bg-blue-500" />
          <span>Expected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-3 rounded-sm bg-red-500" />
          <span>Late</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-3 rounded-sm bg-green-500" />
          <span>Complete</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-px h-4 bg-blue-400" />
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}

function StageSection({
  title,
  icon: Icon,
  status,
  children,
}: {
  title: string;
  icon: any;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <Card data-testid={`section-${title.toLowerCase().replace(/[\s/]+/g, "-")}`}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          <Badge
            className={
              status === "completed"
                ? "text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : status === "in_progress"
                  ? "text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }
          >
            {status === "completed" ? "Complete" : status === "in_progress" ? "In Progress" : "Pending"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">{children}</CardContent>
    </Card>
  );
}

function InfoRow({ label, value, testId }: { label: string; value: React.ReactNode; testId?: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium" data-testid={testId}>
        {value || "--"}
      </span>
    </div>
  );
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function DaysLeftBadge({ dateStr }: { dateStr: string | null | undefined }) {
  if (!dateStr) return <span className="text-muted-foreground">--</span>;
  const days = differenceInDays(parseISO(dateStr), new Date());
  if (days < 0)
    return (
      <Badge variant="destructive" className="text-xs">
        {Math.abs(days)}d overdue
      </Badge>
    );
  if (days <= 7)
    return (
      <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
        {days}d left
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-xs">
      {days}d left
    </Badge>
  );
}

export default function ProjectProfile() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  const { data: taskActions = [], isLoading: actionsLoading } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "task-actions"],
  });

  const { data: schedules = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "install-schedules"],
  });

  if (projectLoading || actionsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div className="text-center py-12 text-muted-foreground">
          <p>Project not found.</p>
        </div>
      </div>
    );
  }

  const stages = computeExpectedDates(project, taskActions);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold" data-testid="text-project-name">
            {project.name}
          </h1>
          <StatusBadge status={project.installType} />
          {project.province && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {project.province}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          {project.projectCreatedDate && (
            <span data-testid="text-created-date">Created: {formatDate(project.projectCreatedDate)}</span>
          )}
          {project.installTeamStage && (
            <Badge variant="outline" className="text-xs" data-testid="text-install-stage">
              {project.installTeamStage}
            </Badge>
          )}
          <Badge
            className={`text-xs ${
              project.pmStatus?.toLowerCase().includes('complete')
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : project.pmStatus?.toLowerCase().includes('install')
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : project.pmStatus?.toLowerCase().includes('paused')
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    : project.pmStatus?.toLowerCase().includes('lost')
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }`}
            data-testid="text-pm-status"
          >
            PM Status: {project.pmStatus || "Not set"}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Project Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4">
          <GanttChart stages={stages} projectCreatedDate={project.projectCreatedDate} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StageSection title="UC Application" icon={FileText} status={stages.uc_application.status}>
          <InfoRow label="Status" value={<StatusBadge status={project.ucStatus} />} testId="text-uc-status" />
          <InfoRow label="UC Team" value={project.ucTeam} testId="text-uc-team" />
          <InfoRow label="Target Due" value={formatDate(project.ucDueDate)} testId="text-uc-target" />
          <InfoRow label="Due In" value={<DaysLeftBadge dateStr={project.ucDueDate} />} />
          {project.ucSubmittedDate && (
            <InfoRow label="Submitted" value={`${formatDate(project.ucSubmittedDate)}${project.ucSubmittedBy ? ` by ${project.ucSubmittedBy}` : ""}`} />
          )}
        </StageSection>

        <StageSection title="Rebates & Payment" icon={DollarSign} status={stages.rebates_payment.status}>
          <InfoRow label="Rebate Status" value={<StatusBadge status={project.rebateStatus} />} testId="text-rebate-status" />
          <InfoRow label="Payment Method" value={project.paymentMethod} testId="text-payment-method" />
          {project.hrspStatus && (
            <InfoRow label="HRSP Status" value={project.hrspStatus} testId="text-hrsp-status" />
          )}
        </StageSection>

        <StageSection title="Contract & Permit Payment" icon={FileText} status={stages.contract_signing.status}>
          <InfoRow label="Contract Status" value={<StatusBadge status={project.contractStatus} />} testId="text-contract-status" />
          <InfoRow label="Target Due" value={formatDate(project.contractDueDate)} testId="text-contract-target" />
          <InfoRow label="Due In" value={<DaysLeftBadge dateStr={project.contractDueDate} />} />
          <InfoRow
            label="Permit Payment"
            value={project.permitPaymentCollected ? "Collected" : "Pending"}
            testId="text-permit-payment"
          />
          <InfoRow
            label="Engineering Fee"
            value={project.engineeringFeeCollected ? "Collected" : "Pending"}
            testId="text-engineering-fee"
          />
        </StageSection>

        <StageSection title="Site Visit" icon={Camera} status={stages.site_visit.status}>
          <InfoRow label="Status" value={<StatusBadge status={project.siteVisitStatus} />} testId="text-sv-status" />
          <InfoRow label="Target Due" value={formatDate(project.siteVisitDueDate)} testId="text-sv-target" />
          <InfoRow label="Due In" value={<DaysLeftBadge dateStr={project.siteVisitDueDate} />} />
          {project.siteVisitDate && (
            <InfoRow label="Visit Date" value={formatDate(project.siteVisitDate)} testId="text-sv-date" />
          )}
        </StageSection>

        <StageSection title="AHJ / Permitting" icon={Shield} status={stages.ahj_permitting.status}>
          <InfoRow label="Status" value={<StatusBadge status={project.ahjStatus} />} testId="text-ahj-status" />
          <InfoRow label="Target Due" value={formatDate(project.ahjDueDate)} testId="text-ahj-target" />
          <InfoRow label="Expected Due" value={formatDate(stages.ahj_permitting.expected)} testId="text-ahj-expected" />
          <InfoRow label="Due In" value={<DaysLeftBadge dateStr={project.ahjDueDate} />} />
        </StageSection>

        <StageSection title="Installation" icon={Wrench} status={stages.installation.status}>
          <InfoRow label="Install Stage" value={project.installTeamStage} testId="text-install-team-stage" />
          <InfoRow label="Target Due" value={formatDate(project.installDueDate)} testId="text-install-target" />
          <InfoRow label="Expected Due" value={formatDate(stages.installation.expected)} testId="text-install-expected" />
          <InfoRow label="Due In" value={<DaysLeftBadge dateStr={project.installDueDate} />} />
          {project.installStartDate && (
            <InfoRow label="Install Start" value={formatDate(project.installStartDate)} testId="text-install-start" />
          )}
          {project.equipmentArrivalDate && (
            <InfoRow label="Equipment Arrival" value={formatDate(project.equipmentArrivalDate)} testId="text-equipment-arrival" />
          )}
          {project.disconnectReconnectDate && (
            <InfoRow label="Disconnect/Reconnect" value={formatDate(project.disconnectReconnectDate)} testId="text-disconnect-reconnect" />
          )}
          {project.finalInspectionDate && (
            <InfoRow label="Final Inspection" value={formatDate(project.finalInspectionDate)} testId="text-final-inspection" />
          )}
          {schedules.length > 0 && (
            <div className="border-t mt-2 pt-2 space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Schedule Items</span>
              {schedules.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-0.5" data-testid={`schedule-item-${s.id}`}>
                  <div className="flex items-center gap-2">
                    <Truck className="h-3 w-3 text-muted-foreground" />
                    <span>{s.taskType}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {s.scheduledDate && <span>{formatDate(s.scheduledDate)}</span>}
                    {s.installerName && <span>- {s.installerName}</span>}
                    <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </StageSection>

        <StageSection title="Close-off" icon={CheckCircle2} status={stages.close_off.status}>
          <InfoRow label="Target Due" value={formatDate(project.closeOffDueDate)} testId="text-closeoff-target" />
          <InfoRow label="Due In" value={<DaysLeftBadge dateStr={project.closeOffDueDate} />} />
          <InfoRow
            label="Milestone Payment"
            value={project.milestonePaymentCollected ? "Collected" : "Pending"}
            testId="text-milestone-payment"
          />
          <InfoRow
            label="Final Payment"
            value={project.finalPaymentCollected ? "Collected" : "Pending"}
            testId="text-final-payment"
          />
        </StageSection>
      </div>

      {taskActions.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Activity ({taskActions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {[...taskActions]
                .sort(
                  (a: any, b: any) =>
                    new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
                )
                .slice(0, 20)
                .map((action: any) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between py-1.5 text-sm border-b last:border-0"
                    data-testid={`activity-${action.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {action.viewType}
                      </Badge>
                      <span className="text-xs">{action.actionType}</span>
                      {action.completedBy && (
                        <span className="text-xs text-muted-foreground">
                          by {action.completedBy}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {action.completedAt
                        ? format(new Date(action.completedAt), "MMM d, h:mm a")
                        : "--"}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {project.customerNotes && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">Customer Notes</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <p className="text-sm whitespace-pre-wrap" data-testid="text-customer-notes">
              {project.customerNotes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
