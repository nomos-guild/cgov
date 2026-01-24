import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import { getChartColors, chartCardClassName, chartCardGameClassName } from "../chartTheme";

export function NCLProgressChart({ isLoading, className }: ChartProps) {
  const { nclDataList } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

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

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  const hasData = ncl2025Data || ncl2026Data;

  return (
    <div
      className={cn(
        chartCardClassName,
        isGame && chartCardGameClassName,
        className
      )}
    >
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]" style={isGame ? { color: chartColors.tooltipText } : undefined}>
        NCL Progress
      </h3>

      {!hasData ? (
        <p className="text-sm text-muted-foreground">No NCL data available</p>
      ) : (
        <div className="flex-1 flex flex-col justify-center space-y-6">
          {ncl2025Data && (
            <NCLYearProgress ncl={ncl2025Data} chartColors={chartColors} isGame={isGame} formatToMillions={formatToMillions} />
          )}
          {ncl2026Data && (
            <NCLYearProgress ncl={ncl2026Data} chartColors={chartColors} isGame={isGame} formatToMillions={formatToMillions} />
          )}
        </div>
      )}
    </div>
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
}

function NCLYearProgress({ ncl, chartColors, isGame, formatToMillions }: NCLYearProgressProps) {
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
        className={cn(
          "h-2 rounded-full bg-secondary dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:rounded-none",
          isGame && "bg-transparent border border-white/30 rounded-none"
        )}
        indicatorClassName={isGame ? "bg-white" : chartColors.primary}
      />
    </div>
  );
}
