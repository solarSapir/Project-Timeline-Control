import type { Project } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Lock } from "lucide-react";
import { getUnmetDependencies, STAGE_COMPLETION_CRITERIA, type WorkflowConfig } from "@/lib/stage-dependencies";
import { STAGE_LABELS } from "@shared/schema";

interface WaitingDepsCardProps {
  project: Project;
  workflowConfigs: WorkflowConfig[] | undefined;
}

export function WaitingDepsCard({ project: p, workflowConfigs }: WaitingDepsCardProps) {
  const unmet = getUnmetDependencies(p, "contract_signing", workflowConfigs);
  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10" data-testid={`card-waiting-${p.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/project/${p.id}`}>
              <span className="font-medium text-sm hover:underline cursor-pointer" data-testid={`link-project-${p.id}`}>{p.name}</span>
            </Link>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="outline" className="text-xs flex items-center gap-1 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                <Lock className="h-3 w-3" />
                Waiting on dependencies
              </Badge>
            </div>
            <div className="mt-2 space-y-0.5">
              {unmet.map(dep => (
                <p key={dep} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="font-medium">{STAGE_LABELS[dep] || dep}:</span>
                  <span>{STAGE_COMPLETION_CRITERIA[dep]?.label || "Not complete"}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
