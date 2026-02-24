import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

export default function SiteVisitsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: siteVisitOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options', 'siteVisitStatus'],
    queryFn: () => fetch('/api/asana/field-options/siteVisitStatus').then(r => r.json()),
  });

  const statusOptions = (siteVisitOptions || []).map(o => o.name);

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install'
  );

  const filtered = installProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter !== "all" && p.siteVisitStatus !== filter) return false;
    return true;
  });

  const handleSiteVisitStatus = async (projectId: string, status: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { siteVisitStatus: status });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Site visit status updated in Asana" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSiteVisitDate = async (projectId: string, date: Date | undefined) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, {
        siteVisitDate: date ? format(date, 'yyyy-MM-dd') : null,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: date ? "Site visit date set" : "Site visit date cleared" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Site Visits</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-site-visits-title">Site Visits</h1>
        <Badge variant="outline" data-testid="badge-project-count">{filtered.length} projects</Badge>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-site-visits" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-site-visits-filter">
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
                      {p.province || 'No province'} - UC: {p.ucStatus || 'N/A'} - Contract: {p.contractStatus || 'N/A'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={p.siteVisitStatus} />
                    <Select value={p.siteVisitStatus || ''} onValueChange={(v) => handleSiteVisitStatus(p.id, v)}>
                      <SelectTrigger className="h-8 text-xs w-[180px]" data-testid={`select-site-visit-status-${p.id}`}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs" data-testid={`button-set-visit-date-${p.id}`}>
                          <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                          {p.siteVisitDate ? format(new Date(p.siteVisitDate), 'MMM d, yyyy') : "Set Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={p.siteVisitDate ? new Date(p.siteVisitDate) : undefined}
                          onSelect={(d) => handleSiteVisitDate(p.id, d)}
                        />
                      </PopoverContent>
                    </Popover>
                    <TaskActionDialog projectId={p.id} projectName={p.name} viewType="site_visits" />
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
