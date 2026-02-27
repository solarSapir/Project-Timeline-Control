import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Maximize2, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StageSectionProps {
  title: string;
  icon: LucideIcon;
  status: string;
  children: React.ReactNode;
  onFocus?: () => void;
  activeInTab?: boolean;
}

export function StageSection({ title, icon: Icon, status, children, onFocus, activeInTab }: StageSectionProps) {
  return (
    <Card
      className={`overflow-hidden ${activeInTab ? "ring-2 ring-blue-400 dark:ring-blue-500" : ""}`}
      data-testid={`section-${title.toLowerCase().replace(/[\s/]+/g, "-")}`}
    >
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {activeInTab && (
              <Badge className="text-[9px] px-1.5 py-0 gap-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Eye className="h-2.5 w-2.5" />
                Visible in tab
              </Badge>
            )}
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
            {onFocus && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-1 px-1.5"
                onClick={onFocus}
                data-testid={`button-focus-${title.toLowerCase().replace(/[\s/]+/g, "-")}`}
              >
                <Maximize2 className="h-3 w-3" />
                Focus
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">{children}</CardContent>
    </Card>
  );
}
