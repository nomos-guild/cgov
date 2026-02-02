import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useChartColors } from "./ChartColorsContext";
import { chartCardClassName, chartCardGameClassName } from "./chartTheme";

interface ChartCardProps {
  chartId: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}

export function ChartCard({
  chartId,
  title,
  children,
  className,
  headerRight,
}: ChartCardProps) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const { getColor } = useChartColors();

  // Get card background color - use special key "_cardBg"
  const cardBgColor = getColor(chartId, "_cardBg", "");

  // Get custom text color - use special key "_textColor"
  const customTextColor = getColor(chartId, "_textColor", "");

  // Determine title color based on theme or custom color
  const getTitleStyle = (): React.CSSProperties | undefined => {
    if (customTextColor) {
      return { color: customTextColor };
    }
    if (isGame) {
      return { color: "#ffffff" };
    }
    return undefined;
  };

  return (
    <div
      className={cn(
        chartCardClassName,
        isGame && chartCardGameClassName,
        "relative",
        className
      )}
      style={cardBgColor ? { backgroundColor: cardBgColor } : undefined}
    >
      {/* Header with title and controls */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-semibold dark:text-[#0bd1a2]"
          style={getTitleStyle()}
        >
          {title}
        </h3>
        {headerRight && (
          <div className="flex items-center gap-2">
            {headerRight}
          </div>
        )}
      </div>

      {/* Chart content */}
      {children}
    </div>
  );
}
