import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { SafeResponsiveContainer as ResponsiveContainer } from "@/components/ui/safe-responsive-container";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import {
  getChartColors, chartCardClassName, chartCardGameClassName,
} from "@/components/dashboards/shared/chartTheme";
import type { ChartProps } from "@/types/dashboard";
import { BarChart3 } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";

export function StarForkTrendsChart({ isLoading, className }: ChartProps) {
  const stars = useAppSelector((state) => state.development.stars);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const data = useMemo(() => {
    if (!stars?.data) return [];
    return stars.data.map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      Stars: d.totalStars,
      Forks: d.totalForks,
    }));
  }, [stars]);

  const yDomains = useMemo(() => {
    if (!data.length) return { stars: [0, 1] as [number, number], forks: [0, 1] as [number, number] };
    const starsVals = data.map((d) => d.Stars);
    const forksVals = data.map((d) => d.Forks);
    const makeDomain = (vals: number[], position: "upper" | "lower"): [number, number] => {
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || max * 0.05;
      if (position === "upper") {
        return [Math.max(0, Math.floor(min - range * 1.5)), Math.ceil(max + range * 0.3)];
      }
      return [Math.max(0, Math.floor(min - range * 0.3)), Math.ceil(max + range * 1.5)];
    };
    return { stars: makeDomain(starsVals, "upper"), forks: makeDomain(forksVals, "lower") };
  }, [data]);

  const paretoStat = useMemo(() => {
    if (!stars?.topReposByStars?.length) return null;
    const totalShare = stars.topReposByStars.reduce((sum, r) => sum + r.share, 0);
    return Math.round(totalShare * 100);
  }, [stars]);

  if (isLoading) return <ChartSkeleton className={className} />;

  return (
    <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]">Star & Fork Trends</h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridLine} />
            <XAxis dataKey="date" tick={{ fill: chartColors.axisText, fontSize: 11 }} stroke={chartColors.axisLine} />
            <YAxis yAxisId="left" domain={yDomains.stars} tick={{ fill: chartColors.axisText, fontSize: 11 }} stroke={chartColors.axisLine} />
            <YAxis yAxisId="right" orientation="right" domain={yDomains.forks} tick={{ fill: chartColors.axisText, fontSize: 11 }} stroke={chartColors.axisLine} />
            <Tooltip
              contentStyle={{
                backgroundColor: chartColors.tooltipBg,
                border: `1px solid ${chartColors.tooltipBorder}`,
                color: chartColors.tooltipText,
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="left" type="monotone" dataKey="Stars" stroke={chartColors.palette[0]} strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="Forks" stroke={chartColors.palette[2]} strokeWidth={2} dot={false} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {paretoStat !== null && (
        <InfoTooltip metricKey="starConcentration">
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <BarChart3 className="w-3 h-3" />
            <span>Top {stars!.topReposByStars.length} repos hold <strong className="dark:text-[#0bd1a2]">{paretoStat}%</strong> of all stars</span>
          </div>
        </InfoTooltip>
      )}
    </div>
  );
}
