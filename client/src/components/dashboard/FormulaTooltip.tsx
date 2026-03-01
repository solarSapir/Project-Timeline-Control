import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export function FormulaTooltip({ formula }: { formula: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help shrink-0" data-testid="icon-formula-info" />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed whitespace-pre-line">
        {formula}
      </TooltipContent>
    </Tooltip>
  );
}
