import { useState, useMemo, useCallback } from "react";
import { useTheme } from "@/lib/theme";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import { getChartColors, ChartTooltip } from "@/components/dashboards/shared/chartTheme";
import { useChartColors } from "@/components/dashboards/shared/ChartColorsContext";
import { ChartCard } from "@/components/dashboards/shared/ChartCard";
import { useDashboard } from "@/components/dashboards/shared/DashboardProvider";
import { useDRepList, useDRepStats } from "@/hooks/useDRepData";
import type { DRepSummary } from "@/types/drep";

const CHART_ID = "drep-voting-power";

type TopN = 10 | 20 | 50;
const TOP_OPTIONS: TopN[] = [10, 20, 50];

interface SliceData {
  name: string;
  value: number;
  key: string;
  defaultFill: string;
  [key: string]: string | number;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K`;
  return ada.toFixed(0);
}

function drepLabel(drep: DRepSummary): string {
  if (drep.name) return drep.name;
  return `${drep.drepId.slice(0, 8)}…${drep.drepId.slice(-4)}`;
}

export function DRepVotingPowerChart({ isLoading, className }: ChartProps) {
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const { getColor } = useChartColors();
  const { setColorPickerTarget } = useDashboard();

  const [topN, setTopN] = useState<TopN>(10);

  // Use existing SWR hooks that properly transform string→number
  const { dreps, isLoading: drepsLoading, error: drepsError } = useDRepList({
    pageSize: 50,
    sortBy: "votingPower",
    sortOrder: "desc",
  });
  const { stats, isLoading: statsLoading, error: statsError } = useDRepStats();

  const loading = drepsLoading || statsLoading;
  const error = drepsError || statsError;
  const totalDelegatedAda = stats?.totalDelegatedAda ?? 0;

  const data = useMemo<SliceData[]>(() => {
    if (!dreps.length) return [];

    const topDreps: DRepSummary[] = dreps.slice(0, topN);
    const topTotal = topDreps.reduce((sum, d) => sum + d.votingPowerAda, 0);
    const restAda = Math.max(0, totalDelegatedAda - topTotal);

    const slices: SliceData[] = topDreps.map((drep, i) => ({
      name: drepLabel(drep),
      value: drep.votingPowerAda,
      key: `drep-${i}`,
      defaultFill: chartColors.palette[i % chartColors.palette.length],
    }));

    if (restAda > 0) {
      slices.push({
        name: "Others",
        value: restAda,
        key: "others",
        defaultFill: chartColors.axisLine,
      });
    }

    return slices;
  }, [dreps, topN, totalDelegatedAda, chartColors.palette, chartColors.axisLine]);

  const total = useMemo(
    () => data.reduce((sum, d) => sum + d.value, 0),
    [data]
  );

  const topPercent = useMemo(() => {
    if (total <= 0) return 0;
    const topSum = data
      .filter((d) => d.key !== "others")
      .reduce((sum, d) => sum + d.value, 0);
    return (topSum / total) * 100;
  }, [data, total]);

  const handleCellClick = useCallback(
    (entry: SliceData) => {
      setColorPickerTarget({
        chartId: CHART_ID,
        chartTitle: "DRep Voting Power",
        elementKey: entry.key,
        elementLabel: entry.name,
      });
    },
    [setColorPickerTarget]
  );

  const handleLegendClick = useCallback(
    (key: string, label: string) => {
      setColorPickerTarget({
        chartId: CHART_ID,
        chartTitle: "DRep Voting Power",
        elementKey: key,
        elementLabel: label,
      });
    },
    [setColorPickerTarget]
  );

  if (isLoading || loading) {
    return <ChartSkeleton className={className} />;
  }

  if (error) {
    return (
      <ChartCard chartId={CHART_ID} title="DRep Voting Power" className={className}>
        <div className="flex items-center justify-center h-full text-sm text-red-500">
          {error}
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      chartId={CHART_ID}
      title="DRep Voting Power"
      className={className}
    >
      <div className="flex items-center gap-1 -mt-2 mb-2">
        {TOP_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setTopN(n)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              topN === n
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Top {n}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0" style={{ maxHeight: "50%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <filter id="drepSliceShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
              </filter>
            </defs>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="35%"
              outerRadius="70%"
              paddingAngle={2}
              animationDuration={500}
              animationEasing="ease-in-out"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={getColor(CHART_ID, entry.key, "#ffffff")}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth={1}
                  style={{ filter: "url(#drepSliceShadow)", cursor: "pointer" }}
                  onClick={() => handleCellClick(entry)}
                />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  themeId={activeTheme.id}
                  valueFormatter={(v) => `${formatAda(v)} ADA`}
                />
              }
              isAnimationActive={false}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Power split indicator */}
      <div className="mt-2 mb-1 text-xs" style={{ color: chartColors.axisText }}>
        <div className="flex justify-between mb-1">
          <span>Top {topN}: {topPercent.toFixed(1)}%</span>
          <span>Others: {(100 - topPercent).toFixed(1)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden bg-muted/40">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${topPercent}%` }}
          />
        </div>
      </div>

      {/* Table Legend */}
      <div className="mt-1 scrollbar-on-hover" style={{ maxHeight: "40%" }}>
        <table className="w-full text-xs table-fixed" style={{ color: chartColors.axisText }}>
          <colgroup>
            <col />
            <col className="w-16" />
            <col className="w-12" />
          </colgroup>
          <thead>
            <tr className="border-b border-current/20">
              <th className="text-left py-1 font-medium">DRep</th>
              <th className="text-right py-1 font-medium">Power</th>
              <th className="text-right py-1 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.key} className="border-b border-current/10 last:border-0">
                <td className="py-1 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                    style={{ backgroundColor: getColor(CHART_ID, item.key, item.defaultFill) }}
                    onClick={() => handleLegendClick(item.key, item.name)}
                    title="Click to change color"
                  />
                  <span className="truncate">{item.name}</span>
                </td>
                <td className="text-right py-1 tabular-nums truncate">
                  {formatAda(item.value)}
                </td>
                <td className="text-right py-1 tabular-nums">
                  {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
