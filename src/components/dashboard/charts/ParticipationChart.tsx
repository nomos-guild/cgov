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

export function ParticipationChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;

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
    if (isDark) return "#0bd1a2";
    switch (range) {
      case "0-25%":
        return "#ef4444";
      case "25-50%":
        return "#f97316";
      case "50-75%":
        return "#eab308";
      case "75-100%":
        return "#22c55e";
      default:
        return "#6b7280";
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none h-full",
        className
      )}
    >
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]">
        DRep Participation
      </h3>

      {!hasData ? (
        <p className="text-sm text-muted-foreground">No active proposals</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
          >
            <XAxis
              dataKey="range"
              tick={{ fontSize: 11, fill: isDark ? "#0bd1a2" : "#6b7280" }}
              axisLine={{ stroke: isDark ? "#0bd1a2" : "#e5e7eb" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: isDark ? "#0bd1a2" : "#6b7280" }}
              axisLine={{ stroke: isDark ? "#0bd1a2" : "#e5e7eb" }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
                border: isDark ? "1px solid #0bd1a2" : "1px solid #e5e7eb",
                borderRadius: isDark ? "0" : "8px",
                color: isDark ? "#0bd1a2" : "#1f2937",
              }}
              formatter={(value) => [`${value} proposals`]}
              labelFormatter={(label) => `Participation: ${label}`}
            />
            <Bar dataKey="count" radius={isDark ? 0 : [4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
