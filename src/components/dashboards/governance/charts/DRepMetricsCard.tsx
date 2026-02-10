import { useTheme } from "@/lib/theme";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import { getChartColors } from "@/components/dashboards/shared/chartTheme";
import { ChartCard } from "@/components/dashboards/shared/ChartCard";
import { useDRepStats } from "@/hooks/useDRepData";

const CHART_ID = "drep-metrics";

export function DRepMetricsCard({ isLoading, className }: ChartProps) {
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const { stats, isLoading: statsLoading, error } = useDRepStats();

  if (isLoading || statsLoading) {
    return <ChartSkeleton className={className} />;
  }

  if (error) {
    return (
      <ChartCard chartId={CHART_ID} title="DRep Metrics" className={className}>
        <div className="flex items-center justify-center h-full text-sm text-red-500">
          {error}
        </div>
      </ChartCard>
    );
  }

  const totalDelegatedAda = stats?.totalDelegatedAda ?? 0;
  const formatAda = (ada: number): string => {
    if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
    if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
    if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K`;
    return ada.toFixed(0);
  };

  const metrics = [
    { label: "Total DReps", value: (stats?.totalDReps ?? 0).toLocaleString() },
    { label: "Votes Cast", value: (stats?.totalVotesCast ?? 0).toLocaleString() },
    { label: "Total Delegated", value: `${formatAda(totalDelegatedAda)} ADA` },
  ];

  return (
    <ChartCard
      chartId={CHART_ID}
      title="DRep Metrics"
      className={className}
    >
      <div className="flex-1 flex flex-col justify-center gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="px-2">
            <p
              className="text-2xl font-bold tabular-nums"
              style={{ color: chartColors.axisText }}
            >
              {metric.value}
            </p>
            <p className="text-xs text-muted-foreground">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
