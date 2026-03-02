import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FilterCriterion {
  field: string;
  operator: string;
  value: string;
}

interface FilterCriteriaBannerProps {
  criteria: FilterCriterion[];
  activeFilter?: string;
  activeFilterLabel?: string;
  projectCount?: number;
}

export function FilterCriteriaBanner({ criteria, activeFilter, activeFilterLabel, projectCount }: FilterCriteriaBannerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border bg-muted/30 text-xs" data-testid="filter-criteria-banner">
      <button
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-filter-criteria"
      >
        <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-muted-foreground">
          Showing {projectCount !== undefined ? <span className="font-medium text-foreground">{projectCount}</span> : ""} projects matching {criteria.length} filter{criteria.length !== 1 ? "s" : ""}
          {activeFilterLabel && (
            <span> · View: <span className="font-medium text-foreground">{activeFilterLabel}</span></span>
          )}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3 ml-auto text-muted-foreground" /> : <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1 border-t pt-1.5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Asana Filter Criteria</p>
          {criteria.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5" data-testid={`filter-criterion-${i}`}>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{c.field}</Badge>
              <span className="text-muted-foreground">{c.operator}</span>
              <span className="font-medium">{c.value}</span>
            </div>
          ))}
          {activeFilter && activeFilterLabel && (
            <div className="flex items-center gap-1.5 pt-1 border-t mt-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">UI Filter</Badge>
              <span className="text-muted-foreground">=</span>
              <span className="font-medium">{activeFilterLabel}</span>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-1.5 pt-1 border-t">
            If a project from Asana is missing, verify it matches all the criteria above. Projects are synced from Asana and filtered locally.
          </p>
        </div>
      )}
    </div>
  );
}
