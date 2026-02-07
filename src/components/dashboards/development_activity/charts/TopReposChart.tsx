import { useMemo, useState, useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import {
  getChartColors, chartCardClassName, chartCardGameClassName,
} from "@/components/dashboards/shared/chartTheme";
import type { ChartProps } from "@/types/dashboard";
import type { DevelopmentRepos } from "@/types/development";
import { Star, TrendingUp } from "lucide-react";
import { API_ENDPOINTS } from "@/config/api";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SortMode = "active" | "trending";

export function TopReposChart({ isLoading, className }: ChartProps) {
  const [sortMode, setSortMode] = useState<SortMode>("active");
  const repos = useAppSelector((state) => state.development.repos);
  const range = useAppSelector((state) => state.development.selectedRange);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const { data: trendingData } = useSWR<DevelopmentRepos>(
    sortMode === "trending" ? API_ENDPOINTS.devRepos(range, "trending") : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const source = sortMode === "trending" ? trendingData : repos;

  const data = useMemo(() => {
    if (!source?.repos) return [];
    return source.repos.slice(0, 10).map((r) => ({
      name: r.name.length > 20 ? `${r.name.slice(0, 18)}...` : r.name,
      fullName: `${r.owner}/${r.name}`,
      commits: r.recentCommits,
      stars: r.stars,
      starGain: r.starGain ?? 0,
    }));
  }, [source]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = useCallback((data: any) => {
    const name = data?.fullName ?? data?.payload?.fullName;
    if (name) window.open(`https://github.com/${name}`, "_blank", "noopener,noreferrer");
  }, []);

  if (isLoading) return <ChartSkeleton className={className} />;

  const barKey = sortMode === "trending" ? "starGain" : "commits";
  const title = sortMode === "trending" ? "Top Repos by Star Gain" : "Top Repos by Commits";

  return (
    <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold dark:text-[#0bd1a2]">{title}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setSortMode("active")}
            className={cn(
              "px-2 py-0.5 text-[10px] rounded transition-colors",
              sortMode === "active"
                ? "bg-primary/10 text-primary dark:bg-[#0bd1a2]/20 dark:text-[#0bd1a2]"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            Most Active
          </button>
          <button
            onClick={() => setSortMode("trending")}
            className={cn(
              "px-2 py-0.5 text-[10px] rounded transition-colors",
              sortMode === "trending"
                ? "bg-primary/10 text-primary dark:bg-[#0bd1a2]/20 dark:text-[#0bd1a2]"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            Trending
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridLine} horizontal={false} />
            <XAxis type="number" tick={{ fill: chartColors.axisText, fontSize: 11 }} stroke={chartColors.axisLine} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: chartColors.axisText, fontSize: 10 }}
              stroke={chartColors.axisLine}
            />
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
                if (sortMode === "trending") {
                  return [`+${value} stars`, props.payload?.fullName ?? ""];
                }
                const stars = props.payload?.stars ?? 0;
                return [`${value} commits | ${stars} stars`, props.payload?.fullName ?? ""];
              }}
            />
            <Bar dataKey={barKey} radius={[0, 4, 4, 0]} cursor="pointer" onClick={handleBarClick}>
              {data.map((_, i) => (
                <Cell key={i} fill={chartColors.palette[i % chartColors.palette.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
        {sortMode === "trending" ? <TrendingUp className="w-3 h-3" /> : <Star className="w-3 h-3" />}
        <span>{source?.total ?? repos?.total ?? 0} total repos tracked</span>
      </div>
    </div>
  );
}
