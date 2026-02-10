import { useMemo, useState, useRef, useEffect } from "react";
import * as d3 from "d3";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";

type ChartMetric = "votingPower" | "delegators" | "votesCast";

interface DRepDonutChartProps {
  dreps: DRepSummary[];
  metric: ChartMetric;
  topN?: number | null;
  rationaleMap: Map<string, number>;
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
    case "votesCast":
      return Math.max(drep.totalVotesCast, 1);
  }
}

function buildSlices(dreps: DRepSummary[], metric: ChartMetric, topN: number | null | undefined): DRepSlice[] {
  if (!dreps.length) return [];

  const total = dreps.reduce((sum, d) => sum + getMetricValue(d, metric), 0);
  const sliceCount = topN != null ? Math.min(topN, dreps.length) : Math.min(MAX_SLICES, dreps.length);
  const top = dreps.slice(0, sliceCount);
  const rest = dreps.slice(sliceCount);

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

export function DRepDonutChart({ dreps, metric, topN, rationaleMap }: DRepDonutChartProps) {
  const { theme, activeTheme } = useTheme();
  const isDark = theme === "dark";
  const isGame = activeTheme.id === "game";
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSlice, setHoveredSlice] = useState<{ slice: DRepSlice; x: number; y: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Compute target slices — only active items + Others
  const targetSlices = useMemo(
    () => buildSlices(dreps, metric, topN),
    [dreps, metric, topN]
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
        </defs>
        <g transform={`translate(${CENTER},${CENTER})`}>
          {slices.map((slice) => {
            const sliceKey = slice.isOthers ? "__others__" : slice.drep!.drepId;
            const isHovered = hoveredId === sliceKey;
            const color = slice.isOthers
              ? (isDark ? "#555" : isGame ? "#444" : "#94a3b8")
              : generateColor(slice.rank - 1, dreps.length);
            const angleDeg = ((slice.endAngle - slice.startAngle) * 180) / Math.PI;

            const getShadowFilter = () => {
              if (isGame) return "";
              if (isDark) return "url(#drep-donut-shadow-dark)";
              return "url(#drep-donut-shadow-light)";
            };

            const getFillOpacity = () => {
              if (isLight) return 1;
              if (isHovered) return 1;
              if (slice.isOthers) return 0.4;
              return 0.85;
            };

            const showLabel = angleDeg > 8 && (!slice.isOthers || angleDeg > 12);
            const labelPos = labelArcGenerator.centroid(slice);

            const isLight = !isDark && !isGame;
            const fillColor = isLight ? "#ffffff" : color;

            const getStroke = () => {
              if (isDark) return "rgba(0,0,0,0.3)";
              if (isGame) return "rgba(0,0,0,0.2)";
              return "transparent";
            };

            return (
              <g key={sliceKey}>
                <path
                  d={(isHovered ? hoverArcGenerator : arcGenerator)(slice) || ""}
                  fill={fillColor}
                  fillOpacity={getFillOpacity()}
                  stroke={getStroke()}
                  strokeWidth={1.5}
                  filter={getShadowFilter()}
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
                    {slice.label.slice(0, Math.floor(angleDeg / 3))}
                  </text>
                )}
              </g>
            );
          })}
        </g>
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
                Others ({hoveredSlice.slice.othersCount} DReps)
              </div>
              <div className={`mt-1.5 space-y-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                <div>
                  <span className="font-medium">Share:</span>{" "}
                  {hoveredSlice.slice.percentage.toFixed(1)}%
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={isGame ? "font-semibold text-white" : "font-semibold text-foreground"}>
                #{hoveredSlice.slice.rank} {hoveredSlice.slice.drep?.name || "Anonymous"}
              </div>
              <div className={`mt-1.5 space-y-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                <div>
                  <span className="font-medium">Voting Power:</span>{" "}
                  {formatCompact(hoveredSlice.slice.drep?.votingPowerAda ?? 0)} ADA
                </div>
                <div>
                  <span className="font-medium">Delegators:</span>{" "}
                  {hoveredSlice.slice.drep?.delegatorCount != null ? hoveredSlice.slice.drep.delegatorCount.toLocaleString() : "--"}
                </div>
                <div>
                  <span className="font-medium">Votes Cast:</span>{" "}
                  {hoveredSlice.slice.drep?.totalVotesCast ?? 0}
                </div>
                <div>
                  <span className="font-medium">Rationales:</span>{" "}
                  {hoveredSlice.slice.drep ? (rationaleMap.get(hoveredSlice.slice.drep.drepId) ?? "--") : "--"}
                </div>
                <div>
                  <span className="font-medium">Share:</span>{" "}
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
