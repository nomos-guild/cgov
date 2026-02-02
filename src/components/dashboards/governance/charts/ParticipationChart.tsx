import { useMemo, useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
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
import { getChartColors, ChartTooltip } from "@/components/dashboards/shared/chartTheme";
import { useChartColors } from "@/components/dashboards/shared/ChartColorsContext";
import { ChartCard } from "@/components/dashboards/shared/ChartCard";
import { useDashboard } from "@/components/dashboards/shared/DashboardProvider";

const CHART_ID = "participation";

interface ParticipationDataItem {
  range: string;
  count: number;
}

export function ParticipationChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const { getColor } = useChartColors();
  const { setColorPickerTarget } = useDashboard();

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

  const handleBarClick = useCallback(
    (entry: ParticipationDataItem) => {
      setColorPickerTarget({
        chartId: CHART_ID,
        chartTitle: "DRep Participation",
        elementKey: entry.range,
        elementLabel: `Participation: ${entry.range}`,
      });
    },
    [setColorPickerTarget]
  );

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  const hasData = data.length > 0 && data.some((d) => d.count > 0);

  return (
    <ChartCard chartId={CHART_ID} title="DRep Participation" className={className}>
      {!hasData ? (
        <p className="text-sm text-muted-foreground">No active proposals</p>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <defs>
                <filter id="participationBarShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
                </filter>
              </defs>
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
                content={
                  <ChartTooltip
                    themeId={activeTheme.id}
                    labelFormatter={(label) => `Participation: ${label}`}
                    valueFormatter={(value) => `${value} proposals`}
                  />
                }
                isAnimationActive={false}
              />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                style={{ filter: "url(#participationBarShadow)" }}
                onClick={(data) => {
                  if (data) {
                    handleBarClick(data as unknown as ParticipationDataItem);
                  }
                }}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getColor(CHART_ID, entry.range, "#ffffff")}
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth={1}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
