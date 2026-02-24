import { Badge } from "@/components/ui/badge";
import { Wrench, Truck } from "lucide-react";
import { StageSection } from "./StageSection";
import { InfoRow, ExpectedDueRow, formatProfileDate } from "./InfoRow";
import type { Project, InstallSchedule } from "@shared/schema";
import type { StageExpectations } from "@/hooks/use-expected-dates";

interface InstallationSectionProps {
  project: Project;
  stages: StageExpectations;
  schedules: InstallSchedule[];
}

export function InstallationSection({ project, stages, schedules }: InstallationSectionProps) {
  return (
    <StageSection title="Installation" icon={Wrench} status={stages.installation.status}>
      <InfoRow label="Install Stage" value={project.installTeamStage} testId="text-install-team-stage" />
      <InfoRow label="Target Due" value={formatProfileDate(project.installDueDate)} testId="text-install-target" />
      <ExpectedDueRow target={project.installDueDate} expected={stages.installation.expected} testId="text-install-expected" />
      {project.installStartDate && <InfoRow label="Install Start" value={formatProfileDate(project.installStartDate)} testId="text-install-start" />}
      {project.equipmentArrivalDate && <InfoRow label="Equipment Arrival" value={formatProfileDate(project.equipmentArrivalDate)} testId="text-equipment-arrival" />}
      {project.disconnectReconnectDate && <InfoRow label="Disconnect/Reconnect" value={formatProfileDate(project.disconnectReconnectDate)} testId="text-disconnect-reconnect" />}
      {project.finalInspectionDate && <InfoRow label="Final Inspection" value={formatProfileDate(project.finalInspectionDate)} testId="text-final-inspection" />}
      {schedules.length > 0 && (
        <div className="border-t mt-2 pt-2 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Schedule Items</span>
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-xs py-0.5" data-testid={`schedule-item-${s.id}`}>
              <div className="flex items-center gap-2">
                <Truck className="h-3 w-3 text-muted-foreground" />
                <span>{s.taskType}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {s.scheduledDate && <span>{formatProfileDate(s.scheduledDate)}</span>}
                {s.installerName && <span>- {s.installerName}</span>}
                <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </StageSection>
  );
}
