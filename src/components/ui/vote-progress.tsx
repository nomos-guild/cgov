import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from "recharts";
import { cn } from "@/lib/utils";

interface VoteProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  yesPercent: number;
  noPercent: number;
  abstainPercent?: number;
  title?: string;
  titlePosition?: "top" | "center";
  yesValue?: number;
  noValue?: number;
  abstainValue?: number;
  valueUnit?: "ada" | "count";
}

const COLORS = {
  yes: {
    active: "rgba(13, 148, 136, 0.95)",
    inactive: "rgba(13, 148, 136, 0.45)",
  },
  no: {
    active: "rgba(91, 33, 182, 0.95)",
    inactive: "rgba(91, 33, 182, 0.45)",
  },
  abstain: {
    active: "rgba(226, 232, 240, 0.98)",
    inactive: "rgba(226, 232, 240, 0.65)",
  },
};

type SliceData = {
  name: "Yes" | "No" | "Abstain";
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
      title,
      titlePosition = "top",
      yesValue,
      noValue,
      abstainValue,
      valueUnit,
      style,
      ...props
    },
    ref
  ) => {
    const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
    const [tooltipVisible, setTooltipVisible] = React.useState(false);
    const hoverTimeout = React.useRef<NodeJS.Timeout | null>(null);

    const totalPercent = yesPercent + noPercent + abstainPercent;

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
      return result;
    }, [
      yesPercent,
      noPercent,
      abstainPercent,
      yesValue,
      noValue,
      abstainValue,
    ]);

    const clearHoverTimeout = React.useCallback(() => {
      if (hoverTimeout.current) {
        clearTimeout(hoverTimeout.current);
        hoverTimeout.current = null;
      }
    }, []);

    const onPieEnter = React.useCallback(
      (_: SliceData, index: number) => {
        clearHoverTimeout();
        setActiveIndex(index);
        setTooltipVisible(true);
      },
      [clearHoverTimeout]
    );

    const onPieLeave = React.useCallback(() => {
      clearHoverTimeout();
      hoverTimeout.current = setTimeout(() => {
        setActiveIndex(null);
        setTooltipVisible(false);
      }, 80);
    }, [clearHoverTimeout]);

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

        if (!tooltipVisible || !extended.active || !extended.payload?.length) {
          return null;
        }

        const slice = extended.payload[0].payload as SliceData;
        const displayValue = formatDisplayValue(slice.displayValue);

        return (
          <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-md">
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
      [formatDisplayValue, title, tooltipVisible]
    );

    const emptyTooltip = React.useCallback(() => null, []);
    const tooltipContent = tooltipVisible ? renderTooltip : emptyTooltip;

    const cardStyle = React.useMemo<React.CSSProperties>(
      () => ({
        borderRadius: "1.5rem",
        padding: "16px 18px 18px",
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
            "border-white/8 flex flex-col items-center gap-2 border bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)]",
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

    return (
      <div
        ref={ref}
        className={cn(
          "border-white/8 flex flex-col items-center gap-2 border bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)]",
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
          onMouseLeave={onPieLeave}
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
            <defs>
              <radialGradient
                id="slice-edge-overlay"
                cx="0.5"
                cy="0.5"
                r="0.95"
              >
                <stop offset="65%" stopColor="rgba(0,0,0,0)" />
                <stop offset="85%" stopColor="rgba(15,23,42,0.08)" />
                <stop offset="95%" stopColor="rgba(15,23,42,0.15)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0.2)" />
              </radialGradient>
            </defs>
            <Tooltip
              content={tooltipContent}
              cursor={false}
              wrapperClassName="recharts-no-box"
              active={tooltipVisible}
              wrapperStyle={{ pointerEvents: "none" }}
            />
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
            >
              {data.map((entry, index) => {
                const isAbstain = entry.type === "abstain";
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={getColor(entry.type, index)}
                    stroke={
                      isAbstain ? "rgba(15, 23, 42, 0.35)" : "transparent"
                    }
                    strokeWidth={isAbstain ? 1.2 : 0}
                    style={{
                      transition: "all 0.2s ease-in-out",
                      transform:
                        activeIndex === index ? "scale(1.05)" : "scale(1)",
                      transformOrigin: "center",
                    }}
                  />
                );
              })}
            </Pie>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
              style={{ pointerEvents: "none" }}
            >
              {data.map((entry, index) => (
                <Cell key={`edge-${index}`} fill="url(#slice-edge-overlay)" />
              ))}
            </Pie>
          </PieChart>
        </div>
      </div>
    );
  }
);
VoteProgress.displayName = "VoteProgress";
