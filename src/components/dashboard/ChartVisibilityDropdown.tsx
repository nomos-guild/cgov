import { useState, useRef, useEffect } from "react";
import { Settings, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "./DashboardProvider";
import { CHART_REGISTRY } from "./charts";
import { useTheme } from "@/lib/theme";

export function ChartVisibilityDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { config, toggleChartVisibility, resetToDefaults, mounted } = useDashboard();
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;

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
              {CHART_REGISTRY.map((chart) => {
                const isVisible = config.visibleCharts.includes(chart.id);
                const Icon = chart.icon;

                return (
                  <button
                    key={chart.id}
                    onClick={() => toggleChartVisibility(chart.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors",
                      isDark
                        ? "hover:bg-[#0bd1a2]/10"
                        : "hover:bg-gray-50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center",
                        isVisible
                          ? isDark
                            ? "bg-[#0bd1a2] border-[#0bd1a2]"
                            : "bg-black border-black"
                          : isDark
                            ? "border-[#0bd1a2]/50"
                            : "border-gray-300"
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
                    </div>

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
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
