import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import type { TaskAction } from "@shared/schema";

interface ActivitySectionProps {
  taskActions: TaskAction[];
}

export function ActivitySection({ taskActions }: ActivitySectionProps) {
  if (taskActions.length === 0) return null;
  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recent Activity ({taskActions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="space-y-2 max-h-[300px] overflow-auto">
          {[...taskActions]
            .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
            .slice(0, 20)
            .map((action) => (
              <div key={action.id} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0" data-testid={`activity-${action.id}`}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{action.viewType}</Badge>
                  <span className="text-xs">{action.actionType}</span>
                  {action.completedBy && <span className="text-xs text-muted-foreground">by {action.completedBy}</span>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {action.completedAt ? format(new Date(action.completedAt), "MMM d, h:mm a") : "--"}
                </span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
