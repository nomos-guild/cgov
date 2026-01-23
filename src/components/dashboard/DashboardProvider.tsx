import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type {
  ChartId,
  ChartLayout,
  DashboardConfig,
  DashboardContextValue,
} from "@/types/dashboard";
import {
  DEFAULT_DASHBOARD_CONFIG,
  DEFAULT_CHART_LAYOUTS,
  ALL_CHART_IDS,
  LAYOUT_CONSTRAINTS,
} from "@/types/dashboard";

const STORAGE_KEY = "dashboard-config";

const DashboardContext = createContext<DashboardContextValue | undefined>(
  undefined
);

function parseStoredConfig(stored: string | null): DashboardConfig | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (
      parsed &&
      Array.isArray(parsed.visibleCharts) &&
      typeof parsed.version === "number"
    ) {
      // Filter to only valid chart IDs
      const validVisible = parsed.visibleCharts.filter((id: string) =>
        ALL_CHART_IDS.includes(id as ChartId)
      ) as ChartId[];

      // Migration: Add any new charts that were added since user's last save
      // New charts should be visible by default
      const storedVersion = parsed.version || 0;
      if (storedVersion < DEFAULT_DASHBOARD_CONFIG.version) {
        for (const chartId of ALL_CHART_IDS) {
          if (!validVisible.includes(chartId)) {
            validVisible.push(chartId);
          }
        }
      }

      // Build layouts from saved data or defaults
      const layouts = { ...DEFAULT_CHART_LAYOUTS };

      if (parsed.layouts) {
        for (const id of ALL_CHART_IDS) {
          const saved = parsed.layouts[id];
          if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
            layouts[id] = {
              x: Math.max(0, saved.x),
              y: Math.max(0, saved.y),
              width: Math.max(LAYOUT_CONSTRAINTS.minWidth, Math.min(LAYOUT_CONSTRAINTS.maxWidth, saved.width || 380)),
              height: Math.max(LAYOUT_CONSTRAINTS.minHeight, Math.min(LAYOUT_CONSTRAINTS.maxHeight, saved.height || 320)),
            };
          }
        }
      }

      return {
        visibleCharts: validVisible,
        layouts,
        version: DEFAULT_DASHBOARD_CONFIG.version,
      };
    }
  } catch {
    // Invalid JSON
  }
  return null;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    const parsed = parseStoredConfig(stored);
    if (parsed) {
      setConfig(parsed);
    }
    setMounted(true);
  }, []);

  // Save to localStorage on config change
  useEffect(() => {
    if (!mounted) return;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  }, [config, mounted]);

  const isChartVisible = useCallback(
    (chartId: ChartId) => config.visibleCharts.includes(chartId),
    [config.visibleCharts]
  );

  const toggleChartVisibility = useCallback((chartId: ChartId) => {
    setConfig((prev) => {
      const isVisible = prev.visibleCharts.includes(chartId);
      if (isVisible) {
        return {
          ...prev,
          visibleCharts: prev.visibleCharts.filter((id) => id !== chartId),
        };
      } else {
        return {
          ...prev,
          visibleCharts: [...prev.visibleCharts, chartId],
        };
      }
    });
  }, []);

  const setVisibleCharts = useCallback((chartIds: ChartId[]) => {
    setConfig((prev) => ({
      ...prev,
      visibleCharts: chartIds,
    }));
  }, []);

  const getLayout = useCallback(
    (chartId: ChartId): ChartLayout =>
      config.layouts[chartId] || DEFAULT_CHART_LAYOUTS[chartId],
    [config.layouts]
  );

  const updateLayout = useCallback((chartId: ChartId, layout: Partial<ChartLayout>) => {
    setConfig((prev) => ({
      ...prev,
      layouts: {
        ...prev.layouts,
        [chartId]: {
          ...prev.layouts[chartId],
          ...layout,
        },
      },
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_DASHBOARD_CONFIG);
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        config,
        mounted,
        isChartVisible,
        toggleChartVisibility,
        setVisibleCharts,
        getLayout,
        updateLayout,
        resetToDefaults,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    return {
      config: DEFAULT_DASHBOARD_CONFIG,
      mounted: false,
      isChartVisible: () => true,
      toggleChartVisibility: () => {},
      setVisibleCharts: () => {},
      getLayout: (chartId) => DEFAULT_CHART_LAYOUTS[chartId],
      updateLayout: () => {},
      resetToDefaults: () => {},
    };
  }
  return context;
}
