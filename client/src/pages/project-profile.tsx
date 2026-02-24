import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGE_LABELS, PROJECT_STAGES } from "@shared/schema";
import { differenceInDays, parseISO, format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

  const STAGE_GAPS = { ucToContract: 7, contractToSv: 7, svToAhj: 14, ahjToInstall: 7, installToCloseOff: 7 };
  const LATE_PUSH = 7;

  const UC_COMPLETE = ['approved', 'complete', 'not required', 'closed', 'close off'];
  const CONTRACT_DONE = ['pending deposit', 'deposit collected', 'pending site visit', 'active install', 'complete'];
  const SV_DONE = ['visit complete', 'not required', 'visit booked'];
  const AHJ_DONE = ['permit issued', 'closed', 'not required', 'permit close off', 'approved', 'complete'];
  const AHJ_NOT_REQUIRED = ['not required', 'closed', 'permit close off'];

  const isMatch = (val: string | null, keywords: string[]) =>
    val ? keywords.some(k => val.toLowerCase().includes(k)) : false;

  const ucDone = isMatch(project.ucStatus, UC_COMPLETE);
  const contractDone = isMatch(project.installTeamStage, CONTRACT_DONE);
  const svDone = isMatch(project.siteVisitStatus, SV_DONE);
  const ahjDone = isMatch(project.ahjStatus, AHJ_DONE);
  const ahjNotRequired = isMatch(project.ahjStatus, AHJ_NOT_REQUIRED);
  const effectiveSvToAhj = ahjNotRequired ? 0 : STAGE_GAPS.svToAhj;

  const addD = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const toStr = (d: Date) => d.toISOString().split('T')[0];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let expectedUc = project.ucDueDate ? new Date(project.ucDueDate) : addD(now, 21);
  let expectedContract = project.contractDueDate ? new Date(project.contractDueDate) : addD(expectedUc, STAGE_GAPS.ucToContract);
  let expectedSv = project.siteVisitDueDate ? new Date(project.siteVisitDueDate) : addD(expectedContract, STAGE_GAPS.contractToSv);
  let expectedAhj = project.ahjDueDate ? new Date(project.ahjDueDate) : addD(expectedSv, effectiveSvToAhj);
  let expectedInstall = project.installDueDate ? new Date(project.installDueDate) : addD(expectedAhj, STAGE_GAPS.ahjToInstall);
  let expectedCloseOff = project.closeOffDueDate ? new Date(project.closeOffDueDate) : addD(expectedInstall, STAGE_GAPS.installToCloseOff);

  if (!ucDone && expectedUc < now) {
    expectedUc = addD(now, LATE_PUSH);
    expectedContract = addD(expectedUc, STAGE_GAPS.ucToContract);
    expectedSv = addD(expectedContract, STAGE_GAPS.contractToSv);
    expectedAhj = addD(expectedSv, effectiveSvToAhj);
    expectedInstall = addD(expectedAhj, STAGE_GAPS.ahjToInstall);
    expectedCloseOff = addD(expectedInstall, STAGE_GAPS.installToCloseOff);
  } else if (!contractDone && expectedContract < now) {
    expectedContract = addD(now, LATE_PUSH);
    expectedSv = addD(expectedContract, STAGE_GAPS.contractToSv);
    expectedAhj = addD(expectedSv, effectiveSvToAhj);
    expectedInstall = addD(expectedAhj, STAGE_GAPS.ahjToInstall);
    expectedCloseOff = addD(expectedInstall, STAGE_GAPS.installToCloseOff);
  } else if (!svDone && expectedSv < now) {
    expectedSv = addD(now, LATE_PUSH);
    expectedAhj = addD(expectedSv, effectiveSvToAhj);
    expectedInstall = addD(expectedAhj, STAGE_GAPS.ahjToInstall);
    expectedCloseOff = addD(expectedInstall, STAGE_GAPS.installToCloseOff);
  } else if (!ahjDone && expectedAhj < now) {
    expectedAhj = addD(now, LATE_PUSH);
    expectedInstall = addD(expectedAhj, STAGE_GAPS.ahjToInstall);
    expectedCloseOff = addD(expectedInstall, STAGE_GAPS.installToCloseOff);
  } else if (!ahjDone && !svDone && !contractDone && !ucDone) {
    // no cascade needed, dates are in the future
  }

  stages.uc_application = {
    target: project.ucDueDate,
    expected: toStr(expectedUc),
    status: ucDone ? "completed" : (project.ucStatus ? "in_progress" : "pending"),
  };

  stages.rebates_payment = {
    target: project.ucDueDate,
    expected: toStr(expectedUc),
    status: getStageStatus(project.rebateStatus, ["complete", "not required", "approved"]),
  };

  stages.contract_signing = {
    target: project.contractDueDate,
    expected: toStr(expectedContract),
    status: contractDone ? "completed" : (project.installTeamStage ? "in_progress" : "pending"),
  };

  stages.site_visit = {
    target: project.siteVisitDueDate,
    expected: project.siteVisitDate || toStr(expectedSv),
    status: svDone ? "completed" : "pending",
  };

  stages.ahj_permitting = {
    target: project.ahjDueDate,
    expected: toStr(expectedAhj),
    status: ahjDone ? "completed" : (project.ahjStatus ? "in_progress" : "pending"),
  };

  stages.install_booking = {
    target: project.installDueDate,
    expected: project.installStartDate || toStr(expectedInstall),
    status: project.installStartDate ? "completed" : "pending",
  };

  stages.installation = {
    target: project.installDueDate,
    expected: project.installStartDate || toStr(expectedInstall),
    status: project.installTeamStage?.toLowerCase().includes("active install")
      ? "completed"
      : project.installTeamStage?.toLowerCase().includes("complete")
        ? "completed"
        : "pending",
  };

  stages.close_off = {
    target: project.closeOffDueDate,
    expected: toStr(expectedCloseOff),
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

const STAGE_COLORS: Record<string, { bar: string; text: string }> = {
  uc_application: { bar: "bg-blue-500", text: "text-white" },
  rebates_payment: { bar: "bg-purple-500", text: "text-white" },
  contract_signing: { bar: "bg-amber-500", text: "text-white" },
  site_visit: { bar: "bg-emerald-500", text: "text-white" },
  ahj_permitting: { bar: "bg-orange-500", text: "text-white" },
  install_booking: { bar: "bg-cyan-500", text: "text-white" },
  installation: { bar: "bg-indigo-500", text: "text-white" },
  close_off: { bar: "bg-rose-500", text: "text-white" },
};

function GanttChart({
  stages,
}: {
  stages: Record<string, { target: string | null; expected: string | null; status: string }>;
  projectCreatedDate: string | null;
}) {
  const [zoomed, setZoomed] = useState(false);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const allExpected = PROJECT_STAGES
    .map(k => stages[k]?.expected ? parseISO(stages[k].expected!) : null)
    .filter(Boolean) as Date[];

  const earliestExpected = allExpected.length > 0 ? new Date(Math.min(...allExpected.map(d => d.getTime()))) : now;
  const baseDate = earliestExpected > now ? now : earliestExpected;

  const zoomBase = zoomed ? now : baseDate;

  const stageData = PROJECT_STAGES.map((key, idx) => {
    const stage = stages[key];
    if (!stage) return null;
    const expectedDate = stage.expected ? parseISO(stage.expected) : null;
    const endDay = expectedDate ? Math.max(0, differenceInDays(expectedDate, zoomBase)) : 0;

    let startDay = 0;
    if (idx > 0) {
      const prevKey = PROJECT_STAGES[idx - 1];
      const prevStage = stages[prevKey];
      const prevExpected = prevStage?.expected ? parseISO(prevStage.expected) : null;
      startDay = prevExpected ? Math.max(0, differenceInDays(prevExpected, zoomBase)) : 0;
    }

    if (key === 'rebates_payment') startDay = 0;

    const duration = Math.max(1, endDay - startDay);
    const isLate = stage.target && stage.expected && new Date(stage.expected) > new Date(stage.target);

    return { key, startDay, endDay, duration, stage, isLate };
  }).filter(Boolean) as { key: string; startDay: number; endDay: number; duration: number; stage: { target: string | null; expected: string | null; status: string }; isLate: boolean }[];

  const maxDay = Math.max(...stageData.map(s => s.endDay), 1);
  const todayDay = Math.max(0, differenceInDays(now, zoomBase));

  const startLabel = zoomed
    ? format(now, "MMM d, yyyy")
    : format(zoomBase, "MMM d, yyyy");
  const endDate = new Date(zoomBase);
  endDate.setDate(endDate.getDate() + maxDay);
  const endLabel = format(endDate, "MMM d, yyyy");

  return (
    <div className="space-y-1.5" data-testid="gantt-chart">
      {stageData.map(({ key, startDay, duration, endDay, stage, isLate }) => {
        const Icon = stageIcons[key] || Clock;
        const isCompleted = stage.status === "completed";
        const leftPct = (startDay / maxDay) * 100;
        const widthPct = Math.max(3, (duration / maxDay) * 100);
        const colors = STAGE_COLORS[key] || { bar: "bg-gray-400", text: "text-white" };
        const barClass = isCompleted ? "bg-green-500" : isLate ? "bg-red-400" : colors.bar;

        const expectedStr = stage.expected ? format(parseISO(stage.expected), "MMM d") : "";

        return (
          <div key={key} className="flex items-center gap-2" data-testid={`gantt-row-${key}`}>
            <div className="w-[140px] flex items-center gap-1.5 flex-shrink-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs truncate">{STAGE_LABELS[key] || key}</span>
            </div>
            <div className="flex-1 relative h-7 rounded bg-muted/30">
              {!zoomed && todayDay >= 0 && todayDay <= maxDay && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-blue-400/60 z-10"
                  style={{ left: `${(todayDay / maxDay) * 100}%` }}
                  title="Today"
                />
              )}
              <div
                className={`absolute top-1 h-5 rounded ${barClass} flex items-center justify-center transition-all`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={`${STAGE_LABELS[key]}: ${duration}d (${expectedStr})`}
              >
                <span className={`text-[10px] font-medium ${colors.text} drop-shadow-sm`}>
                  {duration}d
                </span>
              </div>
            </div>
            <div className="w-[55px] flex-shrink-0 text-right">
              <span className="text-[10px] text-muted-foreground">{expectedStr}</span>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between mt-1 pt-1.5 border-t text-[10px] text-muted-foreground">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Complete</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-400" />
            <span>Late</span>
          </div>
          {!zoomed && (
            <div className="flex items-center gap-1">
              <div className="w-px h-4 bg-blue-400/60" />
              <span>Today</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setZoomed(!zoomed)}
          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          data-testid="button-zoom-gantt"
        >
          {zoomed ? "Show full timeline" : "Zoom to today →"}
        </button>
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

function ExpectedDueRow({ target, expected, testId }: { target: string | null; expected: string | null; testId?: string }) {
  if (!expected) return <InfoRow label="Expected Due" value="--" testId={testId} />;
  const formattedExpected = formatDate(expected);
  const isLate = target && expected && new Date(expected) > new Date(target);
  const isPushed = target && expected && target !== expected;
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">Expected Due</span>
      <span className="flex items-center gap-2" data-testid={testId}>
        <span className={`font-medium ${isLate ? 'text-red-600 dark:text-red-400' : isPushed ? 'text-amber-600 dark:text-amber-400' : ''}`}>
          {formattedExpected}
        </span>
        {isLate && (
          <Badge variant="destructive" className="text-[10px] px-1.5">
            {differenceInDays(parseISO(expected), parseISO(target!))}d late
          </Badge>
        )}
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
  const { toast } = useToast();

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  const { data: taskActions = [], isLoading: actionsLoading } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "task-actions"],
  });

  const { data: schedules = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "install-schedules"],
  });

  const { data: pmOptions = [] } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/pmStatus'],
  });

  const pmStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}`, { pmStatus: newStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "PM Status updated", description: "Change synced to Asana" });
    },
    onError: (err: any) => {
      toast({ title: "Error updating PM Status", description: err.message, variant: "destructive" });
    }
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
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
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
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
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
          <div className="flex items-center gap-1.5" data-testid="pm-status-select">
            <span className="text-xs text-muted-foreground">PM Status:</span>
            <Select
              value={project.pmStatus || ''}
              onValueChange={(v) => pmStatusMutation.mutate(v)}
              disabled={pmStatusMutation.isPending}
            >
              <SelectTrigger className={`h-6 w-auto min-w-[120px] text-xs border px-2 py-0 ${
                project.pmStatus?.toLowerCase().includes('complete')
                  ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700"
                  : project.pmStatus?.toLowerCase().includes('install')
                    ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700"
                    : project.pmStatus?.toLowerCase().includes('paused')
                      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700"
                      : project.pmStatus?.toLowerCase().includes('lost')
                        ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700"
                        : "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600"
              }`} data-testid="select-pm-status">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                {pmOptions.map(opt => (
                  <SelectItem key={opt.gid} value={opt.name}>{opt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <ExpectedDueRow target={project.ucDueDate} expected={stages.uc_application.expected} testId="text-uc-expected" />
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
          <InfoRow label="Contract Status" value={<StatusBadge status={project.installTeamStage} />} testId="text-contract-status" />
          <InfoRow label="Target Due" value={formatDate(project.contractDueDate)} testId="text-contract-target" />
          <ExpectedDueRow target={project.contractDueDate} expected={stages.contract_signing.expected} testId="text-contract-expected" />
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
          <ExpectedDueRow target={project.siteVisitDueDate} expected={stages.site_visit.expected} testId="text-sv-expected" />
          {project.siteVisitDate && (
            <InfoRow label="Visit Date" value={formatDate(project.siteVisitDate)} testId="text-sv-date" />
          )}
        </StageSection>

        <StageSection title="AHJ / Permitting" icon={Shield} status={stages.ahj_permitting.status}>
          <InfoRow label="Status" value={<StatusBadge status={project.ahjStatus} />} testId="text-ahj-status" />
          <InfoRow label="Target Due" value={formatDate(project.ahjDueDate)} testId="text-ahj-target" />
          <ExpectedDueRow target={project.ahjDueDate} expected={stages.ahj_permitting.expected} testId="text-ahj-expected" />
        </StageSection>

        <StageSection title="Installation" icon={Wrench} status={stages.installation.status}>
          <InfoRow label="Install Stage" value={project.installTeamStage} testId="text-install-team-stage" />
          <InfoRow label="Target Due" value={formatDate(project.installDueDate)} testId="text-install-target" />
          <ExpectedDueRow target={project.installDueDate} expected={stages.installation.expected} testId="text-install-expected" />
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
          <ExpectedDueRow target={project.closeOffDueDate} expected={stages.close_off.expected} testId="text-closeoff-expected" />
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
