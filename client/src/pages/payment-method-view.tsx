import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/logo-spinner";
import { Input } from "@/components/ui/input";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { DueIndicator } from "@/components/uc/DueIndicator";
import { getDaysUntilDue, formatShortDate } from "@/utils/dates";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Project } from "@shared/schema";

function getPaymentDueDate(projectCreatedDate: string | null) {
  if (!projectCreatedDate) return null;
  const created = new Date(projectCreatedDate);
  created.setDate(created.getDate() + 7);
  return created.toISOString().split('T')[0];
}

export default function ContractsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("needs_attention");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: paymentOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/paymentMethod'],
  });

  const paymentMethodOptions = Array.isArray(paymentOptions) ? paymentOptions.map(o => o.name) : [];

  const installProjects = (projects || []).filter((p: Project) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential') &&
    !['complete', 'project paused', 'project lost'].includes(p.pmStatus?.toLowerCase() || '')
  );

  const filtered = installProjects.filter((p: Project) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "needs_attention") return !p.paymentMethod;
    if (filter === "confirmed") return !!p.paymentMethod;
    return true;
  });

  const sortedFiltered = [...filtered].sort((a: Project, b: Project) => {
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

  const needsAttentionCount = installProjects.filter((p: Project) => !p.paymentMethod).length;
  const overdueCount = installProjects.filter((p: Project) => {
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
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <PageLoader title="Loading payments..." />;
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
          {sortedFiltered.map((p: Project) => {
            const paymentDueDate = getPaymentDueDate(p.projectCreatedDate);
            const isOverdue = !p.paymentMethod && getDaysUntilDue(paymentDueDate) !== null && getDaysUntilDue(paymentDueDate)! < 0;
            return (
              <Card
                key={p.id}
                className={`transition-colors ${isOverdue ? "border-l-4 border-l-red-400" : ""}`}
                data-testid={`card-project-${p.id}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/project/${p.id}`} className="font-medium text-sm text-primary hover:underline truncate" data-testid={`link-project-${p.id}`}>
                          {p.name}
                        </Link>
                        {p.paymentMethod ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" data-testid={`badge-payment-method-${p.id}`}>
                            {p.paymentMethod}
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400" data-testid={`badge-no-payment-${p.id}`}>
                            No payment method
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        {p.province && <span>{p.province}</span>}
                        {p.province && p.projectCreatedDate && <span>·</span>}
                        {p.projectCreatedDate && <span>Created {formatShortDate(p.projectCreatedDate)}</span>}
                        {(p.province || p.projectCreatedDate) && paymentDueDate && !p.paymentMethod && <span>·</span>}
                        {!p.paymentMethod && <DueIndicator dueDate={paymentDueDate} completed={!!p.paymentMethod} />}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Select value={p.paymentMethod || ''} onValueChange={(v) => handlePaymentMethod(p.id, v)}>
                        <SelectTrigger className="w-[180px] h-7 text-xs" data-testid={`select-payment-method-${p.id}`}>
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
