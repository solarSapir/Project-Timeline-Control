import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AHJView() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: ahjOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options', 'ahjStatus'],
    queryFn: () => fetch('/api/asana/field-options/ahjStatus').then(r => r.json()),
  });

  const statusOptions = (ahjOptions || []).map(o => o.name);

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install'
  );

  const filtered = installProjects.filter((p: any) => {
    if (filter !== "all" && p.ahjStatus !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { ahjStatus: newStatus });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "AHJ status updated in Asana" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEngFee = async (projectId: string, collected: boolean) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { engineeringFeeCollected: collected });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: collected ? "Engineering fee marked as collected" : "Engineering fee unmarked" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">AHJ / Permitting</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  const completedStatuses = statusOptions.filter(s =>
    s.toLowerCase().includes('approved') || s.toLowerCase().includes('complete') || s.toLowerCase().includes('closed')
  );

  const actionNeeded = filtered.filter(p =>
    !completedStatuses.includes(p.ahjStatus || '')
  );
  const completed = filtered.filter(p =>
    completedStatuses.includes(p.ahjStatus || '')
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-ahj-title">AHJ / Permitting</h1>
        <Badge variant="outline" data-testid="badge-action-count">{actionNeeded.length} need action</Badge>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-ahj" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[220px]" data-testid="select-ahj-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {actionNeeded.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> Action Required ({actionNeeded.length})
          </h2>
          {actionNeeded.map((p: any) => (
            <Card key={p.id} data-testid={`card-project-${p.id}`}>
              <CardContent className="py-3 px-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      UC: {p.ucStatus || 'N/A'} - Site Visit: {p.siteVisitStatus || 'N/A'} - {p.province || ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={p.ahjStatus} data-testid={`status-ahj-${p.id}`} />
                    <Select value={p.ahjStatus || ''} onValueChange={(v) => handleStatusChange(p.id, v)}>
                      <SelectTrigger className="h-8 text-xs w-[200px]" data-testid={`select-ahj-status-${p.id}`}>
                        <SelectValue placeholder="Change status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <TaskActionDialog projectId={p.id} projectName={p.name} viewType="ahj" />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!!p.permitPaymentCollected}
                      disabled
                      data-testid={`checkbox-permit-payment-${p.id}`}
                    />
                    <span className="text-xs text-muted-foreground">$1,500 permit fee</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!!p.engineeringFeeCollected}
                      onCheckedChange={(checked) => handleEngFee(p.id, !!checked)}
                      data-testid={`checkbox-eng-fee-${p.id}`}
                    />
                    <span className="text-xs">P.eng fee collected</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Completed ({completed.length})
          </h2>
          {completed.map((p: any) => (
            <Card key={p.id} className="opacity-75" data-testid={`card-project-completed-${p.id}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                  </div>
                  <StatusBadge status={p.ahjStatus} data-testid={`status-ahj-${p.id}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
