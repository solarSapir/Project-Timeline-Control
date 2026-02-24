import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, DollarSign, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PaymentsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("pending");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install'
  );

  const filtered = installProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "pending") {
      return !p.milestonePaymentCollected || !p.finalPaymentCollected;
    }
    if (filter === "milestone_pending") return !p.milestonePaymentCollected;
    if (filter === "final_pending") return !p.finalPaymentCollected;
    if (filter === "completed") return p.milestonePaymentCollected && p.finalPaymentCollected;
    return true;
  });

  const handlePayment = async (projectId: string, field: string, collected: boolean) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { [field]: collected });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: collected ? "Payment marked as collected" : "Payment unmarked" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Payment Collection</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-payments-title">Payment Collection</h1>
        <Badge variant="outline" data-testid="badge-project-count">{filtered.length} projects</Badge>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-payments" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-payments-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Any Pending</SelectItem>
            <SelectItem value="milestone_pending">Milestone Pending</SelectItem>
            <SelectItem value="final_pending">Final Pending</SelectItem>
            <SelectItem value="completed">Fully Paid</SelectItem>
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.province || ''} - Payment: <span data-testid={`text-payment-method-${p.id}`}>{p.paymentMethod || 'N/A'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!!p.milestonePaymentCollected}
                        onCheckedChange={(checked) => handlePayment(p.id, "milestonePaymentCollected", !!checked)}
                        data-testid={`checkbox-milestone-${p.id}`}
                      />
                      <span className="text-xs">Equipment / Milestone</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!!p.finalPaymentCollected}
                        onCheckedChange={(checked) => handlePayment(p.id, "finalPaymentCollected", !!checked)}
                        data-testid={`checkbox-final-payment-${p.id}`}
                      />
                      <span className="text-xs">Final Balance</span>
                    </div>
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
