import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

interface StageSectionProps {
  title: string;
  icon: LucideIcon;
  status: string;
  children: React.ReactNode;
}

export function StageSection({ title, icon: Icon, status, children }: StageSectionProps) {
  return (
    <Card className="overflow-hidden" data-testid={`section-${title.toLowerCase().replace(/[\s/]+/g, "-")}`}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          <Badge
            className={
              status === "completed"
                ? "text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : status === "in_progress"
                  ? "text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }
          >
            {status === "completed" ? "Complete" : status === "in_progress" ? "In Progress" : "Pending"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">{children}</CardContent>
    </Card>
  );
}
