import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/logo-spinner";
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

  if (s.includes("lost"))
    return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300";

  if (s.includes("paused"))
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300";

  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
}

function getPmStatusBadgeColor(status: string | null): string {
  if (!status) return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  const s = status.toLowerCase();
  if (s.includes("complete")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300";
  if (s.includes("lost")) return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300";
  if (s.includes("paused")) return "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300";
  if (s.includes("close")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
}

function truncateStatus(status: string | null, maxLen = 18): string {
  if (!status) return "--";
  if (status.length <= maxLen) return status;
  return status.substring(0, maxLen - 1) + "\u2026";
}

type SortField = "name" | "province" | "created" | "pmStatus";

export default function AllProjectsView() {
  const [search, setSearch] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const allProjects = useMemo(() => projects || [], [projects]);

  const provinces = useMemo(() => {
    const set = new Set<string>();
    allProjects.forEach((p) => {
      if (p.province) set.add(p.province);
    });
    return Array.from(set).sort();
  }, [allProjects]);

  const installTypes = useMemo(() => {
    const set = new Set<string>();
    allProjects.forEach((p) => {
      if (p.installType) set.add(p.installType);
    });
    return Array.from(set).sort();
  }, [allProjects]);

  const pmStatuses = useMemo(() => {
    const set = new Set<string>();
    allProjects.forEach((p) => {
      if (p.pmStatus) set.add(p.pmStatus);
    });
    return Array.from(set).sort();
  }, [allProjects]);

  const filtered = useMemo(() => {
    let list = allProjects;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (provinceFilter !== "all") {
      list = list.filter((p) => p.province === provinceFilter);
    }

    if (typeFilter !== "all") {
      list = list.filter((p) => p.installType === typeFilter);
    }

    if (statusFilter !== "all") {
      list = list.filter((p) => p.pmStatus === statusFilter);
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "province") cmp = (a.province || "").localeCompare(b.province || "");
      else if (sortField === "created") cmp = (a.projectCreatedDate || "").localeCompare(b.projectCreatedDate || "");
      else if (sortField === "pmStatus") cmp = (a.pmStatus || "").localeCompare(b.pmStatus || "");
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [allProjects, search, provinceFilter, typeFilter, statusFilter, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  if (isLoading) {
    return <PageLoader title="Loading projects..." />;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-all-projects-title">All Customers</h1>
        <Badge variant="secondary" data-testid="badge-total-count">
          <Users className="h-3 w-3 mr-1" />
          {filtered.length} of {allProjects.length} customers
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
          <SelectTrigger className="w-[160px]" data-testid="select-province-filter">
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {installTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="PM Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {pmStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
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
                  <th className="text-center px-2 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    Type
                  </th>
                  <th className="text-center px-2 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => toggleSort("pmStatus")}
                      data-testid="button-sort-status"
                    >
                      PM Status
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
                    <td className="px-2 py-2 text-center" data-testid={`text-type-${p.id}`}>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        p.installType?.toLowerCase() === 'install'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
                          : p.installType?.toLowerCase() === 'diy'
                          ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {p.installType || "--"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center" data-testid={`text-pmstatus-${p.id}`}>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium max-w-[120px] truncate ${getPmStatusBadgeColor(p.pmStatus)}`}>
                        {truncateStatus(p.pmStatus, 20)}
                      </span>
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
                    <td colSpan={11} className="text-center py-12 text-muted-foreground">
                      No customers match your filters.
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
