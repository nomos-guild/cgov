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

const CHART_ID = "proposal-status";

interface StatusDataItem {
  status: string;
  count: number;
  defaultFill: string;
}

export function ProposalStatusChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const { getColor } = useChartColors();
  const { setColorPickerTarget } = useDashboard();

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

    return Object.entries(statusCounts)
      .map(([status, count]) => ({
        status,
        count,
        defaultFill: statusToColor[status],
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [actions, chartColors]);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.count, 0), [data]);

  const handleCellClick = useCallback(
    (entry: StatusDataItem) => {
      setColorPickerTarget({
        chartId: CHART_ID,
        chartTitle: "Proposal Status",
        elementKey: entry.status,
        elementLabel: entry.status,
      });
    },
    [setColorPickerTarget]
  );

  const handleLegendClick = useCallback(
    (status: string) => {
      setColorPickerTarget({
        chartId: CHART_ID,
        chartTitle: "Proposal Status",
        elementKey: status,
        elementLabel: status,
      });
    },
    [setColorPickerTarget]
  );

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <ChartCard chartId={CHART_ID} title="Proposal Status" className={className}>
      <div className="flex-1 min-h-0" style={{ maxHeight: "55%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <filter id="statusSliceShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
              </filter>
            </defs>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius="35%"
              outerRadius="70%"
              paddingAngle={3}
              animationDuration={500}
              animationEasing="ease-in-out"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getColor(CHART_ID, entry.status, "#ffffff")}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth={1}
                  style={{ filter: "url(#statusSliceShadow)", cursor: "pointer" }}
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
              <th className="text-left py-1 font-medium">Status</th>
              <th className="text-right py-1 font-medium w-16">Count</th>
              <th className="text-right py-1 font-medium w-14">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.status} className="border-b border-current/10 last:border-0">
                <td className="py-1 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                    style={{ backgroundColor: getColor(CHART_ID, item.status, item.defaultFill) }}
                    onClick={() => handleLegendClick(item.status)}
                    title="Click to change color"
                  />
                  <span className="truncate">{item.status}</span>
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
