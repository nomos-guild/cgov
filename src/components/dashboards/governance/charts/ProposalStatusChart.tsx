import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import { getChartColors, chartCardClassName, chartCardGameClassName } from "@/components/dashboards/shared/chartTheme";

export function ProposalStatusChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const data = useMemo(() => {
    const statusCounts = {
      Active: 0,
      Ratified: 0,
      Enacted: 0,
      Expired: 0,
      Closed: 0,
    };

    actions.forEach((action) => {
      if (action.status in statusCounts) {
        statusCounts[action.status as keyof typeof statusCounts]++;
      }
    });

    const statusToColor: Record<string, string> = {
      Active: chartColors.active,
      Ratified: chartColors.ratified,
      Enacted: chartColors.enacted,
      Expired: chartColors.expired,
      Closed: chartColors.closed,
    };

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      fill: statusToColor[status],
    }));
  }, [actions, chartColors]);

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        chartCardClassName,
        isGame && chartCardGameClassName,
        className
      )}
    >
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]" style={isGame ? { color: chartColors.tooltipText } : undefined}>
        Proposal Status
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <XAxis
            dataKey="status"
            tick={{ fontSize: 11, fill: chartColors.axisText }}
            axisLine={{ stroke: chartColors.axisLine }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: chartColors.axisText }}
            axisLine={{ stroke: chartColors.axisLine }}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: chartColors.tooltipBg,
              border: `1px solid ${chartColors.tooltipBorder}`,
              borderRadius: activeTheme.isDark ? "0" : "8px",
              color: chartColors.tooltipText,
            }}
          />
          <Bar dataKey="count" radius={activeTheme.isDark ? 0 : [4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fill}
              />
            ))}
          </Bar>
        </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
