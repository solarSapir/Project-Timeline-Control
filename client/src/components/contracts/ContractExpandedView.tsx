import { useQuery } from "@tanstack/react-query";
import type { Project, TaskAction, ProjectFile } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import {
  CheckCircle2, Clock, DollarSign, Send, ShieldCheck, Upload,
  FileText, ExternalLink, Eye, Wallet, MessageSquare,
} from "lucide-react";
import { isContractSent, isContractSigned, isDepositCollected, getInstallStageLabel } from "@/utils/stages";
import { getDaysUntilDue, formatShortDate } from "@/utils/dates";
import { getContractDueDate, getContractSentDate, getContractFollowUpDate } from "./contract-helpers";
import { ContractDocumentsDialog } from "./ContractDocumentsDialog";
import { ContractApproveDialog } from "./ContractApproveDialog";
import { ContractFollowUpDialog } from "./ContractFollowUpDialog";
import { InstallTeamSubtaskPanel } from "@/components/shared/SubtaskExpandPanel";
import { TaskActionDialog } from "@/components/task-action-dialog";

interface AsanaCustomField {
  name: string;
  display_value: string | null;
  text_value?: string | null;
}

function getAsanaField(project: Project, fieldName: string): string | null {
  return (project.asanaCustomFields as AsanaCustomField[] | null)?.find(
    (f) => f.name === fieldName
  )?.display_value ?? null;
}

interface ContractExpandedViewProps {
  project: Project;
  docUploaded: boolean;
  docUploadAction: TaskAction | null;
  approved: boolean;
  approvalAction: TaskAction | null;
  lastFollowUp: TaskAction | null;
  updating: string | null;
  onContractSent: (project: Project, checked: boolean) => void;
  onContractSigned: (project: Project, checked: boolean) => void;
  onDepositCollected: (project: Project, checked: boolean) => void;
}

export function ContractExpandedView({
  project: p, docUploaded, docUploadAction, approved, approvalAction,
  lastFollowUp, updating, onContractSent, onContractSigned, onDepositCollected,
}: ContractExpandedViewProps) {
  const sent = isContractSent(p.installTeamStage);
  const signed = isContractSigned(p.installTeamStage);
  const depositDone = isDepositCollected(p.installTeamStage);
  const contractDueDate = getContractDueDate(p);
  const contractSentAsana = getContractSentDate(p);
  const followUpAsana = getContractFollowUpDate(p);
  const daysLeft = getDaysUntilDue(contractDueDate);

  const sharePointLink = getAsanaField(p, 'Share Point Link');

  const { data: contractFiles } = useQuery<ProjectFile[]>({
    queryKey: ['/api/projects', p.id, 'files', 'contract'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${p.id}/files?category=contract`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="space-y-6" data-testid={`expanded-contract-view-${p.id}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-muted/30 rounded-lg p-4 border space-y-3">
            <h3 className="text-sm font-semibold">Project Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stage</span>
                <span className="font-medium text-xs">{getInstallStageLabel(p.installTeamStage)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PM Status</span>
                <span>{p.pmStatus || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Province</span>
                <span>{p.province || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">UC Status</span>
                <span>{p.ucStatus || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">UC Team</span>
                <span>{p.ucTeam || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method</span>
                <span className="flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  {p.paymentMethod || 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contract Due</span>
                <span className={daysLeft !== null && daysLeft < 0 ? 'text-red-600 font-medium' : ''}>
                  {contractDueDate ? formatShortDate(contractDueDate) : '—'}
                  {daysLeft !== null && (
                    <span className="text-xs ml-1">({daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`})</span>
                  )}
                </span>
              </div>
              {contractSentAsana && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contract Sent</span>
                  <span className="text-green-700 dark:text-green-400">{formatShortDate(contractSentAsana)}</span>
                </div>
              )}
              {followUpAsana && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Asana Follow-up</span>
                  <span>{formatShortDate(followUpAsana)}</span>
                </div>
              )}
              {lastFollowUp && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Follow-up</span>
                  <span className="text-blue-600 dark:text-blue-400 text-xs">
                    {new Date(lastFollowUp.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {lastFollowUp.completedBy && ` by ${lastFollowUp.completedBy}`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <ContractFollowUpDialog project={p} lastFollowUp={lastFollowUp} />
              <Link href={`/project/${p.id}`}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" data-testid={`button-profile-${p.id}`}>
                  <Eye className="h-3 w-3" /> Full Profile
                </Button>
              </Link>
              {sharePointLink && (
                <a href={sharePointLink} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" data-testid={`button-sharepoint-${p.id}`}>
                    <ExternalLink className="h-3 w-3" /> SharePoint
                  </Button>
                </a>
              )}
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 border space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4" /> Documents & Approval
            </h3>

            {docUploaded && (
              <div className="space-y-2">
                <Badge className={`text-xs ${approved ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 ring-1 ring-orange-300 dark:ring-orange-700'}`} data-testid={`badge-expanded-doc-status-${p.id}`}>
                  {approved ? (<><ShieldCheck className="h-3 w-3 mr-1" /> Approved</>) : (<><Upload className="h-3 w-3 mr-1" /> For Review</>)}
                </Badge>
                {docUploadAction && (
                <p className="text-xs text-muted-foreground">
                  Uploaded by {docUploadAction.completedBy || 'Unknown'} on {new Date(docUploadAction.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                )}
                {approvalAction && (
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                    Approved by {approvalAction.completedBy || 'Manager'} on {new Date(approvalAction.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>
            )}

            {contractFiles && contractFiles.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Review Documents</p>
                {contractFiles.map((file) => (
                  <a
                    key={file.id}
                    href={`/api/projects/${p.id}/files/${file.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/50 transition-colors group"
                    data-testid={`link-contract-file-${file.id}`}
                  >
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{file.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {file.uploadedBy && `by ${file.uploadedBy}`}
                        {file.fileSize && ` · ${(file.fileSize / 1024).toFixed(0)} KB`}
                      </p>
                    </div>
                    <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            )}

            {docUploaded && (!contractFiles || contractFiles.length === 0) && (
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md p-2 border border-amber-200 dark:border-amber-800">
                Documents were uploaded but files are no longer available. Please re-upload using the button below.
              </div>
            )}

            <div className="space-y-2">
              <ContractDocumentsDialog project={p} hasDocUpload={docUploaded} />
              <ContractApproveDialog project={p} hasDocUpload={docUploaded} isApproved={approved} />
            </div>

            <div className="space-y-2.5 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Checkbox id={`exp-sent-${p.id}`} checked={sent} disabled={sent || updating === p.id + '-sent'} onCheckedChange={(checked) => onContractSent(p, !!checked)} data-testid={`checkbox-exp-contract-sent-${p.id}`} />
                <label htmlFor={`exp-sent-${p.id}`} className={`text-sm cursor-pointer ${sent ? 'text-green-700 dark:text-green-400 font-medium' : 'text-muted-foreground'}`}>Contract Sent</label>
                {sent && <Send className="h-4 w-4 text-green-600" />}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id={`exp-signed-${p.id}`} checked={signed} disabled={!sent || signed || updating === p.id + '-contract'} onCheckedChange={(checked) => onContractSigned(p, !!checked)} data-testid={`checkbox-exp-contract-signed-${p.id}`} />
                <label htmlFor={`exp-signed-${p.id}`} className={`text-sm cursor-pointer ${signed ? 'text-green-700 dark:text-green-400 font-medium' : !sent ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>Contract Signed</label>
                {signed && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id={`exp-deposit-${p.id}`} checked={depositDone} disabled={!signed || updating === p.id + '-deposit'} onCheckedChange={(checked) => onDepositCollected(p, !!checked)} data-testid={`checkbox-exp-deposit-${p.id}`} />
                <label htmlFor={`exp-deposit-${p.id}`} className={`text-sm cursor-pointer ${depositDone ? 'text-green-700 dark:text-green-400 font-medium' : !signed ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>$1,500 Permit Deposit</label>
                {depositDone && <DollarSign className="h-4 w-4 text-green-600" />}
              </div>
            </div>

            <TaskActionDialog projectId={p.id} projectName={p.name} viewType="contracts" />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-muted/30 rounded-lg p-4 border">
            <InstallTeamSubtaskPanel projectId={p.id} subtaskName="Client Contract" label="Client Contract Subtask" />
          </div>
        </div>
      </div>
    </div>
  );
}
