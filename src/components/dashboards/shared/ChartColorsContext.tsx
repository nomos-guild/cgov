import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

const STORAGE_KEY = "dashboard-chart-colors";

// Custom colors are stored per chart, with element keys as identifiers
// e.g., { "proposalType": { "InfoAction": "#ff0000", "Treasury": "#00ff00" } }
type ChartColors = Record<string, Record<string, string>>;

interface ChartColorsContextValue {
  colors: ChartColors;
  getColor: (chartId: string, elementKey: string, defaultColor: string) => string;
  setColor: (chartId: string, elementKey: string, color: string) => void;
  resetColor: (chartId: string, elementKey: string) => void;
  resetChartColors: (chartId: string) => void;
  resetAllColors: () => void;
  /** Apply card background and text color from one chart to all other charts */
  applyStyleToAllCharts: (sourceChartId: string, allChartIds: string[]) => void;
}

const ChartColorsContext = createContext<ChartColorsContextValue | undefined>(undefined);

function parseStoredColors(stored: string | null): ChartColors {
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as ChartColors;
    }
  } catch {
    // Invalid JSON
  }
  return {};
}

export function ChartColorsProvider({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<ChartColors>({});
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    const parsed = parseStoredColors(stored);
    setColors(parsed);
    setMounted(true);
  }, []);

  // Save to localStorage on colors change
  useEffect(() => {
    if (!mounted) return;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
    }
  }, [colors, mounted]);

  const getColor = useCallback(
    (chartId: string, elementKey: string, defaultColor: string): string => {
      return colors[chartId]?.[elementKey] ?? defaultColor;
    },
    [colors]
  );

  const setColor = useCallback((chartId: string, elementKey: string, color: string) => {
    setColors((prev) => ({
      ...prev,
      [chartId]: {
        ...prev[chartId],
        [elementKey]: color,
      },
    }));
  }, []);

  const resetColor = useCallback((chartId: string, elementKey: string) => {
    setColors((prev) => {
      const chartColors = { ...prev[chartId] };
      delete chartColors[elementKey];

      // If no colors left for this chart, remove the chart entry
      if (Object.keys(chartColors).length === 0) {
        const newColors = { ...prev };
        delete newColors[chartId];
        return newColors;
      }

      return {
        ...prev,
        [chartId]: chartColors,
      };
    });
  }, []);

  const resetChartColors = useCallback((chartId: string) => {
    setColors((prev) => {
      const newColors = { ...prev };
      delete newColors[chartId];
      return newColors;
    });
  }, []);

  const resetAllColors = useCallback(() => {
    setColors({});
  }, []);

  const applyStyleToAllCharts = useCallback((sourceChartId: string, allChartIds: string[]) => {
    setColors((prev) => {
      const sourceColors = prev[sourceChartId] || {};
      const cardBg = sourceColors["_cardBg"];
      const textColor = sourceColors["_textColor"];

      const newColors = { ...prev };

      allChartIds.forEach((chartId) => {
        if (chartId === sourceChartId) return; // Skip source chart

        const existingChartColors = { ...(newColors[chartId] || {}) };

        // Apply or remove card background
        if (cardBg) {
          existingChartColors["_cardBg"] = cardBg;
        } else {
          delete existingChartColors["_cardBg"];
        }

        // Apply or remove text color
        if (textColor) {
          existingChartColors["_textColor"] = textColor;
        } else {
          delete existingChartColors["_textColor"];
        }

        // Update or remove chart entry
        if (Object.keys(existingChartColors).length > 0) {
          newColors[chartId] = existingChartColors;
        } else {
          delete newColors[chartId];
        }
      });

      return newColors;
    });
  }, []);

  return (
    <ChartColorsContext.Provider
      value={{
        colors,
        getColor,
        setColor,
        resetColor,
        resetChartColors,
        resetAllColors,
        applyStyleToAllCharts,
      }}
    >
      {children}
    </ChartColorsContext.Provider>
  );
}

export function useChartColors(): ChartColorsContextValue {
  const context = useContext(ChartColorsContext);
  if (context === undefined) {
    // Return a no-op implementation if used outside provider
    return {
      colors: {},
      getColor: (_, __, defaultColor) => defaultColor,
      setColor: () => {},
      resetColor: () => {},
      resetChartColors: () => {},
      resetAllColors: () => {},
      applyStyleToAllCharts: () => {},
    };
  }
  return context;
}
