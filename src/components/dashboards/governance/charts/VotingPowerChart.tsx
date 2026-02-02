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
  Legend,
} from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import { getChartColors, ChartTooltip, chartCardClassName, chartCardGameClassName } from "@/components/dashboards/shared/chartTheme";

export function VotingPowerChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const data = useMemo(() => {
    // Aggregate voting power across all active actions
    const activeActions = actions.filter((a) => a.status === "Active");

    if (activeActions.length === 0) {
      return [];
    }

    // Sum up voting power for DRep and SPO
    let drepYes = 0, drepNo = 0, drepAbstain = 0;
    let spoYes = 0, spoNo = 0, spoAbstain = 0;

    activeActions.forEach((action) => {
      drepYes += action.drepYesAda || 0;
      drepNo += action.drepNoAda || 0;
      drepAbstain += action.drepAbstainAda || 0;
      spoYes += action.spoYesAda || 0;
      spoNo += action.spoNoAda || 0;
      spoAbstain += action.spoAbstainAda || 0;
    });

    // Normalize to percentages per voter type
    const drepTotal = drepYes + drepNo + drepAbstain;
    const spoTotal = spoYes + spoNo + spoAbstain;

    return [
      {
        name: "DRep",
        yes: drepTotal > 0 ? (drepYes / drepTotal) * 100 : 0,
        no: drepTotal > 0 ? (drepNo / drepTotal) * 100 : 0,
        abstain: drepTotal > 0 ? (drepAbstain / drepTotal) * 100 : 0,
      },
      {
        name: "SPO",
        yes: spoTotal > 0 ? (spoYes / spoTotal) * 100 : 0,
        no: spoTotal > 0 ? (spoNo / spoTotal) * 100 : 0,
        abstain: spoTotal > 0 ? (spoAbstain / spoTotal) * 100 : 0,
      },
    ];
  }, [actions]);

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  const hasData = data.length > 0 && data.some((d) => d.yes > 0 || d.no > 0 || d.abstain > 0);

  return (
    <div
      className={cn(
        chartCardClassName,
        isGame && chartCardGameClassName,
        className
      )}
    >
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]" style={isGame ? { color: chartColors.tooltipText } : undefined}>
        Voting Power Distribution
      </h3>

      {!hasData ? (
        <p className="text-sm text-muted-foreground">No active proposals with votes</p>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 5, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: chartColors.axisText }}
              axisLine={{ stroke: chartColors.axisLine }}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: chartColors.axisText }}
              axisLine={{ stroke: chartColors.axisLine }}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={
                <ChartTooltip
                  themeId={activeTheme.id}
                  valueFormatter={(value) => `${Number(value).toFixed(1)}%`}
                />
              }
            />
            <Legend
              wrapperStyle={{
                fontSize: "11px",
                color: chartColors.axisText,
              }}
            />
            <Bar
              dataKey="yes"
              name="Yes"
              stackId="a"
              fill={chartColors.yes}
              radius={0}
            />
            <Bar
              dataKey="no"
              name="No"
              stackId="a"
              fill={chartColors.no}
              radius={0}
            />
            <Bar
              dataKey="abstain"
              name="Abstain"
              stackId="a"
              fill={chartColors.abstain}
              radius={0}
            />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
