import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, CheckCircle2, Mail, Camera, FileText } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CloseOffView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ready");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install'
  );

  const isReadyForCloseOff = (p: any) => {
    return p.pmStatus?.toLowerCase()?.includes('close') ||
      p.pmStatus?.toLowerCase()?.includes('install') ||
      (["Complete", "Approved"].includes(p.ahjStatus || '') && p.finalPaymentCollected);
  };

  const filtered = installProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "ready") return isReadyForCloseOff(p);
    if (filter === "pending_docs") return isReadyForCloseOff(p) && p.ucStatus !== "Close-off";
    if (filter === "completed") return p.ucStatus === "Close-off" && p.ahjStatus === "Close-off";
    return true;
  });

  const handleSetCloseOff = async (projectId: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, {
        ucStatus: "Close-off",
        ahjStatus: "Close-off",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Project set to close-off status" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Close-off</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-close-off-title">Close-off</h1>
        <Badge variant="outline" data-testid="badge-project-count">{filtered.length} projects</Badge>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-close-off" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-close-off-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="ready">Ready for Close-off</SelectItem>
            <SelectItem value="pending_docs">Pending Docs</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
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
                    <p className="text-xs text-muted-foreground mt-0.5">{p.province || ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.ucStatus !== "Close-off" && (
                      <Button size="sm" variant="outline" onClick={() => handleSetCloseOff(p.id)} data-testid={`button-close-off-${p.id}`}>
                        Set Close-off
                      </Button>
                    )}
                    <TaskActionDialog projectId={p.id} projectName={p.name} viewType="close_off" />
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">UC:</span>
                    <StatusBadge status={p.ucStatus} data-testid={`status-uc-${p.id}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">AHJ:</span>
                    <StatusBadge status={p.ahjStatus} data-testid={`status-ahj-${p.id}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Photos:</span>
                    <span data-testid={`text-photos-status-${p.id}`}>Pending</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Final Payment:</span>
                    <span data-testid={`text-final-payment-${p.id}`}>{p.finalPaymentCollected ? "Collected" : "Pending"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Marketing notified:</span>
                    <span data-testid={`text-marketing-status-${p.id}`}>Pending</span>
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
