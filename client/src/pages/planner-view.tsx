import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageLoader } from "@/components/ui/logo-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Search, Check, Circle, Upload, Loader2, RefreshCw,
  CheckCircle2, AlertTriangle, HardHat, FileText, DollarSign,
  Send, FileSignature, Maximize2, FolderOpen
} from "lucide-react";
import { PlanningSubtaskPanel } from "@/components/shared/SubtaskExpandPanel";
import type { Project } from "@shared/schema";

const CONTRACTORS = [
  "RJ ELECTRIC [NS,NB]",
  "UPGRADIUM",
  "SUNSHINE",
  "Power Blitz",
  "MarkON electric",
  "Michael Alcrow",
  "Evolve Energy",
  "VG Electric",
];

function isNsProject(p: Project) {
  return p.province?.toLowerCase().includes('nova scotia') || p.province?.toLowerCase() === 'ns';
}

function isPlannerComplete(p: Project) {
  const hasContractor = !!p.contractStatus && p.contractStatus !== 'A. Not Assign';
  const isNS = isNsProject(p);
  const hasPermit = !!p.electricalPermitUrl;
  const scopeOk = !!p.plannerScopeConfirmed;
  const proposalOk = !!p.plannerProposalUrl;
  const sitePlanOk = !!p.plannerSitePlanUrl;
  const costOk = !!p.plannerTotalCost;
  const payoutOk = !!p.plannerContractorPayout;
  const contractSent = !!p.plannerContractSent;
  const contractSigned = !!p.plannerContractSigned;
  return hasContractor && scopeOk && proposalOk && sitePlanOk && costOk && payoutOk && contractSent && contractSigned && (!isNS || hasPermit);
}

function needsPlanning(p: Project) {
  if (p.installType?.toLowerCase() !== 'install') return false;
  if (['complete', 'project paused', 'project lost'].includes(p.pmStatus?.toLowerCase() || '')) return false;
  if (!p.propertySector || p.propertySector.toLowerCase() === 'residential') {
    return !isPlannerComplete(p);
  }
  return false;
}

function CheckItem({ done, label, required, children }: {
  done: boolean; label: string; required?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {done ? (
        <Check className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
      ) : (
        <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      )}
      <span className={`text-[11px] ${done ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
        {label}
      </span>
      {required && !done && (
        <span className="text-[9px] text-red-500 font-medium">Required</span>
      )}
      {children}
    </div>
  );
}

function PlannerCard({ project, onFocus }: { project: Project; onFocus: () => void }) {
  const { toast } = useToast();
  const permitRef = useRef<HTMLInputElement>(null);
  const proposalRef = useRef<HTMLInputElement>(null);
  const sitePlanRef = useRef<HTMLInputElement>(null);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [editCost, setEditCost] = useState(false);
  const [editPayout, setEditPayout] = useState(false);
  const [costValue, setCostValue] = useState(project.plannerTotalCost || "");
  const [payoutValue, setPayoutValue] = useState(project.plannerContractorPayout || "");

  const isNS = isNsProject(project);
  const hasContractor = !!project.contractStatus && project.contractStatus !== 'A. Not Assign';
  const hasPermit = !!project.electricalPermitUrl;
  const hasProposal = !!project.plannerProposalUrl;
  const hasSitePlan = !!project.plannerSitePlanUrl;
  const scopeConfirmed = !!project.plannerScopeConfirmed;
  const hasCost = !!project.plannerTotalCost;
  const hasPayout = !!project.plannerContractorPayout;
  const contractSent = !!project.plannerContractSent;
  const contractSigned = !!project.plannerContractSigned;
  const isReady = isPlannerComplete(project);

  const completedCount = [hasContractor, scopeConfirmed, hasProposal, hasSitePlan, hasCost, hasPayout, contractSent, contractSigned, ...(isNS ? [hasPermit] : [])].filter(Boolean).length;
  const totalCount = 8 + (isNS ? 1 : 0);

  const updateField = useMutation({
    mutationFn: async (fields: Record<string, unknown>) => {
      await apiRequest("PATCH", `/api/projects/${project.id}`, fields);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Updated", description: "Project planner updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const proposalMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("proposal", file);
      const res = await fetch(`/api/projects/${project.id}/planner-proposal`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "files"] });
      toast({ title: "Uploaded", description: "Proposal saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const sitePlanMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("sitePlan", file);
      const res = await fetch(`/api/projects/${project.id}/planner-site-plan`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "files"] });
      toast({ title: "Uploaded", description: "Site plan saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const permitMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("electricalPermit", file);
      const res = await fetch(`/api/projects/${project.id}/electrical-permit`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "files"] });
      toast({ title: "Uploaded", description: "Electrical permit saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const saveCost = () => {
    if (costValue.trim()) {
      updateField.mutate({ plannerTotalCost: costValue.trim() });
    }
    setEditCost(false);
  };

  const savePayout = () => {
    if (payoutValue.trim()) {
      updateField.mutate({ plannerContractorPayout: payoutValue.trim() });
    }
    setEditPayout(false);
  };

  return (
    <Card className={`transition-colors ${isReady ? "border-l-4 border-l-green-400" : ""}`} data-testid={`card-planner-${project.id}`}>
      <CardContent className="py-3 px-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/project/${project.id}`} className="font-medium text-sm text-primary hover:underline break-all" data-testid={`link-planner-profile-${project.id}`}>
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
            {isReady && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400 border border-green-200 dark:border-green-800" data-testid={`badge-ready-${project.id}`}>
                Ready for UC
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">{completedCount}/{totalCount} complete</span>
          </div>

          <div className="mt-2 pt-2 border-t">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">Planning Checklist</span>
              {isReady && <Check className="h-3 w-3 text-green-600 dark:text-green-400" />}
              {!isReady && <AlertTriangle className="h-3 w-3 text-amber-500" />}
            </div>

            <div className="space-y-2.5 ml-0.5">
              <div>
                <CheckItem done={scopeConfirmed} label="Confirm Scope of Work" required>
                  <div className="ml-2 flex items-center gap-1">
                    <Checkbox
                      checked={scopeConfirmed}
                      onCheckedChange={(checked) => updateField.mutate({ plannerScopeConfirmed: !!checked })}
                      disabled={updateField.isPending}
                      className="h-3.5 w-3.5"
                      data-testid={`checkbox-scope-${project.id}`}
                    />
                    <span className="text-[10px] text-muted-foreground">{scopeConfirmed ? "Confirmed" : "Mark confirmed"}</span>
                  </div>
                </CheckItem>
              </div>

              <div>
                <CheckItem done={hasProposal} label="Upload Final Proposal" required>
                  <input
                    ref={proposalRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) proposalMutation.mutate(f);
                      e.target.value = "";
                    }}
                    data-testid={`input-planner-proposal-${project.id}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 text-[10px] px-1.5 ml-1"
                    onClick={() => proposalRef.current?.click()}
                    disabled={proposalMutation.isPending}
                    data-testid={`button-upload-proposal-${project.id}`}
                  >
                    {proposalMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : hasProposal ? (
                      <><RefreshCw className="h-3 w-3 mr-0.5" /> Replace</>
                    ) : (
                      <><Upload className="h-3 w-3 mr-0.5" /> Upload</>
                    )}
                  </Button>
                </CheckItem>
              </div>

              <div>
                <CheckItem done={hasSitePlan} label="Upload Site Plan" required>
                  <input
                    ref={sitePlanRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) sitePlanMutation.mutate(f);
                      e.target.value = "";
                    }}
                    data-testid={`input-planner-siteplan-${project.id}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 text-[10px] px-1.5 ml-1"
                    onClick={() => sitePlanRef.current?.click()}
                    disabled={sitePlanMutation.isPending}
                    data-testid={`button-upload-siteplan-${project.id}`}
                  >
                    {sitePlanMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : hasSitePlan ? (
                      <><RefreshCw className="h-3 w-3 mr-0.5" /> Replace</>
                    ) : (
                      <><Upload className="h-3 w-3 mr-0.5" /> Upload</>
                    )}
                  </Button>
                </CheckItem>
              </div>

              <div>
                <CheckItem done={hasCost} label="Total Project Cost (Customer)" required>
                  {!editCost && hasCost ? (
                    <button onClick={() => setEditCost(true)} className="text-[10px] text-primary hover:underline ml-1" data-testid={`text-cost-${project.id}`}>
                      ${project.plannerTotalCost}
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1 ml-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="e.g. 25000"
                        value={costValue}
                        onChange={(e) => setCostValue(e.target.value)}
                        className="h-5 text-[10px] w-[100px] px-1"
                        onKeyDown={(e) => e.key === 'Enter' && saveCost()}
                        data-testid={`input-cost-${project.id}`}
                      />
                      <Button variant="outline" size="sm" className="h-5 text-[10px] px-1.5" onClick={saveCost} disabled={updateField.isPending} data-testid={`button-save-cost-${project.id}`}>
                        Save
                      </Button>
                    </div>
                  )}
                </CheckItem>
              </div>

              <div>
                <CheckItem done={hasPayout} label="Contractor Payout Amount" required>
                  {!editPayout && hasPayout ? (
                    <button onClick={() => setEditPayout(true)} className="text-[10px] text-primary hover:underline ml-1" data-testid={`text-payout-${project.id}`}>
                      ${project.plannerContractorPayout}
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1 ml-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="e.g. 12000"
                        value={payoutValue}
                        onChange={(e) => setPayoutValue(e.target.value)}
                        className="h-5 text-[10px] w-[100px] px-1"
                        onKeyDown={(e) => e.key === 'Enter' && savePayout()}
                        data-testid={`input-payout-${project.id}`}
                      />
                      <Button variant="outline" size="sm" className="h-5 text-[10px] px-1.5" onClick={savePayout} disabled={updateField.isPending} data-testid={`button-save-payout-${project.id}`}>
                        Save
                      </Button>
                    </div>
                  )}
                </CheckItem>
              </div>

              <div>
                <CheckItem done={hasContractor} label="Contractor Assignment" required />
                <div className="ml-4 mt-1">
                  <Select
                    value={project.contractStatus || ''}
                    onValueChange={(v) => updateField.mutate({ contractStatus: v })}
                    disabled={updateField.isPending}
                  >
                    <SelectTrigger className="w-[220px] h-7 text-xs" data-testid={`select-contractor-${project.id}`}>
                      <SelectValue placeholder="Assign contractor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A. Not Assign">Not Assigned</SelectItem>
                      {CONTRACTORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {updateField.isPending && (
                    <span className="text-[10px] text-muted-foreground ml-2 inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                    </span>
                  )}
                </div>
              </div>

              <div>
                <CheckItem done={contractSent} label="Contractor Contract Sent" required>
                  <div className="ml-2 flex items-center gap-1">
                    <Checkbox
                      checked={contractSent}
                      onCheckedChange={(checked) => updateField.mutate({ plannerContractSent: !!checked })}
                      disabled={updateField.isPending}
                      className="h-3.5 w-3.5"
                      data-testid={`checkbox-contract-sent-${project.id}`}
                    />
                    <Send className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{contractSent ? "Sent" : "Mark sent"}</span>
                  </div>
                </CheckItem>
              </div>

              <div>
                <CheckItem done={contractSigned} label="Contractor Contract Signed" required>
                  <div className="ml-2 flex items-center gap-1">
                    <Checkbox
                      checked={contractSigned}
                      onCheckedChange={(checked) => updateField.mutate({ plannerContractSigned: !!checked })}
                      disabled={updateField.isPending || !contractSent}
                      className="h-3.5 w-3.5"
                      data-testid={`checkbox-contract-signed-${project.id}`}
                    />
                    <FileSignature className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {contractSigned ? "Signed" : contractSent ? "Mark signed" : "Send contract first"}
                    </span>
                  </div>
                </CheckItem>
              </div>

              {isNS && (
                <div>
                  <CheckItem done={hasPermit} label="Electrical Permit (NS)" required>
                    <input
                      ref={permitRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) permitMutation.mutate(f);
                        e.target.value = "";
                      }}
                      data-testid={`input-planner-permit-${project.id}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 text-[10px] px-1.5 ml-1"
                      onClick={() => permitRef.current?.click()}
                      disabled={permitMutation.isPending}
                      data-testid={`button-upload-planner-permit-${project.id}`}
                    >
                      {permitMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : hasPermit ? (
                        <><RefreshCw className="h-3 w-3 mr-0.5" /> Replace</>
                      ) : (
                        <><Upload className="h-3 w-3 mr-0.5" /> Upload</>
                      )}
                    </Button>
                  </CheckItem>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3 pt-2 border-t">
              <Button
                size="sm"
                variant={showSubtasks ? "secondary" : "ghost"}
                className="h-7 text-xs gap-1 px-2"
                onClick={() => setShowSubtasks(!showSubtasks)}
                data-testid={`button-subtasks-${project.id}`}
              >
                <FolderOpen className="h-3 w-3" />
                Subtasks
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 px-2"
                onClick={onFocus}
                data-testid={`button-focus-${project.id}`}
              >
                <Maximize2 className="h-3 w-3" />
                Focus
              </Button>
            </div>

            {showSubtasks && (
              <div className="pt-3 border-t mt-2">
                <PlanningSubtaskPanel projectId={project.id} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlannerView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("needs_planning");
  const [focusProject, setFocusProject] = useState<Project | null>(null);

  const { data: projects, isLoading } = useQuery<Project[]>({ queryKey: ['/api/projects'] });

  if (isLoading) {
    return <PageLoader title="Loading planner..." />;
  }

  const installProjects = (projects || []).filter((p) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
    !['complete', 'project paused', 'project lost'].includes(p.pmStatus?.toLowerCase() || '')
  );

  const plannerProjects = installProjects.filter(needsPlanning);
  const readyProjects = installProjects.filter(isPlannerComplete);

  const filtered = (filter === "needs_planning" ? plannerProjects : filter === "ready" ? readyProjects : installProjects).filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aReady = isPlannerComplete(a);
    const bReady = isPlannerComplete(b);
    if (aReady && !bReady) return 1;
    if (!aReady && bReady) return -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-planner-title">Project Planner</h1>
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setFilter("needs_planning")}
            className={`px-2 py-1 rounded-md transition-colors font-medium ${filter === "needs_planning" ? "bg-orange-600 text-white" : "text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950"}`}
            data-testid="filter-tab-needs-planning"
          >
            <span className="flex items-center gap-1"><HardHat className="h-3 w-3" /> {plannerProjects.length} need planning</span>
          </button>
          <button
            onClick={() => setFilter("ready")}
            className={`px-2 py-1 rounded-md transition-colors font-medium ${filter === "ready" ? "bg-green-600 text-white" : "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950"}`}
            data-testid="filter-tab-ready"
          >
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {readyProjects.length} ready</span>
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-2 py-1 rounded-md transition-colors font-medium ${filter === "all" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
            data-testid="filter-tab-all"
          >
            {installProjects.length} total
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-planner" />
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            {filter === "needs_planning" ? <><HardHat className="h-3.5 w-3.5 text-orange-500" /> Needs Planning ({sorted.length})</>
            : filter === "ready" ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Ready for UC ({sorted.length})</>
            : <>All Install Projects ({sorted.length})</>}
          </p>

          {sorted.map((p) => (
            <PlannerCard key={p.id} project={p} onFocus={() => setFocusProject(p)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>{filter === "needs_planning" ? "All projects have been planned." : "No projects match this filter."}</p>
        </div>
      )}

      <Dialog open={!!focusProject} onOpenChange={(open) => { if (!open) setFocusProject(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-planner-focus">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Maximize2 className="h-5 w-5" />
              {focusProject?.name}
            </DialogTitle>
            <DialogDescription>
              Planning focus view — checklist, notes, and Asana planning subtask.
            </DialogDescription>
          </DialogHeader>
          {focusProject && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <PlannerCard project={focusProject} onFocus={() => {}} />
              </div>
              <div>
                <PlanningSubtaskPanel projectId={focusProject.id} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
