import type { Project, TaskAction } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import {
  CheckCircle2, Clock, DollarSign, FolderOpen, Maximize2,
  MessageSquare, Send, ShieldCheck, Upload, Wallet,
} from "lucide-react";
import { isContractSent, isContractSigned, isDepositCollected, isPendingSignature, getInstallStageBadgeClass, getInstallStageLabel } from "@/utils/stages";
import { getDaysUntilDue, formatShortDate } from "@/utils/dates";
import { getContractDueDate, getContractSentDate, getContractFollowUpDate } from "./contract-helpers";
import { DueIndicator } from "@/components/uc/DueIndicator";
import { ContractFollowUpDialog } from "./ContractFollowUpDialog";
import { ContractReviewFollowUpDialog } from "./ContractReviewFollowUpDialog";
import { InstallTeamSubtaskPanel } from "@/components/shared/SubtaskExpandPanel";
import { EscalationDialog } from "@/components/shared/EscalationDialog";
import { EscalationBadge } from "@/components/shared/EscalationBadge";

interface ContractCardProps {
  project: Project;
  lastFollowUp: TaskAction | null;
  docUploaded: boolean;
  uploadedCount: number;
  docUploadAction: TaskAction | null;
  approved: boolean;
  approvalAction: TaskAction | null;
  updating: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onExpand: () => void;
  onContractSent: (project: Project, checked: boolean) => void;
  onContractSigned: (project: Project, checked: boolean) => void;
  onDepositCollected: (project: Project, checked: boolean) => void;
  readyForReview?: boolean;
  contractApproved?: boolean;
  showReviewFollowUp?: boolean;
  reviewFollowUpHideDays?: number;
  onReadyForReview?: () => void;
  readyForReviewPending?: boolean;
}

export function ContractCard({
  project: p, lastFollowUp, docUploaded, uploadedCount, docUploadAction, approved, approvalAction,
  updating, isExpanded, onToggleExpand, onExpand, onContractSent, onContractSigned, onDepositCollected,
  readyForReview, contractApproved, showReviewFollowUp, reviewFollowUpHideDays, onReadyForReview, readyForReviewPending,
}: ContractCardProps) {
  const contractDueDate = getContractDueDate(p);
  const contractSentAsana = getContractSentDate(p);
  const followUpAsana = getContractFollowUpDate(p);
  const daysLeft = getDaysUntilDue(contractDueDate);
  const sent = isContractSent(p.installTeamStage);
  const signed = isContractSigned(p.installTeamStage);
  const depositDone = isDepositCollected(p.installTeamStage);
  const pendingSig = isPendingSignature(p.installTeamStage);
  const isOverdue = !sent && daysLeft !== null && daysLeft < 0;
  const allDone = signed && depositDone;
  const completed = allDone;

  return (
    <Card
      className={`transition-colors ${
        isOverdue ? "border-l-4 border-l-red-400" :
        allDone ? "border-l-4 border-l-green-400" :
        pendingSig ? "border-l-4 border-l-amber-400" : ""
      }`}
      data-testid={`card-project-${p.id}`}
    >
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/project/${p.id}`} className="font-medium text-sm text-primary hover:underline truncate" data-testid={`text-project-name-${p.id}`}>
                {p.name}
              </Link>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                p.ucStatus?.toLowerCase().includes('not required')
                  ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  : p.ucStatus?.toLowerCase().includes('complete')
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              }`} data-testid={`badge-uc-status-${p.id}`}>
                UC: {p.ucStatus}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getInstallStageBadgeClass(p.installTeamStage)}`} data-testid={`badge-stage-${p.id}`}>
                {getInstallStageLabel(p.installTeamStage)}
              </span>
              <EscalationBadge projectId={p.id} />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              {p.province && <span>{p.province}</span>}
              {p.province && <span>·</span>}
              <span>PM: {p.pmStatus || '—'}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5">
                <Wallet className="h-2.5 w-2.5" />
                {p.paymentMethod || "No payment method"}
              </span>
              {contractDueDate && !completed && (
                <>
                  <span>·</span>
                  <DueIndicator dueDate={contractDueDate} completed={completed} />
                </>
              )}
            </div>

            {(contractSentAsana || followUpAsana || lastFollowUp) && (
              <div className="flex items-center gap-2 text-[11px] flex-wrap">
                {contractSentAsana && (
                  <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-300 font-medium" data-testid={`badge-contract-sent-${p.id}`}>
                    <CheckCircle2 className="h-3 w-3" />
                    Sent {formatShortDate(contractSentAsana)}
                  </span>
                )}
                {followUpAsana && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground" data-testid={`badge-follow-up-${p.id}`}>
                    <Clock className="h-3 w-3" />
                    Asana follow-up {formatShortDate(followUpAsana)}
                  </span>
                )}
                {lastFollowUp && (
                  <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400" data-testid={`badge-last-followup-${p.id}`}>
                    <MessageSquare className="h-3 w-3" />
                    Follow-up {new Date(lastFollowUp.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {lastFollowUp.completedBy && ` by ${lastFollowUp.completedBy}`}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {docUploaded && (
              <Badge className={`text-[10px] ${approved ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 ring-1 ring-orange-300 dark:ring-orange-700'}`} data-testid={`badge-doc-status-${p.id}`}>
                {approved ? (<><ShieldCheck className="h-3 w-3 mr-1" /> Approved</>) : (<><Upload className="h-3 w-3 mr-1" /> {uploadedCount}/3 Files — For Review</>)}
              </Badge>
            )}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1">
                <Checkbox id={`files-${p.id}`} checked={docUploaded} disabled className="h-3.5 w-3.5" data-testid={`checkbox-files-uploaded-${p.id}`} />
                <label className={`text-[10px] ${docUploaded ? 'text-green-700 dark:text-green-400 font-medium' : 'text-muted-foreground/50'}`}>Files</label>
                {docUploaded && <Upload className="h-3 w-3 text-green-600" />}
              </div>
              <div className="flex items-center gap-1">
                <Checkbox id={`sent-${p.id}`} checked={sent} disabled={sent || updating === p.id + '-sent'} onCheckedChange={(checked) => onContractSent(p, !!checked)} className="h-3.5 w-3.5" data-testid={`checkbox-contract-sent-${p.id}`} />
                <label htmlFor={`sent-${p.id}`} className={`text-[10px] cursor-pointer ${sent ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>Sent</label>
                {sent && <Send className="h-3 w-3 text-green-600" />}
              </div>
              <div className="flex items-center gap-1">
                <Checkbox id={`signed-${p.id}`} checked={signed} disabled={!sent || signed || updating === p.id + '-contract'} onCheckedChange={(checked) => onContractSigned(p, !!checked)} className="h-3.5 w-3.5" data-testid={`checkbox-contract-signed-${p.id}`} />
                <label htmlFor={`signed-${p.id}`} className={`text-[10px] cursor-pointer ${signed ? 'text-green-700 dark:text-green-400' : !sent ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>Signed</label>
                {signed && <CheckCircle2 className="h-3 w-3 text-green-600" />}
              </div>
              <div className="flex items-center gap-1">
                <Checkbox id={`deposit-${p.id}`} checked={depositDone} disabled={!signed || updating === p.id + '-deposit'} onCheckedChange={(checked) => onDepositCollected(p, !!checked)} className="h-3.5 w-3.5" data-testid={`checkbox-deposit-collected-${p.id}`} />
                <label htmlFor={`deposit-${p.id}`} className={`text-[10px] cursor-pointer ${depositDone ? 'text-green-700 dark:text-green-400' : !signed ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>Deposit</label>
                {depositDone && <DollarSign className="h-3 w-3 text-green-600" />}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {docUploaded && !readyForReview && !contractApproved && onReadyForReview && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 px-2 border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-400 dark:hover:bg-teal-950"
              onClick={onReadyForReview}
              disabled={readyForReviewPending}
              data-testid={`button-ready-for-review-${p.id}`}
            >
              <ShieldCheck className="h-3 w-3" />
              {readyForReviewPending ? "Submitting..." : "Ready for Review"}
            </Button>
          )}
          {showReviewFollowUp && (
            <ContractReviewFollowUpDialog project={p} hideDays={reviewFollowUpHideDays ?? 1} />
          )}
          <ContractFollowUpDialog project={p} lastFollowUp={lastFollowUp} />
          <EscalationDialog projectId={p.id} projectName={p.name} viewType="contracts" />
          <Button
            size="sm"
            variant="outline"
            className={`h-7 text-xs gap-1 px-2 ${uploadedCount >= 3
              ? 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950'
              : 'border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950'
            }`}
            onClick={onExpand}
            data-testid={`button-upload-files-${p.id}`}
          >
            {uploadedCount >= 3 ? <CheckCircle2 className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
            {uploadedCount >= 3 ? '3/3 Files Uploaded' : uploadedCount > 0 ? `${uploadedCount}/3 Files` : 'Upload Files'}
          </Button>
          <Button
            size="sm"
            variant={isExpanded ? "secondary" : "ghost"}
            className="h-7 text-xs gap-1 px-2"
            onClick={onToggleExpand}
            data-testid={`button-subtasks-${p.id}`}
          >
            <FolderOpen className="h-3 w-3" />
            Subtasks
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 px-2"
            onClick={onExpand}
            data-testid={`button-expand-${p.id}`}
          >
            <Maximize2 className="h-3 w-3" />
            Focus
          </Button>
        </div>

        {isExpanded && (
          <div className="pt-3 border-t">
            <InstallTeamSubtaskPanel projectId={p.id} subtaskName="Client Contract" label="Client Contract Subtask" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
