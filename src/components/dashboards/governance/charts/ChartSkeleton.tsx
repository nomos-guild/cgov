import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { chartCardClassName, chartCardGameClassName } from "@/components/dashboards/shared/chartTheme";

interface ChartSkeletonProps {
  className?: string;
}

export function ChartSkeleton({ className }: ChartSkeletonProps) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  return (
    <div
      className={cn(
        chartCardClassName,
        isGame && chartCardGameClassName,
        className
      )}
    >
      <div className="animate-pulse">
        <div className={cn(
          "h-5 w-32 bg-muted rounded mb-4",
          isGame && "bg-white/10"
        )} />
        <div className={cn(
          "h-[200px] bg-muted rounded",
          isGame && "bg-white/10"
        )} />
      </div>
    </div>
  );
}
