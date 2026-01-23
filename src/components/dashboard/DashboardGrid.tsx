import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { useDashboard } from "./DashboardProvider";
import { DashboardChartCard } from "./DashboardChartCard";
import { CHART_REGISTRY, getChartById } from "./charts";
import type { ChartId } from "@/types/dashboard";
import { LAYOUT_CONSTRAINTS } from "@/types/dashboard";

interface DashboardGridProps {
  isLoading?: boolean;
}

export function DashboardGrid({ isLoading }: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { config, mounted, getLayout, updateLayout } = useDashboard();
  const [containerHeight, setContainerHeight] = useState(800);
  const [activeCardId, setActiveCardId] = useState<ChartId | null>(null);

  // Get visible chart definitions
  const visibleCharts = useMemo(() => {
    return config.visibleCharts
      .map((id) => ({ id, chart: getChartById(id) }))
      .filter((item) => item.chart);
  }, [config.visibleCharts]);

  // Calculate container height based on card positions
  useEffect(() => {
    if (!mounted) return;

    let maxBottom = 600;
    for (const chartId of config.visibleCharts) {
      const layout = getLayout(chartId);
      const bottom = layout.y + layout.height;
      if (bottom > maxBottom) {
        maxBottom = bottom;
      }
    }
    setContainerHeight(maxBottom + 100);
  }, [config.visibleCharts, config.layouts, getLayout, mounted]);

  // Handle drag - free movement
  const handleDrag = useCallback(
    (chartId: ChartId, deltaX: number, deltaY: number) => {
      const currentLayout = getLayout(chartId);
      const newX = Math.max(0, currentLayout.x + deltaX);
      const newY = Math.max(0, currentLayout.y + deltaY);

      updateLayout(chartId, { x: newX, y: newY });
    },
    [getLayout, updateLayout]
  );

  // Handle resize - free resizing
  const handleResize = useCallback(
    (chartId: ChartId, deltaWidth: number, deltaHeight: number, direction: string) => {
      const currentLayout = getLayout(chartId);

      let newWidth = currentLayout.width;
      let newHeight = currentLayout.height;
      let newX = currentLayout.x;
      let newY = currentLayout.y;

      // Handle width changes
      if (direction.includes("e")) {
        newWidth = Math.max(
          LAYOUT_CONSTRAINTS.minWidth,
          Math.min(LAYOUT_CONSTRAINTS.maxWidth, currentLayout.width + deltaWidth)
        );
      }
      if (direction.includes("w")) {
        const proposedWidth = Math.max(LAYOUT_CONSTRAINTS.minWidth, currentLayout.width - deltaWidth);
        newX = Math.max(0, currentLayout.x + (currentLayout.width - proposedWidth));
        newWidth = proposedWidth;
      }

      // Handle height changes
      if (direction.includes("s")) {
        newHeight = Math.max(
          LAYOUT_CONSTRAINTS.minHeight,
          Math.min(LAYOUT_CONSTRAINTS.maxHeight, currentLayout.height + deltaHeight)
        );
      }
      if (direction.includes("n")) {
        const proposedHeight = Math.max(LAYOUT_CONSTRAINTS.minHeight, currentLayout.height - deltaHeight);
        newY = Math.max(0, currentLayout.y + (currentLayout.height - proposedHeight));
        newHeight = proposedHeight;
      }

      updateLayout(chartId, { x: newX, y: newY, width: newWidth, height: newHeight });
    },
    [getLayout, updateLayout]
  );

  // Don't render until mounted
  if (!mounted) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHART_REGISTRY.filter((c) => c.defaultVisible).map((chart) => {
          const ChartComponent = chart.component;
          return (
            <div key={chart.id} className="min-h-[280px]">
              <ChartComponent isLoading={true} />
            </div>
          );
        })}
      </div>
    );
  }

  if (visibleCharts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-muted-foreground/25 p-8 text-center">
        <p className="text-muted-foreground">
          No charts selected. Use the customize button above to add charts to your dashboard.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ minHeight: `${containerHeight}px` }}
    >
      {visibleCharts.map(({ id, chart }) => {
        const layout = getLayout(id);
        return (
          <DashboardChartCard
            key={id}
            chart={chart!}
            layout={layout}
            isLoading={isLoading}
            isActive={activeCardId === id}
            onActivate={() => setActiveCardId(id)}
            onDrag={(dx, dy) => handleDrag(id, dx, dy)}
            onResize={(dw, dh, dir) => handleResize(id, dw, dh, dir)}
          />
        );
      })}
    </div>
  );
}
