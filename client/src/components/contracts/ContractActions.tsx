import type { Project, TaskAction } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Clock, DollarSign, Send, ShieldCheck, Upload } from "lucide-react";
import { TaskActionDialog } from "@/components/task-action-dialog";
import { isContractSent, isContractSigned, isDepositCollected } from "@/utils/stages";
import { ContractDocumentsDialog } from "./ContractDocumentsDialog";
import { ContractApproveDialog } from "./ContractApproveDialog";

interface ContractActionsProps {
  project: Project;
  docUploaded: boolean;
  docUploadAction: TaskAction | null;
  approved: boolean;
  approvalAction: TaskAction | null;
  updating: string | null;
  onContractSent: (project: Project, checked: boolean) => void;
  onContractSigned: (project: Project, checked: boolean) => void;
  onDepositCollected: (project: Project, checked: boolean) => void;
}

export function ContractActions({ project: p, docUploaded, docUploadAction, approved, approvalAction, updating, onContractSent, onContractSigned, onDepositCollected }: ContractActionsProps) {
  const sent = isContractSent(p.installTeamStage);
  const signed = isContractSigned(p.installTeamStage);
  const depositDone = isDepositCollected(p.installTeamStage);

  return (
    <div className="flex flex-col gap-3 min-w-[240px]">
      <div className="border rounded-md p-2 bg-muted/20 space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Upload className="h-3 w-3" /> Documents for Review
        </p>
        {docUploaded && docUploadAction && (
          <div className="text-xs space-y-1">
            <Badge className={`text-xs ${approved ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'}`} data-testid={`badge-doc-status-${p.id}`}>
              {approved ? (<><ShieldCheck className="h-3 w-3 mr-1" /> Approved</>) : (<><Clock className="h-3 w-3 mr-1" /> Pending Review</>)}
            </Badge>
            <p className="text-muted-foreground">
              Uploaded by {docUploadAction.completedBy || 'Unknown'} on {new Date(docUploadAction.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
            {docUploadAction.notes && <p className="text-muted-foreground truncate max-w-[220px]">{docUploadAction.notes}</p>}
            {approvalAction && (
              <p className="text-green-700 dark:text-green-400 font-medium">
                Approved by {approvalAction.completedBy || 'Manager'} on {new Date(approvalAction.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
        )}
        <ContractDocumentsDialog project={p} hasDocUpload={docUploaded} />
        <ContractApproveDialog project={p} hasDocUpload={docUploaded} isApproved={approved} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={`contract-sent-${p.id}`} checked={sent} disabled={sent || updating === p.id + '-sent'} onCheckedChange={(checked) => onContractSent(p, !!checked)} data-testid={`checkbox-contract-sent-${p.id}`} />
        <label htmlFor={`contract-sent-${p.id}`} className={`text-sm cursor-pointer ${sent ? 'text-green-700 dark:text-green-400 font-medium' : 'text-muted-foreground'}`}>Contract Sent</label>
        {sent && <Send className="h-4 w-4 text-green-600" />}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={`contract-signed-${p.id}`} checked={signed} disabled={!sent || signed || updating === p.id + '-contract'} onCheckedChange={(checked) => onContractSigned(p, !!checked)} data-testid={`checkbox-contract-signed-${p.id}`} />
        <label htmlFor={`contract-signed-${p.id}`} className={`text-sm cursor-pointer ${signed ? 'text-green-700 dark:text-green-400 font-medium' : !sent ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>Contract Signed</label>
        {signed && <CheckCircle2 className="h-4 w-4 text-green-600" />}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={`deposit-collected-${p.id}`} checked={depositDone} disabled={!signed || updating === p.id + '-deposit'} onCheckedChange={(checked) => onDepositCollected(p, !!checked)} data-testid={`checkbox-deposit-collected-${p.id}`} />
        <label htmlFor={`deposit-collected-${p.id}`} className={`text-sm cursor-pointer ${depositDone ? 'text-green-700 dark:text-green-400 font-medium' : !signed ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>$1,500 Permit Deposit</label>
        {depositDone && <DollarSign className="h-4 w-4 text-green-600" />}
      </div>
      <TaskActionDialog projectId={p.id} projectName={p.name} viewType="contracts" />
    </div>
  );
}
