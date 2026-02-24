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
import { Search, CreditCard, AlertTriangle, CalendarClock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function getDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function getPaymentDueDate(projectCreatedDate: string | null) {
  if (!projectCreatedDate) return null;
  const created = new Date(projectCreatedDate);
  created.setDate(created.getDate() + 7);
  return created.toISOString().split('T')[0];
}

function PaymentDueBadge({ projectCreatedDate }: { projectCreatedDate: string | null }) {
  const dueDate = getPaymentDueDate(projectCreatedDate);
  const daysLeft = getDaysUntilDue(dueDate);
  if (daysLeft === null || !dueDate) return null;

  const formattedDate = new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (daysLeft < 0) {
    return (
      <Badge variant="destructive" className="text-xs flex items-center gap-1" data-testid="badge-payment-overdue">
        <CalendarClock className="h-3 w-3" />
        {Math.abs(daysLeft)}d overdue ({formattedDate})
      </Badge>
    );
  }
  if (daysLeft <= 3) {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs flex items-center gap-1" data-testid="badge-payment-due-soon">
        <CalendarClock className="h-3 w-3" />
        Due in {daysLeft}d ({formattedDate})
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid="badge-payment-due">
      <CalendarClock className="h-3 w-3" />
      Due {formattedDate}
    </Badge>
  );
}

export default function ContractsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("needs_attention");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: paymentOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/paymentMethod'],
  });

  const paymentMethodOptions = Array.isArray(paymentOptions) ? paymentOptions.map(o => o.name) : [];

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install'
  );

  const filtered = installProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "needs_attention") return !p.paymentMethod;
    if (filter === "confirmed") return !!p.paymentMethod;
    return true;
  });

  const sortedFiltered = [...filtered].sort((a: any, b: any) => {
    if (!a.paymentMethod && b.paymentMethod) return -1;
    if (a.paymentMethod && !b.paymentMethod) return 1;
    const aDue = getPaymentDueDate(a.projectCreatedDate);
    const bDue = getPaymentDueDate(b.projectCreatedDate);
    const aDays = getDaysUntilDue(aDue);
    const bDays = getDaysUntilDue(bDue);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  });

  const needsAttentionCount = installProjects.filter((p: any) => !p.paymentMethod).length;
  const overdueCount = installProjects.filter((p: any) => {
    if (p.paymentMethod) return false;
    const dueDate = getPaymentDueDate(p.projectCreatedDate);
    const days = getDaysUntilDue(dueDate);
    return days !== null && days < 0;
  }).length;

  const handlePaymentMethod = async (projectId: string, method: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { paymentMethod: method });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Payment method updated in Asana" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Payment Method</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-payment-method-title">Payment Method</h1>
        <div className="flex gap-2">
          {overdueCount > 0 && (
            <Badge variant="destructive" data-testid="badge-overdue-count">{overdueCount} overdue</Badge>
          )}
          <Badge variant="outline" data-testid="badge-needs-attention-count">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {needsAttentionCount} need payment method
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-payment-method" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[220px]" data-testid="select-payment-method-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            <SelectItem value="needs_attention">Needs Payment Method</SelectItem>
            <SelectItem value="confirmed">Payment Method Set</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedFiltered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No projects match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFiltered.map((p: any) => {
            const isOverdue = !p.paymentMethod && getDaysUntilDue(getPaymentDueDate(p.projectCreatedDate)) !== null && getDaysUntilDue(getPaymentDueDate(p.projectCreatedDate))! < 0;
            return (
              <Card key={p.id} className={isOverdue ? "border-red-300 dark:border-red-800" : ""} data-testid={`card-project-${p.id}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{p.province || 'No province'}</span>
                        {p.projectCreatedDate && (
                          <span className="text-xs text-muted-foreground">Created: {new Date(p.projectCreatedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        )}
                        {!p.paymentMethod && (
                          <PaymentDueBadge projectCreatedDate={p.projectCreatedDate} />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.paymentMethod ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid={`badge-payment-method-${p.id}`}>
                          <CreditCard className="h-3 w-3 mr-1" />
                          {p.paymentMethod}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs" data-testid={`badge-no-payment-${p.id}`}>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          No payment method
                        </Badge>
                      )}
                      <Select value={p.paymentMethod || ''} onValueChange={(v) => handlePaymentMethod(p.id, v)}>
                        <SelectTrigger className="w-[220px] h-8 text-xs" data-testid={`select-payment-method-${p.id}`}>
                          <SelectValue placeholder="Set payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethodOptions.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <TaskActionDialog projectId={p.id} projectName={p.name} viewType="contracts" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
