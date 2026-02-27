import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Maximize2, Eye } from "lucide-react";
import { Link } from "wouter";
import { formatShortDate } from "@/utils/dates";
import { EscalationTicketsInline } from "@/components/project-profile/EscalationTicketsSection";
import type { Project } from "@shared/schema";

interface DetailRow {
  label: string;
  value: string | null | undefined;
  className?: string;
}

interface FocusDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  statusField: string;
  statusValue: string | null | undefined;
  statusOptions: string[];
  onStatusChange: (id: string, status: string) => void;
  details: DetailRow[];
  alerts?: { text: string; variant: "warning" | "info" }[];
  actions?: React.ReactNode;
  subtaskPanel: React.ReactNode;
  extraContent?: React.ReactNode;
}

export function FocusDialog({
  project, open, onOpenChange, title, description,
  statusField, statusValue, statusOptions, onStatusChange,
  details, alerts, actions, subtaskPanel, extraContent,
}: FocusDialogProps) {
  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid={`dialog-focus-${project.id}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Maximize2 className="h-5 w-5" />
            {project.name}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-muted/30 rounded-lg p-4 border space-y-3">
              <h3 className="text-sm font-semibold">Project Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Select value={statusValue || ''} onValueChange={(v) => onStatusChange(project.id, v)}>
                    <SelectTrigger className="w-[160px] h-7 text-xs" data-testid={`select-focus-status-${project.id}`}>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {details.map((d, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className={d.className || ''}>{d.value || '\u2014'}</span>
                  </div>
                ))}
              </div>
              {alerts?.map((a, i) => (
                <div key={i} className={`rounded p-2 text-xs ${
                  a.variant === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                    : 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                }`}>
                  {a.text}
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                {actions}
                <Link href={`/project/${project.id}`}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" data-testid={`button-focus-profile-${project.id}`}>
                    <Eye className="h-3 w-3" /> Full Profile
                  </Button>
                </Link>
              </div>
            </div>
            {extraContent}
            <EscalationTicketsInline projectId={project.id} />
          </div>
          <div className="lg:col-span-2">
            <div className="bg-muted/30 rounded-lg p-4 border">
              {subtaskPanel}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
