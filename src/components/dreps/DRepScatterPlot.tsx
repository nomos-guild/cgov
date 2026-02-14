import { useMemo, useState, useRef } from "react";
import * as d3 from "d3";
import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";

type ChartMetric = "votingPower" | "delegators";

interface DRepScatterPlotProps {
  dreps: DRepSummary[];
  metric: ChartMetric;
  topN?: number | null;
  rationaleMap: Map<string, number>;
}

interface DRepPoint {
  cx: number;
  cy: number;
  r: number;
  drep: DRepSummary;
  rank: number;
  fillColor: string;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function generateColor(index: number, total: number): string {
  const hue = (index / Math.max(total, 1)) * 360;
  const saturation = 65 + (index % 3) * 10;
  const lightness = 45 + (index % 2) * 10;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 600;
const MARGIN = { top: 30, right: 30, bottom: 50, left: 70 };
const PLOT_W = SVG_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

export function DRepScatterPlot({ dreps, metric, topN, rationaleMap }: DRepScatterPlotProps) {
  const t = useTranslations("drep");
  const { theme, activeTheme } = useTheme();
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";
  const isDark = theme === "dark";
  const isGame = activeTheme.id === "game";
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ point: DRepPoint; x: number; y: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // X = voting power, Y = delegator count (or flipped depending on metric emphasis)
  const { points, xScale, yScale, xTicks, yTicks, xLabel, yLabel } = useMemo(() => {
    if (!dreps.length)
      return {
        points: [] as DRepPoint[],
        xScale: d3.scaleLog().domain([1, 1]).range([0, PLOT_W]),
        yScale: d3.scaleLinear().domain([0, 1]).range([PLOT_H, 0]),
        xTicks: [] as number[],
        yTicks: [] as number[],
        xLabel: "",
        yLabel: "",
      };

    // Always: X = voting power (log scale), Y = delegators or votes cast
    const xValues = dreps.map((d) => Math.max(d.votingPowerAda, 1));
    const yValues =
      metric === "delegators"
        ? dreps.map((d) => d.delegatorCount ?? 0)
        : dreps.map((d) => d.totalVotesCast);

    const xMin = d3.min(xValues) ?? 1;
    const xMax = d3.max(xValues) ?? 1;
    const yMax = d3.max(yValues) ?? 1;

    const xs = d3.scaleLog().domain([Math.max(xMin * 0.5, 0.1), xMax * 1.5]).range([0, PLOT_W]).nice();
    const ys = d3.scaleLinear().domain([0, yMax * 1.1]).range([PLOT_H, 0]).nice();

    // Size: encode the metric value as bubble radius
    const sizeValues = dreps.map((d) =>
      metric === "votingPower" ? d.votingPowerAda : (d.delegatorCount ?? 0),
    );
    const sizeMax = d3.max(sizeValues) ?? 1;
    const rScale = d3.scaleSqrt().domain([0, sizeMax]).range([3, 20]);

    const pts: DRepPoint[] = dreps.map((drep, i) => ({
      cx: xs(Math.max(drep.votingPowerAda, 1)),
      cy: ys(metric === "delegators" ? (drep.delegatorCount ?? 0) : drep.totalVotesCast),
      r: rScale(metric === "votingPower" ? drep.votingPowerAda : (drep.delegatorCount ?? 0)),
      drep,
      rank: i + 1,
      fillColor: isLight
        ? "#94a3b8"
        : isDark
          ? "#0bd1a2"
          : generateColor(i, dreps.length),
    }));

    return {
      points: pts,
      xScale: xs,
      yScale: ys,
      xTicks: xs.ticks(5),
      yTicks: ys.ticks(6),
      xLabel: `${t("votingPower")} (ADA)`,
      yLabel: metric === "delegators" ? t("delegators") : t("votesCast"),
    };
  }, [dreps, metric, t, isLight, isDark]);

  const handleMouseEnter = (point: DRepPoint, event: React.MouseEvent<SVGCircleElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setHoveredPoint({ point, x: event.clientX - rect.left, y: event.clientY - rect.top });
    setHoveredId(point.drep.drepId);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoveredId(null);
  };

  // Render hovered point last for z-ordering
  const sortedPoints = useMemo(() => {
    if (!hoveredId) return points;
    return [...points].sort((a, b) =>
      a.drep.drepId === hoveredId ? 1 : b.drep.drepId === hoveredId ? -1 : 0,
    );
  }, [points, hoveredId]);

  const isTopN = (rank: number) => topN != null && rank <= topN;

  const axisColor = isGame ? "rgba(255,255,255,0.3)" : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
  const labelColor = isGame ? "rgba(255,255,255,0.6)" : isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";

  return (
    <div ref={containerRef} className="relative w-full" onMouseLeave={handleMouseLeave}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Grid lines */}
          {yTicks.map((tick) => (
            <line
              key={`gy-${tick}`}
              x1={0}
              x2={PLOT_W}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={axisColor}
              strokeDasharray="3,3"
            />
          ))}
          {xTicks.map((tick) => (
            <line
              key={`gx-${tick}`}
              x1={xScale(tick)}
              x2={xScale(tick)}
              y1={0}
              y2={PLOT_H}
              stroke={axisColor}
              strokeDasharray="3,3"
            />
          ))}

          {/* X axis labels */}
          {xTicks.map((tick) => (
            <text
              key={`xt-${tick}`}
              x={xScale(tick)}
              y={PLOT_H + 22}
              textAnchor="middle"
              fontSize={11}
              fill={labelColor}
            >
              {formatCompact(tick)}
            </text>
          ))}
          {/* X axis title */}
          <text
            x={PLOT_W / 2}
            y={PLOT_H + 42}
            textAnchor="middle"
            fontSize={12}
            fontWeight={600}
            fill={labelColor}
          >
            {xLabel}
          </text>

          {/* Y axis labels */}
          {yTicks.map((tick) => (
            <text
              key={`yt-${tick}`}
              x={-10}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill={labelColor}
            >
              {formatCompact(tick)}
            </text>
          ))}
          {/* Y axis title */}
          <text
            x={0}
            y={-14}
            textAnchor="start"
            fontSize={12}
            fontWeight={600}
            fill={labelColor}
          >
            {yLabel}
          </text>

          {/* Data points */}
          {sortedPoints.map((point) => {
            const isHovered = hoveredId === point.drep.drepId;
            const isTop = isTopN(point.rank);
            const baseOpacity = topN != null ? (isTop ? 0.85 : 0.25) : 0.75;

            return (
              <circle
                key={point.drep.drepId}
                cx={point.cx}
                cy={point.cy}
                r={isHovered ? point.r + 3 : point.r}
                fill={point.fillColor}
                fillOpacity={isHovered ? 1 : baseOpacity}
                stroke={isHovered ? (isGame ? "#ffd700" : isDark ? "#0bd1a2" : "#475569") : "transparent"}
                strokeWidth={isHovered ? 2 : 0}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(point, e)}
                onMouseMove={(e) => {
                  if (!containerRef.current) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  setHoveredPoint({ point, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
              />
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className={
            isGame
              ? "absolute z-50 rounded-sm px-4 py-3 text-xs pointer-events-none game-tooltip-card"
              : "absolute z-50 rounded-2xl border border-white/8 bg-[#faf9f6] px-4 py-3 text-xs shadow-[0_12px_30px_rgba(15,23,42,0.25)] pointer-events-none dark:rounded-none dark:border-[#0bd1a2] dark:bg-background dark:shadow-none"
          }
          style={{
            left: `${hoveredPoint.x + 15}px`,
            top: `${Math.max(8, hoveredPoint.y - 14)}px`,
            transform: "translateY(-100%)",
          }}
        >
          <div className={isGame ? "font-semibold text-white" : "font-semibold text-foreground"}>
            #{hoveredPoint.point.rank} {hoveredPoint.point.drep.name || t("anonymous")}
          </div>
          <div className={`mt-1.5 space-y-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
            <div>
              <span className="font-medium">{t("votingPower")}:</span>{" "}
              {formatCompact(hoveredPoint.point.drep.votingPowerAda)} ADA
            </div>
            <div>
              <span className="font-medium">{t("delegators")}:</span>{" "}
              {hoveredPoint.point.drep.delegatorCount != null
                ? hoveredPoint.point.drep.delegatorCount.toLocaleString()
                : "--"}
            </div>
            <div>
              <span className="font-medium">{t("votesCast")}:</span>{" "}
              {hoveredPoint.point.drep.totalVotesCast}
            </div>
            <div>
              <span className="font-medium">{t("rationales")}:</span>{" "}
              {rationaleMap.get(hoveredPoint.point.drep.drepId) ?? "--"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
