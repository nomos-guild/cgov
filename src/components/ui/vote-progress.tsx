import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  type TooltipProps,
} from "recharts";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

interface VoteProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  yesPercent: number;
  noPercent: number;
  abstainPercent?: number;
  pendingPercent?: number;
  title?: string;
  titlePosition?: "top" | "center";
  yesValue?: number;
  noValue?: number;
  abstainValue?: number;
  pendingValue?: number;
  valueUnit?: "ada" | "count";
  showTooltip?: boolean;
  animate?: boolean;
  interactive?: boolean;
}

const COLORS = {
  yes: {
    active: "rgb(11, 140, 48)",
    inactive: "rgba(11, 140, 48, 0.45)",
  },
  no: {
    active: "rgb(140, 32, 11)",
    inactive: "rgba(140, 32, 11, 0.45)",
  },
  abstain: {
    active: "rgb(226, 232, 240)",
    inactive: "rgba(226, 232, 240, 0.65)",
  },
  pending: {
    active: "rgb(148, 163, 184)",
    inactive: "rgba(148, 163, 184, 0.45)",
  },
};

type SliceData = {
  name: "Yes" | "No" | "Abstain" | "Pending";
  value: number;
  type: keyof typeof COLORS;
  displayValue?: number;
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
      yesPercent,
      noPercent,
      abstainPercent = 0,
      pendingPercent = 0,
      title,
      titlePosition = "top",
      yesValue,
      noValue,
      abstainValue,
      pendingValue,
      valueUnit,
      showTooltip = true,
      animate = true,
      interactive = true,
      style,
      ...props
    },
    ref
  ) => {
    const { theme, activeTheme } = useTheme();
    const isDark = theme === "dark";
    const isGame = activeTheme.id === "game";
    const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

    const totalPercent = yesPercent + noPercent + abstainPercent + pendingPercent;

    const data = React.useMemo<SliceData[]>(() => {
      const result: SliceData[] = [];
      if (yesPercent > 0) {
        result.push({
          name: "Yes",
          value: yesPercent,
          type: "yes",
          displayValue: yesValue,
        });
      }
      if (noPercent > 0) {
        result.push({
          name: "No",
          value: noPercent,
          type: "no",
          displayValue: noValue,
        });
      }
      if (abstainPercent > 0) {
        result.push({
          name: "Abstain",
          value: abstainPercent,
          type: "abstain",
          displayValue: abstainValue,
        });
      }
      if (pendingPercent > 0) {
        result.push({
          name: "Pending",
          value: pendingPercent,
          type: "pending",
          displayValue: pendingValue,
        });
      }
      return result;
    }, [
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
      (_: SliceData, index: number) => {
        if (!interactive) return;
        setActiveIndex(index);
      },
      [interactive]
    );

    const onPieLeave = React.useCallback(() => {
      if (!interactive) return;
      setActiveIndex(null);
    }, [interactive]);

    const getColor = (type: string, index: number) => {
      if (activeIndex === index) {
        return COLORS[type as keyof typeof COLORS].active;
      }
      return COLORS[type as keyof typeof COLORS].inactive;
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
      (tooltipProps: TooltipProps<number, string>) => {
        const extended = tooltipProps as TooltipProps<number, string> & {
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
        ...style,
      }),
      [style]
    );

    if (totalPercent === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            "border-white/8 flex flex-col items-center gap-2 border bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] rounded-3xl px-[14px] pt-[12px] pb-[14px] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none",
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
          style={cardStyle}
        >
          {title && titlePosition === "top" && (
            <span className="whitespace-nowrap text-sm font-medium text-white">
              {title}
            </span>
          )}
          <div
            className="vote-progress-card-game recharts-no-box relative overflow-visible rounded-full"
            style={{ width: 132, height: 132, minWidth: 132, minHeight: 132 }}
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
            {title && titlePosition === "center" && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                {title}
              </span>
            )}
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
                  content={renderTooltip}
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
                const baseColor = getColor(entry.type, index);
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={baseColor}
                    stroke="transparent"
                    strokeWidth={0}
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
          "vote-progress-card border-white/8 flex flex-col items-center gap-2 border bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] rounded-3xl px-[14px] pt-[12px] pb-[14px] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none",
          className
        )}
        {...props}
        style={cardStyle}
      >
        {title && titlePosition === "top" && (
          <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
            {title}
          </span>
        )}
        <div
          className="recharts-no-box relative overflow-visible"
          style={{ width: 132, height: 132, minWidth: 132, minHeight: 132 }}
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
          {title && titlePosition === "center" && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
              {title}
            </span>
          )}
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
                content={renderTooltip}
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
                const baseColor = getColor(entry.type, index);
                const strokeColor = isDark
                  ? COLORS[entry.type].active
                  : isAbstain || isPending
                    ? "rgba(15, 23, 42, 0.35)"
                    : "transparent";
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isDark ? "transparent" : baseColor}
                    stroke={strokeColor}
                    strokeWidth={isDark ? 1.4 : isAbstain || isPending ? 1.2 : 0}
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
