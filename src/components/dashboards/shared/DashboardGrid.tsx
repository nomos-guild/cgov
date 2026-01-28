import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { useDashboard } from "./DashboardProvider";
import { DashboardChartCard } from "./DashboardChartCard";
import { CHART_REGISTRY, getChartById } from "@/components/dashboards/governance/charts";
import type { ChartId } from "@/types/dashboard";
import { LAYOUT_CONSTRAINTS, GRID_CONFIG, snapToGrid } from "@/types/dashboard";
import { useTheme } from "@/lib/theme";

interface DashboardGridProps {
  isLoading?: boolean;
}

export function DashboardGrid({ isLoading }: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { config, mounted, getLayout, updateLayout } = useDashboard();
  const [containerHeight, setContainerHeight] = useState(800);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [activeCardId, setActiveCardId] = useState<ChartId | null>(null);
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;

  // Track container width for constraining cards
  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [mounted]);

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

  // Handle drag - snap to grid and constrain to container
  const handleDrag = useCallback(
    (chartId: ChartId, deltaX: number, deltaY: number) => {
      const currentLayout = getLayout(chartId);
      // Constrain X so card doesn't go off left or right edge
      const maxX = Math.max(0, containerWidth - currentLayout.width);
      const newX = snapToGrid(Math.max(0, Math.min(maxX, currentLayout.x + deltaX)));
      const newY = snapToGrid(Math.max(0, currentLayout.y + deltaY));

      updateLayout(chartId, { x: newX, y: newY });
    },
    [getLayout, updateLayout, containerWidth]
  );

  // Handle resize - snap to grid and constrain to container
  const handleResize = useCallback(
    (chartId: ChartId, deltaWidth: number, deltaHeight: number, direction: string) => {
      const currentLayout = getLayout(chartId);

      let newWidth = currentLayout.width;
      let newHeight = currentLayout.height;
      let newX = currentLayout.x;
      let newY = currentLayout.y;

      // Handle width changes - snap to grid and constrain to container
      if (direction.includes("e")) {
        // Max width is limited by container right edge
        const maxWidthForPosition = containerWidth - currentLayout.x;
        newWidth = snapToGrid(
          Math.max(
            LAYOUT_CONSTRAINTS.minWidth,
            Math.min(LAYOUT_CONSTRAINTS.maxWidth, maxWidthForPosition, currentLayout.width + deltaWidth)
          )
        );
      }
      if (direction.includes("w")) {
        const proposedWidth = snapToGrid(Math.max(LAYOUT_CONSTRAINTS.minWidth, currentLayout.width - deltaWidth));
        newX = snapToGrid(Math.max(0, currentLayout.x + (currentLayout.width - proposedWidth)));
        newWidth = proposedWidth;
      }

      // Handle height changes - snap to grid
      if (direction.includes("s")) {
        newHeight = snapToGrid(
          Math.max(
            LAYOUT_CONSTRAINTS.minHeight,
            Math.min(LAYOUT_CONSTRAINTS.maxHeight, currentLayout.height + deltaHeight)
          )
        );
      }
      if (direction.includes("n")) {
        const proposedHeight = snapToGrid(Math.max(LAYOUT_CONSTRAINTS.minHeight, currentLayout.height - deltaHeight));
        newY = snapToGrid(Math.max(0, currentLayout.y + (currentLayout.height - proposedHeight)));
        newHeight = proposedHeight;
      }

      updateLayout(chartId, { x: newX, y: newY, width: newWidth, height: newHeight });
    },
    [getLayout, updateLayout, containerWidth]
  );

  // Grid background pattern - must be before early returns to satisfy hooks rules
  const gridBackgroundStyle = useMemo(() => {
    const cellSize = GRID_CONFIG.cellSize;
    const lineColor = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";

    return {
      backgroundImage: `
        linear-gradient(to right, ${lineColor} 1px, transparent 1px),
        linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)
      `,
      backgroundSize: `${cellSize}px ${cellSize}px`,
    };
  }, [isDark]);

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
      className="relative w-full rounded-lg"
      style={{
        minHeight: `${containerHeight}px`,
        ...gridBackgroundStyle,
      }}
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
