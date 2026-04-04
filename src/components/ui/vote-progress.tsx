import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  type TooltipContentProps,
  type PieSectorDataItem,
} from "recharts";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { SEGMENT_COLORS, type VoteSegment } from "@/lib/voteBreakdownCalculator";

interface VoteProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  // Primary interface for DRep/SPO
  segments?: VoteSegment[];
  // Legacy props - CC only (no breakdown data from API)
  yesPercent?: number;
  noPercent?: number;
  abstainPercent?: number;
  pendingPercent?: number;
  yesValue?: number;
  noValue?: number;
  abstainValue?: number;
  pendingValue?: number;
  // Common props
  title?: string;
  titlePosition?: "top" | "center";
  centerText?: string; // Custom text to show in center (overrides title when set)
  valueUnit?: "ada" | "count";
  showTooltip?: boolean;
  animate?: boolean;
  interactive?: boolean;
  showYesPercent?: boolean;
  // Layout props
  fixedWidth?: number; // Fixed width in pixels (for detail pages)
}

type SliceData = {
  name: string;
  value: number;
  type: string;
  displayValue?: number;
  color: string;
};

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export const VoteProgress = React.forwardRef<HTMLDivElement, VoteProgressProps>(
  (
    {
      className,
      segments,
      yesPercent = 0,
      noPercent = 0,
      abstainPercent = 0,
      pendingPercent = 0,
      title,
      titlePosition = "top",
      centerText,
      yesValue,
      noValue,
      abstainValue,
      pendingValue,
      valueUnit,
      showTooltip = true,
      animate = true,
      interactive = true,
      showYesPercent = false,
      fixedWidth,
      style,
      ...props
    },
    ref
  ) => {
    const { theme, activeTheme } = useTheme();
    const isDark = theme === "dark";
    const isGame = activeTheme.id === "game";
    const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

    // Calculate total percent from segments or legacy props
    // For CC (legacy props): if no votes cast but we have pendingValue, show 100% "Not Voted"
    const hasLegacyPendingData = !segments && pendingValue !== undefined && pendingValue > 0;
    const totalPercent = segments
      ? segments.reduce((sum, seg) => sum + seg.percent, 0)
      : yesPercent + noPercent + abstainPercent + pendingPercent || (hasLegacyPendingData ? 100 : 0);

    // Calculate Yes % for center display (from segments or legacy props)
    const calculatedYesPercent = React.useMemo(() => {
      if (segments && segments.length > 0) {
        const yesSegment = segments.find((seg) => seg.type === "yes");
        return yesSegment?.percent ?? 0;
      }
      return yesPercent;
    }, [segments, yesPercent]);

    const data = React.useMemo<SliceData[]>(() => {
      // Use segments if provided (DRep/SPO)
      if (segments && segments.length > 0) {
        return segments
          .filter((seg) => seg.percent > 0)
          .map((seg) => ({
            name: seg.label,
            value: seg.percent,
            type: seg.type,
            displayValue: seg.value,
            color: seg.color,
          }));
      }

      // Legacy fallback for CC only - use SEGMENT_COLORS
      const result: SliceData[] = [];
      if (yesPercent > 0) {
        result.push({
          name: "Yes",
          value: yesPercent,
          type: "yes",
          displayValue: yesValue,
          color: SEGMENT_COLORS.yes,
        });
      }
      if (noPercent > 0) {
        result.push({
          name: "No",
          value: noPercent,
          type: "no",
          displayValue: noValue,
          color: SEGMENT_COLORS.no,
        });
      }
      if (abstainPercent > 0) {
        result.push({
          name: "Abstain",
          value: abstainPercent,
          type: "abstain",
          displayValue: abstainValue,
          color: SEGMENT_COLORS.excluded,
        });
      }
      if (pendingPercent > 0) {
        result.push({
          name: "Not Voted",
          value: pendingPercent,
          type: "pending",
          displayValue: pendingValue,
          color: SEGMENT_COLORS.notVoted,
        });
      }
      // If no votes at all but we have pending members, show 100% "Not Voted"
      if (result.length === 0 && pendingValue !== undefined && pendingValue > 0) {
        result.push({
          name: "Not Voted",
          value: 100,
          type: "pending",
          displayValue: pendingValue,
          color: SEGMENT_COLORS.notVoted,
        });
      }
      return result;
    }, [
      segments,
      yesPercent,
      noPercent,
      abstainPercent,
      pendingPercent,
      yesValue,
      noValue,
      abstainValue,
      pendingValue,
    ]);

    const onPieEnter = React.useCallback(
      (_: PieSectorDataItem, index: number) => {
        if (!interactive) return;
        setActiveIndex(index);
      },
      [interactive]
    );

    const onPieLeave = React.useCallback(() => {
      if (!interactive) return;
      setActiveIndex(null);
    }, [interactive]);

    const getColor = (entry: SliceData, index: number) => {
      if (activeIndex === index) {
        return entry.color;
      }
      // Light theme: full opacity; Dark/Game: 45% opacity for inactive state
      if (!isDark && !isGame) {
        return entry.color;
      }
      return `${entry.color}73`; // 73 is hex for ~45% opacity
    };

    const formatDisplayValue = React.useCallback(
      (value?: number) => {
        if (value === undefined || value === null) return null;
        const formatted =
          Math.abs(value) >= 1000
            ? compactNumberFormatter.format(value)
            : integerFormatter.format(value);

        if (valueUnit === "ada") {
          return `${formatted} ₳`;
        }
        if (valueUnit === "count") {
          return `${formatted} votes`;
        }
        return formatted;
      },
      [valueUnit]
    );

    const renderTooltip = React.useCallback(
      (tooltipProps: TooltipContentProps<number, string>) => {
        const extended = tooltipProps as TooltipContentProps<number, string> & {
          payload?: ReadonlyArray<{ payload: SliceData }>;
        };

        // Only show tooltip if actively hovering (activeIndex is set) and Recharts says it's active
        if (activeIndex === null || !extended.active || !extended.payload?.length) {
          return null;
        }

        const slice = extended.payload[0].payload as SliceData;
        const displayValue = formatDisplayValue(slice.displayValue);

        return (
          <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-md pointer-events-none">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {title || "Votes"}
            </div>
            <div className="font-semibold text-foreground">
              {slice.name}:{" "}
              {displayValue
                ? `${displayValue} • ${slice.value.toFixed(1)}%`
                : `${slice.value.toFixed(1)}%`}
            </div>
          </div>
        );
      },
      [formatDisplayValue, title, activeIndex]
    );

    const cardStyle = React.useMemo<React.CSSProperties>(
      () => ({
        overflow: "visible",
        ...(fixedWidth ? { width: fixedWidth, height: fixedWidth, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } : {}),
        ...style,
      }),
      [style, fixedWidth]
    );

    if (totalPercent === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            "border-white/8 flex flex-col items-center gap-0 border bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] rounded-3xl px-[14px] pt-0 pb-0 sm:gap-2 sm:pt-[12px] sm:pb-[14px] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none",
            className
          )}
          style={cardStyle}
          {...props}
        >
          {title && (
            <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
              {title}
            </span>
          )}
          <div className="flex h-[120px] w-[120px] items-center justify-center">
            <span className="text-xs text-muted-foreground">No data</span>
          </div>
        </div>
      );
    }

    if (isGame) {
      return (
        <div
          ref={ref}
          className={cn("flex flex-col items-center gap-2", className)}
          {...props}
          style={{ ...cardStyle, cursor: 'inherit' }}
        >
          {title && titlePosition === "top" && (
            <span className="whitespace-nowrap text-sm font-medium text-white">
              {title}
            </span>
          )}
          <div
            className="vote-progress-card-game recharts-no-box relative overflow-visible rounded-full"
            style={{ width: 132, height: 132, minWidth: 132, minHeight: 132, cursor: 'inherit' }}
            onMouseLeave={(e) => {
              const relatedTarget = e.relatedTarget;
              const currentTarget = e.currentTarget;
              if (
                !relatedTarget ||
                !(relatedTarget instanceof Node) ||
                !currentTarget.contains(relatedTarget)
              ) {
                onPieLeave();
              }
            }}
          >
            {centerText ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-white" style={{ cursor: 'inherit' }}>
                {centerText}
              </span>
            ) : showYesPercent ? (
              <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-white" style={{ cursor: 'inherit' }}>
                <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">Yes</span>
                <span className="text-lg font-bold leading-tight">{calculatedYesPercent.toFixed(1)}%</span>
              </span>
            ) : title && titlePosition === "center" ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-white" style={{ cursor: 'inherit' }}>
                {title}
              </span>
            ) : null}
            <PieChart
              width={132}
              height={132}
              className="overflow-visible"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
              }}
              margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
              onMouseLeave={onPieLeave}
            >
              {showTooltip && (
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={renderTooltip as any}
                  cursor={false}
                  wrapperClassName="recharts-no-box"
                  wrapperStyle={{ pointerEvents: "none" }}
                  animationDuration={0}
                  isAnimationActive={false}
                />
              )}
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={58}
                paddingAngle={2}
                dataKey="value"
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                stroke="none"
                isAnimationActive={animate}
              >
              {data.map((entry, index) => {
                const baseColor = getColor(entry, index);
                const isAlwaysNoConfidence = entry.type === "alwaysNoConfidence";
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={baseColor}
                    stroke={isAlwaysNoConfidence ? "rgba(156, 163, 175, 0.8)" : "transparent"}
                    strokeWidth={isAlwaysNoConfidence ? 1 : 0}
                    style={{
                      transition: "all 0.2s ease-in-out",
                      transform:
                        interactive && activeIndex === index
                          ? "scale(1.05)"
                          : "scale(1)",
                      transformOrigin: "center",
                    }}
                  />
                );
              })}
              </Pie>
            </PieChart>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "vote-progress-card border-white/8 flex flex-col items-center gap-0 border bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] rounded-3xl px-[14px] pt-0 pb-0 sm:gap-2 sm:pt-[12px] sm:pb-[14px] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none",
          className
        )}
        {...props}
        style={{ ...cardStyle, cursor: 'inherit' }}
      >
        {title && titlePosition === "top" && (
          <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
            {title}
          </span>
        )}
        <div
          className="recharts-no-box relative overflow-visible"
          style={{
            width: 132,
            height: 132,
            minWidth: 132,
            minHeight: 132,
            cursor: 'inherit',
            filter: isDark ? 'none' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15)) drop-shadow(0 -2px 4px rgba(0, 0, 0, 0.08))'
          }}
          onMouseLeave={(e) => {
            // Ensure we're actually leaving the container, not just moving to a child.
            // In some edge cases, relatedTarget may be a non-Node (e.g. window), which
            // would cause Node.contains to throw, so we guard against that here.
            const relatedTarget = e.relatedTarget;
            const currentTarget = e.currentTarget;

            if (
              !relatedTarget ||
              !(relatedTarget instanceof Node) ||
              !currentTarget.contains(relatedTarget)
            ) {
              onPieLeave();
            }
          }}
        >
          {centerText ? (
            <span className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold",
              isDark ? "text-[#0bd1a2]" : "text-foreground"
            )} style={{ cursor: 'inherit' }}>
              {centerText}
            </span>
          ) : showYesPercent ? (
            <span className={cn(
              "pointer-events-none absolute inset-0 flex flex-col items-center justify-center",
              isDark ? "text-[#0bd1a2]" : "text-foreground"
            )} style={{ cursor: 'inherit' }}>
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">Yes</span>
              <span className="text-lg font-bold leading-tight">{calculatedYesPercent.toFixed(1)}%</span>
            </span>
          ) : title && titlePosition === "center" ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground" style={{ cursor: 'inherit' }}>
              {title}
            </span>
          ) : null}
          <PieChart
            width={132}
            height={132}
            className="overflow-visible"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
            }}
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
            onMouseLeave={onPieLeave}
          >
            {showTooltip && (
              <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={renderTooltip as any}
                cursor={false}
                wrapperClassName="recharts-no-box"
                wrapperStyle={{ pointerEvents: "none" }}
                animationDuration={0}
                isAnimationActive={false}
              />
            )}
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={58}
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              stroke="none"
              isAnimationActive={animate}
            >
              {data.map((entry, index) => {
                const isAbstain = entry.type === "abstain";
                const isPending = entry.type === "pending";
                const isExcluded = entry.type === "excluded";
                const isNotVoted = entry.type === "notVoted";
                const isAlwaysNoConfidence = entry.type === "alwaysNoConfidence";
                const baseColor = getColor(entry, index);

                // Determine stroke color
                let strokeColor: string;
                if (isDark) {
                  // In dark mode, use the segment color for stroke
                  strokeColor = entry.color;
                } else if (isAbstain || isPending || isExcluded || isNotVoted) {
                  strokeColor = "rgba(15, 23, 42, 0.35)";
                } else if (isAlwaysNoConfidence) {
                  strokeColor = "rgba(156, 163, 175, 0.8)";
                } else {
                  strokeColor = "transparent";
                }

                // Determine stroke width
                const needsStroke = isAbstain || isPending || isExcluded || isNotVoted || isAlwaysNoConfidence;
                const strokeWidth = isDark ? 1.4 : needsStroke ? 1.2 : 0;

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isDark ? "transparent" : baseColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    style={{
                      transition: "all 0.2s ease-in-out",
                      transform:
                        interactive && activeIndex === index
                          ? "scale(1.05)"
                          : "scale(1)",
                      transformOrigin: "center",
                    }}
                  />
                );
              })}
            </Pie>
          </PieChart>
        </div>
      </div>
    );
  }
);
VoteProgress.displayName = "VoteProgress";
