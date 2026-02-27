import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageLoader } from "@/components/ui/logo-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Search, PauseCircle, ChevronDown, ChevronUp, Plus, X, Check, History } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { formatShortDate } from "@/utils/dates";
import { EscalationBadge } from "@/components/shared/EscalationBadge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, PauseReason, PauseLog } from "@shared/schema";

function PausedCard({ project, pauseReasonOptions, staffMembers }: { project: Project; pauseReasonOptions: PauseReason[]; staffMembers: { id: string; name: string }[] }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [note, setNote] = useState("");
  const [staffName, setStaffName] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const { data: pauseHistory } = useQuery<PauseLog[]>({
    queryKey: ['/api/pause-reasons/logs', project.id],
    queryFn: async () => {
      const res = await fetch(`/api/pause-reasons/logs?projectId=${project.id}`);
      return res.json();
    },
    enabled: expanded,
  });

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
      queryClient.invalidateQueries({ queryKey: ['/api/pause-reasons/logs', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pause-reasons'] });
      toast({ title: "Pause reason logged" });
      setSelectedReason("");
      setNote("");
      setStaffName("");
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
              {pauseHistory && pauseHistory.length > 0 && (
                <span className="text-muted-foreground">({pauseHistory.length} logged)</span>
              )}
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`button-expand-pause-${project.id}`}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "Reason for Pause"}
          </button>

          {expanded && (
            <div className="space-y-3 pt-1 border-t">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Log New Pause Reason</label>
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
              </div>

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
                    {staffMembers.map(s => (
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

              {pauseHistory && pauseHistory.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <History className="h-3.5 w-3.5" />
                    Pause History ({pauseHistory.length})
                  </div>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {pauseHistory.map(log => (
                      <div key={log.id} className="text-xs p-2 rounded bg-muted/50 space-y-0.5" data-testid={`pause-log-${log.id}`}>
                        <div className="flex items-center justify-between">
                          {log.reason && (
                            <span className="font-medium text-amber-700 dark:text-amber-400">{log.reason}</span>
                          )}
                          <span className="text-muted-foreground">{formatLogDate(log.pausedAt)}</span>
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
  const { data: staffData } = useQuery<{ id: string; name: string }[]>({ queryKey: ['/api/staff'] });

  if (isLoading) {
    return <PageLoader title="Loading paused projects..." />;
  }

  const pausedProjects = (projects || []).filter(p =>
    p.pmStatus?.toLowerCase() === 'project paused'
  );

  const filtered = pausedProjects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-paused-title">
          <PauseCircle className="h-6 w-6 text-amber-500" />
          Paused Projects
        </h1>
        <span className="text-sm text-muted-foreground" data-testid="text-paused-count">{pausedProjects.length} paused</span>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search paused projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-paused" />
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <PauseCircle className="h-3.5 w-3.5 text-amber-500" /> Paused ({sorted.length})
          </p>
          {sorted.map(p => <PausedCard key={p.id} project={p} pauseReasonOptions={pauseReasonOptions || []} staffMembers={staffData || []} />)}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>{search ? "No paused projects match your search." : "No projects are currently paused."}</p>
        </div>
      )}
    </div>
  );
}
