import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageLoader } from "@/components/ui/logo-spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Link } from "wouter";
import {
  Search, PauseCircle, ChevronDown, ChevronUp, Plus, X, Check,
  History, CalendarClock, Clock, AlertTriangle, BarChart3, Users, PenLine,
  BellOff, Timer, CheckCircle2, TrendingUp, XCircle, RotateCcw, MoreVertical,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import { formatShortDate } from "@/utils/dates";
import { EscalationBadge } from "@/components/shared/EscalationBadge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CollapsibleKpiSection } from "@/components/dashboard/CollapsibleKpiSection";
import { FormulaTooltip } from "@/components/dashboard/FormulaTooltip";
import type { Project, PauseReason, PauseLog, StaffMember } from "@shared/schema";

function getDaysPaused(project: Project, projectLogs: PauseLog[]): number {
  if (project.pauseTimerStartDate) {
    return Math.floor((Date.now() - new Date(project.pauseTimerStartDate).getTime()) / (1000 * 60 * 60 * 24));
  }
  const latestReset = projectLogs
    .filter(l => l.actionType === "timer_reset")
    .sort((a, b) => new Date(b.pausedAt!).getTime() - new Date(a.pausedAt!).getTime())[0];
  if (latestReset?.pausedAt) {
    return Math.floor((Date.now() - new Date(latestReset.pausedAt).getTime()) / (1000 * 60 * 60 * 24));
  }
  if (project.pauseReasonSetAt) {
    return Math.floor((Date.now() - new Date(project.pauseReasonSetAt).getTime()) / (1000 * 60 * 60 * 24));
  }
  if (project.projectCreatedDate) {
    return Math.floor((Date.now() - new Date(project.projectCreatedDate).getTime()) / (1000 * 60 * 60 * 24));
  }
  return 0;
}

function PauseDurationBadge({ days, onTrigger90Day }: { days: number; onTrigger90Day: () => void }) {
  let bgClass = "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-800";
  let label = `${days}d paused`;

  if (days >= 90) {
    bgClass = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-300 dark:border-red-800 animate-pulse cursor-pointer";
    label = `${days}d paused`;
  } else if (days >= 60) {
    bgClass = "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800";
  } else if (days >= 30) {
    bgClass = "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
  }

  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap border flex items-center gap-0.5 ${bgClass}`}
      onClick={days >= 90 ? onTrigger90Day : undefined}
      data-testid="badge-pause-duration"
    >
      <Timer className="h-2.5 w-2.5" />
      {label}
      {days >= 90 && <AlertTriangle className="h-2.5 w-2.5 ml-0.5" />}
    </span>
  );
}

function PausedCard({ project, pauseReasonOptions, staffMembers, allLogs }: {
  project: Project;
  pauseReasonOptions: PauseReason[];
  staffMembers: StaffMember[];
  allLogs: PauseLog[];
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [note, setNote] = useState("");
  const [actionRequired, setActionRequired] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [staffName, setStaffName] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpStaff, setFollowUpStaff] = useState("");
  const [show90DayDialog, setShow90DayDialog] = useState(false);
  const [showLostReasonDialog, setShowLostReasonDialog] = useState(false);
  const [showProceedDialog, setShowProceedDialog] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [customLostReason, setCustomLostReason] = useState("");
  const [lostStaff, setLostStaff] = useState("");

  const projectLogs = useMemo(() =>
    allLogs.filter(l => l.projectId === project.id),
    [allLogs, project.id]
  );

  const daysPaused = useMemo(() => getDaysPaused(project, projectLogs), [project, projectLogs]);

  const timerResetCount = useMemo(() =>
    projectLogs.filter(l => l.actionType === "timer_reset").length,
    [projectLogs]
  );

  const sortedLogs = useMemo(() =>
    [...projectLogs].sort((a, b) => new Date(b.pausedAt!).getTime() - new Date(a.pausedAt!).getTime()),
    [projectLogs]
  );
  const latestLog = sortedLogs[0] || null;
  const olderLogs = sortedLogs.slice(1);
  const [showOlderLogs, setShowOlderLogs] = useState(false);

  const markLostMutation = useMutation({
    mutationFn: async () => {
      const finalReason = lostReason === "Other" && customLostReason.trim()
        ? `Other: ${customLostReason.trim()}`
        : lostReason;
      await apiRequest("POST", "/api/pause-reasons/mark-lost", {
        projectId: project.id,
        reason: finalReason,
        staffName: lostStaff || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pause-reasons/logs'] });
      toast({ title: "Project marked as lost" });
      setShowLostReasonDialog(false);
      setLostReason("");
      setCustomLostReason("");
      setLostStaff("");
    },
  });

  const resetTimerMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/pause-reasons/reset-timer", {
        projectId: project.id,
        staffName: lostStaff || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pause-reasons/logs'] });
      toast({ title: "Pause timer reset - customer likely to proceed" });
      setShowProceedDialog(false);
      setLostStaff("");
    },
  });

  const hasExistingReason = !!project.pauseReason || projectLogs.length > 0;

  const latestFollowUp = useMemo(() => {
    let latest: PauseLog | null = null;
    for (const log of projectLogs) {
      if (log.followUpDate) {
        if (!latest || new Date(log.followUpDate) > new Date(latest.followUpDate!)) {
          latest = log;
        }
      }
    }
    return latest;
  }, [projectLogs]);

  const todayStr = new Date().toISOString().split("T")[0];
  const isFollowUpOverdue = latestFollowUp?.followUpDate ? latestFollowUp.followUpDate < todayStr : false;

  const logPauseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReason && !note) return;
      await apiRequest("POST", "/api/pause-reasons/logs", {
        projectId: project.id,
        reason: selectedReason || null,
        note: note || null,
        actionRequired: actionRequired || null,
        nextSteps: nextSteps || null,
        staffName: staffName || null,
      });
      if (selectedReason) {
        await apiRequest("PATCH", `/api/projects/${project.id}`, {
          pauseReason: selectedReason,
          pauseNote: note || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pause-reasons/logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pause-reasons'] });
      toast({ title: "Pause reason logged" });
      setSelectedReason("");
      setNote("");
      setActionRequired("");
      setNextSteps("");
      setStaffName("");
      setShowForm(false);
    },
  });

  const followUpMutation = useMutation({
    mutationFn: async () => {
      if (!followUpDate) return;
      await apiRequest("POST", "/api/pause-reasons/logs", {
        projectId: project.id,
        reason: null,
        note: followUpNote || `Follow-up scheduled for ${followUpDate}`,
        staffName: followUpStaff || null,
        followUpDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pause-reasons/logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: `Follow-up set for ${followUpDate}` });
      setFollowUpDate("");
      setFollowUpNote("");
      setFollowUpStaff("");
      setShowFollowUp(false);
    },
  });

  const addCustomMutation = useMutation({
    mutationFn: async (reason: string) => {
      await apiRequest("POST", "/api/pause-reasons", { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pause-reasons'] });
    },
  });

  const handleReasonChange = (value: string) => {
    if (value === "__custom__") {
      setShowCustom(true);
      return;
    }
    setSelectedReason(value);
  };

  const handleSaveCustom = () => {
    if (!customReason.trim()) return;
    const reason = customReason.trim();
    addCustomMutation.mutate(reason);
    setSelectedReason(reason);
    setShowCustom(false);
    setCustomReason("");
  };

  const setQuickFollowUp = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setFollowUpDate(d.toISOString().split("T")[0]);
  };

  const formatLogDate = (d: string | Date | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <Card data-testid={`card-paused-${project.id}`}>
      <CardContent className="py-3 px-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/project/${project.id}`} className="font-medium text-sm text-primary hover:underline break-all" data-testid={`link-paused-profile-${project.id}`}>
              {project.name}
            </Link>
            {project.province && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {project.province}
              </span>
            )}
            {project.installType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                {project.installType}
              </span>
            )}
            <PauseDurationBadge days={daysPaused} onTrigger90Day={() => setShow90DayDialog(true)} />
            {timerResetCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-0.5" data-testid={`badge-timer-resets-${project.id}`}>
                <RotateCcw className="h-2.5 w-2.5" />
                {timerResetCount}x reset
              </span>
            )}
            <EscalationBadge projectId={project.id} />
            {isFollowUpOverdue && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-0.5" data-testid={`badge-followup-overdue-${project.id}`}>
                <AlertTriangle className="h-2.5 w-2.5" />
                Follow-up overdue
              </span>
            )}
            {latestFollowUp?.followUpDate && !isFollowUpOverdue && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-0.5" data-testid={`badge-followup-${project.id}`}>
                <CalendarClock className="h-2.5 w-2.5" />
                Follow-up {formatShortDate(latestFollowUp.followUpDate)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {project.projectCreatedDate && <span>Created {formatShortDate(project.projectCreatedDate)}</span>}
            {project.lastUnpausedDate && <span>Last Unpaused {formatShortDate(project.lastUnpausedDate)}</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">UC:</span>
            <StatusBadge status={project.ucStatus} />
            <span className="text-muted-foreground">AHJ:</span>
            <StatusBadge status={project.ahjStatus} />
            {project.contractStatus && project.contractStatus !== 'A. Not Assign' && (
              <>
                <span className="text-muted-foreground">Contractor:</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-medium">
                  {project.contractStatus}
                </span>
              </>
            )}
            {project.paymentMethod && (
              <>
                <span className="text-muted-foreground">Payment:</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400 font-medium" data-testid={`text-payment-${project.id}`}>
                  {project.paymentMethod}
                </span>
              </>
            )}
          </div>

          {project.pauseReason && !expanded && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-muted-foreground">Reason:</span>
              <span className="font-medium text-amber-700 dark:text-amber-400">{project.pauseReason}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid={`button-expand-pause-${project.id}`}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide" : "Reason for Pause"}
            </button>
            {hasExistingReason ? (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={() => { setExpanded(true); setShowFollowUp(!showFollowUp); }}
                data-testid={`button-follow-up-${project.id}`}
              >
                <CalendarClock className="h-3 w-3" />
                Follow Up
              </Button>
            ) : (
              <span className="text-[10px] text-muted-foreground italic" data-testid={`text-no-reason-${project.id}`}>
                Log a reason to enable follow-ups
              </span>
            )}
          </div>

          {expanded && (
            <div className="space-y-3 pt-1 border-t">
              {hasExistingReason && latestLog && (
                <div className="space-y-2 p-2.5 rounded-md bg-muted/40 border">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs text-amber-700 dark:text-amber-400">{latestLog.reason || project.pauseReason}</span>
                    <span className="text-[10px] text-muted-foreground">{formatLogDate(latestLog.pausedAt)}</span>
                  </div>
                  {latestLog.note && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Why Paused</span>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{latestLog.note}</p>
                    </div>
                  )}
                  {latestLog.actionRequired && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Action Required</span>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{latestLog.actionRequired}</p>
                    </div>
                  )}
                  {latestLog.nextSteps && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Next Steps</span>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{latestLog.nextSteps}</p>
                    </div>
                  )}
                  {latestLog.staffName && <p className="text-[10px] text-muted-foreground italic">-- {latestLog.staffName}</p>}
                </div>
              )}
              {hasExistingReason && !latestLog && project.pauseReason && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Current Reason:</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">{project.pauseReason}</span>
                </div>
              )}

              {showFollowUp && (
                <div className="space-y-2 p-3 rounded-md bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <label className="text-xs font-medium flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Schedule Follow-Up
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setQuickFollowUp(1)} data-testid={`button-followup-1d-${project.id}`}>Tomorrow</Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setQuickFollowUp(3)} data-testid={`button-followup-3d-${project.id}`}>3 Days</Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setQuickFollowUp(7)} data-testid={`button-followup-7d-${project.id}`}>1 Week</Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setQuickFollowUp(14)} data-testid={`button-followup-14d-${project.id}`}>2 Weeks</Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setQuickFollowUp(30)} data-testid={`button-followup-30d-${project.id}`}>1 Month</Button>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Custom Date</label>
                    <Input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="h-8 text-sm"
                      min={new Date().toISOString().split("T")[0]}
                      data-testid={`input-followup-date-${project.id}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Note (optional)</label>
                    <Textarea
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      placeholder="What to follow up on..."
                      rows={2}
                      className="text-sm resize-none"
                      data-testid={`textarea-followup-note-${project.id}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Staff</label>
                    <Select value={followUpStaff} onValueChange={setFollowUpStaff}>
                      <SelectTrigger className="h-8 text-sm" data-testid={`trigger-followup-staff-${project.id}`}>
                        <SelectValue placeholder="Select staff..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffMembers.filter(s => s.active !== false).map(s => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => followUpMutation.mutate()}
                      disabled={followUpMutation.isPending || !followUpDate}
                      data-testid={`button-submit-followup-${project.id}`}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {followUpMutation.isPending ? "Setting..." : "Set Follow-Up"}
                    </Button>
                  </div>
                </div>
              )}

              {!showForm ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowForm(true)}
                  data-testid={`button-open-reason-form-${project.id}`}
                >
                  <PenLine className="h-3 w-3" />
                  {hasExistingReason ? "Add / Edit Reason" : "Log Pause Reason"}
                </Button>
              ) : (
                <div className="space-y-3 p-3 rounded-md bg-muted/30 border">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Log New Pause Reason</label>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setShowForm(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  {showCustom ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Type a new reason..."
                        className="h-8 text-sm"
                        data-testid={`input-custom-reason-${project.id}`}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveCustom(); }}
                      />
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={handleSaveCustom} data-testid={`button-save-custom-${project.id}`}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setShowCustom(false); setCustomReason(""); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Select value={selectedReason} onValueChange={handleReasonChange}>
                      <SelectTrigger className="h-8 text-sm" data-testid={`trigger-pause-reason-${project.id}`}>
                        <SelectValue placeholder="Select a reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pauseReasonOptions.map(r => (
                          <SelectItem key={r.id} value={r.reason}>
                            {r.reason}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">
                          <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Add custom reason</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Why is this project paused?</label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Describe why the project is on hold..."
                      rows={2}
                      className="text-sm resize-none"
                      data-testid={`textarea-pause-note-${project.id}`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">What action is required from our end, if any?</label>
                    <Textarea
                      value={actionRequired}
                      onChange={(e) => setActionRequired(e.target.value)}
                      placeholder="e.g. Follow up with customer, send revised quote..."
                      rows={2}
                      className="text-sm resize-none"
                      data-testid={`textarea-action-required-${project.id}`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">What are the next steps?</label>
                    <Textarea
                      value={nextSteps}
                      onChange={(e) => setNextSteps(e.target.value)}
                      placeholder="e.g. Wait for customer response, schedule site visit..."
                      rows={2}
                      className="text-sm resize-none"
                      data-testid={`textarea-next-steps-${project.id}`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Staff</label>
                    <Select value={staffName} onValueChange={setStaffName}>
                      <SelectTrigger className="h-8 text-sm" data-testid={`trigger-staff-${project.id}`}>
                        <SelectValue placeholder="Select staff..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffMembers.filter(s => s.active !== false).map(s => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => logPauseMutation.mutate()}
                      disabled={logPauseMutation.isPending || (!selectedReason && !note)}
                      data-testid={`button-log-pause-${project.id}`}
                    >
                      {logPauseMutation.isPending ? "Logging..." : "Log Pause Reason"}
                    </Button>
                  </div>
                </div>
              )}

              {projectLogs.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <History className="h-3.5 w-3.5" />
                    Pause History ({projectLogs.length})
                  </div>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {projectLogs.map(log => (
                      <div key={log.id} className="text-xs p-2 rounded bg-muted/50 space-y-0.5" data-testid={`pause-log-${log.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {log.reason && (
                              <span className="font-medium text-amber-700 dark:text-amber-400">{log.reason}</span>
                            )}
                            {log.followUpDate && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 flex items-center gap-0.5 whitespace-nowrap">
                                <CalendarClock className="h-2.5 w-2.5" />
                                {formatShortDate(log.followUpDate)}
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground whitespace-nowrap">{formatLogDate(log.pausedAt)}</span>
                        </div>
                        {log.note && (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Why Paused</span>
                            <p className="text-muted-foreground whitespace-pre-wrap">{log.note}</p>
                          </div>
                        )}
                        {log.actionRequired && (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Action Required</span>
                            <p className="text-muted-foreground whitespace-pre-wrap">{log.actionRequired}</p>
                          </div>
                        )}
                        {log.nextSteps && (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Next Steps</span>
                            <p className="text-muted-foreground whitespace-pre-wrap">{log.nextSteps}</p>
                          </div>
                        )}
                        {log.staffName && <p className="text-muted-foreground italic">-- {log.staffName}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Dialog open={show90DayDialog} onOpenChange={setShow90DayDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Project Paused for {daysPaused} Days
              </DialogTitle>
              <DialogDescription>
                This project has been paused for over 90 days. Should it be canceled and moved to lost?
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 text-sm text-muted-foreground">
              <p className="font-medium mb-1">{project.name}</p>
              {project.pauseReason && <p>Current pause reason: {project.pauseReason}</p>}
              {timerResetCount > 0 && <p>Timer has been reset {timerResetCount} time{timerResetCount !== 1 ? "s" : ""} previously</p>}
            </div>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="destructive"
                onClick={() => {
                  setShow90DayDialog(false);
                  setShowLostReasonDialog(true);
                }}
                data-testid={`button-mark-lost-${project.id}`}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Yes, Mark as Lost
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShow90DayDialog(false);
                  setShowProceedDialog(true);
                }}
                data-testid={`button-not-lost-${project.id}`}
              >
                No, Customer May Proceed
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showLostReasonDialog} onOpenChange={setShowLostReasonDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reason for Project Lost</DialogTitle>
              <DialogDescription>
                Why is this project being marked as lost? This will be tracked in insights.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Reason</label>
                <Select value={lostReason} onValueChange={(val) => { setLostReason(val); if (val !== "Other") setCustomLostReason(""); }}>
                  <SelectTrigger data-testid={`select-lost-reason-${project.id}`}>
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Customer unresponsive">Customer unresponsive</SelectItem>
                    <SelectItem value="Customer changed mind">Customer changed mind</SelectItem>
                    <SelectItem value="Financial reasons">Financial reasons</SelectItem>
                    <SelectItem value="Went with competitor">Went with competitor</SelectItem>
                    <SelectItem value="Property issues">Property issues</SelectItem>
                    <SelectItem value="Permit denied">Permit denied</SelectItem>
                    <SelectItem value="Utility issues">Utility issues</SelectItem>
                    <SelectItem value="Project no longer viable">Project no longer viable</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {lostReason === "Other" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Please specify</label>
                  <Input
                    value={customLostReason}
                    onChange={(e) => setCustomLostReason(e.target.value)}
                    placeholder="Type the reason..."
                    className="h-9 text-sm"
                    autoFocus
                    data-testid={`input-custom-lost-reason-${project.id}`}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Staff</label>
                <Select value={lostStaff} onValueChange={setLostStaff}>
                  <SelectTrigger data-testid={`select-lost-staff-${project.id}`}>
                    <SelectValue placeholder="Select staff..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffMembers.filter(s => s.active !== false).map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLostReasonDialog(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!lostReason || (lostReason === "Other" && !customLostReason.trim()) || markLostMutation.isPending}
                onClick={() => markLostMutation.mutate()}
                data-testid={`button-confirm-lost-${project.id}`}
              >
                {markLostMutation.isPending ? "Processing..." : "Confirm Project Lost"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showProceedDialog} onOpenChange={setShowProceedDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Is the customer likely to still proceed?</DialogTitle>
              <DialogDescription>
                If yes, the pause timer will reset and the 30/60/90 day cycle will start over. This helps track how often we're following up with paused projects.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Staff</label>
                <Select value={lostStaff} onValueChange={setLostStaff}>
                  <SelectTrigger data-testid={`select-proceed-staff-${project.id}`}>
                    <SelectValue placeholder="Select staff..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffMembers.filter(s => s.active !== false).map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                onClick={() => resetTimerMutation.mutate()}
                disabled={resetTimerMutation.isPending}
                data-testid={`button-confirm-proceed-${project.id}`}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                {resetTimerMutation.isPending ? "Resetting..." : "Yes, Reset Timer"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowProceedDialog(false);
                  setShowLostReasonDialog(true);
                }}
                data-testid={`button-proceed-to-lost-${project.id}`}
              >
                No, Mark as Lost
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default function PausedProjectsView() {
  const [search, setSearch] = useState("");
  const { data: projects, isLoading } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const { data: pauseReasonOptions } = useQuery<PauseReason[]>({ queryKey: ['/api/pause-reasons'] });
  const { data: staffData } = useQuery<StaffMember[]>({ queryKey: ['/api/staff'] });
  const { data: allPauseLogs = [] } = useQuery<PauseLog[]>({
    queryKey: ['/api/pause-reasons/logs'],
    queryFn: async () => {
      const res = await fetch('/api/pause-reasons/logs');
      return res.json();
    },
  });

  const pausedProjects = useMemo(() =>
    (projects || []).filter(p => p.pmStatus?.toLowerCase() === 'project paused'),
    [projects]
  );

  const projectFollowUps = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of allPauseLogs) {
      if (log.followUpDate) {
        const existing = map.get(log.projectId);
        if (!existing || log.followUpDate > existing) {
          map.set(log.projectId, log.followUpDate);
        }
      }
    }
    return map;
  }, [allPauseLogs]);

  const todayDate = useMemo(() => new Date().toISOString().split("T")[0], []);

  const { activeProjects, snoozedProjects } = useMemo(() => {
    const active: Project[] = [];
    const snoozed: Project[] = [];
    for (const p of pausedProjects) {
      const latestFu = projectFollowUps.get(p.id);
      if (latestFu && latestFu > todayDate) {
        snoozed.push(p);
      } else {
        active.push(p);
      }
    }
    return { activeProjects: active, snoozedProjects: snoozed };
  }, [pausedProjects, projectFollowUps, todayDate]);

  const lostProjects = useMemo(() =>
    (projects || []).filter(p => p.pmStatus?.toLowerCase() === 'project lost'),
    [projects]
  );

  const kpiStats = useMemo(() => {
    const total = pausedProjects.length;

    const withReason = pausedProjects.filter(p => p.pauseReason).length;
    const withoutReason = total - withReason;

    const reasonCounts: Record<string, number> = {};
    for (const p of pausedProjects) {
      if (p.pauseReason) {
        reasonCounts[p.pauseReason] = (reasonCounts[p.pauseReason] || 0) + 1;
      }
    }
    const topReason = Object.entries(reasonCounts).sort(([, a], [, b]) => b - a)[0];

    const pausedIds = new Set(pausedProjects.map(p => p.id));
    let followUpsDue = 0;
    let followUpsScheduled = 0;
    for (const [pid, dateStr] of projectFollowUps) {
      if (!pausedIds.has(pid)) continue;
      followUpsScheduled++;
      if (dateStr < todayDate) followUpsDue++;
    }

    const noFollowUp = total - followUpsScheduled;

    let avgDaysPaused = 0;
    const daysPausedArr: number[] = [];
    for (const p of pausedProjects) {
      const pLogs = allPauseLogs.filter(l => l.projectId === p.id);
      const days = getDaysPaused(p, pLogs);
      daysPausedArr.push(days);
    }
    if (daysPausedArr.length > 0) {
      avgDaysPaused = Math.round(daysPausedArr.reduce((a, b) => a + b, 0) / daysPausedArr.length);
    }

    let over30 = 0;
    let over60 = 0;
    let over90 = 0;
    for (const d of daysPausedArr) {
      if (d >= 90) over90++;
      else if (d >= 60) over60++;
      else if (d >= 30) over30++;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoMs = sevenDaysAgo.getTime();
    let actionsThisWeek = 0;
    const staffFollowUpCounts: Record<string, number> = {};
    for (const log of allPauseLogs) {
      if (log.pausedAt) {
        const logTime = new Date(log.pausedAt).getTime();
        if (logTime >= sevenDaysAgoMs) {
          actionsThisWeek++;
          if (log.staffName) {
            staffFollowUpCounts[log.staffName] = (staffFollowUpCounts[log.staffName] || 0) + 1;
          }
        }
      }
    }

    const topStaff = Object.entries(staffFollowUpCounts).sort(([, a], [, b]) => b - a)[0];

    const timerResets = allPauseLogs.filter(l => l.actionType === "timer_reset").length;
    const markedLost = allPauseLogs.filter(l => l.actionType === "marked_lost").length;

    const lostReasonCounts: Record<string, number> = {};
    for (const p of lostProjects) {
      if (p.projectLostReason) {
        lostReasonCounts[p.projectLostReason] = (lostReasonCounts[p.projectLostReason] || 0) + 1;
      }
    }

    return {
      total,
      withReason,
      withoutReason,
      topReason: topReason ? { reason: topReason[0], count: topReason[1] } : null,
      followUpsDue,
      followUpsScheduled,
      noFollowUp,
      avgDaysPaused,
      snoozedCount: snoozedProjects.length,
      activeCount: activeProjects.length,
      actionsThisWeek,
      topStaff: topStaff ? { name: topStaff[0], count: topStaff[1] } : null,
      reasonBreakdown: Object.entries(reasonCounts).sort(([, a], [, b]) => b - a),
      over30,
      over60,
      over90,
      timerResets,
      markedLost,
      lostTotal: lostProjects.length,
      lostReasonBreakdown: Object.entries(lostReasonCounts).sort(([, a], [, b]) => b - a),
    };
  }, [pausedProjects, allPauseLogs, projectFollowUps, todayDate, snoozedProjects, activeProjects, lostProjects]);

  const [filterTab, setFilterTab] = useState<"all" | "active" | "snoozed">("active");

  if (isLoading) {
    return <PageLoader title="Loading paused projects..." />;
  }

  const searchLower = search.toLowerCase();
  const filteredActive = activeProjects
    .filter(p => !search || p.name.toLowerCase().includes(searchLower))
    .sort((a, b) => a.name.localeCompare(b.name));
  const filteredSnoozed = snoozedProjects
    .filter(p => !search || p.name.toLowerCase().includes(searchLower))
    .sort((a, b) => {
      const aDate = projectFollowUps.get(a.id) || "";
      const bDate = projectFollowUps.get(b.id) || "";
      return aDate.localeCompare(bDate);
    });
  const filteredAll = [...filteredActive, ...filteredSnoozed].sort((a, b) => a.name.localeCompare(b.name));

  const displayProjects = filterTab === "all" ? filteredAll : filterTab === "active" ? filteredActive : filteredSnoozed;

  return (
    <div className="p-6 space-y-5">
      <CollapsibleKpiSection
        storageKey="paused-kpi"
        title="Paused Projects"
        titleIcon={<PauseCircle className="h-5 w-5 text-amber-500" />}
        titleExtra={<span className="text-sm text-muted-foreground" data-testid="text-paused-count">{kpiStats.total} paused ({kpiStats.activeCount} active, {kpiStats.snoozedCount} snoozed)</span>}
        titleTestId="text-paused-title"
        testId="section-paused-kpi"
        accentColor="hsl(45, 93%, 47%)"
        summaryItems={[
          { label: "Active", value: kpiStats.activeCount, color: "hsl(45, 93%, 47%)" },
          { label: "Follow-ups Due", value: kpiStats.followUpsDue, color: kpiStats.followUpsDue > 0 ? "hsl(0, 84%, 60%)" : undefined },
          { label: "Snoozed", value: kpiStats.snoozedCount, color: "hsl(220, 70%, 50%)" },
          { label: "Avg Days Paused", value: kpiStats.avgDaysPaused },
        ]}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          <Card data-testid="kpi-total-paused">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Total Paused
                <FormulaTooltip formula="Count of projects with PM Status = 'Project Paused'" />
              </CardTitle>
              <PauseCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.total}</div>
              <p className="text-xs text-muted-foreground">projects currently paused</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-active-needing-attention">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Needs Attention
                <FormulaTooltip formula="Paused projects with overdue follow-ups or no follow-up date set. These appear in the main list." />
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpiStats.activeCount > 0 ? "text-amber-600" : ""}`}>{kpiStats.activeCount}</div>
              <p className="text-xs text-muted-foreground">{kpiStats.followUpsDue} overdue, {kpiStats.noFollowUp} no follow-up</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-snoozed">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Snoozed
                <FormulaTooltip formula="Projects with a future follow-up date. Hidden from the main list until the follow-up date arrives." />
              </CardTitle>
              <BellOff className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{kpiStats.snoozedCount}</div>
              <p className="text-xs text-muted-foreground">hidden until follow-up</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-avg-days-paused">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Avg Days Paused
                <FormulaTooltip formula="AVG(today - projectCreatedDate) for all paused projects. Measures how long projects stay on hold." />
              </CardTitle>
              <Timer className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.avgDaysPaused}d</div>
              <p className="text-xs text-muted-foreground">average hold time</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-followups-week">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Actions (7d)
                <FormulaTooltip formula="Count of pause logs (follow-ups scheduled + reasons logged) created in the last 7 days. Measures staff engagement with paused projects." />
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.actionsThisWeek}</div>
              <p className="text-xs text-muted-foreground">actions logged this week</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-duration-alert">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Duration Alert
                <FormulaTooltip formula="Projects paused 30+ days (yellow), 60+ days (red), 90+ days (critical). Based on pause timer start or last timer reset." />
              </CardTitle>
              <Timer className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs">
                {kpiStats.over30 > 0 && <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 font-medium">30d: {kpiStats.over30}</span>}
                {kpiStats.over60 > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-medium">60d: {kpiStats.over60}</span>}
                {kpiStats.over90 > 0 && <span className="px-1.5 py-0.5 rounded bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200 font-bold">90d: {kpiStats.over90}</span>}
                {kpiStats.over30 === 0 && kpiStats.over60 === 0 && kpiStats.over90 === 0 && <span className="text-muted-foreground">all under 30d</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{kpiStats.timerResets} timer reset{kpiStats.timerResets !== 1 ? "s" : ""} total</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-projects-lost">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Projects Lost
                <FormulaTooltip formula="Projects moved from 'Project Paused' to 'Project Lost' via the 90-day review process." />
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpiStats.lostTotal > 0 ? "text-red-600" : ""}`}>{kpiStats.lostTotal}</div>
              <p className="text-xs text-muted-foreground">{kpiStats.markedLost} marked via review</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-top-staff">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Top Staff (7d)
                <FormulaTooltip formula="Staff member with the most follow-up actions in the last 7 days." />
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold truncate" title={kpiStats.topStaff?.name}>
                {kpiStats.topStaff?.name || "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {kpiStats.topStaff ? `${kpiStats.topStaff.count} follow-up${kpiStats.topStaff.count !== 1 ? "s" : ""}` : "no activity"}
              </p>
            </CardContent>
          </Card>
        </div>

        {kpiStats.reasonBreakdown.length > 1 && (
          <div className="mt-3 p-3 rounded-md bg-muted/30 border">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> Pause Reason Breakdown
            </p>
            <div className="space-y-1.5">
              {kpiStats.reasonBreakdown.map(([reason, count]) => (
                <div key={reason} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs truncate">{reason}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500/70"
                        style={{ width: `${Math.round((count / kpiStats.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {kpiStats.lostReasonBreakdown.length > 0 && (
          <div className="mt-3 p-3 rounded-md bg-red-50/30 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" /> Lost Project Reasons (Insights)
            </p>
            <div className="space-y-1.5">
              {kpiStats.lostReasonBreakdown.map(([reason, count]) => (
                <div key={reason} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs truncate">{reason}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500/70"
                        style={{ width: `${Math.round((count / kpiStats.lostTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CollapsibleKpiSection>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search paused projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-paused" />
        </div>
        <Select value={filterTab} onValueChange={(v: "all" | "active" | "snoozed") => setFilterTab(v)}>
          <SelectTrigger className="w-[220px]" data-testid="select-paused-filter">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Needs Attention ({activeProjects.length})</SelectItem>
            <SelectItem value="snoozed">Snoozed ({snoozedProjects.length})</SelectItem>
            <SelectItem value="all">All ({pausedProjects.length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {displayProjects.length > 0 ? (
        <div className="space-y-2">
          {displayProjects.map(p => {
            const isSnoozed = snoozedProjects.includes(p);
            return (
              <div key={p.id} className={isSnoozed && filterTab === "all" ? "pl-2 border-l-2 border-blue-200 dark:border-blue-800" : ""}>
                <PausedCard
                  project={p}
                  pauseReasonOptions={pauseReasonOptions || []}
                  staffMembers={staffData || []}
                  allLogs={allPauseLogs}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>
            {search
              ? "No paused projects match your search."
              : filterTab === "active"
                ? "All paused projects have future follow-ups scheduled."
                : filterTab === "snoozed"
                  ? "No snoozed projects."
                  : "No paused projects."
            }
          </p>
        </div>
      )}
    </div>
  );
}
