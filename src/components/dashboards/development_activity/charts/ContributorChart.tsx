import { useMemo, useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import {
  getChartColors, chartCardClassName, chartCardGameClassName,
} from "@/components/dashboards/shared/chartTheme";
import type { ChartProps } from "@/types/dashboard";

export function ContributorChart({ isLoading, className }: ChartProps) {
  const contributors = useAppSelector((state) => state.development.contributors);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const data = useMemo(() => {
    if (!contributors?.contributors) return [];
    return contributors.contributors.slice(0, 15).map((c) => ({
      login: c.login.length > 14 ? `${c.login.slice(0, 12)}...` : c.login,
      fullLogin: c.login,
      commits: c.totalCommits,
      prs: c.totalPRs,
      isActive: c.isActive,
    }));
  }, [contributors]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = useCallback((data: any) => {
    const login = data?.fullLogin ?? data?.payload?.fullLogin;
    if (login) window.open(`https://github.com/${login}`, "_blank", "noopener,noreferrer");
  }, []);

  if (isLoading) return <ChartSkeleton className={className} />;

  return (
    <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]">Top Contributors</h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridLine} />
            <XAxis
              dataKey="login"
              tick={{ fill: chartColors.axisText, fontSize: 10, dy: 8 }}
              stroke={chartColors.axisLine}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fill: chartColors.axisText, fontSize: 11 }} stroke={chartColors.axisLine} />
            <Tooltip
              contentStyle={{
                backgroundColor: chartColors.tooltipBg,
                border: `1px solid ${chartColors.tooltipBorder}`,
                color: chartColors.tooltipText,
                borderRadius: 8,
                fontSize: 12,
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any, props: any) => {
                if (name === "commits") {
                  return [`${value} commits, ${props.payload?.prs ?? 0} PRs`, props.payload?.fullLogin ?? ""];
                }
                return [value, name];
              }}
            />
            <Bar dataKey="commits" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isActive ? chartColors.palette[0] : chartColors.primaryMuted}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColors.palette[0] }} />
          Active
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColors.primaryMuted }} />
          Inactive
        </span>
        <span className="ml-auto">{contributors?.total ?? 0} total</span>
      </div>
    </div>
  );
}
