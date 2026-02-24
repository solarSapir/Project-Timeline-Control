import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, ImageIcon } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isVisitComplete } from "@/utils/stages";

interface SiteVisitPhotosDialogProps {
  projectId: string;
  projectName: string;
  siteVisitStatus: string | null;
}

/** Dialog for uploading site visit photos and installer notes to Asana. */
export default function SiteVisitPhotosDialog({ projectId, projectName, siteVisitStatus }: SiteVisitPhotosDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [completedBy, setCompletedBy] = useState("");
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (!isVisitComplete(siteVisitStatus)) return null;

  const handleSubmit = async () => {
    if (!completedBy.trim()) { toast({ title: "Please enter your name", variant: "destructive" }); return; }
    if (!photos || photos.length === 0) { toast({ title: "Please select at least one photo", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('notes', notes);
      formData.append('completedBy', completedBy);
      for (let i = 0; i < photos.length; i++) formData.append('photos', photos[i]);

      const res = await fetch(`/api/projects/${projectId}/site-visit-photos`, { method: 'POST', body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Failed to upload photos'); }

      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/task-actions', 'site_visits'] });
      toast({ title: `${result.uploadedCount} photo(s) uploaded`, description: 'Photos added to "Site visit Photos" subtask in Asana' });
      setOpen(false); setNotes(""); setCompletedBy(""); setPhotos(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="h-8 text-xs" data-testid={`button-upload-photos-${projectId}`}>
          <Camera className="h-3 w-3 mr-1" />Upload Site Visit Photos
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Site Visit Photos - {projectName}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload photos from the site visit. These will be added to a "Site visit Photos" subtask in Asana along with any notes from the installer.
          </p>
          <div>
            <Label htmlFor="svCompletedBy">Your Name / Installer Name</Label>
            <Input id="svCompletedBy" value={completedBy} onChange={(e) => setCompletedBy(e.target.value)} placeholder="Enter name" data-testid="input-sv-photos-name" />
          </div>
          <div>
            <Label htmlFor="svNotes">Installer Notes</Label>
            <Textarea id="svNotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes from the site visit (measurements, observations, issues, etc.)" data-testid="input-sv-photos-notes" />
          </div>
          <div>
            <Label htmlFor="svPhotos">Site Visit Photos</Label>
            <div className="mt-1">
              <Input id="svPhotos" type="file" accept="image/*" multiple onChange={(e) => setPhotos(e.target.files)} data-testid="input-sv-photos-files" />
              {photos && photos.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> {photos.length} photo(s) selected ({Array.from(photos).map(f => (f.size / 1024).toFixed(0) + ' KB').join(', ')})
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Select multiple photos. They will all be uploaded to the Asana subtask.</p>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={submitting} data-testid="button-submit-sv-photos">
            {submitting ? "Uploading to Asana..." : "Upload Photos & Notes to Asana"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
