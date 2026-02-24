import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Gift, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PaymentsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: rebateOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/rebateStatus'],
  });

  const rebateStatusOptions = Array.isArray(rebateOptions) ? rebateOptions.map(o => o.name) : [];

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install'
  );

  const filtered = installProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "needs_attention") {
      return !p.rebateStatus || p.rebateStatus.toLowerCase().includes('new') || p.rebateStatus.toLowerCase().includes('check');
    }
    if (filter === "not_required") return p.rebateStatus?.toLowerCase().includes('not required');
    if (filter !== "all" && p.rebateStatus !== filter) return false;
    return true;
  });

  const needsAttention = installProjects.filter((p: any) =>
    !p.rebateStatus || p.rebateStatus.toLowerCase().includes('new') || p.rebateStatus.toLowerCase().includes('check')
  ).length;

  const handleRebateStatus = async (projectId: string, status: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { rebateStatus: status });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Rebate status updated in Asana" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Rebates</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-rebates-title">Rebates</h1>
        <div className="flex gap-2">
          {needsAttention > 0 && (
            <Badge variant="outline" data-testid="badge-needs-attention-count">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {needsAttention} need attention
            </Badge>
          )}
          <Badge variant="outline" data-testid="badge-project-count">{filtered.length} projects</Badge>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-rebates" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[220px]" data-testid="select-rebates-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            <SelectItem value="needs_attention">Needs Attention</SelectItem>
            <SelectItem value="not_required">Not Required</SelectItem>
            {rebateStatusOptions.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No projects match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p: any) => (
            <Card key={p.id} data-testid={`card-project-${p.id}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{p.province || 'No province'}</span>
                      <span className="text-xs text-muted-foreground">PM: {p.pmStatus || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.rebateStatus ? (
                      <Badge
                        className={
                          p.rebateStatus.toLowerCase().includes('not required')
                            ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            : p.rebateStatus.toLowerCase().includes('new') || p.rebateStatus.toLowerCase().includes('check')
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        }
                        data-testid={`badge-rebate-status-${p.id}`}
                      >
                        <Gift className="h-3 w-3 mr-1" />
                        {p.rebateStatus}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs" data-testid={`badge-no-rebate-${p.id}`}>
                        No rebate status
                      </Badge>
                    )}
                    <Select value={p.rebateStatus || ''} onValueChange={(v) => handleRebateStatus(p.id, v)}>
                      <SelectTrigger className="w-[200px] h-8 text-xs" data-testid={`select-rebate-status-${p.id}`}>
                        <SelectValue placeholder="Set rebate status" />
                      </SelectTrigger>
                      <SelectContent>
                        {rebateStatusOptions.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <TaskActionDialog projectId={p.id} projectName={p.name} viewType="payments" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
