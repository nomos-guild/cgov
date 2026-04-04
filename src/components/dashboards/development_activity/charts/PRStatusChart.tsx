import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { SafeResponsiveContainer as ResponsiveContainer } from "@/components/ui/safe-responsive-container";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import {
  getChartColors, chartCardClassName, chartCardGameClassName,
} from "@/components/dashboards/shared/chartTheme";
import type { ChartProps } from "@/types/dashboard";

export function PRStatusChart({ isLoading, className }: ChartProps) {
  const activity = useAppSelector((state) => state.development.activity);
  const health = useAppSelector((state) => state.development.health);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const { data, totalPRs } = useMemo(() => {
    if (!activity?.data) return { data: [], totalPRs: 0 };
    const opened = activity.data.reduce((sum, d) => sum + d.prOpened, 0);
    const merged = activity.data.reduce((sum, d) => sum + d.prMerged, 0);
    const closed = Math.max(0, opened - merged);
    return {
      data: [
        { name: "Merged", value: merged },
        { name: "Open", value: closed },
      ],
      totalPRs: opened,
    };
  }, [activity]);

  if (isLoading) return <ChartSkeleton className={className} />;

  const colors = [chartColors.yes, chartColors.palette[2]];

  return (
    <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]">Pull Request Status</h3>
      <div className="flex-1 min-h-0 flex items-center">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                dataKey="value"
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: chartColors.tooltipBg,
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  color: chartColors.tooltipText,
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
        </ResponsiveContainer>
        </div>
        <div className="w-1/2 flex flex-col gap-3 pl-4">
          <div>
            <span className="text-2xl font-bold dark:text-[#0bd1a2]">{totalPRs}</span>
            <span className="text-xs text-muted-foreground ml-1">Total PRs</span>
          </div>
          {health?.avgMergeTimeHours != null && (
            <div>
              <span className="text-lg font-semibold dark:text-[#0bd1a2]">
                {health.avgMergeTimeHours.toFixed(1)}h
              </span>
              <span className="text-xs text-muted-foreground ml-1">Avg Merge Time</span>
            </div>
          )}
          {health?.prCloseRate != null && (
            <div>
              <span className="text-lg font-semibold dark:text-[#0bd1a2]">
                {(health.prCloseRate * 100).toFixed(0)}%
              </span>
              <span className="text-xs text-muted-foreground ml-1">Close Rate</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
