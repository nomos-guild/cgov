import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";

type ChartMetric = "votingPower" | "delegators" | "votesCast";

interface DRepBubbleMapProps {
  dreps: DRepSummary[];
  metric: ChartMetric;
  rationaleMap: Map<string, number>;
  zoomEnabled?: boolean;
  focusDRepId?: string | null;
}

interface DRepBubble {
  x: number;
  y: number;
  radius: number;
  drep: DRepSummary;
  rank: number;
  fillColor: string;
  borderColor: string;
}

type HierarchyDatum = {
  name: string;
  value?: number;
  drep?: DRepSummary;
  rank?: number;
  children?: HierarchyDatum[];
};

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

const SVG_WIDTH = 800;
const SVG_HEIGHT = 600;

export function DRepBubbleMap({ dreps, metric, rationaleMap, zoomEnabled = true, focusDRepId }: DRepBubbleMapProps) {
  const { theme, activeTheme } = useTheme();
  const isDark = theme === "dark";
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light";
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hoveredBubble, setHoveredBubble] = useState<{ bubble: DRepBubble; x: number; y: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const isZoomed = transform.k !== 1 || transform.x !== 0 || transform.y !== 0;

  const bubbles = useMemo(() => {
    if (!dreps.length) return [];

    const hierarchicalData: HierarchyDatum = {
      name: "root",
      children: dreps.map((drep, index) => ({
        name: drep.name || "Anonymous",
        value: getMetricValue(drep, metric),
        drep,
        rank: index + 1,
      })),
    };

    const hierarchy = d3
      .hierarchy<HierarchyDatum>(hierarchicalData)
      .sum((d) => (d.value ? d.value : 0));

    const packGenerator = d3
      .pack<HierarchyDatum>()
      .size([SVG_WIDTH, SVG_HEIGHT])
      .padding(1);

    const root = packGenerator(hierarchy as d3.HierarchyNode<HierarchyDatum>);
    const total = dreps.length;
    const result: DRepBubble[] = [];

    root.descendants().forEach((node) => {
      if (node.data && node.data.drep && !node.children) {
        const drep = node.data.drep;
        const rank = node.data.rank ?? 0;
        const color = generateColor(rank - 1, total);

        result.push({
          x: node.x,
          y: node.y,
          radius: node.r,
          drep,
          rank,
          fillColor: isLight ? "rgba(0,0,0,0.04)" : isDark ? "transparent" : color,
          borderColor: isLight ? color : color,
        });
      }
    });

    return result;
  }, [dreps, metric, isLight, isDark]);

  // Setup D3 zoom — attach/detach based on zoomEnabled prop
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = svgRef.current;

    if (!zoomEnabled) {
      // Detach zoom and reset to identity
      d3.select(svg).on(".zoom", null);
      zoomRef.current = null;
      if (transform.k !== 1 || transform.x !== 0 || transform.y !== 0) {
        setTransform(d3.zoomIdentity);
      }
      return;
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 60])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const t = event.transform;
        // At minimum zoom with leftover pan offset — snap back to default view
        if (t.k <= 1 && (t.x !== 0 || t.y !== 0)) {
          d3.select(svg).call(zoom.transform, d3.zoomIdentity);
          return;
        }
        setTransform(t);
        // Dismiss tooltip while zooming/panning
        setHoveredBubble(null);
        setHoveredId(null);
      });

    zoomRef.current = zoom;
    d3.select(svg).call(zoom);

    return () => {
      d3.select(svg).on(".zoom", null);
    };
  }, [zoomEnabled]);

  // Zoom to a specific DRep bubble when focusDRepId changes
  useEffect(() => {
    if (!focusDRepId || !svgRef.current || !zoomRef.current) return;
    const target = bubbles.find((b) => b.drep.drepId === focusDRepId);
    if (!target) return;

    // Zoom level: fill ~60% of viewport with the bubble, capped to scaleExtent
    const k = Math.min(Math.max((SVG_HEIGHT * 0.3) / target.radius, 2), 30);
    const tx = SVG_WIDTH / 2 - target.x * k;
    const ty = SVG_HEIGHT / 2 - target.y * k;
    const newTransform = d3.zoomIdentity.translate(tx, ty).scale(k);

    d3.select(svgRef.current)
      .transition()
      .duration(1400)
      .ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform, newTransform);
  }, [focusDRepId, bubbles]);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.scaleBy, 2);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.scaleBy, 0.5);
  }, []);

  const handleReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  const handleMouseEnter = (bubble: DRepBubble, event: React.MouseEvent<SVGCircleElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setHoveredBubble({
        bubble,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredBubble(null);
    setHoveredId(null);
  };

  if (!dreps.length) return null;

  const btnClass = isGame
    ? "game-tab-btn text-[10px] sm:text-xs h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center"
    : "rounded-md border border-white/8 bg-white text-black h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center text-sm font-semibold shadow-[0_12px_30px_rgba(15,23,42,0.25)] hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] transform-gpu transition-transform transition-shadow duration-450 ease-in-out dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:hover:bg-[#0bd1a2] dark:hover:text-black btn-neon";

  return (
    <div ref={containerRef} className="w-full relative overflow-hidden" onMouseLeave={handleMouseLeave}>
      {/* Zoom controls — only visible when zoom is enabled */}
      {zoomEnabled && (
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <button onClick={handleZoomIn} className={btnClass} title="Zoom in">+</button>
          <button onClick={handleZoomOut} className={btnClass} title="Zoom out">&minus;</button>
          {isZoomed && (
            <button onClick={handleReset} className={btnClass} title="Reset zoom">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 sm:w-3.5 sm:h-3.5">
                <path d="M3.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 0-1H4.354L6.03 3.354A4.5 4.5 0 1 1 3.535 10.5a.5.5 0 1 0-.97.242A5.5 5.5 0 1 0 6.737 2.646L5 4.354V2.5a.5.5 0 0 0-.5-.5h-1z"/>
              </svg>
            </button>
          )}
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className={`w-full h-auto max-h-[500px] sm:max-h-[700px] ${zoomEnabled ? "cursor-grab active:cursor-grabbing" : ""}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Light theme shadows — matches card shadow-[0_12px_30px_rgba(15,23,42,0.25)] */}
          <filter id="drep-bubble-shadow-light" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur"/>
            <feOffset dx="0" dy="8" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.25" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="drep-bubble-shadow-hover-light" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="16" result="blur"/>
            <feOffset dx="0" dy="12" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.32" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Dark theme shadows */}
          <filter id="drep-bubble-shadow-dark" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="15" result="blur"/>
            <feOffset dx="0" dy="12" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.25" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="drep-bubble-shadow-hover-dark" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="20" result="blur"/>
            <feOffset dx="0" dy="16" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.35" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Game theme text gradient */}
          <linearGradient id="drep-game-text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.9)"/>
            <stop offset="90%" stopColor="rgba(215, 215, 215, 0.8)"/>
            <stop offset="99%" stopColor="rgba(120, 120, 120, 0.7)"/>
            <stop offset="100%" stopColor="rgba(35, 35, 35, 0.08)"/>
          </linearGradient>
          <filter id="drep-game-text-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.8)" floodOpacity="1"/>
          </filter>
        </defs>
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {/* Render hovered bubble last so it paints on top */}
          {(hoveredId ? [...bubbles].sort((a, b) => a.drep.drepId === hoveredId ? 1 : b.drep.drepId === hoveredId ? -1 : 0) : bubbles).map((bubble) => {
            const isHovered = hoveredId === bubble.drep.drepId;
            const scale = isHovered ? 1.08 : 1;
            const color = generateColor(bubble.rank - 1, dreps.length);
            const k = transform.k;

            const getShadowFilter = () => {
              if (isGame) return "";
              if (isDark) return isHovered ? "url(#drep-bubble-shadow-hover-dark)" : "url(#drep-bubble-shadow-dark)";
              return isHovered ? "url(#drep-bubble-shadow-hover-light)" : "url(#drep-bubble-shadow-light)";
            };

            const getFillColor = () => {
              if (isGame) return color;
              if (isDark) return "transparent";
              return "#ffffff";
            };

            // Adapt stroke width to zoom: keep visual thickness constant
            const baseStroke = isGame ? 0 : isDark ? 1.4 : 0;
            const adaptedStroke = baseStroke / k;

            // Label sizing — always relative to the bubble so text never overflows
            const visualRadius = bubble.radius * k;
            const showLabel = visualRadius > 12;
            // Font size: always proportional to radius, capped for visual comfort
            const fontSize = Math.min(bubble.radius * 0.35, 14 / k);
            // How many chars fit: use ~80% of diameter, assume char width ≈ 0.6 × fontSize
            const availableWidth = bubble.radius * 1.6;
            const charSlots = Math.max(Math.floor(availableWidth / (fontSize * 0.6)), 2);

            return (
              <g
                key={bubble.drep.drepId}
                style={{
                  transform: `translate(${bubble.x}px, ${bubble.y}px) scale(${scale}) translate(${-bubble.x}px, ${-bubble.y}px)`,
                  transition: "transform 0.3s ease",
                }}
              >
                <circle
                  cx={bubble.x}
                  cy={bubble.y}
                  r={bubble.radius}
                  fill={getFillColor()}
                  stroke={color}
                  strokeWidth={adaptedStroke}
                  filter={getShadowFilter()}
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    setHoveredId(bubble.drep.drepId);
                    handleMouseEnter(bubble, e);
                  }}
                  onMouseLeave={handleMouseLeave}
                />
                {showLabel && (
                  <text
                    x={bubble.x}
                    y={bubble.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isGame ? "url(#drep-game-text-gradient)" : isDark ? color : "#0f172a"}
                    filter={isGame ? "url(#drep-game-text-shadow)" : undefined}
                    className="pointer-events-none font-semibold"
                    fontSize={fontSize}
                  >
                    {(bubble.drep.name || "Anonymous").slice(0, charSlots)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {hoveredBubble && (
        <div
          className={
            isGame
              ? "absolute z-50 rounded-sm px-4 py-3 text-xs pointer-events-none game-tooltip-card"
              : "absolute z-50 rounded-2xl border border-white/8 bg-[#faf9f6] px-4 py-3 text-xs shadow-[0_12px_30px_rgba(15,23,42,0.25)] pointer-events-none dark:rounded-none dark:border-[#0bd1a2] dark:bg-background dark:shadow-none"
          }
          style={{
            left: `${hoveredBubble.x + 15}px`,
            top: `${Math.max(8, hoveredBubble.y - 14)}px`,
            transform: "translateY(-100%)",
          }}
        >
          <div className={isGame ? "font-semibold text-white" : "font-semibold text-foreground"}>
            #{hoveredBubble.bubble.rank} {hoveredBubble.bubble.drep.name || "Anonymous"}
          </div>
          <div className={`mt-1.5 space-y-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
            <div>
              <span className="font-medium">Voting Power:</span>{" "}
              {formatCompact(hoveredBubble.bubble.drep.votingPowerAda)} ADA
            </div>
            <div>
              <span className="font-medium">Delegators:</span>{" "}
              {hoveredBubble.bubble.drep.delegatorCount != null ? hoveredBubble.bubble.drep.delegatorCount.toLocaleString() : "--"}
            </div>
            <div>
              <span className="font-medium">Votes Cast:</span>{" "}
              {hoveredBubble.bubble.drep.totalVotesCast}
            </div>
            <div>
              <span className="font-medium">Rationales:</span>{" "}
              {rationaleMap.get(hoveredBubble.bubble.drep.drepId) ?? "--"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
