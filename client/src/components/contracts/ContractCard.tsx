import type { Project, TaskAction } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, Clock, FolderOpen, MessageSquare, Wallet } from "lucide-react";
import { isContractSent, isContractSigned, isDepositCollected, isPendingSignature, getInstallStageBadgeClass, getInstallStageLabel } from "@/utils/stages";
import { getDaysUntilDue, formatShortDate } from "@/utils/dates";
import { getContractDueDate, getContractSentDate, getContractFollowUpDate } from "./contract-helpers";
import { DueIndicator } from "@/components/uc/DueIndicator";
import { ContractFollowUpDialog } from "./ContractFollowUpDialog";
import { ContractActions } from "./ContractActions";
import { InstallTeamSubtaskPanel } from "@/components/shared/SubtaskExpandPanel";
import { EscalationDialog } from "@/components/shared/EscalationDialog";
import { EscalationBadge } from "@/components/shared/EscalationBadge";

interface ContractCardProps {
  project: Project;
  lastFollowUp: TaskAction | null;
  docUploaded: boolean;
  docUploadAction: TaskAction | null;
  approved: boolean;
  approvalAction: TaskAction | null;
  updating: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onContractSent: (project: Project, checked: boolean) => void;
  onContractSigned: (project: Project, checked: boolean) => void;
  onDepositCollected: (project: Project, checked: boolean) => void;
}

export function ContractCard({
  project: p, lastFollowUp, docUploaded, docUploadAction, approved, approvalAction,
  updating, isExpanded, onToggleExpand, onContractSent, onContractSigned, onDepositCollected,
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
      <CardContent className="py-3 px-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
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
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 ${
                p.paymentMethod
                  ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              }`} data-testid={`badge-payment-method-${p.id}`}>
                <Wallet className="h-3 w-3" />
                {p.paymentMethod || "No payment method"}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
              {p.province && <span>{p.province}</span>}
              {p.province && p.pmStatus && <span>·</span>}
              {p.pmStatus && <span>PM: {p.pmStatus}</span>}
              {(p.province || p.pmStatus) && p.ucTeam && <span>·</span>}
              {p.ucTeam && <span>UC Team: {p.ucTeam}</span>}
              {(p.province || p.pmStatus || p.ucTeam) && contractDueDate && !completed && <span>·</span>}
              <DueIndicator dueDate={contractDueDate} completed={completed} />
            </div>

            <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
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
                  Last follow-up: {new Date(lastFollowUp.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {lastFollowUp.completedBy && ` by ${lastFollowUp.completedBy}`}
                </span>
              )}
              <ContractFollowUpDialog project={p} lastFollowUp={lastFollowUp} />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <EscalationDialog projectId={p.id} projectName={p.name} viewType="contracts" />
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
            <ContractActions
              project={p}
              docUploaded={docUploaded}
              docUploadAction={docUploadAction}
              approved={approved}
              approvalAction={approvalAction}
              updating={updating}
              onContractSent={onContractSent}
              onContractSigned={onContractSigned}
              onDepositCollected={onDepositCollected}
            />
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t">
            <InstallTeamSubtaskPanel projectId={p.id} subtaskName="Contract Creation" label="Contract Subtask" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
