import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { Project } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  "Active": "#22c55e",
  "Project Paused": "#f59e0b",
  "Project Lost": "#ef4444",
  "Complete": "#3b82f6",
  "Other": "#94a3b8",
};

export function PmStatusChart() {
  const { data: projects } = useQuery<Project[]>({ queryKey: ['/api/projects'] });

  const chartData = useMemo(() => {
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
        color: STATUS_COLORS[name] || STATUS_COLORS["Other"],
      }))
      .sort((a, b) => b.value - a.value);
  }, [projects]);

  if (chartData.length === 0) return null;

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card data-testid="card-pm-status-chart">
      <CardHeader>
        <CardTitle className="text-base">PM Status Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center gap-4">
          <div className="w-full lg:w-1/2 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={false}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} projects (${Math.round((value / total) * 100)}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full lg:w-1/2">
            <div className="space-y-1.5">
              {chartData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm" data-testid={`pm-status-row-${d.name}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-foreground">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{d.value}</span>
                    <span className="text-muted-foreground text-xs w-10 text-right">{Math.round((d.value / total) * 100)}%</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm pt-1.5 border-t mt-2">
                <span className="font-medium text-muted-foreground">Total</span>
                <span className="font-bold">{total}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
