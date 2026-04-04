import { useMemo, useState, useRef } from "react";
import * as d3 from "d3";
import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";
import { ZoomLens, LENS_W, LENS_CHART_H } from "@/components/dreps/ZoomLens";
import type { ZoomLensTarget } from "@/components/dreps/ZoomLens";

type ChartMetric = "votingPower" | "delegators";

interface DRepScatterPlotProps {
  dreps: DRepSummary[];
  metric: ChartMetric;
  topN?: number | null;
  rationaleMap: Map<string, number>;
  highlightedIds?: Set<string>;
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

export function DRepScatterPlot({ dreps, metric, topN, rationaleMap, highlightedIds }: DRepScatterPlotProps) {
  const t = useTranslations("drep");
  const { theme, activeTheme } = useTheme();
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";
  const isDark = theme === "dark";
  const isGame = activeTheme.id === "game";
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ point: DRepPoint; x: number; y: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hasHighlight = highlightedIds != null && highlightedIds.size > 0;

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

  // Zoom lens target: first highlighted point (in SVG-absolute coordinates)
  const lensTarget = useMemo((): ZoomLensTarget | null => {
    if (!hasHighlight || !points.length) return null;
    const pt = points.find((p) => highlightedIds!.has(p.drep.drepId));
    if (!pt) return null;
    return { x: pt.cx + MARGIN.left, y: pt.cy + MARGIN.top, drep: pt.drep, rank: pt.rank };
  }, [points, highlightedIds, hasHighlight]);

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
            const isHighlighted = hasHighlight && highlightedIds!.has(point.drep.drepId);
            const isDimmedBySearch = hasHighlight && !isHighlighted;
            const isTop = isTopN(point.rank);
            const baseOpacity = isDimmedBySearch ? 0.1 : topN != null ? (isTop ? 0.85 : 0.25) : 0.75;

            return (
              <circle
                key={point.drep.drepId}
                cx={point.cx}
                cy={point.cy}
                r={isHovered ? point.r + 3 : point.r}
                fill={point.fillColor}
                fillOpacity={isHovered ? 1 : baseOpacity}
                stroke={isHighlighted || isHovered ? (isGame ? "#ffd700" : isDark ? "#0bd1a2" : "#475569") : "transparent"}
                strokeWidth={isHighlighted ? 2.5 : isHovered ? 2 : 0}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(point, e)}
                onMouseLeave={handleMouseLeave}
                onMouseMove={(e) => {
                  if (!containerRef.current) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  setHoveredPoint({ point, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
              />
            );
          })}
        </g>

        {/* Zoom lens */}
        {lensTarget && (
          <ZoomLens
            target={lensTarget}
            svgWidth={SVG_WIDTH}
            svgHeight={SVG_HEIGHT}
            isGame={isGame}
            isDark={isDark}
            isLight={isLight}
            rationaleMap={rationaleMap}
            idPrefix="scatter"
          >
            {(() => {
              const scale = 2.8;
              const lensX = lensTarget.x < SVG_WIDTH / 2 ? SVG_WIDTH - LENS_W - 16 : 16;
              const lensY = lensTarget.y < SVG_HEIGHT / 2 ? SVG_HEIGHT - (LENS_CHART_H + 135) - 16 : 16;
              return (
                <g transform={`translate(${lensX + LENS_W / 2 - lensTarget.x * scale}, ${lensY + LENS_CHART_H / 2 - lensTarget.y * scale}) scale(${scale})`}>
                  <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                    {points.map((point) => {
                      const isMatch = highlightedIds!.has(point.drep.drepId);
                      const hasAvatar = isMatch && point.drep.iconUrl;
                      const avatarR = 18;
                      return (
                        <g key={`lens-${point.drep.drepId}`}>
                          {hasAvatar ? (
                            <>
                              <defs>
                                <clipPath id={`lens-scatter-avatar-${point.drep.drepId}`}>
                                  <circle cx={point.cx} cy={point.cy} r={avatarR} />
                                </clipPath>
                              </defs>
                              <image
                                href={point.drep.iconUrl!}
                                x={point.cx - avatarR}
                                y={point.cy - avatarR}
                                width={avatarR * 2}
                                height={avatarR * 2}
                                clipPath={`url(#lens-scatter-avatar-${point.drep.drepId})`}
                                preserveAspectRatio="xMidYMid slice"
                              />
                              <circle
                                cx={point.cx}
                                cy={point.cy}
                                r={avatarR}
                                fill="none"
                                stroke={isGame ? "#ffd700" : isDark ? "#0bd1a2" : point.fillColor}
                                strokeWidth={1.5}
                              />
                            </>
                          ) : (
                            <circle
                              cx={point.cx}
                              cy={point.cy}
                              r={isMatch ? point.r + 2 : point.r}
                              fill={isMatch
                                ? point.fillColor
                                : (isGame ? "rgba(20,20,20,0.4)" : isDark ? "rgba(255,255,255,0.03)" : "rgba(200,200,200,0.5)")}
                              stroke={isMatch
                                ? (isGame ? "#ffd700" : isDark ? "#0bd1a2" : point.fillColor)
                                : "transparent"}
                              strokeWidth={isMatch ? 1.5 : 0}
                              opacity={isMatch ? 1 : 0.3}
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>
                </g>
              );
            })()}
          </ZoomLens>
        )}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (() => {
        const containerW = containerRef.current?.clientWidth ?? SVG_WIDTH;
        const containerH = containerRef.current?.clientHeight ?? SVG_HEIGHT;
        const flipX = hoveredPoint.x > containerW * 0.7;
        const flipY = hoveredPoint.y < containerH * 0.25;
        return (
        <div
          className={
            isGame
              ? "absolute z-50 rounded-sm px-4 py-3 text-xs pointer-events-none game-tooltip-card"
              : "absolute z-50 rounded-2xl border border-border bg-card px-4 py-3 text-xs shadow-elevation-2 pointer-events-none dark:rounded-none dark:border-[#0bd1a2] dark:bg-background dark:shadow-none"
          }
          style={flipX
            ? {
                right: `${containerW - hoveredPoint.x + 15}px`,
                top: flipY ? `${hoveredPoint.y + 15}px` : `${Math.max(8, hoveredPoint.y - 14)}px`,
                transform: flipY ? undefined : "translateY(-100%)",
              }
            : {
                left: `${hoveredPoint.x + 15}px`,
                top: flipY ? `${hoveredPoint.y + 15}px` : `${Math.max(8, hoveredPoint.y - 14)}px`,
                transform: flipY ? undefined : "translateY(-100%)",
              }
          }
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
        );
      })()}
    </div>
  );
}
