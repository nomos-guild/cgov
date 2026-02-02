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
} from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import { getChartColors, ChartTooltip } from "@/components/dashboards/shared/chartTheme";
import { useChartColors } from "@/components/dashboards/shared/ChartColorsContext";
import { ChartCard } from "@/components/dashboards/shared/ChartCard";
import { useDashboard } from "@/components/dashboards/shared/DashboardProvider";

const CHART_ID = "voting-power";

export function VotingPowerChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const { getColor } = useChartColors();
  const { setColorPickerTarget } = useDashboard();

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

  const handleLegendClick = useCallback(
    (voteType: string) => {
      const labels: Record<string, string> = {
        yes: "Yes votes",
        no: "No votes",
        abstain: "Abstain votes",
      };
      setColorPickerTarget({
        chartId: CHART_ID,
        chartTitle: "Voting Power Distribution",
        elementKey: voteType,
        elementLabel: labels[voteType] || voteType,
      });
    },
    [setColorPickerTarget]
  );

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  const hasData = data.length > 0 && data.some((d) => d.yes > 0 || d.no > 0 || d.abstain > 0);

  // Custom legend with clickable items
  const renderLegend = () => (
    <div className="flex justify-center gap-4 mt-2 text-xs" style={{ color: chartColors.axisText }}>
      {[
        { key: "yes", label: "Yes", default: "#ffffff" },
        { key: "no", label: "No", default: "#f0f0f0" },
        { key: "abstain", label: "Abstain", default: "#e0e0e0" },
      ].map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
          onClick={() => handleLegendClick(item.key)}
          title="Click to change color"
        >
          <span
            className="w-3 h-3 rounded-sm border border-gray-300"
            style={{ backgroundColor: getColor(CHART_ID, item.key, item.default) }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <ChartCard chartId={CHART_ID} title="Voting Power Distribution" className={className}>
      {!hasData ? (
        <p className="text-sm text-muted-foreground">No active proposals with votes</p>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 5, left: 10, bottom: 5 }}
              >
                <defs>
                  <filter id="votingBarShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
                  </filter>
                </defs>
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
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="yes"
                  name="Yes"
                  stackId="a"
                  fill={getColor(CHART_ID, "yes", "#ffffff")}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth={1}
                  radius={0}
                  style={{ filter: "url(#votingBarShadow)" }}
                />
                <Bar
                  dataKey="no"
                  name="No"
                  stackId="a"
                  fill={getColor(CHART_ID, "no", "#f0f0f0")}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth={1}
                  radius={0}
                />
                <Bar
                  dataKey="abstain"
                  name="Abstain"
                  stackId="a"
                  fill={getColor(CHART_ID, "abstain", "#e0e0e0")}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth={1}
                  radius={0}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {renderLegend()}
        </div>
      )}
    </ChartCard>
  );
}
