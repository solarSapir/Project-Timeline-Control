import type { Project, TaskAction } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { CheckCircle2, Clock, MessageSquare, Wallet } from "lucide-react";
import { isContractSent, isContractSigned, isDepositCollected, isPendingSignature, getInstallStageBadgeClass, getInstallStageLabel } from "@/utils/stages";
import { getDaysUntilDue } from "@/utils/dates";
import { getContractDueDate, getContractSentDate, getContractFollowUpDate } from "./contract-helpers";
import { ContractDueBadge } from "./ContractDueBadge";
import { ContractFollowUpDialog } from "./ContractFollowUpDialog";
import { ContractActions } from "./ContractActions";

interface ContractCardProps {
  project: Project;
  lastFollowUp: TaskAction | null;
  docUploaded: boolean;
  docUploadAction: TaskAction | null;
  approved: boolean;
  approvalAction: TaskAction | null;
  updating: string | null;
  onContractSent: (project: Project, checked: boolean) => void;
  onContractSigned: (project: Project, checked: boolean) => void;
  onDepositCollected: (project: Project, checked: boolean) => void;
}

export function ContractCard({
  project: p, lastFollowUp, docUploaded, docUploadAction, approved, approvalAction,
  updating, onContractSent, onContractSigned, onDepositCollected,
}: ContractCardProps) {
  const contractSentAsana = getContractSentDate(p);
  const followUpAsana = getContractFollowUpDate(p);
  const daysLeft = getDaysUntilDue(getContractDueDate(p));
  const sent = isContractSent(p.installTeamStage);
  const signed = isContractSigned(p.installTeamStage);
  const depositDone = isDepositCollected(p.installTeamStage);
  const pendingSig = isPendingSignature(p.installTeamStage);
  const isOverdue = !sent && daysLeft !== null && daysLeft < 0;
  const allDone = signed && depositDone;

  return (
    <Card
      className={isOverdue ? "border-red-300 dark:border-red-800" : allDone ? "border-green-300 dark:border-green-800" : pendingSig ? "border-amber-300 dark:border-amber-800" : ""}
      data-testid={`card-project-${p.id}`}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/project/${p.id}`} className="font-medium hover:underline cursor-pointer text-primary" data-testid={`text-project-name-${p.id}`}>{p.name}</Link>
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
              <Badge className={`text-xs ${getInstallStageBadgeClass(p.installTeamStage)}`} data-testid={`badge-stage-${p.id}`}>
                {getInstallStageLabel(p.installTeamStage)}
              </Badge>
              <Badge
                className={`text-xs flex items-center gap-1 ${
                  p.paymentMethod
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-dashed border-gray-300 dark:border-gray-600"
                }`}
                variant="outline"
                data-testid={`badge-payment-method-${p.id}`}
              >
                <Wallet className="h-3 w-3" />
                {p.paymentMethod || "Payment method not set"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{p.province || 'No province'}</span>
              <span className="text-xs text-muted-foreground">PM: {p.pmStatus || 'N/A'}</span>
              {p.ucTeam && <span className="text-xs text-muted-foreground">UC Team: {p.ucTeam}</span>}
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
                  Last follow-up: {new Date(lastFollowUp.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {lastFollowUp.completedBy && ` by ${lastFollowUp.completedBy}`}
                </Badge>
              )}
              <ContractFollowUpDialog project={p} lastFollowUp={lastFollowUp} />
            </div>
          </div>
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
      </CardContent>
    </Card>
  );
}
