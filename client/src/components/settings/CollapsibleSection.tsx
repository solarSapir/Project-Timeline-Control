import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId?: string;
}

export function CollapsibleSection({ title, icon, defaultOpen = true, children, testId }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card data-testid={testId}>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
        data-testid={testId ? `${testId}-toggle` : undefined}
      >
        <CardTitle className="text-base flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}
