import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { Link } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import type { Project } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  "Active": "#22c55e",
  "Project Paused": "#f59e0b",
  "Project lost": "#ef4444",
  "Complete": "#3b82f6",
  "Awaiting internal teams": "#8b5cf6",
  "Install": "#06b6d4",
  "Ready to build": "#10b981",
  "Pending Payment": "#f97316",
  "Close-Off": "#6366f1",
  "Missing Information": "#ec4899",
  "No Status": "#9ca3af",
  "Needs manager review": "#d946ef",
  "New Project": "#14b8a6",
};

const DEFAULT_HIDDEN = new Set(["Complete", "Project lost"]);

function getColor(name: string): string {
  return STATUS_COLORS[name] || STATUS_COLORS[Object.keys(STATUS_COLORS).find(k => k.toLowerCase() === name.toLowerCase()) || ""] || "#64748b";
}

function renderActiveShape(props: Record<string, unknown>) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props as {
    cx: number; cy: number; innerRadius: number; outerRadius: number;
    startAngle: number; endAngle: number; fill: string;
    payload: { name: string }; value: number; percent: number;
  };
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={(outerRadius as number) + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={(innerRadius as number) - 4} outerRadius={innerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.4} />
      <text x={cx} y={cy - 10} textAnchor="middle" fill="currentColor" fontSize={13} fontWeight={500}>{payload.name}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="currentColor" fontSize={12}>{value} ({Math.round(percent * 100)}%)</text>
    </g>
  );
}

export function PmStatusChart() {
  const { data: projects } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set(DEFAULT_HIDDEN));
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [drillStatus, setDrillStatus] = useState<string | null>(null);

  const allData = useMemo(() => {
    if (!projects) return [];
    const counts: Record<string, number> = {};
    projects.forEach(p => {
      const status = p.pmStatus || "No Status";
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        color: getColor(name),
      }))
      .sort((a, b) => b.value - a.value);
  }, [projects]);

  const chartData = allData.filter(d => !hiddenStatuses.has(d.name));
  const visibleTotal = chartData.reduce((sum, d) => sum + d.value, 0);

  const drillProjects = useMemo(() => {
    if (!drillStatus || !projects) return [];
    return projects
      .filter(p => (p.pmStatus || "No Status") === drillStatus)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drillStatus, projects]);

  const toggleHidden = (name: string) => {
    setHiddenStatuses(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setActiveIndex(undefined);
  };

  const handlePieClick = (_: unknown, index: number) => {
    if (chartData[index]) {
      setDrillStatus(chartData[index].name);
    }
  };

  if (allData.length === 0) return null;

  return (
    <>
      <Card data-testid="card-pm-status-chart">
        <CardHeader>
          <CardTitle className="text-base">PM Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="w-full lg:w-1/2 h-[320px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      activeIndex={activeIndex}
                      activeShape={renderActiveShape}
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(undefined)}
                      onClick={handlePieClick}
                      className="cursor-pointer"
                    >
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  All statuses hidden
                </div>
              )}
            </div>
            <div className="w-full lg:w-1/2">
              <div className="space-y-1.5">
                {allData.map((d) => {
                  const hidden = hiddenStatuses.has(d.name);
                  const pct = visibleTotal > 0 && !hidden ? Math.round((d.value / visibleTotal) * 100) : 0;
                  return (
                    <div key={d.name} className={`flex items-center justify-between text-sm ${hidden ? "opacity-40" : ""}`} data-testid={`pm-status-row-${d.name}`}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleHidden(d.name)}
                          className="p-0.5 rounded hover:bg-muted transition-colors"
                          title={hidden ? `Show ${d.name}` : `Hide ${d.name}`}
                          data-testid={`button-toggle-${d.name}`}
                        >
                          {hidden ? (
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <button
                          onClick={() => setDrillStatus(d.name)}
                          className="text-foreground hover:text-primary hover:underline transition-colors text-left"
                          data-testid={`button-drill-${d.name}`}
                        >
                          {d.name}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.value}</span>
                        <span className="text-muted-foreground text-xs w-10 text-right">
                          {hidden ? "--" : `${pct}%`}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between text-sm pt-1.5 border-t mt-2">
                  <span className="font-medium text-muted-foreground">Visible Total</span>
                  <span className="font-bold">{visibleTotal}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!drillStatus} onOpenChange={(open) => { if (!open) setDrillStatus(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-pm-drill">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColor(drillStatus || "") }} />
              {drillStatus} ({drillProjects.length})
            </DialogTitle>
            <DialogDescription>
              All projects with PM Status set to "{drillStatus}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {drillProjects.map(p => (
              <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted transition-colors" data-testid={`drill-row-${p.id}`}>
                <Link href={`/project/${p.id}`} className="text-sm text-primary hover:underline truncate flex-1 mr-2" data-testid={`drill-link-${p.id}`}>
                  {p.name}
                </Link>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {p.province && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {p.province}
                    </span>
                  )}
                  {p.installType && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                      {p.installType}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {drillProjects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No projects found.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
