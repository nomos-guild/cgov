import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import { chartCardClassName, chartCardGameClassName } from "@/components/dashboards/shared/chartTheme";
import type { ChartProps } from "@/types/dashboard";
import { InfoTooltip } from "./InfoTooltip";
import { TrendIndicator } from "./TrendIndicator";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function EcosystemKPICards({ isLoading, className }: ChartProps) {
  const overview = useAppSelector((state) => state.development.overview);
  const health = useAppSelector((state) => state.development.health);
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  const kpis = useMemo(() => {
    if (!overview) return [];
    return [
      { label: "Active Repos", value: formatNumber(overview.activeRepos), raw: overview.activeRepos, prev: overview.previous?.activeRepos, metricKey: "activeRepos" },
      { label: "Contributors", value: formatNumber(overview.totalContributors), raw: overview.totalContributors, prev: overview.previous?.totalContributors, metricKey: "contributors" },
      { label: "Commits", value: formatNumber(overview.totalCommits), raw: overview.totalCommits, prev: overview.previous?.totalCommits, metricKey: "commits" },
      { label: "Pull Requests", value: formatNumber(overview.totalPRs), raw: overview.totalPRs, prev: overview.previous?.totalPRs, metricKey: "pullRequests" },
      { label: "Avg Merge Time", value: overview.avgMergeTimeHours != null ? `${overview.avgMergeTimeHours.toFixed(1)}h` : "N/A", raw: overview.avgMergeTimeHours ?? 0, prev: overview.previous?.avgMergeTimeHours ?? undefined, metricKey: "kpiAvgMergeTime" },
      { label: "Releases", value: health?.releaseCadence != null ? formatNumber(health.releaseCadence) : "N/A", raw: health?.releaseCadence ?? 0, prev: undefined, metricKey: "kpiReleases" },
      { label: "Growth Rate", value: health?.ecosystemGrowthRate != null ? `${(health.ecosystemGrowthRate * 100).toFixed(1)}%` : "N/A", raw: health?.ecosystemGrowthRate ?? 0, prev: undefined, metricKey: "growthRate" },
    ];
  }, [overview, health]);

  if (isLoading) return <ChartSkeleton className={className} />;

  return (
    <div className={cn(chartCardClassName, isGame && chartCardGameClassName, "h-full flex flex-col justify-center", className)}>
      <h3 className="text-sm font-semibold mb-3 dark:text-[#0bd1a2]">Ecosystem Overview</h3>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
        {kpis.map((kpi) => (
          <InfoTooltip key={kpi.label} metricKey={kpi.metricKey}>
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-bold dark:text-[#0bd1a2]">{kpi.value}</span>
              <span className="text-xs text-muted-foreground mt-1">{kpi.label}</span>
              <TrendIndicator current={kpi.raw} previous={kpi.prev} />
            </div>
          </InfoTooltip>
        ))}
      </div>
    </div>
  );
}
