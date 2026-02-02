import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import { getChartColors, ChartTooltip, chartCardClassName, chartCardGameClassName } from "@/components/dashboards/shared/chartTheme";

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
  const isGame = activeTheme.id === "game";

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
        fill: chartColors.palette[index % chartColors.palette.length],
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [actions, chartColors.palette]);

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        chartCardClassName,
        isGame && chartCardGameClassName,
        className
      )}
    >
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]" style={isGame ? { color: chartColors.tooltipText } : undefined}>
        Proposal Types
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="45%"
              innerRadius="30%"
              outerRadius="55%"
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.fill}
                  stroke={chartColors.tooltipBg}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip themeId={activeTheme.id} />} />
            <Legend
              wrapperStyle={{
                fontSize: "11px",
                color: chartColors.axisText,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
