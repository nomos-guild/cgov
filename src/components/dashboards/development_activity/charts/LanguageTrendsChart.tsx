import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { SafeResponsiveContainer as ResponsiveContainer } from "@/components/ui/safe-responsive-container";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import {
  getChartColors, chartCardClassName, chartCardGameClassName,
} from "@/components/dashboards/shared/chartTheme";
import type { ChartProps } from "@/types/dashboard";

export function LanguageTrendsChart({ isLoading, className }: ChartProps) {
  const languages = useAppSelector((state) => state.development.languages);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const data = useMemo(() => {
    if (!languages?.languages) return [];
    const prevMap = new Map(
      (languages.previous ?? []).map((p) => [p.language, p.repoCount])
    );
    return languages.languages
      .slice(0, 12)
      .map((l) => {
        const prev = prevMap.get(l.language);
        return {
          language: l.language,
          repos: l.repoCount,
          commits: l.totalCommits,
          stars: l.totalStars,
          delta: prev != null ? l.repoCount - prev : null,
        };
      });
  }, [languages]);

  if (isLoading) return <ChartSkeleton className={className} />;

  return (
    <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]">Language Distribution</h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridLine} />
            <XAxis
              dataKey="language"
              tick={{ fill: chartColors.axisText, fontSize: 10, dy: 8 }}
              stroke={chartColors.axisLine}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fill: chartColors.axisText, fontSize: 11 }} stroke={chartColors.axisLine} />
            <Tooltip
              contentStyle={{
                backgroundColor: chartColors.tooltipBg,
                border: `1px solid ${chartColors.tooltipBorder}`,
                color: chartColors.tooltipText,
                borderRadius: 8,
                fontSize: 12,
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, _name: any, props: any) => {
                const d = props.payload;
                const deltaStr = d?.delta != null
                  ? ` (${d.delta > 0 ? "+" : ""}${d.delta} YoY)`
                  : "";
                return [
                  `${value} repos${deltaStr} | ${d?.commits ?? 0} commits | ${d?.stars ?? 0} stars`,
                  "Language",
                ];
              }}
            />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Bar dataKey="repos" radius={[4, 4, 0, 0]} label={(props: any) => {
              const { x, y, width, index } = props as { x: number; y: number; width: number; index: number };
              const d = data[index];
              if (d?.delta == null || d.delta === 0) return <text />;
              const color = d.delta > 0 ? "#22c55e" : "#ef4444";
              const text = d.delta > 0 ? `+${d.delta}` : `${d.delta}`;
              return (
                <text x={x + width / 2} y={y - 4} fill={color} fontSize={9} fontWeight={600} textAnchor="middle">
                  {text}
                </text>
              );
            }}>
              {data.map((_, i) => (
                <Cell key={i} fill={chartColors.palette[i % chartColors.palette.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
