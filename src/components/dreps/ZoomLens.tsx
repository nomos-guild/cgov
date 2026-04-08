import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { DRepSummary } from "@/types/drep";

const LENS_W = 220;
const LENS_CHART_H = 150;
const LENS_INFO_H = 135;
const LENS_H = LENS_CHART_H + LENS_INFO_H;
const LENS_MARGIN = 16;

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export interface ZoomLensTarget {
  /** Center X of the target element in SVG coordinates */
  x: number;
  /** Center Y of the target element in SVG coordinates */
  y: number;
  drep: DRepSummary;
  rank: number;
}

interface ZoomLensProps {
  target: ZoomLensTarget;
  svgWidth: number;
  svgHeight: number;
  isGame: boolean;
  isDark: boolean;
  isLight: boolean;
  rationaleMap: Map<string, number>;
  /** Unique prefix for clipPath IDs to avoid collisions */
  idPrefix: string;
  /** The zoomed SVG content to render inside the lens chart area */
  children: ReactNode;
}

export function ZoomLens({
  target,
  svgWidth,
  svgHeight,
  isGame,
  isDark,
  isLight,
  rationaleMap,
  idPrefix,
  children,
}: ZoomLensProps) {
  const t = useTranslations("drep");

  // Place lens in the corner farthest from the target
  const lensX = target.x < svgWidth / 2
    ? svgWidth - LENS_W - LENS_MARGIN
    : LENS_MARGIN;
  const lensY = target.y < svgHeight / 2
    ? svgHeight - LENS_H - LENS_MARGIN
    : LENS_MARGIN;

  const drep = target.drep;
  const infoX = lensX + 10;
  const infoY = lensY + LENS_CHART_H + 14;
  const labelColor = isGame ? "rgba(255,255,255,0.5)" : isDark ? "rgba(11,209,162,0.6)" : "#64748b";
  const valueColor = isGame ? "#ffffff" : isDark ? "#0bd1a2" : "#0f172a";
  const nameColor = isGame ? "#ffd700" : isDark ? "#0bd1a2" : "#0f172a";

  const lines = [
    { label: `#${target.rank}`, value: drep.name || t("anonymous"), isName: true },
    { label: t("votingPower"), value: `${formatCompact(drep.votingPowerAda)} ADA` },
    { label: t("delegators"), value: drep.delegatorCount != null ? drep.delegatorCount.toLocaleString() : "--" },
    { label: t("votesCast"), value: String(drep.totalVotesCast) },
    { label: t("rationales"), value: String(rationaleMap.get(drep.drepId) ?? "--") },
  ];

  const btnY = infoY + lines.length * 12.5 + 14;
  const btnW = LENS_W - 20;
  const btnH = 34;
  const btnClass = isGame
    ? "game-tab-btn data-[state=active]:game-tab-btn-active text-xs"
    : "rounded-full border border-border bg-white text-black px-3 py-1.5 text-xs font-semibold uppercase tracking-wide shadow-elevation-2 hover:scale-101 hover:shadow-elevation-3 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:hover:bg-[#0bd1a2] dark:hover:text-black btn-neon";

  const clipId = `${idPrefix}-zoom-lens-clip`;

  return (
    <g className="pointer-events-none">
      {/* Dashed marker around target */}
      <circle
        cx={target.x}
        cy={target.y}
        r={20}
        fill="none"
        stroke={isGame ? "rgba(255,215,0,0.4)" : isDark ? "rgba(11,209,162,0.4)" : "rgba(0,0,0,0.2)"}
        strokeWidth={1}
        strokeDasharray="3,3"
      />

      {/* Connecting line */}
      <line
        x1={lensX + LENS_W / 2}
        y1={lensY + LENS_CHART_H / 2}
        x2={target.x}
        y2={target.y}
        stroke={isGame ? "rgba(255,215,0,0.3)" : isDark ? "rgba(11,209,162,0.3)" : "rgba(0,0,0,0.15)"}
        strokeWidth={1}
        strokeDasharray="4,4"
      />

      {/* Background */}
      <rect
        x={lensX}
        y={lensY}
        width={LENS_W}
        height={LENS_H}
        rx={isGame ? 2 : isLight ? 12 : 0}
        fill={isGame ? "rgba(12,12,12,0.85)" : isDark ? "rgba(0,0,0,0.8)" : "rgba(250,249,246,0.95)"}
      />

      {/* Zoomed content clipped to chart area */}
      <defs>
        <clipPath id={clipId}>
          <rect
            x={lensX}
            y={lensY}
            width={LENS_W}
            height={LENS_CHART_H}
            rx={isGame ? 2 : isLight ? 12 : 0}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {children}
      </g>

      {/* Separator */}
      <line
        x1={lensX + 8}
        y1={lensY + LENS_CHART_H}
        x2={lensX + LENS_W - 8}
        y2={lensY + LENS_CHART_H}
        stroke={isGame ? "rgba(255,215,0,0.25)" : isDark ? "rgba(11,209,162,0.3)" : "rgba(0,0,0,0.1)"}
        strokeWidth={1}
      />

      {/* Info panel */}
      <g>
        {lines.map((line, i) => {
          const y = infoY + i * 12.5;
          return line.isName ? (
            <text key={i} x={infoX} y={y} fill={nameColor} fontSize={10} fontWeight={600}>
              {line.label} {line.value}
            </text>
          ) : (
            <text key={i} x={infoX} y={y} fontSize={9}>
              <tspan fill={labelColor}>{line.label}: </tspan>
              <tspan fill={valueColor} fontWeight={600}>{line.value}</tspan>
            </text>
          );
        })}
        <foreignObject
          x={infoX - 10}
          y={btnY - 10}
          width={btnW + 20}
          height={btnH + 20}
          style={{ pointerEvents: "auto", overflow: "visible" }}
        >
          <div style={{ padding: 10 }}>
            <a
              href={`/drep/${encodeURIComponent(drep.drepId)}`}
              className={`${btnClass} inline-flex w-full items-center justify-center whitespace-nowrap`}
              data-state="active"
            >
              {t("viewProfile")}
            </a>
          </div>
        </foreignObject>
      </g>

      {/* Border */}
      <rect
        x={lensX}
        y={lensY}
        width={LENS_W}
        height={LENS_H}
        rx={isGame ? 2 : isLight ? 12 : 0}
        fill="none"
        stroke={isGame ? "rgba(255,215,0,0.5)" : isDark ? "#0bd1a2" : "rgba(0,0,0,0.2)"}
        strokeWidth={isGame ? 1.5 : isDark ? 1 : 1.5}
      />
    </g>
  );
}

// Export constants for use in chart-specific zoom transforms
export { LENS_W, LENS_CHART_H, LENS_MARGIN, LENS_H };
