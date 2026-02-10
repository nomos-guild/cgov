import { useMemo, useState, useRef } from "react";
import * as d3 from "d3";
import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";

type ChartMetric = "votingPower" | "delegators";

interface DRepBubbleMapProps {
  dreps: DRepSummary[];
  metric: ChartMetric;
  topN?: number | null;
  rationaleMap: Map<string, number>;
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
  }
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 600;

export function DRepBubbleMap({ dreps, metric, topN, rationaleMap }: DRepBubbleMapProps) {
  const t = useTranslations("drep");
  const { theme, activeTheme } = useTheme();
  const isDark = theme === "dark";
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light";
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBubble, setHoveredBubble] = useState<{ bubble: DRepBubble; x: number; y: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Always flat hierarchy — positions stay fixed regardless of topN
  const bubbles = useMemo(() => {
    if (!dreps.length) return [] as DRepBubble[];

    const leafChildren = dreps.map((drep, index) => ({
      name: drep.name || "Anonymous",
      value: getMetricValue(drep, metric),
      drep,
      rank: index + 1,
    }));

    const hierarchicalData: HierarchyDatum = {
      name: "root",
      children: leafChildren,
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
    const resultBubbles: DRepBubble[] = [];

    root.descendants().forEach((node) => {
      if (node.depth === 0) return;

      if (node.data.drep) {
        const drep = node.data.drep;
        const rank = node.data.rank ?? 0;
        const color = generateColor(rank - 1, total);

        resultBubbles.push({
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

    return resultBubbles;
  }, [dreps, metric, isLight, isDark]);

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

  return (
    <div ref={containerRef} className="w-full relative overflow-hidden" onMouseLeave={handleMouseLeave}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-auto max-h-[500px] sm:max-h-[700px]"
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
          {/* Light theme emphasized shadow for top-N bubbles */}
          <filter id="drep-bubble-shadow-topn-light" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="16" result="blur"/>
            <feOffset dx="0" dy="10" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.35" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="drep-bubble-shadow-topn-hover-light" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="20" result="blur"/>
            <feOffset dx="0" dy="14" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.42" result="shadowColor"/>
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
          {/* Game theme hover glow */}
          <filter id="drep-bubble-game-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
            <feFlood floodColor="rgba(255,255,255,0.18)" result="color"/>
            <feComposite in="color" in2="blur" operator="in" result="glow"/>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g>
          {/* Render hovered bubble last so it paints on top */}
          {(hoveredId ? [...bubbles].sort((a, b) => a.drep.drepId === hoveredId ? 1 : b.drep.drepId === hoveredId ? -1 : 0) : bubbles).map((bubble) => {
            const isHovered = hoveredId === bubble.drep.drepId;
            const scale = isHovered ? 1.08 : 1;
            const color = generateColor(bubble.rank - 1, dreps.length);

            const hasTopNFilter = topN != null;
            const isInTopN = !hasTopNFilter || bubble.rank <= topN;
            const getShadowFilter = () => {
              if (isGame) return "";
              if (isDark) return isHovered ? "url(#drep-bubble-shadow-hover-dark)" : "url(#drep-bubble-shadow-dark)";
              if (hasTopNFilter && isInTopN) {
                return isHovered ? "url(#drep-bubble-shadow-topn-hover-light)" : "url(#drep-bubble-shadow-topn-light)";
              }
              return isHovered ? "url(#drep-bubble-shadow-hover-light)" : "url(#drep-bubble-shadow-light)";
            };

            const getFillColor = () => {
              if (isGame) return "rgba(20, 20, 20, 0.7)";
              if (isDark) return "transparent";
              return "#ffffff";
            };

            // Game: rank-based stroke variation for visual hierarchy
            const rankRatio = 1 - (bubble.rank - 1) / Math.max(dreps.length - 1, 1);
            const gameStrokeW = 0.4 + rankRatio * 0.9;
            const gameStrokeOpacity = 0.12 + rankRatio * 0.22;
            const strokeWidth = isGame ? gameStrokeW : isDark ? 1.4 : 0;
            const showLabel = bubble.radius > 12 && isInTopN;
            const fontSize = Math.min(bubble.radius * 0.35, 14);
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
                  stroke={isGame ? `rgba(255,255,255,${gameStrokeOpacity})` : isDark ? "#0bd1a2" : color}
                  strokeWidth={strokeWidth}
                  filter={isGame && isHovered ? "url(#drep-bubble-game-glow)" : getShadowFilter()}
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
                    fill={isGame ? "url(#drep-game-text-gradient)" : isDark ? "#0bd1a2" : "#0f172a"}
                    filter={isGame ? "url(#drep-game-text-shadow)" : undefined}
                    className="pointer-events-none font-semibold"
                    fontSize={fontSize}
                  >
                    {(bubble.drep.name || t("anonymous")).slice(0, charSlots)}
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
            #{hoveredBubble.bubble.rank} {hoveredBubble.bubble.drep.name || t("anonymous")}
          </div>
          <div className={`mt-1.5 space-y-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
            <div>
              <span className="font-medium">{t("votingPower")}:</span>{" "}
              {formatCompact(hoveredBubble.bubble.drep.votingPowerAda)} ADA
            </div>
            <div>
              <span className="font-medium">{t("delegators")}:</span>{" "}
              {hoveredBubble.bubble.drep.delegatorCount != null ? hoveredBubble.bubble.drep.delegatorCount.toLocaleString() : "--"}
            </div>
            <div>
              <span className="font-medium">{t("votesCast")}:</span>{" "}
              {hoveredBubble.bubble.drep.totalVotesCast}
            </div>
            <div>
              <span className="font-medium">{t("rationales")}:</span>{" "}
              {rationaleMap.get(hoveredBubble.bubble.drep.drepId) ?? "--"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
