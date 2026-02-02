/**
 * Chart theme colors configuration
 * Provides consistent colors across all themes (light, dark, game)
 */

export interface ChartThemeColors {
  // Status colors
  active: string;
  ratified: string;
  enacted: string;
  expired: string;
  closed: string;

  // Vote colors
  yes: string;
  no: string;
  abstain: string;

  // Participation levels
  participationLow: string;
  participationMedLow: string;
  participationMedHigh: string;
  participationHigh: string;

  // General chart colors (for pie charts, etc.)
  palette: string[];

  // Chart chrome
  axisLine: string;
  axisText: string;
  gridLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;

  // Primary accent for single-color charts
  primary: string;
  primaryMuted: string;
}

export const lightChartColors: ChartThemeColors = {
  // Status - monochromatic grayscale
  active: "#1a1a1a", // near black
  ratified: "#404040", // dark gray
  enacted: "#666666", // medium gray
  expired: "#999999", // light gray
  closed: "#b3b3b3", // lighter gray

  // Votes - black/gray spectrum
  yes: "#1a1a1a", // near black
  no: "#808080", // medium gray
  abstain: "#c0c0c0", // light gray

  // Participation levels - grayscale gradient
  participationLow: "#d0d0d0", // lightest
  participationMedLow: "#999999", // light gray
  participationMedHigh: "#666666", // medium gray
  participationHigh: "#1a1a1a", // near black (highest)

  // Palette for categorical data - grayscale spectrum
  palette: [
    "#1a1a1a", // near black
    "#404040", // dark gray
    "#666666", // medium gray
    "#808080", // gray
    "#999999", // light gray
    "#b3b3b3", // lighter gray
    "#cccccc", // very light gray
  ],

  // Chart chrome - clean grays
  axisLine: "#d4d4d4", // light gray
  axisText: "#525252", // dark gray
  gridLine: "#e5e5e5", // very light gray
  tooltipBg: "#ffffff", // white
  tooltipBorder: "#d4d4d4", // light gray border
  tooltipText: "#1a1a1a", // near black

  // Primary
  primary: "#1a1a1a", // near black
  primaryMuted: "#999999", // medium gray
};

export const darkChartColors: ChartThemeColors = {
  // Status - cyan variations for subtle distinction
  active: "#0bd1a2", // primary cyan
  ratified: "#08a883", // darker cyan
  enacted: "#0eb8a0", // mid cyan
  expired: "#06c9b5", // cyan-teal
  closed: "#069b7d", // muted cyan

  // Votes - cyan for yes, muted red for no
  yes: "#0bd1a2",
  no: "#8C200B", // dark red matching theme
  abstain: "#4a5568",

  // Participation - cyan gradient
  participationLow: "#069b7d", // muted cyan
  participationMedLow: "#08a883", // darker cyan
  participationMedHigh: "#0eb8a0", // mid cyan
  participationHigh: "#0bd1a2", // bright cyan

  // Palette - subtle cyan variations for charts
  palette: [
    "#0bd1a2", // primary cyan
    "#08a883", // darker cyan
    "#06c9b5", // cyan-teal
    "#0eb8a0", // mid cyan
    "#069b7d", // muted cyan
    "#05b399", // teal-cyan
    "#0ac4a0", // light cyan
  ],

  // Chart chrome
  axisLine: "rgba(11, 209, 162, 0.5)",
  axisText: "rgba(11, 209, 162, 0.8)",
  gridLine: "rgba(11, 209, 162, 0.15)",
  tooltipBg: "#131320",
  tooltipBorder: "#0bd1a2",
  tooltipText: "#0bd1a2",

  // Primary
  primary: "#0bd1a2",
  primaryMuted: "rgba(11, 209, 162, 0.5)",
};

export const gameChartColors: ChartThemeColors = {
  // Status - high contrast grayscale with green accent
  active: "#00ff66", // neon green for active
  ratified: "#e0e0e0", // bright white
  enacted: "#b0b0b0", // light gray
  expired: "#707070", // medium gray
  closed: "#404040", // dark gray

  // Votes - retro neon colors
  yes: "#00ff66", // neon green
  no: "#ff3333", // neon red
  abstain: "#606060", // medium gray

  // Participation levels - grayscale gradient
  participationLow: "#404040", // dark gray
  participationMedLow: "#707070", // medium gray
  participationMedHigh: "#b0b0b0", // light gray
  participationHigh: "#00ff66", // neon green for high

  // Palette - alternating white/gray with green accent
  palette: [
    "#00ff66", // neon green (primary)
    "#e0e0e0", // bright white
    "#909090", // mid gray
    "#c0c0c0", // light gray
    "#606060", // darker gray
    "#d0d0d0", // off-white
    "#505050", // dark gray
  ],

  // Chart chrome - crisp white on black
  axisLine: "rgba(255, 255, 255, 0.25)",
  axisText: "rgba(255, 255, 255, 0.7)",
  gridLine: "rgba(255, 255, 255, 0.08)",
  tooltipBg: "rgba(8, 8, 8, 0.95)",
  tooltipBorder: "rgba(255, 255, 255, 0.15)",
  tooltipText: "#ffffff",

  // Primary
  primary: "#00ff66", // neon green for line charts
  primaryMuted: "rgba(255, 255, 255, 0.4)",
};

/**
 * Get chart colors based on theme ID
 */
export function getChartColors(themeId: string): ChartThemeColors {
  switch (themeId) {
    case "dark":
      return darkChartColors;
    case "game":
      return gameChartColors;
    default:
      return lightChartColors;
  }
}

/**
 * Common card className for dashboard charts
 * Includes all theme variations
 */
export const chartCardClassName =
  "rounded-xl border-none bg-white p-4 shadow-[0_8px_24px_rgba(45,41,38,0.12)] " +
  "dark:rounded-none dark:border dark:border-[rgba(11,209,162,0.4)] dark:bg-[rgba(19,19,32,0.6)] dark:shadow-[0_4px_20px_rgba(11,209,162,0.1)] " +
  "h-full flex flex-col";

/**
 * Game theme class name for dashboard chart cards
 */
export const chartCardGameClassName = "dashboard-chart-card";

/**
 * Get tooltip styles matching chart card design
 * Returns both contentStyle and wrapperStyle for Recharts Tooltip
 */
export function getTooltipStyles(themeId: string) {
  switch (themeId) {
    case "dark":
      return {
        contentStyle: {
          backgroundColor: darkChartColors.tooltipBg,
          border: `1px solid ${darkChartColors.tooltipBorder}`,
          borderRadius: "0",
          padding: "8px 12px",
        },
        wrapperStyle: {
          outline: "none",
        },
        itemStyle: {
          color: darkChartColors.tooltipText,
        },
        labelStyle: {
          color: darkChartColors.tooltipText,
          fontWeight: 600,
          marginBottom: "4px",
        },
      };
    case "game":
      return {
        contentStyle: {
          backgroundColor: gameChartColors.tooltipBg,
          border: `1px solid ${gameChartColors.tooltipBorder}`,
          borderRadius: "0",
          padding: "8px 12px",
        },
        wrapperStyle: {
          outline: "none",
        },
        itemStyle: {
          color: gameChartColors.tooltipText,
        },
        labelStyle: {
          color: gameChartColors.tooltipText,
          fontWeight: 600,
          marginBottom: "4px",
        },
      };
    default:
      return {
        contentStyle: {
          backgroundColor: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: "12px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
          padding: "8px 12px",
        },
        wrapperStyle: {
          outline: "none",
        },
        itemStyle: {
          color: lightChartColors.tooltipText,
        },
        labelStyle: {
          color: lightChartColors.tooltipText,
          fontWeight: 600,
          marginBottom: "4px",
        },
      };
  }
}

/**
 * @deprecated Use getTooltipStyles instead
 */
export function getTooltipStyle(themeId: string) {
  return getTooltipStyles(themeId).contentStyle;
}

/**
 * Custom tooltip content component for Recharts
 * Use with <Tooltip content={<ChartTooltip themeId={activeTheme.id} />} />
 */
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  themeId: string;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label: string) => string;
}

export function ChartTooltip({
  payload,
  label,
  themeId,
  valueFormatter,
  labelFormatter,
}: ChartTooltipProps) {
  const hasData = payload && payload.length > 0;
  const isGame = themeId === "game";
  const isDark = themeId === "dark";

  const themeStyle: React.CSSProperties = isGame
    ? {
        backgroundColor: "#080808",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "0",
        padding: "8px 12px",
        color: "#ffffff",
      }
    : isDark
      ? {
          backgroundColor: "#131320",
          border: "1px solid #0bd1a2",
          borderRadius: "0",
          padding: "8px 12px",
          color: "#0bd1a2",
        }
      : {
          backgroundColor: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: "12px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
          padding: "8px 12px",
          color: "#1a1a1a",
        };

  // Don't render if no data
  if (!hasData) {
    return null;
  }

  const displayLabel = labelFormatter ? labelFormatter(String(label)) : label;

  return (
    <div style={themeStyle}>
      {displayLabel && (
        <p style={{ fontWeight: 600, marginBottom: "4px", fontSize: "12px" }}>
          {displayLabel}
        </p>
      )}
      {payload?.map((entry, index) => (
        <p key={index} style={{ fontSize: "12px", margin: "2px 0" }}>
          <span style={{ color: entry.color, marginRight: "6px" }}>●</span>
          {entry.name}: {valueFormatter ? valueFormatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}
