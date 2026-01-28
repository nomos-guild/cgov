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
  // Status - distinct colors
  active: "#22c55e", // green
  ratified: "#3b82f6", // blue
  enacted: "#8b5cf6", // purple
  expired: "#f97316", // orange
  closed: "#6b7280", // gray

  // Votes
  yes: "#22c55e",
  no: "#ef4444",
  abstain: "#94a3b8",

  // Participation levels
  participationLow: "#ef4444",
  participationMedLow: "#f97316",
  participationMedHigh: "#eab308",
  participationHigh: "#22c55e",

  // Palette for categorical data
  palette: [
    "#3b82f6", // blue
    "#22c55e", // green
    "#f97316", // orange
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#14b8a6", // teal
    "#f59e0b", // amber
  ],

  // Chart chrome
  axisLine: "#d1d5db",
  axisText: "#6b7280",
  gridLine: "#e5e7eb",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e5e7eb",
  tooltipText: "#1f2937",

  // Primary
  primary: "#000000",
  primaryMuted: "#6b7280",
};

export const darkChartColors: ChartThemeColors = {
  // Status - all cyan in dark theme for consistency
  active: "#0bd1a2",
  ratified: "#0bd1a2",
  enacted: "#0bd1a2",
  expired: "#0bd1a2",
  closed: "#0bd1a2",

  // Votes - cyan for yes, muted red for no
  yes: "#0bd1a2",
  no: "#ff6b6b",
  abstain: "#4a5568",

  // Participation - all cyan
  participationLow: "#0bd1a2",
  participationMedLow: "#0bd1a2",
  participationMedHigh: "#0bd1a2",
  participationHigh: "#0bd1a2",

  // Palette - cyan variations
  palette: [
    "#0bd1a2",
    "#0bd1a2",
    "#0bd1a2",
    "#0bd1a2",
    "#0bd1a2",
    "#0bd1a2",
    "#0bd1a2",
  ],

  // Chart chrome
  axisLine: "#0bd1a2",
  axisText: "#0bd1a2",
  gridLine: "rgba(11, 209, 162, 0.2)",
  tooltipBg: "#1a1a2e",
  tooltipBorder: "#0bd1a2",
  tooltipText: "#0bd1a2",

  // Primary
  primary: "#0bd1a2",
  primaryMuted: "rgba(11, 209, 162, 0.5)",
};

export const gameChartColors: ChartThemeColors = {
  // Status - white/gray scale
  active: "#ffffff",
  ratified: "#d1d5db",
  enacted: "#9ca3af",
  expired: "#6b7280",
  closed: "#4b5563",

  // Votes
  yes: "#22cc44",
  no: "#cc2222",
  abstain: "#6b7280",

  // Participation levels - white scale
  participationLow: "#4b5563",
  participationMedLow: "#6b7280",
  participationMedHigh: "#9ca3af",
  participationHigh: "#ffffff",

  // Palette - whites and grays
  palette: [
    "#ffffff",
    "#e5e7eb",
    "#d1d5db",
    "#9ca3af",
    "#6b7280",
    "#4b5563",
    "#374151",
  ],

  // Chart chrome
  axisLine: "rgba(255, 255, 255, 0.3)",
  axisText: "rgba(255, 255, 255, 0.8)",
  gridLine: "rgba(255, 255, 255, 0.1)",
  tooltipBg: "rgba(12, 12, 12, 0.95)",
  tooltipBorder: "rgba(255, 255, 255, 0.2)",
  tooltipText: "#ffffff",

  // Primary
  primary: "#ffffff",
  primaryMuted: "rgba(255, 255, 255, 0.5)",
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
  "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] " +
  "dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none " +
  "h-full flex flex-col";

/**
 * Game theme class name for dashboard chart cards
 */
export const chartCardGameClassName = "dashboard-chart-card";
