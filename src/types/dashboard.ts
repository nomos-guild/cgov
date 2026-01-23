import type { ComponentType } from "react";

/**
 * Unique identifier for each dashboard chart
 */
export type ChartId =
  | "proposal-status"
  | "proposal-type"
  | "ncl-progress"
  | "voting-power"
  | "participation"
  | "proposal-submission";

/**
 * Pixel-based layout for a chart (fully free-form)
 */
export interface ChartLayout {
  /** X position in pixels from left */
  x: number;
  /** Y position in pixels from top */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Layout configuration for all charts
 */
export type ChartLayoutMap = Record<ChartId, ChartLayout>;

/**
 * Configuration for dashboard layout and visibility
 */
export interface DashboardConfig {
  /** Chart IDs that are currently visible */
  visibleCharts: ChartId[];
  /** Layout configuration for each chart */
  layouts: ChartLayoutMap;
  /** Version for future migrations */
  version: number;
}

/**
 * Props passed to all chart components
 */
export interface ChartProps {
  /** Whether the chart is in a loading state */
  isLoading?: boolean;
  /** Optional className for styling */
  className?: string;
}

/**
 * Chart definition in the registry
 */
export interface ChartDefinition {
  id: ChartId;
  title: string;
  description: string;
  component: ComponentType<ChartProps>;
  /** Whether visible by default for new users */
  defaultVisible: boolean;
  /** Default layout for this chart */
  defaultLayout: ChartLayout;
  /** Icon component for the dropdown */
  icon?: ComponentType<{ className?: string }>;
}

/**
 * Context value for dashboard state
 */
export interface DashboardContextValue {
  config: DashboardConfig;
  mounted: boolean;
  isChartVisible: (chartId: ChartId) => boolean;
  toggleChartVisibility: (chartId: ChartId) => void;
  setVisibleCharts: (chartIds: ChartId[]) => void;
  getLayout: (chartId: ChartId) => ChartLayout;
  updateLayout: (chartId: ChartId, layout: Partial<ChartLayout>) => void;
  resetToDefaults: () => void;
}

/**
 * All available chart IDs for iteration
 */
export const ALL_CHART_IDS: ChartId[] = [
  "proposal-status",
  "proposal-type",
  "ncl-progress",
  "voting-power",
  "participation",
  "proposal-submission",
];

/**
 * Layout constraints
 */
export const LAYOUT_CONSTRAINTS = {
  minWidth: 280,
  minHeight: 200,
  maxWidth: 1200,
  maxHeight: 800,
  /** Fixed gap between cards (prevents overlap) */
  gap: 16,
};

/**
 * Default layouts for all charts (pixel-based positions)
 */
export const DEFAULT_CHART_LAYOUTS: ChartLayoutMap = {
  "proposal-status": { x: 0, y: 0, width: 380, height: 320 },
  "proposal-type": { x: 396, y: 0, width: 380, height: 320 },
  "ncl-progress": { x: 792, y: 0, width: 380, height: 320 },
  "voting-power": { x: 0, y: 336, width: 580, height: 320 },
  "participation": { x: 596, y: 336, width: 580, height: 320 },
  "proposal-submission": { x: 0, y: 672, width: 780, height: 320 },
};

/**
 * Default dashboard configuration for new users
 */
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  visibleCharts: ALL_CHART_IDS,
  layouts: DEFAULT_CHART_LAYOUTS,
  version: 7,
};
