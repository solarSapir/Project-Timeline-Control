import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, CalendarClock, CheckCircle2, Clock, AlertTriangle, DollarSign, MessageSquare, Upload, Send } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function getDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function hoursSince(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
}

const UC_COMPLETE_STATUSES = ['approved', 'complete', 'not required'];

function isUcComplete(ucStatus: string | null) {
  if (!ucStatus) return false;
  const s = ucStatus.toLowerCase();
  return UC_COMPLETE_STATUSES.some(status => s.includes(status));
}

function getContractDueDate(project: any) {
  if (!isUcComplete(project.ucStatus)) return null;
  if (project.ucStatus?.toLowerCase().includes('not required')) {
    const base = project.projectCreatedDate || project.createdAt;
    if (!base) return null;
    const d = new Date(base);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }
  const ucDue = project.ucDueDate;
  if (ucDue) {
    const d = new Date(ucDue);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }
  return null;
}

function getContractSentDate(project: any) {
  const fields = project.asanaCustomFields || [];
  const field = fields.find((f: any) =>
    f.name?.toLowerCase().includes('date contract sent')
  );
  return field?.display_value ? field.display_value.split('T')[0] : null;
}

function getContractFollowUpDate(project: any) {
  const fields = project.asanaCustomFields || [];
  const field = fields.find((f: any) =>
    f.name?.toLowerCase().includes('date followed up on with contract')
  );
  return field?.display_value ? field.display_value.split('T')[0] : null;
}

function isContractSent(stage: string | null) {
  if (!stage) return false;
  const s = stage.toLowerCase();
  return s.includes('pending contract to be signed') || s.includes('pending deposit') || s.includes('deposit collected') || s.includes('pending site visit') || s.includes('active install') || s.includes('complete');
}

function isContractSigned(stage: string | null) {
  if (!stage) return false;
  const s = stage.toLowerCase();
  return s.includes('pending deposit') || s.includes('deposit collected') || s.includes('pending site visit') || s.includes('active install') || s.includes('complete');
}

function isDepositCollected(stage: string | null) {
  if (!stage) return false;
  const s = stage.toLowerCase();
  return s.includes('pending site visit') || s.includes('deposit collected') || s.includes('active install') || s.includes('complete');
}

function isPendingSignature(stage: string | null) {
  if (!stage) return false;
  return stage.toLowerCase().includes('pending contract to be signed');
}

function getStageLabel(stage: string | null) {
  if (!stage) return 'Unknown';
  return stage;
}

function getStageBadgeClass(stage: string | null) {
  if (!stage) return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  const s = stage.toLowerCase();
  if (s.includes('active install') || s.includes('complete')) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (s.includes('deposit collected')) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (s.includes('pending site visit')) return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
  if (s.includes('pending deposit')) return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (s.includes('pending contract')) return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  if (s.includes('need contract')) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

function ContractDueBadge({ project }: { project: any }) {
  const dueDate = getContractDueDate(project);
  const daysLeft = getDaysUntilDue(dueDate);
  if (daysLeft === null || !dueDate) return null;
  const formattedDate = new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (daysLeft < 0) {
    return (
      <Badge variant="destructive" className="text-xs flex items-center gap-1" data-testid="badge-contract-overdue">
        <CalendarClock className="h-3 w-3" />
        {Math.abs(daysLeft)}d overdue ({formattedDate})
      </Badge>
    );
  }
  if (daysLeft <= 3) {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs flex items-center gap-1" data-testid="badge-contract-due-soon">
        <CalendarClock className="h-3 w-3" />
        Due in {daysLeft}d ({formattedDate})
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid="badge-contract-due">
      <CalendarClock className="h-3 w-3" />
      Due {formattedDate}
    </Badge>
  );
}

function ContractFollowUpDialog({ project, lastFollowUp }: { project: any; lastFollowUp: any }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [completedBy, setCompletedBy] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (!isPendingSignature(project.installTeamStage)) return null;

  const lastFollowUpDate = lastFollowUp?.completedAt || lastFollowUp?.createdAt;
  const hrs = hoursSince(lastFollowUpDate);
  const needsFollowUp = hrs === null || hrs >= 24;

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
      formData.append('viewType', 'contracts');
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
      queryClient.invalidateQueries({ queryKey: ['/api/task-actions', 'contracts'] });
      toast({ title: "Contract follow-up posted to Asana timeline" });
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
    <>
      {needsFollowUp && (
        <Badge variant="destructive" className="text-xs flex items-center gap-1" data-testid={`badge-followup-needed-${project.id}`}>
          <MessageSquare className="h-3 w-3" />
          Follow-up needed {hrs !== null ? `(${hrs}h since last)` : '(no follow-ups yet)'}
        </Badge>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 text-xs" data-testid={`button-contract-followup-${project.id}`}>
            <MessageSquare className="h-3 w-3 mr-1" />
            Follow Up
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contract Follow-Up - {project.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Contract signature should be followed up every 24 hours. This will post to the Asana project timeline.
            </p>
            {lastFollowUp && (
              <div className="p-2 rounded bg-muted text-xs">
                Last follow-up: {new Date(lastFollowUp.completedAt || lastFollowUp.createdAt).toLocaleString()} by {lastFollowUp.completedBy || 'Unknown'}
                {lastFollowUp.notes && <p className="mt-1 text-muted-foreground">{lastFollowUp.notes}</p>}
              </div>
            )}
            <div>
              <Label htmlFor="contractCompletedBy">Your Name</Label>
              <Input
                id="contractCompletedBy"
                value={completedBy}
                onChange={(e) => setCompletedBy(e.target.value)}
                placeholder="Enter your name"
                data-testid="input-contract-followup-name"
              />
            </div>
            <div>
              <Label htmlFor="contractNotes">Follow-up Notes</Label>
              <Textarea
                id="contractNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What was communicated? Any updates from the customer?"
                data-testid="input-contract-followup-notes"
              />
            </div>
            <div>
              <Label htmlFor="contractScreenshot">Screenshot (optional)</Label>
              <div className="mt-1">
                <Input
                  id="contractScreenshot"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                  data-testid="input-contract-followup-screenshot"
                />
                {screenshot && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Upload className="h-3 w-3" /> {screenshot.name} ({(screenshot.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Upload proof of follow-up — this will be attached to the Asana project timeline.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting}
              data-testid="button-submit-contract-followup"
            >
              {submitting ? "Posting to Asana..." : "Submit Follow-Up & Post to Asana"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ContractCreationView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("needs_contract");
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: taskActions } = useQuery<any[]>({
    queryKey: ['/api/task-actions', 'contracts'],
  });

  const getLastContractFollowUp = (projectId: string) => {
    if (!taskActions) return null;
    const actions = taskActions
      .filter((a: any) => a.projectId === projectId && a.viewType === 'contracts' && a.actionType === 'follow_up')
      .sort((a: any, b: any) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());
    return actions[0] || null;
  };

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential')
  );

  const ucReadyProjects = installProjects.filter((p: any) => isUcComplete(p.ucStatus));

  const handleContractSent = async (project: any, checked: boolean) => {
    setUpdating(project.id + '-sent');
    try {
      const newStage = checked ? 'Pending Contract to be signed' : 'Need contract';
      await apiRequest("PATCH", `/api/projects/${project.id}`, { installTeamStage: newStage });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: checked ? "Contract marked as sent — pending signature" : "Contract marked as not sent" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const handleContractSigned = async (project: any, checked: boolean) => {
    setUpdating(project.id + '-contract');
    try {
      const newStage = checked ? 'Pending Deposit (from customer)' : 'Pending Contract to be signed';
      await apiRequest("PATCH", `/api/projects/${project.id}`, { installTeamStage: newStage });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: checked ? "Contract marked as signed — awaiting deposit" : "Contract marked as unsigned" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const handleDepositCollected = async (project: any, checked: boolean) => {
    setUpdating(project.id + '-deposit');
    try {
      let newStage: string;
      if (checked) {
        const sv = (project.siteVisitStatus || '').toLowerCase();
        const siteVisitDone = sv.includes('visit complete') || sv.includes('visit booked');
        newStage = siteVisitDone ? 'Active Install' : 'Pending site visit';
      } else {
        newStage = 'Pending Deposit (from customer)';
      }
      await apiRequest("PATCH", `/api/projects/${project.id}`, { installTeamStage: newStage });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      if (checked && newStage === 'Pending site visit') {
        toast({ title: "Deposit collected — pending site visit", description: "Project moved to Site Visits tab" });
      } else if (checked) {
        toast({ title: "Deposit collected — project is Active Install" });
      } else {
        toast({ title: "Deposit uncollected" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const filtered = ucReadyProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    const sent = isContractSent(p.installTeamStage);
    const signed = isContractSigned(p.installTeamStage);
    const depositDone = isDepositCollected(p.installTeamStage);
    const pendingSig = isPendingSignature(p.installTeamStage);
    if (filter === "needs_contract") return !sent;
    if (filter === "pending_signature") return pendingSig;
    if (filter === "pending_deposit") return signed && !depositDone;
    if (filter === "complete") return signed && depositDone;
    if (filter === "overdue") {
      const dueDate = getContractDueDate(p);
      const daysLeft = getDaysUntilDue(dueDate);
      return !sent && daysLeft !== null && daysLeft < 0;
    }
    return true;
  });

  const sortedFiltered = [...filtered].sort((a: any, b: any) => {
    const aDone = isDepositCollected(a.installTeamStage);
    const bDone = isDepositCollected(b.installTeamStage);
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;
    const aDue = getContractDueDate(a);
    const bDue = getContractDueDate(b);
    const aDays = getDaysUntilDue(aDue);
    const bDays = getDaysUntilDue(bDue);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  });

  const needsContractCount = ucReadyProjects.filter((p: any) => !isContractSent(p.installTeamStage)).length;
  const pendingSigCount = ucReadyProjects.filter((p: any) => isPendingSignature(p.installTeamStage)).length;
  const pendingDepositCount = ucReadyProjects.filter((p: any) => isContractSigned(p.installTeamStage) && !isDepositCollected(p.installTeamStage)).length;
  const completeCount = ucReadyProjects.filter((p: any) => isContractSigned(p.installTeamStage) && isDepositCollected(p.installTeamStage)).length;
  const overdueCount = ucReadyProjects.filter((p: any) => {
    if (isContractSent(p.installTeamStage)) return false;
    const dueDate = getContractDueDate(p);
    const daysLeft = getDaysUntilDue(dueDate);
    return daysLeft !== null && daysLeft < 0;
  }).length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Contracts</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-contracts-title">Contracts</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-uc-ready-count">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            UC Ready: {ucReadyProjects.length}
          </Badge>
          <Badge variant="secondary" data-testid="badge-needs-contract-count">
            <FileText className="h-3 w-3 mr-1" />
            Needs Contract: {needsContractCount}
          </Badge>
          {pendingSigCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid="badge-pending-sig-count">
              <Send className="h-3 w-3 mr-1" />
              Pending Signature: {pendingSigCount}
            </Badge>
          )}
          {pendingDepositCount > 0 && (
            <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" data-testid="badge-pending-deposit-count">
              <DollarSign className="h-3 w-3 mr-1" />
              Pending Deposit: {pendingDepositCount}
            </Badge>
          )}
          {overdueCount > 0 && (
            <Badge variant="destructive" data-testid="badge-overdue-count">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Overdue: {overdueCount}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Projects appear once UC is Approved/Complete/Not Required. Contract due within 7 days of UC completion. Follow up on pending signatures every 24 hours with proof.
      </p>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[240px]" data-testid="select-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All UC-Ready ({ucReadyProjects.length})</SelectItem>
            <SelectItem value="needs_contract">Needs Contract ({needsContractCount})</SelectItem>
            <SelectItem value="pending_signature">Pending Signature ({pendingSigCount})</SelectItem>
            <SelectItem value="pending_deposit">Pending Deposit ({pendingDepositCount})</SelectItem>
            <SelectItem value="complete">Contract Complete ({completeCount})</SelectItem>
            <SelectItem value="overdue">Overdue ({overdueCount})</SelectItem>
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
            const contractSentAsana = getContractSentDate(p);
            const followUpAsana = getContractFollowUpDate(p);
            const dueDate = getContractDueDate(p);
            const daysLeft = getDaysUntilDue(dueDate);
            const sent = isContractSent(p.installTeamStage);
            const signed = isContractSigned(p.installTeamStage);
            const depositDone = isDepositCollected(p.installTeamStage);
            const pendingSig = isPendingSignature(p.installTeamStage);
            const isOverdue = !sent && daysLeft !== null && daysLeft < 0;
            const allDone = signed && depositDone;
            const lastFollowUp = getLastContractFollowUp(p.id);

            return (
              <Card
                key={p.id}
                className={isOverdue ? "border-red-300 dark:border-red-800" : allDone ? "border-green-300 dark:border-green-800" : pendingSig ? "border-amber-300 dark:border-amber-800" : ""}
                data-testid={`card-project-${p.id}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                        <Badge
                          variant="outline"
                          className={
                            p.ucStatus?.toLowerCase().includes('not required')
                              ? "text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              : p.ucStatus?.toLowerCase().includes('complete')
                                ? "text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }
                          data-testid={`badge-uc-status-${p.id}`}
                        >
                          UC: {p.ucStatus}
                        </Badge>
                        <Badge className={`text-xs ${getStageBadgeClass(p.installTeamStage)}`} data-testid={`badge-stage-${p.id}`}>
                          {getStageLabel(p.installTeamStage)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{p.province || 'No province'}</span>
                        <span className="text-xs text-muted-foreground">PM: {p.pmStatus || 'N/A'}</span>
                        {p.ucTeam && (
                          <span className="text-xs text-muted-foreground">UC Team: {p.ucTeam}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <ContractDueBadge project={p} />
                        {contractSentAsana && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs flex items-center gap-1" data-testid={`badge-contract-sent-${p.id}`}>
                            <CheckCircle2 className="h-3 w-3" />
                            Sent {new Date(contractSentAsana).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                        )}
                        {followUpAsana && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid={`badge-follow-up-${p.id}`}>
                            <Clock className="h-3 w-3" />
                            Asana follow-up {new Date(followUpAsana).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                        )}
                        {lastFollowUp && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1 bg-blue-50 dark:bg-blue-950" data-testid={`badge-last-followup-${p.id}`}>
                            <MessageSquare className="h-3 w-3" />
                            Last follow-up: {new Date(lastFollowUp.completedAt || lastFollowUp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            {lastFollowUp.completedBy && ` by ${lastFollowUp.completedBy}`}
                          </Badge>
                        )}
                        <ContractFollowUpDialog project={p} lastFollowUp={lastFollowUp} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`contract-sent-${p.id}`}
                          checked={sent}
                          disabled={sent || updating === p.id + '-sent'}
                          onCheckedChange={(checked) => handleContractSent(p, !!checked)}
                          data-testid={`checkbox-contract-sent-${p.id}`}
                        />
                        <label
                          htmlFor={`contract-sent-${p.id}`}
                          className={`text-sm cursor-pointer ${sent ? 'text-green-700 dark:text-green-400 font-medium' : 'text-muted-foreground'}`}
                        >
                          Contract Sent
                        </label>
                        {sent && <Send className="h-4 w-4 text-green-600" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`contract-signed-${p.id}`}
                          checked={signed}
                          disabled={!sent || signed || updating === p.id + '-contract'}
                          onCheckedChange={(checked) => handleContractSigned(p, !!checked)}
                          data-testid={`checkbox-contract-signed-${p.id}`}
                        />
                        <label
                          htmlFor={`contract-signed-${p.id}`}
                          className={`text-sm cursor-pointer ${signed ? 'text-green-700 dark:text-green-400 font-medium' : !sent ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
                        >
                          Contract Signed
                        </label>
                        {signed && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`deposit-collected-${p.id}`}
                          checked={depositDone}
                          disabled={!signed || updating === p.id + '-deposit'}
                          onCheckedChange={(checked) => handleDepositCollected(p, !!checked)}
                          data-testid={`checkbox-deposit-collected-${p.id}`}
                        />
                        <label
                          htmlFor={`deposit-collected-${p.id}`}
                          className={`text-sm cursor-pointer ${depositDone ? 'text-green-700 dark:text-green-400 font-medium' : !signed ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
                        >
                          $1,500 Permit Deposit
                        </label>
                        {depositDone && <DollarSign className="h-4 w-4 text-green-600" />}
                      </div>
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
