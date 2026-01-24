import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import { getChartColors, chartCardClassName, chartCardGameClassName } from "../chartTheme";

/**
 * Convert a Cardano epoch number to an approximate Date.
 * Shelley era started at epoch 208 on July 29, 2020.
 * Each epoch is exactly 5 days (432,000 slots at 1 slot/second).
 */
function epochToDate(epoch: number): Date {
  const SHELLEY_START_EPOCH = 208;
  const SHELLEY_START_DATE = new Date("2020-07-29T21:44:51Z");
  const EPOCH_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days in ms

  const epochsSinceShelley = epoch - SHELLEY_START_EPOCH;
  return new Date(
    SHELLEY_START_DATE.getTime() + epochsSinceShelley * EPOCH_DURATION_MS
  );
}

/**
 * Format a Date to "MMM YYYY" (e.g., "Jan 2024")
 */
function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Get a month key for grouping (YYYY-MM format)
 */
function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

interface MonthlyData {
  monthKey: string;
  label: string;
  count: number;
  date: Date;
}

export function ProposalSubmissionChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const data = useMemo(() => {
    if (actions.length === 0) {
      return [];
    }

    // Group proposals by month
    const monthlySubmissions = new Map<string, number>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    actions.forEach((action) => {
      if (action.submissionEpoch) {
        const date = epochToDate(action.submissionEpoch);
        const monthKey = getMonthKey(date);

        monthlySubmissions.set(
          monthKey,
          (monthlySubmissions.get(monthKey) || 0) + 1
        );

        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
      }
    });

    if (!minDate || !maxDate) {
      return [];
    }

    // Fill in gaps for months with no submissions
    const result: MonthlyData[] = [];
    const startDate = minDate as Date;
    const endDate = maxDate as Date;
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= end) {
      const monthKey = getMonthKey(current);
      result.push({
        monthKey,
        label: formatMonthYear(current),
        count: monthlySubmissions.get(monthKey) || 0,
        date: new Date(current),
      });
      current.setMonth(current.getMonth() + 1);
    }

    return result;
  }, [actions]);

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  const hasData = data.length > 0;
  const totalProposals = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div
      className={cn(
        chartCardClassName,
        isGame && chartCardGameClassName,
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold dark:text-[#0bd1a2]" style={isGame ? { color: chartColors.tooltipText } : undefined}>
          Proposal Submission
        </h3>
        {hasData && (
          <span className="text-xs text-muted-foreground" style={isGame ? { color: chartColors.axisText } : undefined}>
            {totalProposals} total proposals
          </span>
        )}
      </div>

      {!hasData ? (
        <p className="text-sm text-muted-foreground">No proposal data available</p>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: chartColors.axisText }}
                axisLine={{ stroke: chartColors.axisLine }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={50}
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
                formatter={(value) => [`${value} proposals`, "Submitted"]}
                labelFormatter={(label) => label}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={chartColors.primary}
                strokeWidth={2}
                dot={{
                  fill: chartColors.primary,
                  strokeWidth: 0,
                  r: 3,
                }}
                activeDot={{
                  fill: chartColors.primary,
                  strokeWidth: 0,
                  r: 5,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
