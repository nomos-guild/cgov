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
 * Text element for custom titles/labels on the dashboard
 */
export interface TextElement {
  /** Unique identifier */
  id: string;
  /** Text content */
  text: string;
  /** X position in pixels from left */
  x: number;
  /** Y position in pixels from top */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Font size in pixels */
  fontSize: number;
}

/**
 * Configuration for dashboard layout and visibility
 */
export interface DashboardConfig {
  /** Chart IDs that are currently visible */
  visibleCharts: ChartId[];
  /** Order of charts in the customize menu (all charts, not just visible) */
  chartOrder: ChartId[];
  /** Layout configuration for each chart */
  layouts: ChartLayoutMap;
  /** Text elements on the dashboard */
  textElements: TextElement[];
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
  reorderCharts: (fromIndex: number, toIndex: number) => void;
  resetToDefaults: () => void;
  addTextElement: () => void;
  updateTextElement: (id: string, updates: Partial<TextElement>) => void;
  removeTextElement: (id: string) => void;
  exportConfig: () => string;
  importConfig: (code: string) => { success: boolean; error?: string };
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
 * Grid configuration for snap-to-grid behavior
 */
export const GRID_CONFIG = {
  /** Cell size in pixels - fine enough for high resizability */
  cellSize: 20,
  /** Gap between cards in grid cells */
  gapCells: 1,
};

/**
 * Layout constraints
 */
export const LAYOUT_CONSTRAINTS = {
  /** Minimum width in grid cells */
  minWidthCells: 14, // 280px / 20px
  /** Minimum height in grid cells */
  minHeightCells: 10, // 200px / 20px
  /** Maximum width in grid cells */
  maxWidthCells: 60, // 1200px / 20px
  /** Maximum height in grid cells */
  maxHeightCells: 40, // 800px / 20px
  // Legacy pixel values for reference
  minWidth: 280,
  minHeight: 200,
  maxWidth: 1200,
  maxHeight: 800,
  /** Fixed gap between cards (prevents overlap) */
  gap: 16,
};

/**
 * Text element constraints
 */
export const TEXT_ELEMENT_CONSTRAINTS = {
  minWidth: 100,
  minHeight: 40,
  maxWidth: 800,
  maxHeight: 200,
  defaultWidth: 200,
  defaultHeight: 40,
  minFontSize: 12,
  maxFontSize: 48,
  defaultFontSize: 18,
  fontSizeStep: 2,
};

/**
 * Snap a pixel value to the nearest grid cell
 */
export function snapToGrid(value: number): number {
  return Math.round(value / GRID_CONFIG.cellSize) * GRID_CONFIG.cellSize;
}

/**
 * Convert pixels to grid cells
 */
export function pixelsToCells(pixels: number): number {
  return Math.round(pixels / GRID_CONFIG.cellSize);
}

/**
 * Convert grid cells to pixels
 */
export function cellsToPixels(cells: number): number {
  return cells * GRID_CONFIG.cellSize;
}

/**
 * Default layouts for all charts (grid-aligned pixel positions)
 * All values are multiples of GRID_CONFIG.cellSize (20px)
 */
export const DEFAULT_CHART_LAYOUTS: ChartLayoutMap = {
  "proposal-status": { x: 0, y: 0, width: 380, height: 320 },
  "proposal-type": { x: 400, y: 0, width: 380, height: 320 },
  "ncl-progress": { x: 800, y: 0, width: 380, height: 320 },
  "voting-power": { x: 0, y: 340, width: 580, height: 320 },
  "participation": { x: 600, y: 340, width: 580, height: 320 },
  "proposal-submission": { x: 0, y: 680, width: 780, height: 320 },
};

/**
 * Default dashboard configuration for new users
 */
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  visibleCharts: ALL_CHART_IDS,
  chartOrder: ALL_CHART_IDS,
  layouts: DEFAULT_CHART_LAYOUTS,
  textElements: [],
  version: 10, // Bumped for text elements feature
};
