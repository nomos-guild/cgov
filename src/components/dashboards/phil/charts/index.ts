// Phil Dashboard - Treasury/Developer
// Placeholder for chart registry
// Phil will add charts here

import type { ChartDefinition } from "@/types/dashboard";

export const CHART_REGISTRY: ChartDefinition[] = [];

export function getChartById(id: string): ChartDefinition | undefined {
  return CHART_REGISTRY.find((chart) => chart.id === id);
}
