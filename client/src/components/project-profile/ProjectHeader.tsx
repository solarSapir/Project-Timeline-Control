import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatProfileDate } from "./InfoRow";
import { MapPin, Loader2, Upload, Paperclip, X } from "lucide-react";
import { StaffSelect } from "@/components/shared/StaffSelect";
import type { Project } from "@shared/schema";

function getPmStatusColor(pmStatus: string | null): string {
  const s = pmStatus?.toLowerCase() ?? "";
  if (s.includes("complete")) return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700";
  if (s.includes("install")) return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700";
  if (s.includes("paused")) return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700";
  if (s.includes("lost")) return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700";
  return "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600";
}

interface ProjectHeaderProps {
  project: Project;
  pmOptions: { gid: string; name: string }[];
  onPmStatusChange: (newStatus: string, note: string, staffName: string, files: File[]) => Promise<void>;
  isPending: boolean;
}

export function ProjectHeader({ project, pmOptions, onPmStatusChange, isPending }: ProjectHeaderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const [note, setNote] = useState("");
  const [staffName, setStaffName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSelectStatus = (newStatus: string) => {
    if (newStatus === project.pmStatus) return;
    setPendingStatus(newStatus);
    setDialogOpen(true);
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setNote("");
    setStaffName("");
    setFiles([]);
    setPendingStatus("");
  };

  const handleSubmit = async () => {
    if (!note.trim() || !staffName.trim()) return;
    setSubmitting(true);
    try {
      await onPmStatusChange(pendingStatus, note.trim(), staffName.trim(), files);
      setDialogOpen(false);
      resetForm();
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold" data-testid="text-project-name">{project.name}</h1>
          <StatusBadge status={project.installType} />
          {project.province && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {project.province}
            </Badge>
          )}
          {project.propertySector && (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" data-testid="badge-property-sector">
              {project.propertySector}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          {project.projectCreatedDate && (
            <span data-testid="text-created-date">Created: {formatProfileDate(project.projectCreatedDate)}</span>
          )}
          {project.installTeamStage && (
            <Badge variant="outline" className="text-xs" data-testid="text-install-stage">{project.installTeamStage}</Badge>
          )}
          <div className="flex items-center gap-1.5" data-testid="pm-status-select">
            <span className="text-xs text-muted-foreground">PM Status:</span>
            <Select
              value={project.pmStatus || ""}
              onValueChange={handleSelectStatus}
              disabled={isPending}
            >
              <SelectTrigger
                className={`h-6 w-auto min-w-[120px] text-xs border px-2 py-0 ${getPmStatusColor(project.pmStatus)}`}
                data-testid="select-pm-status"
              >
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                {pmOptions.map((opt) => (
                  <SelectItem key={opt.gid} value={opt.name}>{opt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-pm-status-change">
          <DialogHeader>
            <DialogTitle data-testid="text-pm-dialog-title">PM Status Change</DialogTitle>
            <DialogDescription>
              Changing PM Status from "{project.pmStatus || 'Not set'}" to "{pendingStatus}".
              A note is required and will be posted to the project's Asana timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <StaffSelect
                value={staffName}
                onValueChange={setStaffName}
                id="pmStaffName"
                testId="select-pm-status-staff"
              />
            </div>
            <div>
              <Label htmlFor="pmStatusNote">
                Why are you changing the status? <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="pmStatusNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain the reason for this status change..."
                rows={4}
                data-testid="input-pm-status-note"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">
                Supporting Documents
                <span className="text-muted-foreground font-normal text-xs ml-1">(optional)</span>
              </Label>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xlsx,.csv,.heic"
                className="hidden"
                onChange={handleAddFiles}
                data-testid="input-pm-status-files"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 w-full border-dashed"
                onClick={() => fileRef.current?.click()}
                data-testid="button-pm-status-add-files"
              >
                <Upload className="h-3.5 w-3.5" />
                Add Screenshots & Documents
              </Button>
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5" data-testid={`pm-file-${i}`}>
                      <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-muted-foreground flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0" data-testid={`button-remove-pm-file-${i}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!note.trim() || !staffName.trim() || submitting}
              data-testid="button-submit-pm-status"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {submitting ? "Updating..." : "Confirm Status Change & Post to Asana"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
