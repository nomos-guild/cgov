// DRep Dashboard
// Placeholder for chart registry
// DRep-specific charts will be added here

import type { ChartDefinition } from "@/types/dashboard";

export const CHART_REGISTRY: ChartDefinition[] = [];

export function getChartById(id: string): ChartDefinition | undefined {
  return CHART_REGISTRY.find((chart) => chart.id === id);
}
