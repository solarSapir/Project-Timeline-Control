import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Clock, Search, CalendarClock, Upload, MessageSquare, User } from "lucide-react";

function getDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  const daysLeft = getDaysUntilDue(dueDate);
  if (daysLeft === null || !dueDate) return null;

  const formattedDate = new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (daysLeft < 0) {
    return (
      <Badge variant="destructive" className="text-xs flex items-center gap-1" data-testid="badge-overdue">
        <CalendarClock className="h-3 w-3" />
        {Math.abs(daysLeft)}d overdue ({formattedDate})
      </Badge>
    );
  }
  if (daysLeft <= 5) {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs flex items-center gap-1" data-testid="badge-due-soon">
        <CalendarClock className="h-3 w-3" />
        Due in {daysLeft}d ({formattedDate})
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid="badge-due-date">
      <CalendarClock className="h-3 w-3" />
      Due {formattedDate}
    </Badge>
  );
}

function UcTeamBadge({ ucTeam }: { ucTeam: string | null }) {
  if (!ucTeam) return null;
  const isOffGrid = ucTeam.toLowerCase().includes('off grid') || ucTeam.toLowerCase().includes('no/');
  return (
    <Badge
      variant="outline"
      className={isOffGrid
        ? "text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300"
        : "text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300"}
      data-testid="badge-uc-team"
    >
      {ucTeam}
    </Badge>
  );
}

function FollowUpInfo({ project }: { project: any }) {
  if (project.ucStatus?.toLowerCase() !== 'submitted') return null;

  const submittedDays = daysSince(project.ucSubmittedDate);
  const weeksSinceSubmitted = submittedDays !== null ? Math.floor(submittedDays / 7) : null;
  const needsFollowUp = submittedDays !== null && submittedDays >= 7;

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      {project.ucSubmittedDate && (
        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 flex items-center gap-1">
          <User className="h-3 w-3" />
          Submitted {new Date(project.ucSubmittedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {project.ucSubmittedBy && ` by ${project.ucSubmittedBy}`}
          {submittedDays !== null && ` (${submittedDays}d ago)`}
        </Badge>
      )}
      {needsFollowUp && (
        <Badge variant="destructive" className="text-xs flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          Follow-up needed ({weeksSinceSubmitted} week{weeksSinceSubmitted! > 1 ? 's' : ''} since submission)
        </Badge>
      )}
    </div>
  );
}

function FollowUpDialog({ project }: { project: any }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [completedBy, setCompletedBy] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (project.ucStatus?.toLowerCase() !== 'submitted') return null;

  const handleSubmit = async () => {
    if (!completedBy.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('notes', notes);
      formData.append('completedBy', completedBy);
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      const res = await fetch(`/api/projects/${project.id}/follow-up`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to submit follow-up');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/task-actions'] });
      toast({ title: "Follow-up posted to Asana timeline" });
      setOpen(false);
      setNotes("");
      setCompletedBy("");
      setScreenshot(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs" data-testid={`button-followup-${project.id}`}>
          <MessageSquare className="h-3 w-3 mr-1" />
          Follow Up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>UC Follow-Up - {project.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {project.ucSubmittedDate && (
            <p className="text-sm text-muted-foreground">
              Submitted on {new Date(project.ucSubmittedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {project.ucSubmittedBy && ` by ${project.ucSubmittedBy}`}
            </p>
          )}
          <div>
            <Label htmlFor="completedBy">Your Name</Label>
            <Input
              id="completedBy"
              value={completedBy}
              onChange={(e) => setCompletedBy(e.target.value)}
              placeholder="Enter your name"
              data-testid="input-followup-name"
            />
          </div>
          <div>
            <Label htmlFor="notes">Follow-up Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you follow up on? Any updates from the utility company?"
              data-testid="input-followup-notes"
            />
          </div>
          <div>
            <Label htmlFor="screenshot">Screenshot (optional)</Label>
            <div className="mt-1">
              <Input
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                data-testid="input-followup-screenshot"
              />
              {screenshot && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Upload className="h-3 w-3" /> {screenshot.name} ({(screenshot.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              This screenshot will be uploaded to the Asana project timeline.
            </p>
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="button-submit-followup"
          >
            {submitting ? "Posting to Asana..." : "Submit Follow-Up & Post to Asana"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UCView() {
  const [filter, setFilter] = useState("needs_action");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: ucOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/ucStatus'],
  });

  const statusOptions = Array.isArray(ucOptions) ? ucOptions.map(o => o.name) : [];

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install'
  );

  const isCompletedStatus = (status: string | null) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes('approved') || s.includes('complete') || s.includes('not required') || s.includes('closed');
  };

  const filtered = installProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "needs_action") return !isCompletedStatus(p.ucStatus);
    if (filter === "completed") return isCompletedStatus(p.ucStatus);
    if (filter === "submitted") return p.ucStatus?.toLowerCase() === 'submitted';
    if (filter !== "all" && p.ucStatus !== filter) return false;
    return true;
  });

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { ucStatus: newStatus });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "UC status updated in Asana" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">UC Applications</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  const totalNeedAction = installProjects.filter(p => !isCompletedStatus(p.ucStatus)).length;
  const totalCompleted = installProjects.filter(p => isCompletedStatus(p.ucStatus)).length;
  const totalSubmitted = installProjects.filter(p => p.ucStatus?.toLowerCase() === 'submitted').length;
  const needsFollowUpCount = installProjects.filter(p => {
    if (p.ucStatus?.toLowerCase() !== 'submitted') return false;
    const days = daysSince(p.ucSubmittedDate);
    return days !== null && days >= 7;
  }).length;

  const overdueCount = installProjects.filter(p => {
    if (isCompletedStatus(p.ucStatus)) return false;
    const days = getDaysUntilDue(p.ucDueDate);
    return days !== null && days < 0;
  }).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-uc-title">UC Applications</h1>
        <div className="flex gap-2 flex-wrap">
          {overdueCount > 0 && (
            <Badge variant="destructive" data-testid="badge-overdue-count">{overdueCount} overdue</Badge>
          )}
          {needsFollowUpCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid="badge-followup-count">
              {needsFollowUpCount} need follow-up
            </Badge>
          )}
          <Badge variant="outline" data-testid="badge-action-count">{totalNeedAction} need action</Badge>
          {totalSubmitted > 0 && (
            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950" data-testid="badge-submitted-count">{totalSubmitted} submitted</Badge>
          )}
          <Badge variant="outline" className="bg-green-50 dark:bg-green-950" data-testid="badge-completed-count">{totalCompleted} complete</Badge>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-uc"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[260px]" data-testid="select-uc-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="needs_action">Needs Action</SelectItem>
            <SelectItem value="submitted">Submitted (Awaiting Approval)</SelectItem>
            <SelectItem value="completed">Completed (Approved / Not Required)</SelectItem>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            {filter === "completed" ? (
              <><CheckCircle2 className="h-4 w-4" /> Completed ({filtered.length})</>
            ) : filter === "submitted" ? (
              <><Clock className="h-4 w-4" /> Submitted - Awaiting Approval ({filtered.length})</>
            ) : filter === "needs_action" ? (
              <><AlertTriangle className="h-4 w-4" /> Action Required ({filtered.length})</>
            ) : (
              <><Clock className="h-4 w-4" /> All Projects ({filtered.length})</>
            )}
          </h2>
          {[...filtered]
            .sort((a: any, b: any) => {
              if (isCompletedStatus(a.ucStatus) && !isCompletedStatus(b.ucStatus)) return 1;
              if (!isCompletedStatus(a.ucStatus) && isCompletedStatus(b.ucStatus)) return -1;
              const aSubmittedDays = a.ucStatus?.toLowerCase() === 'submitted' ? (daysSince(a.ucSubmittedDate) ?? 0) : -1;
              const bSubmittedDays = b.ucStatus?.toLowerCase() === 'submitted' ? (daysSince(b.ucSubmittedDate) ?? 0) : -1;
              if (aSubmittedDays >= 7 && bSubmittedDays < 7) return -1;
              if (aSubmittedDays < 7 && bSubmittedDays >= 7) return 1;
              const aDays = getDaysUntilDue(a.ucDueDate);
              const bDays = getDaysUntilDue(b.ucDueDate);
              if (aDays === null) return 1;
              if (bDays === null) return -1;
              return aDays - bDays;
            })
            .map((p: any) => {
              const completed = isCompletedStatus(p.ucStatus);
              const isOverdue = !completed && getDaysUntilDue(p.ucDueDate) !== null && getDaysUntilDue(p.ucDueDate)! < 0;
              const isSubmitted = p.ucStatus?.toLowerCase() === 'submitted';
              const submittedDays = daysSince(p.ucSubmittedDate);
              const needsFollowUp = isSubmitted && submittedDays !== null && submittedDays >= 7;
              return (
                <Card
                  key={p.id}
                  className={completed ? "opacity-60" : needsFollowUp ? "border-amber-400 dark:border-amber-700" : isOverdue ? "border-red-300 dark:border-red-800" : ""}
                  data-testid={`card-project-${p.id}`}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                          <UcTeamBadge ucTeam={p.ucTeam} />
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">{p.province || 'No province'}</span>
                          {p.projectCreatedDate && (
                            <span className="text-xs text-muted-foreground">Created: {new Date(p.projectCreatedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          )}
                          {!completed && <DueDateBadge dueDate={p.ucDueDate} />}
                        </div>
                        {isSubmitted && <FollowUpInfo project={p} />}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={p.ucStatus} data-testid={`status-uc-${p.id}`} />
                        <Select value={p.ucStatus || ''} onValueChange={(v) => handleStatusChange(p.id, v)}>
                          <SelectTrigger className="w-[180px] h-8 text-xs" data-testid={`select-uc-status-${p.id}`}>
                            <SelectValue placeholder="Change status" />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isSubmitted && <FollowUpDialog project={p} />}
                        {!completed && <TaskActionDialog projectId={p.id} projectName={p.name} viewType="uc" />}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>{filter === "needs_action" ? "All UC applications are complete — no action needed." : "No projects match this filter."}</p>
        </div>
      )}
    </div>
  );
}
