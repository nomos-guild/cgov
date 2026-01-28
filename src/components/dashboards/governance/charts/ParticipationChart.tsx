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

export function ParticipationChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const data = useMemo(() => {
    // Count proposals by participation level
    const activeActions = actions.filter((a) => a.status === "Active");

    if (activeActions.length === 0) {
      return [];
    }

    // Calculate average DRep participation for each proposal
    const participationBuckets = {
      "0-25%": 0,
      "25-50%": 0,
      "50-75%": 0,
      "75-100%": 0,
    };

    activeActions.forEach((action) => {
      // Calculate participation as sum of yes/no/abstain percentages
      // (the rest would be not voted)
      const drepParticipation =
        (action.drepYesPercent || 0) +
        (action.drepNoPercent || 0) +
        (action.drepAbstainPercent || 0);

      if (drepParticipation < 25) {
        participationBuckets["0-25%"]++;
      } else if (drepParticipation < 50) {
        participationBuckets["25-50%"]++;
      } else if (drepParticipation < 75) {
        participationBuckets["50-75%"]++;
      } else {
        participationBuckets["75-100%"]++;
      }
    });

    return Object.entries(participationBuckets).map(([range, count]) => ({
      range,
      count,
    }));
  }, [actions]);

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  const hasData = data.length > 0 && data.some((d) => d.count > 0);

  const getBarColor = (range: string) => {
    switch (range) {
      case "0-25%":
        return chartColors.participationLow;
      case "25-50%":
        return chartColors.participationMedLow;
      case "50-75%":
        return chartColors.participationMedHigh;
      case "75-100%":
        return chartColors.participationHigh;
      default:
        return chartColors.primaryMuted;
    }
  };

  return (
    <div
      className={cn(
        chartCardClassName,
        isGame && chartCardGameClassName,
        className
      )}
    >
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]" style={isGame ? { color: chartColors.tooltipText } : undefined}>
        DRep Participation
      </h3>

      {!hasData ? (
        <p className="text-sm text-muted-foreground">No active proposals</p>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
            data={data}
            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
          >
            <XAxis
              dataKey="range"
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
              formatter={(value) => [`${value} proposals`]}
              labelFormatter={(label) => `Participation: ${label}`}
            />
            <Bar dataKey="count" radius={activeTheme.isDark ? 0 : [4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
              ))}
            </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
