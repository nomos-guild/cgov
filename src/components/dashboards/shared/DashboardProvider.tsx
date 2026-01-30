import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type {
  ChartId,
  ChartLayout,
  DashboardConfig,
  DashboardContextValue,
  TextElement,
} from "@/types/dashboard";
import {
  DEFAULT_DASHBOARD_CONFIG,
  DEFAULT_CHART_LAYOUTS,
  ALL_CHART_IDS,
  LAYOUT_CONSTRAINTS,
  TEXT_ELEMENT_CONSTRAINTS,
  snapToGrid,
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
      // Snap all values to grid for consistency
      const layouts = { ...DEFAULT_CHART_LAYOUTS };

      if (parsed.layouts) {
        for (const id of ALL_CHART_IDS) {
          const saved = parsed.layouts[id];
          if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
            layouts[id] = {
              x: snapToGrid(Math.max(0, saved.x)),
              y: snapToGrid(Math.max(0, saved.y)),
              width: snapToGrid(Math.max(LAYOUT_CONSTRAINTS.minWidth, Math.min(LAYOUT_CONSTRAINTS.maxWidth, saved.width || 380))),
              height: snapToGrid(Math.max(LAYOUT_CONSTRAINTS.minHeight, Math.min(LAYOUT_CONSTRAINTS.maxHeight, saved.height || 320))),
            };
          }
        }
      }

      // Parse chart order, ensuring all charts are included
      let chartOrder: ChartId[] = [];
      if (Array.isArray(parsed.chartOrder)) {
        chartOrder = parsed.chartOrder.filter((id: string) =>
          ALL_CHART_IDS.includes(id as ChartId)
        ) as ChartId[];
      }
      // Add any missing charts to the end of the order
      for (const chartId of ALL_CHART_IDS) {
        if (!chartOrder.includes(chartId)) {
          chartOrder.push(chartId);
        }
      }

      // Parse text elements
      let textElements: TextElement[] = [];
      if (Array.isArray(parsed.textElements)) {
        textElements = parsed.textElements.filter(
          (el: TextElement) =>
            el && typeof el.id === "string" && typeof el.text === "string"
        );
      }

      return {
        visibleCharts: validVisible,
        chartOrder,
        layouts,
        textElements,
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

  const reorderCharts = useCallback((fromIndex: number, toIndex: number) => {
    setConfig((prev) => {
      const newOrder = [...prev.chartOrder];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      return {
        ...prev,
        chartOrder: newOrder,
      };
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_DASHBOARD_CONFIG);
  }, []);

  const addTextElement = useCallback(() => {
    const newElement: TextElement = {
      id: `text-${Date.now()}`,
      text: "",
      x: snapToGrid(20),
      y: snapToGrid(20),
      width: TEXT_ELEMENT_CONSTRAINTS.defaultWidth,
      height: TEXT_ELEMENT_CONSTRAINTS.defaultHeight,
      fontSize: TEXT_ELEMENT_CONSTRAINTS.defaultFontSize,
    };
    setConfig((prev) => ({
      ...prev,
      textElements: [...prev.textElements, newElement],
    }));
  }, []);

  const updateTextElement = useCallback((id: string, updates: Partial<TextElement>) => {
    setConfig((prev) => ({
      ...prev,
      textElements: prev.textElements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      ),
    }));
  }, []);

  const removeTextElement = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      textElements: prev.textElements.filter((el) => el.id !== id),
    }));
  }, []);

  const exportConfig = useCallback((): string => {
    try {
      const exportData = {
        ...config,
        exportedAt: Date.now(),
      };
      const jsonString = JSON.stringify(exportData);
      // Encode to base64 for easy sharing
      return btoa(jsonString);
    } catch {
      return "";
    }
  }, [config]);

  const importConfig = useCallback(
    (code: string): { success: boolean; error?: string } => {
      try {
        // Decode from base64
        const jsonString = atob(code.trim());
        const parsed = parseStoredConfig(jsonString);
        if (parsed) {
          setConfig(parsed);
          return { success: true };
        }
        return { success: false, error: "Invalid dashboard configuration" };
      } catch {
        return { success: false, error: "Invalid share code format" };
      }
    },
    []
  );

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
        reorderCharts,
        resetToDefaults,
        addTextElement,
        updateTextElement,
        removeTextElement,
        exportConfig,
        importConfig,
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
      reorderCharts: () => {},
      resetToDefaults: () => {},
      addTextElement: () => {},
      updateTextElement: () => {},
      removeTextElement: () => {},
      exportConfig: () => "",
      importConfig: () => ({ success: false, error: "Context not available" }),
    };
  }
  return context;
}
