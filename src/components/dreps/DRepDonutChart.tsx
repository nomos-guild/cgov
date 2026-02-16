import { useMemo, useState, useRef, useEffect } from "react";
import * as d3 from "d3";
import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";
import { ZoomLens, LENS_W, LENS_CHART_H } from "@/components/dreps/ZoomLens";
import type { ZoomLensTarget } from "@/components/dreps/ZoomLens";

type ChartMetric = "votingPower" | "delegators";

interface DRepDonutChartProps {
  dreps: DRepSummary[];
  metric: ChartMetric;
  topN?: number | null;
  rationaleMap: Map<string, number>;
  highlightedIds?: Set<string>;
}

interface DRepSlice {
  startAngle: number;
  endAngle: number;
  drep: DRepSummary | null;
  label: string;
  rank: number;
  value: number;
  percentage: number;
  isOthers: boolean;
  othersCount: number;
}

const MAX_SLICES = 50;
const ANIM_MS = 500;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function generateColor(index: number, total: number): string {
  const hue = (index / Math.max(total, 1)) * 360;
  const saturation = 65 + (index % 3) * 10;
  const lightness = 45 + (index % 2) * 10;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function getMetricValue(drep: DRepSummary, metric: ChartMetric): number {
  switch (metric) {
    case "votingPower":
      return Math.max(drep.votingPowerAda, 1);
    case "delegators":
      return Math.max(drep.delegatorCount ?? 0, 1);
  }
}

function buildSlices(
  dreps: DRepSummary[],
  metric: ChartMetric,
  topN: number | null | undefined,
  highlightedIds?: Set<string>,
): DRepSlice[] {
  if (!dreps.length) return [];

  const total = dreps.reduce((sum, d) => sum + getMetricValue(d, metric), 0);
  const sliceCount = topN != null ? Math.min(topN, dreps.length) : Math.min(MAX_SLICES, dreps.length);
  const top = dreps.slice(0, sliceCount);
  let rest = dreps.slice(sliceCount);

  type PieDatum = {
    drep: DRepSummary | null;
    label: string;
    rank: number;
    value: number;
    isOthers: boolean;
    othersCount: number;
  };

  const pieData: PieDatum[] = top.map((drep, index) => ({
    drep,
    label: drep.name || "Anonymous",
    rank: index + 1,
    value: getMetricValue(drep, metric),
    isOthers: false,
    othersCount: 0,
  }));

  // Promote any highlighted DReps that fell into "rest" so they get their own slice
  if (highlightedIds && highlightedIds.size > 0 && rest.length > 0) {
    const promoted: DRepSummary[] = [];
    const remaining: DRepSummary[] = [];
    for (const d of rest) {
      if (highlightedIds.has(d.drepId)) promoted.push(d);
      else remaining.push(d);
    }
    for (const drep of promoted) {
      const origIndex = dreps.indexOf(drep);
      pieData.push({
        drep,
        label: drep.name || "Anonymous",
        rank: origIndex + 1,
        value: getMetricValue(drep, metric),
        isOthers: false,
        othersCount: 0,
      });
    }
    rest = remaining;
  }

  if (rest.length > 0) {
    const othersValue = rest.reduce((sum, d) => sum + getMetricValue(d, metric), 0);
    pieData.push({
      drep: null,
      label: `Others (${rest.length})`,
      rank: sliceCount + 1,
      value: othersValue,
      isOthers: true,
      othersCount: rest.length,
    });
  }

  const arcs = d3.pie<PieDatum>().value((d) => d.value).sort(null).padAngle(0.005)(pieData);

  return arcs.map((arc) => ({
    startAngle: arc.startAngle,
    endAngle: arc.endAngle,
    drep: arc.data.drep,
    label: arc.data.label,
    rank: arc.data.rank,
    value: arc.data.value,
    percentage: total > 0 ? (arc.data.value / total) * 100 : 0,
    isOthers: arc.data.isOthers,
    othersCount: arc.data.othersCount,
  }));
}

const SVG_SIZE = 600;
const CENTER = SVG_SIZE / 2;
const OUTER_RADIUS = SVG_SIZE / 2 - 20;
const INNER_RADIUS = OUTER_RADIUS * 0.55;

export function DRepDonutChart({ dreps, metric, topN, rationaleMap, highlightedIds }: DRepDonutChartProps) {
  const t = useTranslations("drep");
  const { theme, activeTheme } = useTheme();
  const isDark = theme === "dark";
  const isGame = activeTheme.id === "game";
  const isLight = !isDark && !isGame;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSlice, setHoveredSlice] = useState<{ slice: DRepSlice; x: number; y: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hasHighlight = highlightedIds != null && highlightedIds.size > 0;

  // Compute target slices — only active items + Others
  // Pass highlightedIds so searched DReps outside top-N get their own slice
  const targetSlices = useMemo(
    () => buildSlices(dreps, metric, topN, highlightedIds),
    [dreps, metric, topN, highlightedIds]
  );

  // Arc-interpolation animation when topN changes
  const [renderSlices, setRenderSlices] = useState<DRepSlice[]>(targetSlices);
  const prevTopNRef = useRef(topN);
  const prevSlicesRef = useRef<DRepSlice[]>(targetSlices);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Snap immediately for data changes (not topN change)
    if (prevTopNRef.current === topN) {
      prevSlicesRef.current = targetSlices;
      setRenderSlices(targetSlices);
      return;
    }
    prevTopNRef.current = topN;
    cancelAnimationFrame(rafRef.current);

    const prev = prevSlicesRef.current;
    const next = targetSlices;

    // Build lookup maps by key
    const prevMap = new Map<string, DRepSlice>();
    for (const s of prev) {
      prevMap.set(s.isOthers ? "__others__" : s.drep!.drepId, s);
    }
    const nextMap = new Map<string, DRepSlice>();
    for (const s of next) {
      nextMap.set(s.isOthers ? "__others__" : s.drep!.drepId, s);
    }

    const startTime = performance.now();

    // Ordered DRep keys by rank (prev order first, then entering from next)
    const orderedDrepKeys: string[] = [];
    const seenKeys = new Set<string>();
    for (const s of prev) {
      if (!s.isOthers) {
        const key = s.drep!.drepId;
        if (!seenKeys.has(key)) { orderedDrepKeys.push(key); seenKeys.add(key); }
      }
    }
    for (const s of next) {
      if (!s.isOthers) {
        const key = s.drep!.drepId;
        if (!seenKeys.has(key)) { orderedDrepKeys.push(key); seenKeys.add(key); }
      }
    }
    const prevOthersSlice = prevMap.get("__others__");
    const nextOthersSlice = nextMap.get("__others__");

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = easeInOutCubic(Math.min(elapsed / ANIM_MS, 1));

      // Value-based interpolation: let d3.pie compute all angles
      // so the pie always sums to 2π with no gaps or overlaps
      type PieDatum = { slice: DRepSlice; value: number };
      const pieData: PieDatum[] = [];

      // DRep slices in rank order with interpolated values
      for (const key of orderedDrepKeys) {
        const from = prevMap.get(key);
        const to = nextMap.get(key);
        if (from && to) {
          // Staying: value unchanged
          pieData.push({ slice: to, value: to.value });
        } else if (from) {
          // Exiting: shrink value to 0
          const v = from.value * (1 - t);
          if (v > 0.01) pieData.push({ slice: from, value: v });
        } else if (to) {
          // Entering: grow value from 0
          const v = to.value * t;
          if (v > 0.01) pieData.push({ slice: to, value: v });
        }
      }

      // Others: interpolate value between old and new
      if (prevOthersSlice && nextOthersSlice) {
        const v = prevOthersSlice.value + (nextOthersSlice.value - prevOthersSlice.value) * t;
        pieData.push({ slice: nextOthersSlice, value: v });
      } else if (nextOthersSlice) {
        const v = nextOthersSlice.value * t;
        if (v > 0.01) pieData.push({ slice: nextOthersSlice, value: v });
      } else if (prevOthersSlice) {
        const v = prevOthersSlice.value * (1 - t);
        if (v > 0.01) pieData.push({ slice: prevOthersSlice, value: v });
      }

      // Rebuild pie layout from interpolated values
      const arcs = d3.pie<PieDatum>()
        .value(d => d.value)
        .sort(null)
        .padAngle(0.005)(pieData);

      const result: DRepSlice[] = arcs.map(arc => ({
        ...arc.data.slice,
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
        value: arc.data.value,
      }));

      setRenderSlices(result);

      if (elapsed < ANIM_MS) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevSlicesRef.current = next;
        setRenderSlices(next);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [targetSlices, topN]);

  const slices = renderSlices;

  const arcGenerator = useMemo(
    () =>
      d3
        .arc<DRepSlice>()
        .innerRadius(INNER_RADIUS)
        .outerRadius(OUTER_RADIUS)
        .cornerRadius(2),
    []
  );

  const hoverArcGenerator = useMemo(
    () =>
      d3
        .arc<DRepSlice>()
        .innerRadius(INNER_RADIUS)
        .outerRadius(OUTER_RADIUS + 8)
        .cornerRadius(2),
    []
  );

  const labelArcGenerator = useMemo(
    () =>
      d3
        .arc<DRepSlice>()
        .innerRadius((INNER_RADIUS + OUTER_RADIUS) / 2)
        .outerRadius((INNER_RADIUS + OUTER_RADIUS) / 2),
    []
  );

  // Zoom lens target: centroid of first highlighted slice in SVG coordinates
  const lensTarget = useMemo((): ZoomLensTarget | null => {
    if (!hasHighlight || !slices.length) return null;
    const slice = slices.find((s) => !s.isOthers && highlightedIds!.has(s.drep!.drepId));
    if (!slice) return null;
    const midAngle = (slice.startAngle + slice.endAngle) / 2;
    const midRadius = (INNER_RADIUS + OUTER_RADIUS) / 2;
    return {
      x: CENTER + Math.sin(midAngle) * midRadius,
      y: CENTER - Math.cos(midAngle) * midRadius,
      drep: slice.drep!,
      rank: slice.rank,
    };
  }, [slices, highlightedIds, hasHighlight]);

  const handleMouseEnter = (slice: DRepSlice, event: React.MouseEvent<SVGPathElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setHoveredSlice({
        slice,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredSlice(null);
    setHoveredId(null);
  };

  if (!dreps.length) return null;

  return (
    <div ref={containerRef} className="w-full relative overflow-hidden" onMouseLeave={handleMouseLeave}>
      <svg
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="w-full h-auto max-h-[500px] sm:max-h-[700px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Light theme shadows */}
          <filter id="drep-donut-shadow-light" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
            <feOffset dx="0" dy="2" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.15" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Dark theme shadows */}
          <filter id="drep-donut-shadow-dark" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>
            <feOffset dx="0" dy="3" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.2" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Game theme text */}
          <linearGradient id="drep-donut-game-text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.9)"/>
            <stop offset="90%" stopColor="rgba(215, 215, 215, 0.8)"/>
            <stop offset="99%" stopColor="rgba(120, 120, 120, 0.7)"/>
            <stop offset="100%" stopColor="rgba(35, 35, 35, 0.08)"/>
          </linearGradient>
          <filter id="drep-donut-game-text-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.8)" floodOpacity="1"/>
          </filter>
          {/* Game theme hover glow */}
          <filter id="drep-donut-game-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
            <feFlood floodColor="rgba(255,255,255,0.2)" result="color"/>
            <feComposite in="color" in2="blur" operator="in" result="glow"/>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g transform={`translate(${CENTER},${CENTER})`}>
          {slices.map((slice) => {
            const sliceKey = slice.isOthers ? "__others__" : slice.drep!.drepId;
            const isHovered = hoveredId === sliceKey;
            const isHighlighted = hasHighlight && !slice.isOthers && highlightedIds!.has(slice.drep!.drepId);
            const isDimmedBySearch = hasHighlight && !isHighlighted;
            const color = slice.isOthers
              ? (isGame ? "rgba(30, 30, 30, 0.7)" : isDark ? "#0bd1a2" : "#94a3b8")
              : isGame ? "rgba(20, 20, 20, 0.7)" : isDark ? "#0bd1a2" : generateColor(slice.rank - 1, dreps.length);
            const angleDeg = ((slice.endAngle - slice.startAngle) * 180) / Math.PI;

            const getShadowFilter = () => {
              if (isGame) return "";
              if (isDark) return "url(#drep-donut-shadow-dark)";
              return "url(#drep-donut-shadow-light)";
            };

            const isLight = !isDark && !isGame;

            const getFillOpacity = () => {
              if (isDimmedBySearch) return isLight ? 0.7 : 0.2;
              if (isLight) return 1;
              if (isHovered) return 1;
              if (slice.isOthers) return 0.4;
              return 0.85;
            };

            const showLabel = angleDeg > 8 && (!slice.isOthers || angleDeg > 12);
            const labelPos = labelArcGenerator.centroid(slice);

            // Dimmed slices stay white/neutral; highlighted keeps its color
            const fillColor = isDimmedBySearch
              ? (isGame ? "rgba(20,20,20,0.5)" : isDark ? "rgba(11,209,162,0.3)" : "#ffffff")
              : isLight ? "#ffffff" : color;

            // Game: rank-based stroke variation
            const sliceRankRatio = slice.isOthers ? 0 : 1 - (slice.rank - 1) / Math.max(dreps.length - 1, 1);
            const gameStrokeOpacity = 0.08 + sliceRankRatio * 0.2;
            const gameStrokeW = 0.8 + sliceRankRatio * 1;

            const getStroke = () => {
              if (isHighlighted) return isGame ? "#ffd700" : isDark ? "#0bd1a2" : "#0f172a";
              if (isDimmedBySearch) return isGame ? "rgba(255,255,255,0.04)" : isDark ? "rgba(11,209,162,0.1)" : "rgba(0,0,0,0.06)";
              if (isGame) return `rgba(255,255,255,${gameStrokeOpacity})`;
              if (isDark) return "rgba(0,0,0,0.3)";
              return "transparent";
            };
            const highlightStrokeWidth = isHighlighted ? 2 : isGame ? gameStrokeW : 1.5;

            // Highlighted slice uses the expanded arc (same as hover) + shadow
            const useExpandedArc = isHighlighted || isHovered;

            return (
              <g key={sliceKey}>
                <path
                  d={(useExpandedArc ? hoverArcGenerator : arcGenerator)(slice) || ""}
                  fill={fillColor}
                  fillOpacity={getFillOpacity()}
                  stroke={getStroke()}
                  strokeWidth={highlightStrokeWidth}
                  filter={isGame && (isHovered || isHighlighted) ? "url(#drep-donut-game-glow)" : isHighlighted ? getShadowFilter() : isDimmedBySearch ? "" : getShadowFilter()}
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    setHoveredId(sliceKey);
                    handleMouseEnter(slice, e);
                  }}
                  onMouseLeave={handleMouseLeave}
                />
                {showLabel && labelPos && (
                  <text
                    x={labelPos[0]}
                    y={labelPos[1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isGame ? "url(#drep-donut-game-text-gradient)" : isDark ? "#ffffff" : "#0f172a"}
                    filter={isGame ? "url(#drep-donut-game-text-shadow)" : undefined}
                    className="pointer-events-none font-semibold"
                    fontSize={Math.min(angleDeg * 0.5, 11)}
                  >
                    {(slice.isOthers ? t("others") : (slice.drep?.name || t("anonymous"))).slice(0, Math.floor(angleDeg / 3))}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Zoom lens */}
        {lensTarget && (
          <ZoomLens
            target={lensTarget}
            svgWidth={SVG_SIZE}
            svgHeight={SVG_SIZE}
            isGame={isGame}
            isDark={isDark}
            isLight={isLight}
            rationaleMap={rationaleMap}
            idPrefix="donut"
          >
            {(() => {
              const scale = 2.5;
              const lensX = lensTarget.x < SVG_SIZE / 2 ? SVG_SIZE - LENS_W - 16 : 16;
              const lensY = lensTarget.y < SVG_SIZE / 2 ? SVG_SIZE - (LENS_CHART_H + 135) - 16 : 16;
              return (
                <g transform={`translate(${lensX + LENS_W / 2 - lensTarget.x * scale}, ${lensY + LENS_CHART_H / 2 - lensTarget.y * scale}) scale(${scale})`}>
                  <g transform={`translate(${CENTER},${CENTER})`}>
                    {slices.map((slice) => {
                      const isMatch = !slice.isOthers && highlightedIds!.has(slice.drep!.drepId);
                      const lensColor = slice.isOthers ? "#94a3b8" : generateColor(slice.rank - 1, dreps.length);
                      return (
                        <path
                          key={`lens-${slice.isOthers ? "__others__" : slice.drep!.drepId}`}
                          d={arcGenerator(slice) || ""}
                          fill={isMatch
                            ? (isGame ? "rgba(40,40,40,0.9)" : isDark ? "rgba(11,209,162,0.15)" : "#ffffff")
                            : (isGame ? "rgba(20,20,20,0.4)" : isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.5)")}
                          stroke={isMatch
                            ? "none"
                            : (isGame ? "rgba(255,255,255,0.06)" : isDark ? "rgba(11,209,162,0.15)" : `${lensColor}30`)}
                          strokeWidth={isMatch ? 0 : 0.3}
                          opacity={isMatch ? 1 : 0.3}
                        />
                      );
                    })}
                    {/* Avatar overlay with opaque background to mask arc strokes */}
                    {(() => {
                      const matchSlice = slices.find((s) => !s.isOthers && highlightedIds!.has(s.drep!.drepId));
                      if (!matchSlice || !matchSlice.drep?.iconUrl) return null;
                      const centroid = labelArcGenerator.centroid(matchSlice);
                      const avatarR = 18;
                      const clipId = `lens-donut-avatar-${matchSlice.drep.drepId}`;
                      const lensColor = generateColor(matchSlice.rank - 1, dreps.length);
                      return (
                        <>
                          <defs>
                            <clipPath id={clipId}>
                              <circle cx={centroid[0]} cy={centroid[1]} r={avatarR} />
                            </clipPath>
                          </defs>
                          {/* Opaque disc to fully cover any arc strokes behind the avatar */}
                          <circle
                            cx={centroid[0]}
                            cy={centroid[1]}
                            r={avatarR + 1}
                            fill={isGame ? "#0c0c0c" : isDark ? "#000000" : "#faf9f6"}
                          />
                          <image
                            href={matchSlice.drep.iconUrl}
                            x={centroid[0] - avatarR}
                            y={centroid[1] - avatarR}
                            width={avatarR * 2}
                            height={avatarR * 2}
                            clipPath={`url(#${clipId})`}
                            preserveAspectRatio="xMidYMid slice"
                          />
                          <circle
                            cx={centroid[0]}
                            cy={centroid[1]}
                            r={avatarR}
                            fill="none"
                            stroke={isGame ? "#ffd700" : isDark ? "#0bd1a2" : lensColor}
                            strokeWidth={1.5}
                          />
                        </>
                      );
                    })()}
                  </g>
                </g>
              );
            })()}
          </ZoomLens>
        )}
      </svg>
      {hoveredSlice && (
        <div
          className={
            isGame
              ? "absolute z-50 rounded-sm px-4 py-3 text-xs pointer-events-none game-tooltip-card"
              : "absolute z-50 rounded-2xl border border-white/8 bg-[#faf9f6] px-4 py-3 text-xs shadow-[0_12px_30px_rgba(15,23,42,0.25)] pointer-events-none dark:rounded-none dark:border-[#0bd1a2] dark:bg-background dark:shadow-none"
          }
          style={{
            left: `${hoveredSlice.x + 15}px`,
            top: `${Math.max(8, hoveredSlice.y - 14)}px`,
            transform: "translateY(-100%)",
          }}
        >
          {hoveredSlice.slice.isOthers ? (
            <>
              <div className={isGame ? "font-semibold text-white" : "font-semibold text-foreground"}>
                {t("othersDReps", { count: hoveredSlice.slice.othersCount })}
              </div>
              <div className={`mt-1.5 space-y-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                <div>
                  <span className="font-medium">{t("share")}:</span>{" "}
                  {hoveredSlice.slice.percentage.toFixed(1)}%
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={isGame ? "font-semibold text-white" : "font-semibold text-foreground"}>
                #{hoveredSlice.slice.rank} {hoveredSlice.slice.drep?.name || t("anonymous")}
              </div>
              <div className={`mt-1.5 space-y-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                <div>
                  <span className="font-medium">{t("votingPower")}:</span>{" "}
                  {formatCompact(hoveredSlice.slice.drep?.votingPowerAda ?? 0)} ADA
                </div>
                <div>
                  <span className="font-medium">{t("delegators")}:</span>{" "}
                  {hoveredSlice.slice.drep?.delegatorCount != null ? hoveredSlice.slice.drep.delegatorCount.toLocaleString() : "--"}
                </div>
                <div>
                  <span className="font-medium">{t("votesCast")}:</span>{" "}
                  {hoveredSlice.slice.drep?.totalVotesCast ?? 0}
                </div>
                <div>
                  <span className="font-medium">{t("rationales")}:</span>{" "}
                  {hoveredSlice.slice.drep ? (rationaleMap.get(hoveredSlice.slice.drep.drepId) ?? "--") : "--"}
                </div>
                <div>
                  <span className="font-medium">{t("share")}:</span>{" "}
                  {hoveredSlice.slice.percentage.toFixed(1)}%
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
