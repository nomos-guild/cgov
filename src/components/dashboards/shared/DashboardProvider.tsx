import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import type {
  ChartId,
  ChartLayout,
  ChartDefinition,
  ChartLayoutMap,
  DashboardConfig,
  DashboardContextValue,
  TextElement,
} from "@/types/dashboard";
import {
  DEFAULT_DASHBOARD_CONFIG,
  DEFAULT_CHART_LAYOUTS,
  LAYOUT_CONSTRAINTS,
  TEXT_ELEMENT_CONSTRAINTS,
  snapToGrid,
} from "@/types/dashboard";

const DashboardContext = createContext<DashboardContextValue | undefined>(
  undefined
);

function parseStoredConfig(
  stored: string | null,
  validChartIds: ChartId[],
  defaultConfig: DashboardConfig,
  defaultLayouts: ChartLayoutMap,
): DashboardConfig | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (
      parsed &&
      Array.isArray(parsed.visibleCharts) &&
      typeof parsed.version === "number"
    ) {
      const validVisible = parsed.visibleCharts.filter((id: string) =>
        validChartIds.includes(id as ChartId)
      ) as ChartId[];

      const storedVersion = parsed.version || 0;
      const isOutdated = storedVersion < defaultConfig.version;
      if (isOutdated) {
        for (const chartId of validChartIds) {
          if (!validVisible.includes(chartId)) {
            validVisible.push(chartId);
          }
        }
      }

      const layouts: ChartLayoutMap = { ...defaultLayouts };

      if (parsed.layouts && !isOutdated) {
        for (const id of validChartIds) {
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

      let chartOrder: ChartId[] = [];
      if (Array.isArray(parsed.chartOrder)) {
        chartOrder = parsed.chartOrder.filter((id: string) =>
          validChartIds.includes(id as ChartId)
        ) as ChartId[];
      }
      for (const chartId of validChartIds) {
        if (!chartOrder.includes(chartId)) {
          chartOrder.push(chartId);
        }
      }

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
        version: defaultConfig.version,
      };
    }
  } catch {
    // Invalid JSON
  }
  return null;
}

interface DashboardProviderProps {
  dashboardId: string;
  chartRegistry: ChartDefinition[];
  defaultLayouts: ChartLayoutMap;
  children: ReactNode;
}

const FALLBACK_LAYOUT: ChartLayout = { x: 0, y: 0, width: 380, height: 320 };

export function DashboardProvider({
  dashboardId,
  chartRegistry,
  defaultLayouts,
  children,
}: DashboardProviderProps) {
  const validChartIds = useMemo(
    () => chartRegistry.map((c) => c.id),
    [chartRegistry]
  );

  const defaultConfig = useMemo<DashboardConfig>(
    () => ({
      visibleCharts: validChartIds,
      chartOrder: validChartIds,
      layouts: defaultLayouts,
      textElements: [],
      version: DEFAULT_DASHBOARD_CONFIG.version,
    }),
    [validChartIds, defaultLayouts]
  );

  const storageKey = `${dashboardId}-dashboard-config`;

  const [config, setConfig] = useState<DashboardConfig>(defaultConfig);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const LEGACY_KEY = "dashboard-config";
    if (typeof localStorage !== "undefined" && dashboardId === "governance") {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy && !localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, legacy);
        localStorage.removeItem(LEGACY_KEY);
      }
    }
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(storageKey)
        : null;
    const parsed = parseStoredConfig(stored, validChartIds, defaultConfig, defaultLayouts);
    if (parsed) {
      setConfig(parsed);
    }
    setMounted(true);
  }, [dashboardId, storageKey, validChartIds, defaultConfig, defaultLayouts]);

  useEffect(() => {
    if (!mounted) return;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(config));
    }
  }, [config, mounted, storageKey]);

  const getChartById = useCallback(
    (id: string): ChartDefinition | undefined =>
      chartRegistry.find((chart) => chart.id === id),
    [chartRegistry]
  );

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
      config.layouts[chartId] || defaultLayouts[chartId] || FALLBACK_LAYOUT,
    [config.layouts, defaultLayouts]
  );

  const updateLayout = useCallback((chartId: ChartId, layout: Partial<ChartLayout>) => {
    setConfig((prev) => ({
      ...prev,
      layouts: {
        ...prev.layouts,
        [chartId]: {
          ...(prev.layouts[chartId] || FALLBACK_LAYOUT),
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
    setConfig(defaultConfig);
  }, [defaultConfig]);

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
      return btoa(jsonString);
    } catch {
      return "";
    }
  }, [config]);

  const importConfig = useCallback(
    (code: string): { success: boolean; error?: string } => {
      try {
        const jsonString = atob(code.trim());
        const parsed = parseStoredConfig(jsonString, validChartIds, defaultConfig, defaultLayouts);
        if (parsed) {
          setConfig(parsed);
          return { success: true };
        }
        return { success: false, error: "Invalid dashboard configuration" };
      } catch {
        return { success: false, error: "Invalid share code format" };
      }
    },
    [validChartIds, defaultConfig, defaultLayouts]
  );

  return (
    <DashboardContext.Provider
      value={{
        config,
        mounted,
        chartRegistry,
        getChartById,
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
      chartRegistry: [],
      getChartById: () => undefined,
      isChartVisible: () => true,
      toggleChartVisibility: () => {},
      setVisibleCharts: () => {},
      getLayout: (chartId) => DEFAULT_CHART_LAYOUTS[chartId] || FALLBACK_LAYOUT,
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
