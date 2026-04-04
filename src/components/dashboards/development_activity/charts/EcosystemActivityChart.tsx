import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { SafeResponsiveContainer as ResponsiveContainer } from "@/components/ui/safe-responsive-container";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import {
  getChartColors, chartCardClassName, chartCardGameClassName,
} from "@/components/dashboards/shared/chartTheme";
import type { ChartProps } from "@/types/dashboard";

export function EcosystemActivityChart({ isLoading, className }: ChartProps) {
  const activity = useAppSelector((state) => state.development.activity);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const data = useMemo(() => {
    if (!activity?.data) return [];
    return activity.data.map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rawDate: d.date,
      Commits: d.commits,
      "PRs Opened": d.prOpened,
      "PRs Merged": d.prMerged,
      "Issues Opened": d.issuesOpened,
    }));
  }, [activity]);

  if (isLoading) return <ChartSkeleton className={className} />;

  return (
    <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]">Ecosystem Activity</h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridLine} />
            <XAxis dataKey="date" tick={{ fill: chartColors.axisText, fontSize: 11 }} stroke={chartColors.axisLine} />
            <YAxis tick={{ fill: chartColors.axisText, fontSize: 11 }} stroke={chartColors.axisLine} />
            <Tooltip
              contentStyle={{
                backgroundColor: chartColors.tooltipBg,
                border: `1px solid ${chartColors.tooltipBorder}`,
                color: chartColors.tooltipText,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(_label, payload) => {
                const raw = payload?.[0]?.payload?.rawDate;
                if (!raw) return _label;
                return new Date(raw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="Commits" stackId="1" stroke={chartColors.palette[0]} fill={chartColors.palette[0]} fillOpacity={0.6} />
            <Area type="monotone" dataKey="PRs Merged" stackId="1" stroke={chartColors.palette[1]} fill={chartColors.palette[1]} fillOpacity={0.6} />
            <Area type="monotone" dataKey="PRs Opened" stackId="1" stroke={chartColors.palette[2]} fill={chartColors.palette[2]} fillOpacity={0.4} />
            <Area type="monotone" dataKey="Issues Opened" stackId="1" stroke={chartColors.palette[3]} fill={chartColors.palette[3]} fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
