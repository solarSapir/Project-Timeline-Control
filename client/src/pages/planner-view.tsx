import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageLoader } from "@/components/ui/logo-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Search, Check, Circle, Upload, Loader2, RefreshCw,
  CheckCircle2, AlertTriangle, HardHat, FileText
} from "lucide-react";
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

function needsPlanning(p: Project) {
  if (p.installType?.toLowerCase() !== 'install') return false;
  if (['complete', 'project paused', 'project lost'].includes(p.pmStatus?.toLowerCase() || '')) return false;
  if (!p.propertySector || p.propertySector.toLowerCase() === 'residential') {
    const noContractor = !p.contractStatus || p.contractStatus === 'A. Not Assign';
    const nsNoPermit = isNsProject(p) && !p.electricalPermitUrl;
    return noContractor || nsNoPermit;
  }
  return false;
}

function PlannerCard({ project }: { project: Project }) {
  const { toast } = useToast();
  const permitRef = useRef<HTMLInputElement>(null);
  const isNS = isNsProject(project);
  const hasContractor = !!project.contractStatus && project.contractStatus !== 'A. Not Assign';
  const hasPermit = !!project.electricalPermitUrl;
  const isReady = hasContractor && (!isNS || hasPermit);

  const contractorMutation = useMutation({
    mutationFn: async (contractor: string) => {
      await apiRequest("PATCH", `/api/projects/${project.id}`, { contractStatus: contractor });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Updated", description: "Contractor assigned" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
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
          </div>

          <div className="mt-2 pt-2 border-t">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">Planning Checklist</span>
              {isReady && <Check className="h-3 w-3 text-green-600 dark:text-green-400" />}
              {!isReady && <AlertTriangle className="h-3 w-3 text-amber-500" />}
            </div>

            <div className="space-y-2 ml-0.5">
              <div className="flex items-center gap-1.5">
                {hasContractor ? (
                  <Check className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                ) : (
                  <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className={`text-[11px] ${hasContractor ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                  Contractor Assignment
                </span>
                {!hasContractor && <span className="text-[9px] text-red-500 font-medium">Required</span>}
              </div>

              <div className="ml-4">
                <Select
                  value={project.contractStatus || ''}
                  onValueChange={(v) => contractorMutation.mutate(v)}
                  disabled={contractorMutation.isPending}
                >
                  <SelectTrigger className="w-[220px] h-7 text-xs" data-testid={`select-contractor-${project.id}`}>
                    <SelectValue placeholder="Assign contractor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A. Not Assign">Not Assigned</SelectItem>
                    {CONTRACTORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {contractorMutation.isPending && (
                  <span className="text-[10px] text-muted-foreground ml-2 inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                  </span>
                )}
              </div>

              {isNS && (
                <>
                  <div className="flex items-center gap-1.5">
                    {hasPermit ? (
                      <Check className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={`text-[11px] ${hasPermit ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                      Electrical Permit (NS)
                    </span>
                    {!hasPermit && <span className="text-[9px] text-red-500 font-medium">Required</span>}

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
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlannerView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("needs_planning");

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
  const readyProjects = installProjects.filter(p => {
    const hasContractor = !!p.contractStatus && p.contractStatus !== 'A. Not Assign';
    const isNS = isNsProject(p);
    const hasPermit = !!p.electricalPermitUrl;
    return hasContractor && (!isNS || hasPermit);
  });

  const filtered = (filter === "needs_planning" ? plannerProjects : filter === "ready" ? readyProjects : installProjects).filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aReady = !!a.contractStatus && a.contractStatus !== 'A. Not Assign';
    const bReady = !!b.contractStatus && b.contractStatus !== 'A. Not Assign';
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
            <PlannerCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>{filter === "needs_planning" ? "All projects have been planned." : "No projects match this filter."}</p>
        </div>
      )}
    </div>
  );
}
