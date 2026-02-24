import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, Calendar as CalendarIcon, Camera, Upload, CheckCircle2, Clock, AlertTriangle, ImageIcon } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

function getDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getSiteVisitDueDate(project: any) {
  const contractDue = project.contractDueDate;
  if (!contractDue) return project.siteVisitDueDate || null;
  const d = new Date(contractDue);
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function isVisitComplete(status: string | null) {
  if (!status) return false;
  return status.toLowerCase().includes('visit complete');
}

function isVisitBooked(status: string | null) {
  if (!status) return false;
  return status.toLowerCase().includes('visit booked');
}

function SiteVisitPhotosDialog({ project }: { project: any }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [completedBy, setCompletedBy] = useState("");
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (!isVisitComplete(project.siteVisitStatus)) return null;

  const handleSubmit = async () => {
    if (!completedBy.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!photos || photos.length === 0) {
      toast({ title: "Please select at least one photo", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('notes', notes);
      formData.append('completedBy', completedBy);
      for (let i = 0; i < photos.length; i++) {
        formData.append('photos', photos[i]);
      }

      const res = await fetch(`/api/projects/${project.id}/site-visit-photos`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to upload photos');
      }

      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/task-actions', 'site_visits'] });
      toast({ title: `${result.uploadedCount} photo(s) uploaded`, description: 'Photos added to "Site visit Photos" subtask in Asana' });
      setOpen(false);
      setNotes("");
      setCompletedBy("");
      setPhotos(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="h-8 text-xs" data-testid={`button-upload-photos-${project.id}`}>
          <Camera className="h-3 w-3 mr-1" />
          Upload Site Visit Photos
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Site Visit Photos - {project.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload photos from the site visit. These will be added to a "Site visit Photos" subtask in Asana along with any notes from the installer.
          </p>
          <div>
            <Label htmlFor="svCompletedBy">Your Name / Installer Name</Label>
            <Input
              id="svCompletedBy"
              value={completedBy}
              onChange={(e) => setCompletedBy(e.target.value)}
              placeholder="Enter name"
              data-testid="input-sv-photos-name"
            />
          </div>
          <div>
            <Label htmlFor="svNotes">Installer Notes</Label>
            <Textarea
              id="svNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes from the site visit (measurements, observations, issues, etc.)"
              data-testid="input-sv-photos-notes"
            />
          </div>
          <div>
            <Label htmlFor="svPhotos">Site Visit Photos</Label>
            <div className="mt-1">
              <Input
                id="svPhotos"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setPhotos(e.target.files)}
                data-testid="input-sv-photos-files"
              />
              {photos && photos.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> {photos.length} photo(s) selected ({Array.from(photos).map(f => (f.size / 1024).toFixed(0) + ' KB').join(', ')})
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Select multiple photos. They will all be uploaded to the Asana subtask.
            </p>
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="button-submit-sv-photos"
          >
            {submitting ? "Uploading to Asana..." : "Upload Photos & Notes to Asana"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SiteVisitsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("pending");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  const { data: siteVisitOptions } = useQuery<{ gid: string; name: string }[]>({
    queryKey: ['/api/asana/field-options/siteVisitStatus'],
  });

  const statusOptions = Array.isArray(siteVisitOptions) ? siteVisitOptions.map(o => o.name) : [];

  const installProjects = (projects || []).filter((p: any) =>
    p.installType?.toLowerCase() === 'install' &&
    (!p.propertySector || p.propertySector.toLowerCase() === 'residential')
  );

  const pendingSiteVisitProjects = installProjects.filter((p: any) =>
    p.installTeamStage?.toLowerCase().includes('pending site visit')
  );

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

  const filtered = pendingSiteVisitProjects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    const complete = isVisitComplete(p.siteVisitStatus);
    const booked = isVisitBooked(p.siteVisitStatus);
    if (filter === "pending") return !complete && !booked;
    if (filter === "booked") return booked && !complete;
    if (filter === "complete") return complete;
    if (filter === "overdue") {
      const dueDate = getSiteVisitDueDate(p);
      const daysLeft = getDaysUntilDue(dueDate);
      return !complete && !booked && daysLeft !== null && daysLeft < 0;
    }
    return true;
  });

  const sortedFiltered = [...filtered].sort((a: any, b: any) => {
    const aComplete = isVisitComplete(a.siteVisitStatus);
    const bComplete = isVisitComplete(b.siteVisitStatus);
    if (aComplete && !bComplete) return 1;
    if (!aComplete && bComplete) return -1;
    const aDue = getSiteVisitDueDate(a);
    const bDue = getSiteVisitDueDate(b);
    const aDays = getDaysUntilDue(aDue);
    const bDays = getDaysUntilDue(bDue);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  });

  const pendingCount = pendingSiteVisitProjects.filter(p => !isVisitComplete(p.siteVisitStatus) && !isVisitBooked(p.siteVisitStatus)).length;
  const bookedCount = pendingSiteVisitProjects.filter(p => isVisitBooked(p.siteVisitStatus) && !isVisitComplete(p.siteVisitStatus)).length;
  const completeCount = pendingSiteVisitProjects.filter(p => isVisitComplete(p.siteVisitStatus)).length;
  const overdueCount = pendingSiteVisitProjects.filter(p => {
    if (isVisitComplete(p.siteVisitStatus) || isVisitBooked(p.siteVisitStatus)) return false;
    const dueDate = getSiteVisitDueDate(p);
    const daysLeft = getDaysUntilDue(dueDate);
    return daysLeft !== null && daysLeft < 0;
  }).length;

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
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-total-count">
            <MapPin className="h-3 w-3 mr-1" />
            Total: {pendingSiteVisitProjects.length}
          </Badge>
          <Badge variant="secondary" data-testid="badge-pending-count">
            <Clock className="h-3 w-3 mr-1" />
            Pending: {pendingCount}
          </Badge>
          {bookedCount > 0 && (
            <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" data-testid="badge-booked-count">
              <CalendarIcon className="h-3 w-3 mr-1" />
              Booked: {bookedCount}
            </Badge>
          )}
          {completeCount > 0 && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-complete-count">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Complete: {completeCount}
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
        Projects with Install Team Stage "Pending site visit". Site visits are due within 7 days of contract signing. Upload photos once the visit is complete.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-site-visits" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[220px]" data-testid="select-site-visits-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({pendingSiteVisitProjects.length})</SelectItem>
            <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
            <SelectItem value="booked">Booked ({bookedCount})</SelectItem>
            <SelectItem value="complete">Complete ({completeCount})</SelectItem>
            <SelectItem value="overdue">Overdue ({overdueCount})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedFiltered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{filter === "pending" ? "No pending site visits. All visits are booked or complete." : "No projects match this filter."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFiltered.map((p: any) => {
            const dueDate = getSiteVisitDueDate(p);
            const daysLeft = getDaysUntilDue(dueDate);
            const complete = isVisitComplete(p.siteVisitStatus);
            const booked = isVisitBooked(p.siteVisitStatus);
            const isOverdue = !complete && !booked && daysLeft !== null && daysLeft < 0;

            return (
              <Card
                key={p.id}
                className={complete ? "border-green-300 dark:border-green-800" : isOverdue ? "border-red-300 dark:border-red-800" : booked ? "border-blue-300 dark:border-blue-800" : ""}
                data-testid={`card-project-${p.id}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/project/${p.id}`} className="font-medium hover:underline cursor-pointer text-primary" data-testid={`text-project-name-${p.id}`}>{p.name}</Link>
                        <StatusBadge status={p.siteVisitStatus} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{p.province || 'No province'}</span>
                        <span className="text-xs text-muted-foreground">UC: {p.ucStatus || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">Contract: {p.contractStatus || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {dueDate && (
                          <Badge
                            variant={isOverdue ? "destructive" : daysLeft !== null && daysLeft <= 3 ? "default" : "outline"}
                            className={`text-xs flex items-center gap-1 ${!isOverdue && daysLeft !== null && daysLeft <= 3 ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" : ""}`}
                            data-testid={`badge-due-${p.id}`}
                          >
                            <Clock className="h-3 w-3" />
                            {isOverdue
                              ? `${Math.abs(daysLeft!)}d overdue`
                              : daysLeft !== null && daysLeft <= 3
                                ? `Due in ${daysLeft}d`
                                : `Due ${new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                            }
                          </Badge>
                        )}
                        {p.siteVisitDate && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1 bg-blue-50 dark:bg-blue-950" data-testid={`badge-visit-date-${p.id}`}>
                            <CalendarIcon className="h-3 w-3" />
                            Visit: {format(new Date(p.siteVisitDate), 'MMM d, yyyy')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <Select value={p.siteVisitStatus || ''} onValueChange={(v) => handleSiteVisitStatus(p.id, v)}>
                        <SelectTrigger className="h-8 text-xs w-full" data-testid={`select-site-visit-status-${p.id}`}>
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
                          <Button variant="outline" size="sm" className="text-xs w-full" data-testid={`button-set-visit-date-${p.id}`}>
                            <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                            {p.siteVisitDate ? format(new Date(p.siteVisitDate), 'MMM d, yyyy') : "Set Visit Date"}
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
                      <SiteVisitPhotosDialog project={p} />
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
