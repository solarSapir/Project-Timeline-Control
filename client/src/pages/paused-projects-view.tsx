import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageLoader } from "@/components/ui/logo-spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import {
  Search, PauseCircle, ChevronDown, ChevronUp, Plus, X, Check,
  History, CalendarClock, Clock, AlertTriangle, BarChart3, Users, PenLine,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { formatShortDate } from "@/utils/dates";
import { EscalationBadge } from "@/components/shared/EscalationBadge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CollapsibleKpiSection } from "@/components/dashboard/CollapsibleKpiSection";
import type { Project, PauseReason, PauseLog, StaffMember } from "@shared/schema";

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
  const [staffName, setStaffName] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpStaff, setFollowUpStaff] = useState("");

  const projectLogs = useMemo(() =>
    allLogs.filter(l => l.projectId === project.id),
    [allLogs, project.id]
  );

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
          </div>

          {expanded && (
            <div className="space-y-3 pt-1 border-t">
              {hasExistingReason && (
                <div className="space-y-2">
                  {project.pauseReason && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">Current Reason:</span>
                      <span className="font-medium text-amber-700 dark:text-amber-400">{project.pauseReason}</span>
                    </div>
                  )}
                  {project.pauseNote && (
                    <p className="text-xs text-muted-foreground pl-0.5">{project.pauseNote}</p>
                  )}
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
                    <label className="text-xs font-medium text-muted-foreground">Note</label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Additional context..."
                      rows={2}
                      className="text-sm resize-none"
                      data-testid={`textarea-pause-note-${project.id}`}
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
                        {log.note && <p className="text-muted-foreground whitespace-pre-wrap">{log.note}</p>}
                        {log.staffName && <p className="text-muted-foreground italic">-- {log.staffName}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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

    const todayDate = new Date().toISOString().split("T")[0];
    let followUpsDue = 0;
    let followUpsScheduled = 0;
    const projectFollowUps = new Map<string, string>();

    for (const log of allPauseLogs) {
      if (log.followUpDate) {
        const existing = projectFollowUps.get(log.projectId);
        if (!existing || log.followUpDate > existing) {
          projectFollowUps.set(log.projectId, log.followUpDate);
        }
      }
    }

    const pausedIds = new Set(pausedProjects.map(p => p.id));
    for (const [pid, dateStr] of projectFollowUps) {
      if (!pausedIds.has(pid)) continue;
      followUpsScheduled++;
      if (dateStr < todayDate) followUpsDue++;
    }

    const noFollowUp = total - followUpsScheduled;

    let avgDaysPaused = 0;
    const daysPausedArr: number[] = [];
    const nowMs = Date.now();
    for (const p of pausedProjects) {
      const created = p.projectCreatedDate ? new Date(p.projectCreatedDate) : null;
      if (created) {
        const days = Math.floor((nowMs - created.getTime()) / (1000 * 60 * 60 * 24));
        daysPausedArr.push(days);
      }
    }
    if (daysPausedArr.length > 0) {
      avgDaysPaused = Math.round(daysPausedArr.reduce((a, b) => a + b, 0) / daysPausedArr.length);
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
    };
  }, [pausedProjects, allPauseLogs]);

  if (isLoading) {
    return <PageLoader title="Loading paused projects..." />;
  }

  const filtered = pausedProjects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-6 space-y-5">
      <CollapsibleKpiSection
        storageKey="paused-kpi"
        title="Paused Projects"
        titleIcon={<PauseCircle className="h-5 w-5 text-amber-500" />}
        titleExtra={<span className="text-sm text-muted-foreground" data-testid="text-paused-count">{kpiStats.total} paused</span>}
        titleTestId="text-paused-title"
        testId="section-paused-kpi"
        accentColor="hsl(45, 93%, 47%)"
        summaryItems={[
          { label: "Total", value: kpiStats.total, color: "hsl(45, 93%, 47%)" },
          { label: "Follow-ups Due", value: kpiStats.followUpsDue, color: kpiStats.followUpsDue > 0 ? "hsl(0, 84%, 60%)" : undefined },
          { label: "No Follow-up", value: kpiStats.noFollowUp },
          { label: "No Reason", value: kpiStats.withoutReason },
        ]}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <Card data-testid="kpi-total-paused">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paused</CardTitle>
              <PauseCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.total}</div>
              <p className="text-xs text-muted-foreground">projects currently paused</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-followups-due">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Follow-ups Due</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpiStats.followUpsDue > 0 ? "text-red-600" : ""}`}>{kpiStats.followUpsDue}</div>
              <p className="text-xs text-muted-foreground">overdue follow-ups</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-followups-scheduled">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled</CardTitle>
              <CalendarClock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.followUpsScheduled}</div>
              <p className="text-xs text-muted-foreground">have follow-ups set</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-no-followup">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">No Follow-up</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.noFollowUp}</div>
              <p className="text-xs text-muted-foreground">need attention</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-no-reason">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">No Reason</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.withoutReason}</div>
              <p className="text-xs text-muted-foreground">missing pause reason</p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-top-reason">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top Reason</CardTitle>
              <BarChart3 className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold truncate" title={kpiStats.topReason?.reason}>
                {kpiStats.topReason?.reason || "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {kpiStats.topReason ? `${kpiStats.topReason.count} project${kpiStats.topReason.count !== 1 ? "s" : ""}` : "no reasons logged"}
              </p>
            </CardContent>
          </Card>
        </div>
      </CollapsibleKpiSection>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search paused projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-paused" />
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <PauseCircle className="h-3.5 w-3.5 text-amber-500" /> Paused ({sorted.length})
          </p>
          {sorted.map(p => (
            <PausedCard
              key={p.id}
              project={p}
              pauseReasonOptions={pauseReasonOptions || []}
              staffMembers={staffData || []}
              allLogs={allPauseLogs}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>{search ? "No paused projects match your search." : "No projects are currently paused."}</p>
        </div>
      )}
    </div>
  );
}
