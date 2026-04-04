import { useMemo, useState, useRef } from "react";
import * as d3 from "d3";
import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";
import { ZoomLens, LENS_W, LENS_CHART_H } from "@/components/dreps/ZoomLens";
import type { ZoomLensTarget } from "@/components/dreps/ZoomLens";

type ChartMetric = "votingPower" | "delegators";

interface DRepTreeMapProps {
  dreps: DRepSummary[];
  metric: ChartMetric;
  topN?: number | null;
  rationaleMap: Map<string, number>;
  highlightedIds?: Set<string>;
}

interface DRepTile {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  drep: DRepSummary;
  rank: number;
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

export function DRepTreeMap({ dreps, metric, topN, rationaleMap, highlightedIds }: DRepTreeMapProps) {
  const t = useTranslations("drep");
  const { theme, activeTheme } = useTheme();
  const isDark = theme === "dark";
  const isGame = activeTheme.id === "game";
  const isLight = !isDark && !isGame;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredTile, setHoveredTile] = useState<{ tile: DRepTile; x: number; y: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hasHighlight = highlightedIds != null && highlightedIds.size > 0;

  const tiles = useMemo(() => {
    if (!dreps.length) return [] as DRepTile[];

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
      .sum((d) => (d.value ? d.value : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const treemapGenerator = d3
      .treemap<HierarchyDatum>()
      .size([SVG_WIDTH, SVG_HEIGHT])
      .tile(d3.treemapSquarify)
      .padding(2)
      .round(true);

    const root = treemapGenerator(hierarchy);
    const resultTiles: DRepTile[] = [];

    root.leaves().forEach((node) => {
      if (node.data.drep) {
        resultTiles.push({
          x0: node.x0,
          y0: node.y0,
          x1: node.x1,
          y1: node.y1,
          drep: node.data.drep,
          rank: node.data.rank ?? 0,
        });
      }
    });

    return resultTiles;
  }, [dreps, metric]);

  // Zoom lens target: first highlighted tile
  const lensTarget = useMemo((): ZoomLensTarget | null => {
    if (!hasHighlight || !tiles.length) return null;
    const tile = tiles.find((t) => highlightedIds!.has(t.drep.drepId));
    if (!tile) return null;
    return { x: (tile.x0 + tile.x1) / 2, y: (tile.y0 + tile.y1) / 2, drep: tile.drep, rank: tile.rank };
  }, [tiles, highlightedIds, hasHighlight]);

  const handleMouseEnter = (tile: DRepTile, event: React.MouseEvent<SVGRectElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setHoveredTile({
        tile,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredTile(null);
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
          {/* Light theme shadows */}
          <filter id="drep-tree-shadow-light" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>
            <feOffset dx="0" dy="3" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.18" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="drep-tree-shadow-hover-light" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
            <feOffset dx="0" dy="4" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.28" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="drep-tree-shadow-topn-light" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
            <feOffset dx="0" dy="4" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.28" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="drep-tree-shadow-topn-hover-light" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur"/>
            <feOffset dx="0" dy="5" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.35" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Dark theme shadows */}
          <filter id="drep-tree-shadow-dark" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur"/>
            <feOffset dx="0" dy="4" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.2" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="drep-tree-shadow-hover-dark" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur"/>
            <feOffset dx="0" dy="6" in="blur" result="offsetblur"/>
            <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.3" result="shadowColor"/>
            <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
            <feMerge>
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Game theme text gradient */}
          <linearGradient id="drep-tree-game-text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.9)"/>
            <stop offset="90%" stopColor="rgba(215, 215, 215, 0.8)"/>
            <stop offset="99%" stopColor="rgba(120, 120, 120, 0.7)"/>
            <stop offset="100%" stopColor="rgba(35, 35, 35, 0.08)"/>
          </linearGradient>
          <filter id="drep-tree-game-text-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.8)" floodOpacity="1"/>
          </filter>
          {/* Game theme hover glow */}
          <filter id="drep-tree-game-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
            <feFlood floodColor="rgba(255,255,255,0.15)" result="color"/>
            <feComposite in="color" in2="blur" operator="in" result="glow"/>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Clip paths for text inside tiles */}
          {tiles.map((tile) => (
            <clipPath key={`clip-${tile.drep.drepId}`} id={`clip-${tile.drep.drepId}`}>
              <rect
                x={tile.x0 + 2}
                y={tile.y0 + 2}
                width={Math.max(tile.x1 - tile.x0 - 4, 0)}
                height={Math.max(tile.y1 - tile.y0 - 4, 0)}
              />
            </clipPath>
          ))}
        </defs>
        <g>
          {tiles.map((tile) => {
            const isHovered = hoveredId === tile.drep.drepId;
            const isHighlighted = hasHighlight && highlightedIds!.has(tile.drep.drepId);
            const isDimmedBySearch = hasHighlight && !isHighlighted;
            const color = generateColor(tile.rank - 1, dreps.length);
            const w = tile.x1 - tile.x0;
            const h = tile.y1 - tile.y0;

            const hasTopNFilter = topN != null;
            const isInTopN = !hasTopNFilter || tile.rank <= topN;

            const getShadowFilter = () => {
              if (isGame) return "";
              if (isDark) return isHovered ? "url(#drep-tree-shadow-hover-dark)" : "url(#drep-tree-shadow-dark)";
              if (hasTopNFilter && isInTopN) {
                return isHovered ? "url(#drep-tree-shadow-topn-hover-light)" : "url(#drep-tree-shadow-topn-light)";
              }
              return isHovered ? "url(#drep-tree-shadow-hover-light)" : "url(#drep-tree-shadow-light)";
            };

            const getFillColor = () => {
              if (isGame) return "rgba(20, 20, 20, 0.7)";
              if (isDark) return "transparent";
              return "#ffffff";
            };

            // Game: rank-based stroke variation for visual hierarchy
            const rankRatio = 1 - (tile.rank - 1) / Math.max(dreps.length - 1, 1);
            const gameStrokeW = 0.4 + rankRatio * 0.8;
            const gameStrokeOpacity = 0.1 + rankRatio * 0.2;
            const strokeWidth = isGame ? gameStrokeW : isDark ? 1.2 : 0;
            const showLabel = w > 40 && h > 20 && isInTopN;
            const fontSize = Math.min(h * 0.25, w * 0.08, 14);

            return (
              <g key={tile.drep.drepId}>
                <rect
                  x={tile.x0}
                  y={tile.y0}
                  width={w}
                  height={h}
                  rx={3}
                  fill={getFillColor()}
                  stroke={isGame ? `rgba(255,255,255,${gameStrokeOpacity})` : isDark ? "#0bd1a2" : color}
                  strokeWidth={strokeWidth}
                  filter={isGame && isHovered ? "url(#drep-tree-game-glow)" : getShadowFilter()}
                  opacity={isDimmedBySearch ? 0.12 : isHovered ? 1 : 0.9}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={(e) => {
                    setHoveredId(tile.drep.drepId);
                    handleMouseEnter(tile, e);
                  }}
                  onMouseLeave={handleMouseLeave}
                />
                {isHighlighted && (
                  <rect
                    x={tile.x0 - 1}
                    y={tile.y0 - 1}
                    width={w + 2}
                    height={h + 2}
                    rx={4}
                    fill="none"
                    stroke={isGame ? "#ffd700" : isDark ? "#0bd1a2" : color}
                    strokeWidth={2.5}
                    className="pointer-events-none"
                  >
                    <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.5s" repeatCount="indefinite" />
                  </rect>
                )}
                {showLabel && (
                  <text
                    x={tile.x0 + w / 2}
                    y={tile.y0 + h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isGame ? "url(#drep-tree-game-text-gradient)" : isDark ? "#0bd1a2" : "#0f172a"}
                    filter={isGame ? "url(#drep-tree-game-text-shadow)" : undefined}
                    className="pointer-events-none font-semibold"
                    fontSize={fontSize}
                    clipPath={`url(#clip-${tile.drep.drepId})`}
                  >
                    {tile.drep.name || t("anonymous")}
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
            svgWidth={SVG_WIDTH}
            svgHeight={SVG_HEIGHT}
            isGame={isGame}
            isDark={isDark}
            isLight={isLight}
            rationaleMap={rationaleMap}
            idPrefix="treemap"
          >
            {(() => {
              const scale = 2.8;
              const lensX = lensTarget.x < SVG_WIDTH / 2 ? SVG_WIDTH - LENS_W - 16 : 16;
              const lensY = lensTarget.y < SVG_HEIGHT / 2 ? SVG_HEIGHT - (LENS_CHART_H + 135) - 16 : 16;
              return (
                <g transform={`translate(${lensX + LENS_W / 2 - lensTarget.x * scale}, ${lensY + LENS_CHART_H / 2 - lensTarget.y * scale}) scale(${scale})`}>
                  {tiles.map((tile) => {
                    const isMatch = highlightedIds!.has(tile.drep.drepId);
                    const lensColor = generateColor(tile.rank - 1, dreps.length);
                    const w = tile.x1 - tile.x0;
                    const h = tile.y1 - tile.y0;
                    const hasAvatar = isMatch && tile.drep.iconUrl;
                    const avatarR = 18;
                    return (
                      <g key={`lens-${tile.drep.drepId}`}>
                        <rect
                          x={tile.x0}
                          y={tile.y0}
                          width={w}
                          height={h}
                          rx={2}
                          fill={isMatch
                            ? (isGame ? "rgba(40,40,40,0.9)" : isDark ? "rgba(11,209,162,0.15)" : "#ffffff")
                            : (isGame ? "rgba(20,20,20,0.4)" : isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.5)")}
                          stroke={isMatch
                            ? (isGame ? "#ffd700" : isDark ? "#0bd1a2" : lensColor)
                            : (isGame ? "rgba(255,255,255,0.06)" : isDark ? "rgba(11,209,162,0.2)" : `${lensColor}40`)}
                          strokeWidth={isMatch ? 1 : 0.3}
                          opacity={isMatch ? 1 : 0.3}
                        />
                        {hasAvatar && (
                          <>
                            <defs>
                              <clipPath id={`lens-tree-avatar-${tile.drep.drepId}`}>
                                <circle cx={(tile.x0 + tile.x1) / 2} cy={(tile.y0 + tile.y1) / 2} r={avatarR} />
                              </clipPath>
                            </defs>
                            <image
                              href={tile.drep.iconUrl!}
                              x={(tile.x0 + tile.x1) / 2 - avatarR}
                              y={(tile.y0 + tile.y1) / 2 - avatarR}
                              width={avatarR * 2}
                              height={avatarR * 2}
                              clipPath={`url(#lens-tree-avatar-${tile.drep.drepId})`}
                              preserveAspectRatio="xMidYMid slice"
                            />
                            <circle
                              cx={(tile.x0 + tile.x1) / 2}
                              cy={(tile.y0 + tile.y1) / 2}
                              r={avatarR}
                              fill="none"
                              stroke={isGame ? "#ffd700" : isDark ? "#0bd1a2" : lensColor}
                              strokeWidth={1.5}
                            />
                          </>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })()}
          </ZoomLens>
        )}
      </svg>
      {hoveredTile && (
        <div
          className={
            isGame
              ? "absolute z-50 rounded-sm px-4 py-3 text-xs pointer-events-none game-tooltip-card"
              : "absolute z-50 rounded-2xl border border-border/40 bg-card px-4 py-3 text-xs shadow-elevation-2 pointer-events-none dark:rounded-none dark:border-[#0bd1a2] dark:bg-background dark:shadow-none"
          }
          style={{
            left: `${hoveredTile.x + 15}px`,
            top: `${Math.max(8, hoveredTile.y - 14)}px`,
            transform: "translateY(-100%)",
          }}
        >
          <div className={isGame ? "font-semibold text-white" : "font-semibold text-foreground"}>
            #{hoveredTile.tile.rank} {hoveredTile.tile.drep.name || t("anonymous")}
          </div>
          <div className={`mt-1.5 space-y-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
            <div>
              <span className="font-medium">{t("votingPower")}:</span>{" "}
              {formatCompact(hoveredTile.tile.drep.votingPowerAda)} ADA
            </div>
            <div>
              <span className="font-medium">{t("delegators")}:</span>{" "}
              {hoveredTile.tile.drep.delegatorCount != null ? hoveredTile.tile.drep.delegatorCount.toLocaleString() : "--"}
            </div>
            <div>
              <span className="font-medium">{t("votesCast")}:</span>{" "}
              {hoveredTile.tile.drep.totalVotesCast}
            </div>
            <div>
              <span className="font-medium">{t("rationales")}:</span>{" "}
              {rationaleMap.get(hoveredTile.tile.drep.drepId) ?? "--"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
