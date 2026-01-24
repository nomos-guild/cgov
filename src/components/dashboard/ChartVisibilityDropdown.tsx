import { useState, useRef, useEffect, useMemo } from "react";
import { Settings, Check, RotateCcw, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "./DashboardProvider";
import { getChartById } from "./charts";
import { useTheme } from "@/lib/theme";

export function ChartVisibilityDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { config, toggleChartVisibility, reorderCharts, resetToDefaults, mounted } = useDashboard();
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;

  // Get charts in the user's custom order
  const orderedCharts = useMemo(() => {
    return config.chartOrder
      .map((id) => getChartById(id))
      .filter((chart) => chart !== undefined);
  }, [config.chartOrder]);

  // Drag and drop handlers
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      reorderCharts(draggedIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  if (!mounted) {
    return (
      <button
        disabled
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
          isDark
            ? "bg-transparent border border-[#0bd1a2] text-[#0bd1a2]"
            : "bg-white border border-gray-200 text-gray-600 shadow-sm"
        )}
      >
        <Settings className="h-4 w-4" />
        Customize
      </button>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
          isDark
            ? "bg-transparent border border-[#0bd1a2] text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
            : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm"
        )}
      >
        <Settings className="h-4 w-4" />
        Customize
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-full mt-2 w-72 z-[100] rounded-lg shadow-lg",
            isDark
              ? "bg-[#1a1a2e] border border-[#0bd1a2]"
              : "bg-white border border-gray-200"
          )}
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3
                className={cn(
                  "text-sm font-semibold",
                  isDark ? "text-[#0bd1a2]" : "text-gray-900"
                )}
              >
                Dashboard Charts
              </h3>
              <button
                onClick={() => {
                  resetToDefaults();
                }}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
                  isDark
                    ? "text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
                    : "text-gray-500 hover:bg-gray-100"
                )}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>

            <div className="space-y-1">
              {orderedCharts.map((chart, index) => {
                const isVisible = config.visibleCharts.includes(chart.id);
                const Icon = chart.icon;
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={chart.id}
                    draggable
                    onDragStart={handleDragStart(index)}
                    onDragOver={handleDragOver(index)}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-all",
                      isDark
                        ? "hover:bg-[#0bd1a2]/10"
                        : "hover:bg-gray-50",
                      isDragging && "opacity-50",
                      isDragOver && (isDark ? "bg-[#0bd1a2]/20 border-t-2 border-[#0bd1a2]" : "bg-blue-50 border-t-2 border-blue-400")
                    )}
                  >
                    {/* Drag handle */}
                    <div
                      className={cn(
                        "flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded",
                        isDark ? "text-[#0bd1a2]/50 hover:text-[#0bd1a2]" : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    {/* Checkbox */}
                    <button
                      onClick={() => toggleChartVisibility(chart.id)}
                      className={cn(
                        "flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors",
                        isVisible
                          ? isDark
                            ? "bg-[#0bd1a2] border-[#0bd1a2]"
                            : "bg-black border-black"
                          : isDark
                            ? "border-[#0bd1a2]/50 hover:border-[#0bd1a2]"
                            : "border-gray-300 hover:border-gray-400"
                      )}
                    >
                      {isVisible && (
                        <Check
                          className={cn(
                            "h-3 w-3",
                            isDark ? "text-black" : "text-white"
                          )}
                        />
                      )}
                    </button>

                    {Icon && (
                      <Icon
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          isDark ? "text-[#0bd1a2]" : "text-gray-500"
                        )}
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          "text-sm font-medium",
                          isDark ? "text-[#0bd1a2]" : "text-gray-900"
                        )}
                      >
                        {chart.title}
                      </div>
                      <div
                        className={cn(
                          "text-xs truncate",
                          isDark ? "text-[#0bd1a2]/70" : "text-gray-500"
                        )}
                      >
                        {chart.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
