import { useMemo, useCallback } from "react";
import { useTheme } from "@/lib/theme";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import { getChartColors, ChartTooltip } from "@/components/dashboards/shared/chartTheme";
import { useChartColors } from "@/components/dashboards/shared/ChartColorsContext";
import { ChartCard } from "@/components/dashboards/shared/ChartCard";
import { useDashboard } from "@/components/dashboards/shared/DashboardProvider";
import { useDRepRationaleStats } from "@/hooks/useDRepData";
import { useState } from "react";

const CHART_ID = "drep-rationale";

type TopN = 10 | 20 | 50 | 0;
const TOP_OPTIONS: { value: TopN; label: string }[] = [
  { value: 10, label: "Top 10" },
  { value: 20, label: "Top 20" },
  { value: 50, label: "Top 50" },
  { value: 0, label: "All" },
];

interface SliceData {
  name: string;
  value: number;
  key: string;
  defaultFill: string;
  [key: string]: string | number;
}

export function DRepRationaleChart({ isLoading, className }: ChartProps) {
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const { getColor } = useChartColors();
  const { setColorPickerTarget } = useDashboard();

  const [topN, setTopN] = useState<TopN>(10);

  // Single API call — server aggregates all DRep details
  const { dreps, isLoading: statsLoading, error } = useDRepRationaleStats();

  // Compute totals for the current selection
  const { totalVotes, totalRationales } = useMemo(() => {
    const selected = topN === 0 ? dreps : dreps.slice(0, topN);
    let votes = 0;
    let rationales = 0;
    for (const d of selected) {
      votes += d.totalVotesCast;
      rationales += d.rationalesProvided;
    }
    return { totalVotes: votes, totalRationales: rationales };
  }, [dreps, topN]);

  const loading = isLoading || statsLoading;

  const withoutRationale = Math.max(0, totalVotes - totalRationales);
  const rationalePercent =
    totalVotes > 0 ? (totalRationales / totalVotes) * 100 : 0;

  const data = useMemo<SliceData[]>(() => {
    if (totalVotes <= 0) return [];
    return [
      {
        name: "With Rationale",
        value: totalRationales,
        key: "with-rationale",
        defaultFill: chartColors.yes,
      },
      {
        name: "Without Rationale",
        value: withoutRationale,
        key: "without-rationale",
        defaultFill: chartColors.axisLine,
      },
    ];
  }, [totalVotes, totalRationales, withoutRationale, chartColors.yes, chartColors.axisLine]);

  const handleCellClick = useCallback(
    (entry: SliceData) => {
      setColorPickerTarget({
        chartId: CHART_ID,
        chartTitle: "DRep Rationales",
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
        chartTitle: "DRep Rationales",
        elementKey: key,
        elementLabel: label,
      });
    },
    [setColorPickerTarget]
  );

  if (loading) {
    return <ChartSkeleton className={className} />;
  }

  if (error) {
    return (
      <ChartCard chartId={CHART_ID} title="DRep Rationales" className={className}>
        <div className="flex items-center justify-center h-full text-sm text-red-500">
          {error}
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      chartId={CHART_ID}
      title="DRep Rationales"
      className={className}
    >
      <div className="flex items-center gap-1 -mt-2 mb-2">
        {TOP_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTopN(opt.value)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              topN === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0" style={{ maxHeight: "50%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <filter id="rationaleSliceShadow" x="-50%" y="-50%" width="200%" height="200%">
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
              paddingAngle={3}
              animationDuration={500}
              animationEasing="ease-in-out"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={getColor(CHART_ID, entry.key, "#ffffff")}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth={1}
                  style={{ filter: "url(#rationaleSliceShadow)", cursor: "pointer" }}
                  onClick={() => handleCellClick(entry)}
                />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  themeId={activeTheme.id}
                  valueFormatter={(v) =>
                    v.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  }
                />
              }
              isAnimationActive={false}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Rationale rate indicator */}
      <div className="mt-2 mb-1 text-xs" style={{ color: chartColors.axisText }}>
        <div className="flex justify-between mb-1">
          <span>With: {rationalePercent.toFixed(1)}%</span>
          <span>Without: {(100 - rationalePercent).toFixed(1)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden bg-muted/40">
          <div
            className="h-full rounded-full bg-primary transition-all duration-normal"
            style={{ width: `${rationalePercent}%` }}
          />
        </div>
      </div>

      {/* Table Legend */}
      <div className="mt-1 scrollbar-on-hover" style={{ maxHeight: "40%" }}>
        <table className="w-full text-xs" style={{ color: chartColors.axisText }}>
          <thead>
            <tr className="border-b border-current/20">
              <th className="text-left py-1 font-medium">Category</th>
              <th className="text-right py-1 font-medium w-16">Count</th>
              <th className="text-right py-1 font-medium w-14">%</th>
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
                <td className="text-right py-1 tabular-nums">
                  {item.value.toLocaleString()}
                </td>
                <td className="text-right py-1 tabular-nums">
                  {totalVotes > 0 ? ((item.value / totalVotes) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
            <tr className="border-t border-current/20">
              <td className="py-1 font-medium">Total Votes</td>
              <td className="text-right py-1 tabular-nums font-medium">
                {totalVotes.toLocaleString()}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
