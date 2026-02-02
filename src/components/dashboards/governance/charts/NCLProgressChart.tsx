import { useMemo, useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import { getChartColors } from "@/components/dashboards/shared/chartTheme";
import { useChartColors } from "@/components/dashboards/shared/ChartColorsContext";
import { ChartCard } from "@/components/dashboards/shared/ChartCard";
import { useDashboard } from "@/components/dashboards/shared/DashboardProvider";

const CHART_ID = "ncl-progress";

export function NCLProgressChart({ isLoading, className }: ChartProps) {
  const { nclDataList } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";
  const { getColor } = useChartColors();
  const { setColorPickerTarget } = useDashboard();

  const ncl2025Data = useMemo(() => {
    return nclDataList.find((ncl) => ncl.year === 2025);
  }, [nclDataList]);

  const ncl2026Data = useMemo(() => {
    return nclDataList.find((ncl) => ncl.year === 2026);
  }, [nclDataList]);

  const formatToMillions = (value: number): string => {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    }
    return `${(value / 1_000_000).toFixed(0)}M`;
  };

  const handleBarClick = useCallback(
    (year: number) => {
      setColorPickerTarget({
        chartId: CHART_ID,
        chartTitle: "NCL Progress",
        elementKey: `ncl${year}`,
        elementLabel: `${year} Progress Bar`,
      });
    },
    [setColorPickerTarget]
  );

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  const hasData = ncl2025Data || ncl2026Data;

  return (
    <ChartCard chartId={CHART_ID} title="NCL Progress" className={className}>
      {!hasData ? (
        <p className="text-sm text-muted-foreground">No NCL data available</p>
      ) : (
        <div className="flex-1 flex flex-col justify-center space-y-6">
          {ncl2025Data && (
            <NCLYearProgress
              ncl={ncl2025Data}
              chartColors={chartColors}
              isGame={isGame}
              formatToMillions={formatToMillions}
              barColor={getColor(CHART_ID, `ncl${ncl2025Data.year}`, "")}
              onBarClick={() => handleBarClick(ncl2025Data.year)}
            />
          )}
          {ncl2026Data && (
            <NCLYearProgress
              ncl={ncl2026Data}
              chartColors={chartColors}
              isGame={isGame}
              formatToMillions={formatToMillions}
              barColor={getColor(CHART_ID, `ncl${ncl2026Data.year}`, "")}
              onBarClick={() => handleBarClick(ncl2026Data.year)}
            />
          )}
        </div>
      )}
    </ChartCard>
  );
}

interface NCLYearProgressProps {
  ncl: {
    year: number;
    currentValueAda: number;
    targetValueAda: number;
    percentUsed?: number;
  };
  chartColors: ReturnType<typeof getChartColors>;
  isGame: boolean;
  formatToMillions: (value: number) => string;
  barColor: string;
  onBarClick: () => void;
}

function NCLYearProgress({ ncl, chartColors, isGame, formatToMillions, barColor, onBarClick }: NCLYearProgressProps) {
  const calculatedPercent =
    ncl.targetValueAda > 0
      ? (ncl.currentValueAda / ncl.targetValueAda) * 100
      : 0;
  const progress = Math.min(ncl.percentUsed || calculatedPercent, 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs text-muted-foreground uppercase tracking-wide dark:text-[#0bd1a2]"
          style={isGame ? { color: chartColors.axisText } : undefined}
        >
          {ncl.year} NCL
        </span>
        <span
          className="text-sm font-semibold dark:text-[#0bd1a2]"
          style={isGame ? { color: chartColors.tooltipText } : undefined}
        >
          {progress.toFixed(1)}%
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className="text-lg font-bold dark:text-[#0bd1a2]"
          style={isGame ? { color: chartColors.tooltipText } : undefined}
        >
          {formatToMillions(ncl.currentValueAda)}
        </span>
        <span
          className="text-sm text-muted-foreground dark:text-[#0bd1a2]"
          style={isGame ? { color: chartColors.axisText } : undefined}
        >
          / {formatToMillions(ncl.targetValueAda)} ADA
        </span>
      </div>
      <Progress
        value={progress}
        onClick={onBarClick}
        className={cn(
          "h-3 rounded-full bg-gray-100 dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:rounded-none cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all",
          isGame && "bg-transparent border border-white/30 rounded-none"
        )}
        indicatorClassName={cn(
          "rounded-full",
          !barColor && "bg-white",
          "shadow-[0_0_6px_rgba(0,0,0,0.3)]"
        )}
        indicatorStyle={barColor ? { backgroundColor: barColor } : undefined}
      />
    </div>
  );
}
