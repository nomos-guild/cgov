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
  // Status - warm, muted tones matching beige aesthetic
  active: "#2d8a6e", // muted teal-green
  ratified: "#3d7ea6", // muted blue
  enacted: "#7c5aa3", // muted purple
  expired: "#c2793d", // warm amber/orange
  closed: "#8b7e74", // warm gray

  // Votes - semantic colors, slightly muted
  yes: "#2d8a6e", // muted green
  no: "#c04c4c", // muted red
  abstain: "#a39890", // warm gray

  // Participation levels - warm gradient
  participationLow: "#c04c4c", // muted red
  participationMedLow: "#c2793d", // warm amber
  participationMedHigh: "#b5963c", // warm gold
  participationHigh: "#2d8a6e", // muted green

  // Palette for categorical data - harmonious warm tones
  palette: [
    "#3d7ea6", // muted blue
    "#2d8a6e", // muted teal-green
    "#c2793d", // warm amber
    "#7c5aa3", // muted purple
    "#b56576", // dusty rose
    "#4a8f8f", // teal
    "#9c7a3c", // warm gold
  ],

  // Chart chrome - warm grays matching beige theme
  axisLine: "#d4cdc4", // warm light gray
  axisText: "#6b6259", // warm dark gray
  gridLine: "#e8e2da", // warm very light gray
  tooltipBg: "#faf9f6", // matches light theme background
  tooltipBorder: "#d4cdc4", // warm border
  tooltipText: "#2d2926", // warm near-black

  // Primary
  primary: "#2d2926", // warm black (matches foreground)
  primaryMuted: "#8b7e74", // warm gray
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
  "rounded-xl border border-[#d4cdc4] bg-[#faf9f6] p-4 shadow-[0_8px_24px_rgba(45,41,38,0.08)] " +
  "dark:rounded-none dark:border-[rgba(11,209,162,0.4)] dark:bg-[rgba(19,19,32,0.6)] dark:shadow-[0_4px_20px_rgba(11,209,162,0.1)] " +
  "h-full flex flex-col";

/**
 * Game theme class name for dashboard chart cards
 */
export const chartCardGameClassName = "dashboard-chart-card";
