import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { useDashboard } from "./DashboardProvider";
import { DashboardChartCard } from "./DashboardChartCard";
import { DashboardTextElement } from "./DashboardTextElement";
import type { ChartId } from "@/types/dashboard";
import { LAYOUT_CONSTRAINTS, TEXT_ELEMENT_CONSTRAINTS, GRID_CONFIG, snapToGrid } from "@/types/dashboard";
import { useTheme } from "@/lib/theme";

interface DashboardGridProps {
  isLoading?: boolean;
}

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function DashboardGrid({ isLoading }: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { config, mounted, chartRegistry, getChartById, getLayout, updateLayout, updateTextElement, removeTextElement } = useDashboard();
  const [containerHeight, setContainerHeight] = useState(800);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
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
  }, [config.visibleCharts, getChartById]);

  // Calculate container height based on card and text element positions
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
    for (const textElement of config.textElements) {
      const bottom = textElement.y + textElement.height;
      if (bottom > maxBottom) {
        maxBottom = bottom;
      }
    }
    setContainerHeight(maxBottom + 100);
  }, [config.visibleCharts, config.layouts, config.textElements, getLayout, mounted]);

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

  // Handle text element drag
  const handleTextDrag = useCallback(
    (elementId: string, deltaX: number, deltaY: number) => {
      const element = config.textElements.find((el) => el.id === elementId);
      if (!element) return;

      const maxX = Math.max(0, containerWidth - element.width);
      const newX = snapToGrid(Math.max(0, Math.min(maxX, element.x + deltaX)));
      const newY = snapToGrid(Math.max(0, element.y + deltaY));

      updateTextElement(elementId, { x: newX, y: newY });
    },
    [config.textElements, updateTextElement, containerWidth]
  );

  // Handle text element resize
  const handleTextResize = useCallback(
    (elementId: string, deltaWidth: number, _deltaHeight: number, direction: string) => {
      const element = config.textElements.find((el) => el.id === elementId);
      if (!element) return;

      let newWidth = element.width;
      let newX = element.x;

      if (direction.includes("e")) {
        const maxWidthForPosition = containerWidth - element.x;
        newWidth = snapToGrid(
          Math.max(
            TEXT_ELEMENT_CONSTRAINTS.minWidth,
            Math.min(TEXT_ELEMENT_CONSTRAINTS.maxWidth, maxWidthForPosition, element.width + deltaWidth)
          )
        );
      }
      if (direction.includes("w")) {
        const proposedWidth = snapToGrid(Math.max(TEXT_ELEMENT_CONSTRAINTS.minWidth, element.width - deltaWidth));
        newX = snapToGrid(Math.max(0, element.x + (element.width - proposedWidth)));
        newWidth = proposedWidth;
      }

      updateTextElement(elementId, { x: newX, width: newWidth });
    },
    [config.textElements, updateTextElement, containerWidth]
  );

  // Check if a rectangle intersects with the selection box
  const rectanglesIntersect = useCallback(
    (r1: { x: number; y: number; width: number; height: number }, r2: { x: number; y: number; width: number; height: number }) => {
      return !(r2.x > r1.x + r1.width || r2.x + r2.width < r1.x || r2.y > r1.y + r1.height || r2.y + r2.height < r1.y);
    },
    []
  );

  // Get normalized selection box (handles dragging in any direction)
  const getNormalizedSelectionBox = useCallback((box: SelectionBox) => {
    const x = Math.min(box.startX, box.currentX);
    const y = Math.min(box.startY, box.currentY);
    const width = Math.abs(box.currentX - box.startX);
    const height = Math.abs(box.currentY - box.startY);
    return { x, y, width, height };
  }, []);

  // Handle mouse down on container for selection box
  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start selection if clicking on the container background (not on a card)
      if ((e.target as HTMLElement).closest("[data-chart-card], [data-text-element]")) {
        return;
      }

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setIsSelecting(true);
      setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });

      // Clear selection if not holding shift
      if (!e.shiftKey) {
        setSelectedElements(new Set());
      }
    },
    []
  );

  // Handle mouse move for selection box
  useEffect(() => {
    if (!isSelecting) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !selectionBox) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setSelectionBox((prev) => prev ? { ...prev, currentX: x, currentY: y } : null);
    };

    const handleMouseUp = () => {
      if (selectionBox) {
        const normalizedBox = getNormalizedSelectionBox(selectionBox);
        const newSelected = new Set<string>();

        // Check charts
        for (const chartId of config.visibleCharts) {
          const layout = getLayout(chartId);
          if (rectanglesIntersect(normalizedBox, layout)) {
            newSelected.add(chartId);
          }
        }

        // Check text elements
        for (const textElement of config.textElements) {
          if (rectanglesIntersect(normalizedBox, textElement)) {
            newSelected.add(textElement.id);
          }
        }

        setSelectedElements(newSelected);
      }

      setIsSelecting(false);
      setSelectionBox(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isSelecting, selectionBox, config.visibleCharts, config.textElements, getLayout, getNormalizedSelectionBox, rectanglesIntersect]);

  // Clear selection when clicking outside or pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedElements(new Set());
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle group drag for selected elements
  const handleGroupDrag = useCallback(
    (deltaX: number, deltaY: number) => {
      // Move all selected charts
      for (const id of selectedElements) {
        if (config.visibleCharts.includes(id as ChartId)) {
          const currentLayout = getLayout(id as ChartId);
          const maxX = Math.max(0, containerWidth - currentLayout.width);
          const newX = snapToGrid(Math.max(0, Math.min(maxX, currentLayout.x + deltaX)));
          const newY = snapToGrid(Math.max(0, currentLayout.y + deltaY));
          updateLayout(id as ChartId, { x: newX, y: newY });
        } else {
          // Text element
          const element = config.textElements.find((el) => el.id === id);
          if (element) {
            const maxX = Math.max(0, containerWidth - element.width);
            const newX = snapToGrid(Math.max(0, Math.min(maxX, element.x + deltaX)));
            const newY = snapToGrid(Math.max(0, element.y + deltaY));
            updateTextElement(id, { x: newX, y: newY });
          }
        }
      }
    },
    [selectedElements, config.visibleCharts, config.textElements, getLayout, updateLayout, updateTextElement, containerWidth]
  );

  // Handle group resize for selected elements
  const handleGroupResize = useCallback(
    (deltaWidth: number, deltaHeight: number, direction: string) => {
      for (const id of selectedElements) {
        if (config.visibleCharts.includes(id as ChartId)) {
          // Chart element
          const currentLayout = getLayout(id as ChartId);
          let newWidth = currentLayout.width;
          let newHeight = currentLayout.height;
          let newX = currentLayout.x;
          let newY = currentLayout.y;

          // Handle width changes
          if (direction.includes("e")) {
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

          // Handle height changes
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

          updateLayout(id as ChartId, { x: newX, y: newY, width: newWidth, height: newHeight });
        } else {
          // Text element - only handle width
          const element = config.textElements.find((el) => el.id === id);
          if (element) {
            let newWidth = element.width;
            let newX = element.x;

            if (direction.includes("e")) {
              const maxWidthForPosition = containerWidth - element.x;
              newWidth = snapToGrid(
                Math.max(
                  TEXT_ELEMENT_CONSTRAINTS.minWidth,
                  Math.min(TEXT_ELEMENT_CONSTRAINTS.maxWidth, maxWidthForPosition, element.width + deltaWidth)
                )
              );
            }
            if (direction.includes("w")) {
              const proposedWidth = snapToGrid(Math.max(TEXT_ELEMENT_CONSTRAINTS.minWidth, element.width - deltaWidth));
              newX = snapToGrid(Math.max(0, element.x + (element.width - proposedWidth)));
              newWidth = proposedWidth;
            }

            updateTextElement(id, { x: newX, width: newWidth });
          }
        }
      }
    },
    [selectedElements, config.visibleCharts, config.textElements, getLayout, updateLayout, updateTextElement, containerWidth]
  );

  // Grid background pattern - must be before early returns to satisfy hooks rules
  const gridBackgroundStyle = useMemo(() => {
    const cellSize = GRID_CONFIG.cellSize;
    const lineColor = isDark ? "rgba(255, 255, 255, 0.015)" : "rgba(0, 0, 0, 0.02)";

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
        {chartRegistry.filter((c) => c.defaultVisible).map((chart) => {
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

  if (visibleCharts.length === 0 && config.textElements.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-muted-foreground/25 p-8 text-center">
        <p className="text-muted-foreground">
          No charts selected. Use the customize button above to add charts to your dashboard.
        </p>
      </div>
    );
  }

  // Computed selection box rectangle for rendering
  const selectionRect = selectionBox ? getNormalizedSelectionBox(selectionBox) : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-lg select-none"
      style={{
        minHeight: `${containerHeight}px`,
        ...gridBackgroundStyle,
      }}
      onMouseDown={handleContainerMouseDown}
    >
      {visibleCharts.map(({ id, chart }) => {
        const layout = getLayout(id);
        const isSelected = selectedElements.has(id);
        return (
          <DashboardChartCard
            key={id}
            chart={chart!}
            layout={layout}
            isLoading={isLoading}
            isActive={activeElementId === id}
            isSelected={isSelected}
            onActivate={(e) => {
              setActiveElementId(id);
              if (e?.ctrlKey || e?.metaKey) {
                // CTRL+click: toggle selection
                setSelectedElements((prev) => {
                  const newSet = new Set(prev);
                  if (newSet.has(id)) {
                    newSet.delete(id);
                  } else {
                    newSet.add(id);
                  }
                  return newSet;
                });
              } else if (!selectedElements.has(id)) {
                // Regular click on unselected: clear selection
                setSelectedElements(new Set());
              }
            }}
            onDrag={(dx, dy) => {
              if (isSelected && selectedElements.size > 1) {
                handleGroupDrag(dx, dy);
              } else {
                handleDrag(id, dx, dy);
              }
            }}
            onResize={(dw, dh, dir) => {
              if (isSelected && selectedElements.size > 1) {
                handleGroupResize(dw, dh, dir);
              } else {
                handleResize(id, dw, dh, dir);
              }
            }}
          />
        );
      })}
      {config.textElements.map((element) => {
        const isSelected = selectedElements.has(element.id);
        return (
          <DashboardTextElement
            key={element.id}
            element={element}
            isActive={activeElementId === element.id}
            isSelected={isSelected}
            onActivate={(e) => {
              setActiveElementId(element.id);
              if (e?.ctrlKey || e?.metaKey) {
                // CTRL+click: toggle selection
                setSelectedElements((prev) => {
                  const newSet = new Set(prev);
                  if (newSet.has(element.id)) {
                    newSet.delete(element.id);
                  } else {
                    newSet.add(element.id);
                  }
                  return newSet;
                });
              } else if (!selectedElements.has(element.id)) {
                // Regular click on unselected: clear selection
                setSelectedElements(new Set());
              }
            }}
            onDrag={(dx, dy) => {
              if (isSelected && selectedElements.size > 1) {
                handleGroupDrag(dx, dy);
              } else {
                handleTextDrag(element.id, dx, dy);
              }
            }}
            onResize={(dw, dh, dir) => {
              if (isSelected && selectedElements.size > 1) {
                handleGroupResize(dw, dh, dir);
              } else {
                handleTextResize(element.id, dw, dh, dir);
              }
            }}
            onTextChange={(text) => updateTextElement(element.id, { text })}
            onFontSizeChange={(fontSize) => updateTextElement(element.id, { fontSize })}
            onRemove={() => removeTextElement(element.id)}
          />
        );
      })}

      {/* Selection box overlay */}
      {selectionRect && selectionRect.width > 5 && selectionRect.height > 5 && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: `${selectionRect.x}px`,
            top: `${selectionRect.y}px`,
            width: `${selectionRect.width}px`,
            height: `${selectionRect.height}px`,
            border: `2px dashed ${isDark ? "#0bd1a2" : "#000000"}`,
            backgroundColor: isDark ? "rgba(11, 209, 162, 0.1)" : "rgba(0, 0, 0, 0.05)",
          }}
        />
      )}
    </div>
  );
}
