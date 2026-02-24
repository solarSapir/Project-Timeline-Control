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
import { Search, FileText, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function ContractsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: contractorOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/contractStatus'],
  });

  const contractOptions = Array.isArray(contractorOptions) ? contractorOptions.map(o => o.name) : [];

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install'
  );

  const filtered = installProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter !== "all" && p.contractStatus !== filter) return false;
    return true;
  });

  const handleContractStatus = async (projectId: string, status: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { contractStatus: status });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Contractor updated in Asana" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handlePermitPayment = async (projectId: string, collected: boolean) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { permitPaymentCollected: collected });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: collected ? "Permit payment marked as collected" : "Permit payment unmarked" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Contracts & Payments</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-contracts-title">Contracts & Payments</h1>
        <Badge variant="outline" data-testid="badge-project-count">{filtered.length} projects</Badge>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-contracts" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-contracts-filter">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {contractOptions.map(s => (
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
              <CardContent className="py-4 px-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.province || 'No province'} - UC: {p.ucStatus || 'N/A'}</p>
                  </div>
                  <TaskActionDialog projectId={p.id} projectName={p.name} viewType="contracts" />
                </div>
                <div className="flex items-center gap-4 flex-wrap text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Contractor:</span>
                    <Select value={p.contractStatus || ''} onValueChange={(v) => handleContractStatus(p.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-[200px]" data-testid={`select-contract-status-${p.id}`}>
                        <SelectValue placeholder="Select contractor" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractOptions.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Payment: {p.paymentMethod || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!!p.permitPaymentCollected}
                      onCheckedChange={(checked) => handlePermitPayment(p.id, !!checked)}
                      data-testid={`checkbox-permit-payment-${p.id}`}
                    />
                    <span className="text-xs">$1,500 permit fee collected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground" data-testid={`text-rebate-status-${p.id}`}>Rebates: {p.rebateStatus || 'N/A'}</span>
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
