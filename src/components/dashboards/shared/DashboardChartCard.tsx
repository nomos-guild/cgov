import { useRef, useCallback, useState } from "react";
import { GripVertical, X, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import type { ChartDefinition, ChartLayout } from "@/types/dashboard";
import { useDashboard } from "./DashboardProvider";

interface DashboardChartCardProps {
  chart: ChartDefinition;
  layout: ChartLayout;
  isLoading?: boolean;
  isActive?: boolean;
  isSelected?: boolean;
  onActivate: (e?: React.MouseEvent) => void;
  onDrag: (deltaX: number, deltaY: number) => void;
  onResize: (deltaWidth: number, deltaHeight: number, direction: string) => void;
  onHide?: () => void;
}

export function DashboardChartCard({
  chart,
  layout,
  isLoading,
  isActive,
  isSelected,
  onActivate,
  onDrag,
  onResize,
  onHide,
}: DashboardChartCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;
  const isGame = activeTheme.id === "game";
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Color picker via side panel
  const { setColorPickerTarget } = useDashboard();

  const handlePaletteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setColorPickerTarget({
        chartId: chart.id,
        chartTitle: chart.title,
        elementKey: "_cardBg",
        elementLabel: "Card background",
      });
    },
    [chart.id, chart.title, setColorPickerTarget]
  );

  // Handle drag
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      onActivate(); // Bring to front

      const startX = e.clientX;
      const startY = e.clientY;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        onDrag(deltaX, deltaY);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onDrag, onActivate]
  );

  // Handle resize
  const handleResizeStart = useCallback(
    (direction: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      onActivate(); // Bring to front

      const startX = e.clientX;
      const startY = e.clientY;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        onResize(deltaX, deltaY, direction);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize, onActivate]
  );

  const ChartComponent = chart.component;

  // Handle click to bring to front
  const handleClick = useCallback((e: React.MouseEvent) => {
    onActivate(e);
  }, [onActivate]);

  return (
    <div
      ref={cardRef}
      className="absolute group rounded-lg"
      style={{
        left: `${layout.x}px`,
        top: `${layout.y}px`,
        width: `${layout.width}px`,
        height: `${layout.height}px`,
        zIndex: isActive ? 50 : isSelected ? 10 : 1,
        transition: isDragging || isResizing ? "none" : "box-shadow 0.2s",
        ...(isSelected && {
          animation: "selection-glow 1.5s ease-in-out infinite",
          boxShadow: isDark
            ? "0 0 8px rgba(11, 209, 162, 0.6), 0 0 16px rgba(11, 209, 162, 0.4), 0 0 24px rgba(11, 209, 162, 0.2)"
            : "0 0 8px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 0, 0, 0.35), 0 0 24px rgba(0, 0, 0, 0.2)",
        }),
      }}
      onClick={handleClick}
      data-chart-card
    >
      {/* Card controls - drag handle, palette, and close button */}
      <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          className={cn(
            "p-1.5 rounded-md cursor-grab active:cursor-grabbing",
            isGame
              ? "bg-black/70 hover:bg-black/90 text-white"
              : isDark
                ? "bg-black/70 hover:bg-black/90 text-[#0bd1a2]"
                : "bg-white/90 hover:bg-white text-gray-600 shadow-sm"
          )}
          aria-label={`Drag to move ${chart.title}`}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Palette button */}
        <button
          onClick={handlePaletteClick}
          className={cn(
            "p-1.5 rounded-md cursor-pointer",
            isGame
              ? "bg-black/70 hover:bg-black/90 text-white"
              : isDark
                ? "bg-black/70 hover:bg-black/90 text-[#0bd1a2]"
                : "bg-white/90 hover:bg-white text-gray-600 shadow-sm"
          )}
          aria-label={`Change ${chart.title} colors`}
        >
          <Palette className="h-4 w-4" />
        </button>

        {/* Close button */}
        {onHide && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHide();
            }}
            className={cn(
              "p-1.5 rounded-md cursor-pointer",
              isGame
                ? "bg-black/70 hover:bg-red-600/90 text-white"
                : isDark
                  ? "bg-black/70 hover:bg-red-600/90 text-[#0bd1a2] hover:text-white"
                  : "bg-white/90 hover:bg-red-500 text-gray-600 hover:text-white shadow-sm"
            )}
            aria-label={`Hide ${chart.title}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Resize handles - visible on hover */}
      {/* East (right) */}
      <div
        onMouseDown={handleResizeStart("e")}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-16 cursor-ew-resize z-30 opacity-0 group-hover:opacity-100 transition-opacity rounded",
          isGame ? "hover:bg-white/50" : isDark ? "hover:bg-[#0bd1a2]/50" : "hover:bg-blue-500/50"
        )}
      />

      {/* West (left) */}
      <div
        onMouseDown={handleResizeStart("w")}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-16 cursor-ew-resize z-30 opacity-0 group-hover:opacity-100 transition-opacity rounded",
          isGame ? "hover:bg-white/50" : isDark ? "hover:bg-[#0bd1a2]/50" : "hover:bg-blue-500/50"
        )}
      />

      {/* South (bottom) */}
      <div
        onMouseDown={handleResizeStart("s")}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 -bottom-1 w-16 h-2 cursor-ns-resize z-30 opacity-0 group-hover:opacity-100 transition-opacity rounded",
          isGame ? "hover:bg-white/50" : isDark ? "hover:bg-[#0bd1a2]/50" : "hover:bg-blue-500/50"
        )}
      />

      {/* North (top) */}
      <div
        onMouseDown={handleResizeStart("n")}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 -top-1 w-16 h-2 cursor-ns-resize z-30 opacity-0 group-hover:opacity-100 transition-opacity rounded",
          isGame ? "hover:bg-white/50" : isDark ? "hover:bg-[#0bd1a2]/50" : "hover:bg-blue-500/50"
        )}
      />

      {/* Southeast (corner) */}
      <div
        onMouseDown={handleResizeStart("se")}
        className={cn(
          "absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize z-30 opacity-0 group-hover:opacity-100 transition-opacity rounded",
          isGame ? "hover:bg-white/70" : isDark ? "hover:bg-[#0bd1a2]/70" : "hover:bg-blue-500/70"
        )}
      />

      {/* Southwest (corner) */}
      <div
        onMouseDown={handleResizeStart("sw")}
        className={cn(
          "absolute -bottom-1 -left-1 w-4 h-4 cursor-nesw-resize z-30 opacity-0 group-hover:opacity-100 transition-opacity rounded",
          isGame ? "hover:bg-white/70" : isDark ? "hover:bg-[#0bd1a2]/70" : "hover:bg-blue-500/70"
        )}
      />

      {/* Northeast (corner) */}
      <div
        onMouseDown={handleResizeStart("ne")}
        className={cn(
          "absolute -top-1 -right-1 w-4 h-4 cursor-nesw-resize z-30 opacity-0 group-hover:opacity-100 transition-opacity rounded",
          isGame ? "hover:bg-white/70" : isDark ? "hover:bg-[#0bd1a2]/70" : "hover:bg-blue-500/70"
        )}
      />

      {/* Northwest (corner) */}
      <div
        onMouseDown={handleResizeStart("nw")}
        className={cn(
          "absolute -top-1 -left-1 w-4 h-4 cursor-nwse-resize z-30 opacity-0 group-hover:opacity-100 transition-opacity rounded",
          isGame ? "hover:bg-white/70" : isDark ? "hover:bg-[#0bd1a2]/70" : "hover:bg-blue-500/70"
        )}
      />

      {/* Chart content */}
      <div
        className={cn(
          "h-full w-full overflow-hidden",
          isGame
            ? "rounded-sm border-none bg-transparent"
            : isDark
              ? "rounded-2xl border border-[#0bd1a2] bg-transparent"
              : "rounded-2xl border-none bg-white shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
        )}
      >
        <ChartComponent isLoading={isLoading} className="h-full w-full" />
      </div>
    </div>
  );
}
