import { useState, useEffect, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SummaryItem {
  label: string;
  value: string | number;
  color?: string;
}

interface CollapsibleKpiSectionProps {
  storageKey: string;
  title: string;
  titleIcon?: ReactNode;
  titleExtra?: ReactNode;
  titleTestId?: string;
  summaryItems: SummaryItem[];
  children: ReactNode;
  testId: string;
  accentColor?: string;
}

const STORAGE_PREFIX = "kpi-collapsed-";

export function CollapsibleKpiSection({
  storageKey,
  title,
  titleIcon,
  titleExtra,
  titleTestId,
  summaryItems,
  children,
  testId,
  accentColor,
}: CollapsibleKpiSectionProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_PREFIX + storageKey) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKey, String(collapsed));
    } catch {}
  }, [collapsed, storageKey]);

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center gap-2 w-full">
        <div
          className="flex items-center gap-2 cursor-pointer select-none group"
          onClick={() => setCollapsed(!collapsed)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsed(!collapsed); } }}
          data-testid={`button-toggle-${storageKey}`}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform" />
          )}
          {titleIcon}
          <h2 className="text-lg font-semibold" data-testid={titleTestId}>{title}</h2>
        </div>
        {titleExtra}

        {collapsed && summaryItems.length > 0 && (
          <div className="flex items-center gap-3 ml-auto text-xs">
            {summaryItems.map((item, i) => (
              <span key={i} className="flex items-center gap-1 text-muted-foreground whitespace-nowrap">
                <span>{item.label}:</span>
                <span
                  className="font-semibold"
                  style={item.color ? { color: item.color } : undefined}
                  data-testid={`summary-${storageKey}-${i}`}
                >
                  {item.value}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
