import { useMemo, useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import { getChartColors, ChartTooltip } from "@/components/dashboards/shared/chartTheme";
import { useChartColors } from "@/components/dashboards/shared/ChartColorsContext";
import { ChartCard } from "@/components/dashboards/shared/ChartCard";
import { useDashboard } from "@/components/dashboards/shared/DashboardProvider";

const CHART_ID = "proposal-type";

const TYPE_LABELS: Record<string, string> = {
  InfoAction: "Info",
  HardForkInitiation: "Hard Fork",
  ParameterChange: "Parameter",
  NoConfidence: "No Confidence",
  UpdateCommittee: "Committee",
  NewConstitution: "Constitution",
  Treasury: "Treasury",
};

export function ProposalTypeChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const { getColor } = useChartColors();
  const { setColorPickerTarget } = useDashboard();

  const data = useMemo(() => {
    const typeCounts: Record<string, number> = {};

    actions.forEach((action) => {
      const type = action.type || "Unknown";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return Object.entries(typeCounts)
      .map(([type, count], index) => ({
        type,
        label: TYPE_LABELS[type] || type,
        count,
        defaultFill: chartColors.palette[index % chartColors.palette.length],
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [actions, chartColors.palette]);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.count, 0), [data]);

  const handleCellClick = useCallback(
    (entry: typeof data[0]) => {
      setColorPickerTarget({
        chartId: CHART_ID,
        chartTitle: "Proposal Types",
        elementKey: entry.type,
        elementLabel: entry.label,
      });
    },
    [setColorPickerTarget]
  );

  const handleLegendClick = useCallback(
    (type: string, label: string) => {
      setColorPickerTarget({
        chartId: CHART_ID,
        chartTitle: "Proposal Types",
        elementKey: type,
        elementLabel: label,
      });
    },
    [setColorPickerTarget]
  );

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <ChartCard chartId={CHART_ID} title="Proposal Types" className={className}>
      <div className="flex-1 min-h-0" style={{ maxHeight: "55%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <filter id="sliceShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
              </filter>
            </defs>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="35%"
              outerRadius="70%"
              paddingAngle={3}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getColor(CHART_ID, entry.type, "#ffffff")}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth={1}
                  style={{ filter: "url(#sliceShadow)", cursor: "pointer" }}
                  onClick={() => handleCellClick(entry)}
                />
              ))}
            </Pie>
            <Tooltip
              content={<ChartTooltip themeId={activeTheme.id} />}
              isAnimationActive={false}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Table Legend */}
      <div className="mt-2 overflow-auto" style={{ maxHeight: "45%" }}>
        <table className="w-full text-xs" style={{ color: chartColors.axisText }}>
          <thead>
            <tr className="border-b border-current/20">
              <th className="text-left py-1 font-medium">Type</th>
              <th className="text-right py-1 font-medium w-16">Count</th>
              <th className="text-right py-1 font-medium w-14">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.type} className="border-b border-current/10 last:border-0">
                <td className="py-1 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                    style={{ backgroundColor: getColor(CHART_ID, item.type, item.defaultFill) }}
                    onClick={() => handleLegendClick(item.type, item.label)}
                    title="Click to change color"
                  />
                  <span className="truncate">{item.label}</span>
                </td>
                <td className="text-right py-1 tabular-nums">{item.count}</td>
                <td className="text-right py-1 tabular-nums">
                  {total > 0 ? ((item.count / total) * 100).toFixed(0) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
