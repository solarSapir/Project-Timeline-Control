import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Users, ArrowUpDown } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { Project } from "@shared/schema";

type StageKey = "uc" | "rebates" | "contract" | "siteVisit" | "ahj" | "install" | "closeOff";

interface StageInfo {
  label: string;
  shortLabel: string;
  getStatus: (p: Project) => string | null;
}

const STAGES: Record<StageKey, StageInfo> = {
  uc: {
    label: "UC Application",
    shortLabel: "UC",
    getStatus: (p) => p.ucStatus,
  },
  rebates: {
    label: "Rebates",
    shortLabel: "Rebates",
    getStatus: (p) => p.rebateStatus,
  },
  contract: {
    label: "Contract",
    shortLabel: "Contract",
    getStatus: (p) => p.installTeamStage,
  },
  siteVisit: {
    label: "Site Visit",
    shortLabel: "Site Visit",
    getStatus: (p) => p.siteVisitStatus,
  },
  ahj: {
    label: "AHJ / Permit",
    shortLabel: "AHJ",
    getStatus: (p) => p.ahjStatus,
  },
  install: {
    label: "Installation",
    shortLabel: "Install",
    getStatus: (p) => {
      if (p.ahjStatus?.toLowerCase().includes("permit issued")) return "Ready";
      if (p.ahjStatus?.toLowerCase().includes("closed")) return "Complete";
      return "Waiting";
    },
  },
  closeOff: {
    label: "Close-off",
    shortLabel: "Close-off",
    getStatus: (p) => p.pmStatus,
  },
};

function getStatusColor(status: string | null): string {
  if (!status) return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
  const s = status.toLowerCase();

  if (s.includes("complete") || s.includes("closed") || s.includes("approved") || s.includes("not required") || s === "ready")
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300";

  if (s.includes("submitted") || s.includes("in-progress") || s.includes("in progress") || s.includes("pending") || s.includes("booked") || s.includes("active"))
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300";

  if (s.includes("missing") || s.includes("revision") || s.includes("rejected") || s.includes("need"))
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300";

  if (s.includes("new") || s.includes("waiting"))
    return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

  if (s.includes("permit issued") || s.includes("permit close"))
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300";

  if (s.includes("install"))
    return "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300";

  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
}

function truncateStatus(status: string | null, maxLen = 18): string {
  if (!status) return "--";
  if (status.length <= maxLen) return status;
  return status.substring(0, maxLen - 1) + "\u2026";
}

type SortField = "name" | "province" | "created";

export default function AllProjectsView() {
  const [search, setSearch] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const installProjects = useMemo(() => {
    return (projects || []).filter(
      (p) =>
        p.installType?.toLowerCase() === "install" &&
        (!p.propertySector || p.propertySector.toLowerCase() === "residential") &&
        !['complete', 'project paused', 'project lost'].includes(p.pmStatus?.toLowerCase() || '')
    );
  }, [projects]);

  const provinces = useMemo(() => {
    const set = new Set<string>();
    installProjects.forEach((p) => {
      if (p.province) set.add(p.province);
    });
    return Array.from(set).sort();
  }, [installProjects]);

  const filtered = useMemo(() => {
    let list = installProjects;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (provinceFilter !== "all") {
      list = list.filter((p) => p.province === provinceFilter);
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "province") cmp = (a.province || "").localeCompare(b.province || "");
      else if (sortField === "created") cmp = (a.projectCreatedDate || "").localeCompare(b.projectCreatedDate || "");
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [installProjects, search, provinceFilter, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">All Projects</h1>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-all-projects-title">All Projects</h1>
        <Badge variant="secondary" data-testid="badge-total-count">
          <Users className="h-3 w-3 mr-1" />
          {filtered.length} of {installProjects.length} projects
        </Badge>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-all"
          />
        </div>
        <Select value={provinceFilter} onValueChange={setProvinceFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-province-filter">
            <SelectValue placeholder="Province" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Provinces</SelectItem>
            {provinces.map((prov) => (
              <SelectItem key={prov} value={prov}>
                {prov}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-all-projects">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap sticky left-0 bg-muted/40 z-10">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => toggleSort("name")}
                      data-testid="button-sort-name"
                    >
                      Customer
                      <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => toggleSort("province")}
                      data-testid="button-sort-province"
                    >
                      Province
                      <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </th>
                  {(Object.keys(STAGES) as StageKey[]).map((key) => (
                    <th
                      key={key}
                      className="text-center px-2 py-2.5 font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {STAGES[key].shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    data-testid={`row-project-${p.id}`}
                  >
                    <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-0 bg-background z-10">
                      <Link
                        href={`/project/${p.id}`}
                        className="hover:underline text-primary"
                        data-testid={`link-project-${p.id}`}
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap" data-testid={`text-province-${p.id}`}>
                      {p.province || "--"}
                    </td>
                    {(Object.keys(STAGES) as StageKey[]).map((key) => {
                      const status = STAGES[key].getStatus(p);
                      return (
                        <td key={key} className="px-2 py-2 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight max-w-[100px] truncate ${getStatusColor(status)}`}
                                data-testid={`status-${key}-${p.id}`}
                              >
                                {truncateStatus(status)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs font-semibold">{STAGES[key].label}</p>
                              <p className="text-xs">{status || "No status"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                      No projects match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
