import { Handle, Position, type NodeProps } from "reactflow";

interface FlowNodeData {
  label: string;
  description?: string;
  type?: "data" | "filter" | "action" | "dialog" | "api" | "component" | "logic" | "default";
  items?: string[];
}

const typeColors: Record<string, { bg: string; border: string; headerBg: string }> = {
  data: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-300 dark:border-blue-700", headerBg: "bg-blue-100 dark:bg-blue-900/60" },
  filter: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-300 dark:border-amber-700", headerBg: "bg-amber-100 dark:bg-amber-900/60" },
  action: { bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-300 dark:border-green-700", headerBg: "bg-green-100 dark:bg-green-900/60" },
  dialog: { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-300 dark:border-purple-700", headerBg: "bg-purple-100 dark:bg-purple-900/60" },
  api: { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-300 dark:border-emerald-700", headerBg: "bg-emerald-100 dark:bg-emerald-900/60" },
  component: { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-300 dark:border-indigo-700", headerBg: "bg-indigo-100 dark:bg-indigo-900/60" },
  logic: { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-300 dark:border-orange-700", headerBg: "bg-orange-100 dark:bg-orange-900/60" },
  default: { bg: "bg-gray-50 dark:bg-gray-900/40", border: "border-gray-300 dark:border-gray-700", headerBg: "bg-gray-100 dark:bg-gray-800/60" },
};

export function FlowNode({ data }: NodeProps<FlowNodeData>) {
  const colors = typeColors[data.type || "default"];

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} shadow-sm min-w-[200px] max-w-[280px]`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <div className={`px-3 py-1.5 rounded-t-lg ${colors.headerBg}`}>
        <span className="text-xs font-semibold">{data.label}</span>
      </div>
      {(data.description || data.items) && (
        <div className="px-3 py-2 space-y-1">
          {data.description && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">{data.description}</p>
          )}
          {data.items && (
            <ul className="space-y-0.5">
              {data.items.map((item, i) => (
                <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                  <span className="text-muted-foreground/50 mt-0.5">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
    </div>
  );
}
