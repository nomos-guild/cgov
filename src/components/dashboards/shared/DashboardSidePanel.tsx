import { useState, useMemo, useEffect, useCallback } from "react";
import { Settings, Check, RotateCcw, GripVertical, Plus, Type, Share2, Download, Copy, CheckCircle, X, MoveHorizontal, Palette, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "./DashboardProvider";
import { getChartById } from "@/components/dashboards/governance/charts";
import { useTheme } from "@/lib/theme";
import { PAGE_MARGIN_CONSTRAINTS, ALL_CHART_IDS } from "@/types/dashboard";
import { SidePanelColorPicker } from "./SidePanelColorPicker";
import { useChartColors } from "./ChartColorsContext";

type TabId = "charts" | "elements" | "layout" | "share" | "colors";

export function DashboardSidePanel() {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const {
    config,
    toggleChartVisibility,
    reorderCharts,
    resetToDefaults,
    addTextElement,
    updatePageMargins,
    exportConfig,
    importConfig,
    mounted,
    isSidePanelOpen,
    setSidePanelOpen,
    sidePanelTab,
    setSidePanelTab,
    colorPickerTarget,
    setColorPickerTarget,
  } = useDashboard();
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;
  const isGame = activeTheme.id === "game";

  // Chart colors context for the color picker
  const { getColor, setColor, resetColor, applyStyleToAllCharts } = useChartColors();

  // Alias for easier use
  const isOpen = isSidePanelOpen;
  const setIsOpen = setSidePanelOpen;
  const activeTab = sidePanelTab as TabId;
  const setActiveTab = (tab: TabId) => setSidePanelTab(tab);

  // Handle color change from the picker
  const handleColorChange = useCallback((color: string) => {
    if (colorPickerTarget) {
      setColor(colorPickerTarget.chartId, colorPickerTarget.elementKey, color);
    }
  }, [colorPickerTarget, setColor]);

  // Handle reset color
  const handleResetColor = useCallback(() => {
    if (colorPickerTarget) {
      resetColor(colorPickerTarget.chartId, colorPickerTarget.elementKey);
    }
  }, [colorPickerTarget, resetColor]);

  // Get current color for the picker
  const currentColor = colorPickerTarget
    ? getColor(colorPickerTarget.chartId, colorPickerTarget.elementKey, "#ffffff")
    : "#ffffff";

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

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidePanelOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [setSidePanelOpen]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted) {
    return (
      <button
        disabled
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
          isGame
            ? "rounded-none border border-white/30 text-white bg-black"
            : isDark
              ? "rounded-lg bg-transparent border border-[#0bd1a2] text-[#0bd1a2]"
              : "rounded-lg bg-white border border-gray-200 text-gray-600 shadow-sm"
        )}
      >
        <Settings className="h-4 w-4" />
        Customize
      </button>
    );
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
          isGame
            ? "rounded-none border border-white/30 text-white bg-black hover:bg-white/10 hover:border-[#00ff66]"
            : isDark
              ? "rounded-lg bg-transparent border border-[#0bd1a2] text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
              : "rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm"
        )}
      >
        <Settings className="h-4 w-4" />
        Customize
      </button>

      {/* Side Panel */}
      <div
        data-side-panel
        className={cn(
          "fixed top-0 right-0 h-full w-[400px] max-w-[90vw] z-[100] shadow-2xl transition-transform duration-300 ease-out",
          isGame
            ? "bg-black border-l border-white/20"
            : isDark
              ? "bg-[#1a1a2e]"
              : "bg-white",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Panel Header */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b",
            isGame
              ? "border-white/20"
              : isDark
                ? "border-[#0bd1a2]/30"
                : "border-gray-200"
          )}
        >
          <h2
            className={cn(
              "text-lg font-semibold",
              isGame
                ? "text-white"
                : isDark
                  ? "text-[#0bd1a2]"
                  : "text-gray-900"
            )}
          >
            Customize Dashboard
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className={cn(
              "p-1.5 transition-colors",
              isGame
                ? "rounded-none text-white hover:bg-white/10"
                : isDark
                  ? "rounded-md text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
                  : "rounded-md text-gray-500 hover:bg-gray-100"
            )}
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div
          className={cn(
            "flex border-b",
            isGame
              ? "border-white/20"
              : isDark
                ? "border-[#0bd1a2]/30"
                : "border-gray-200"
          )}
        >
          <button
            onClick={() => setActiveTab("charts")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "charts"
                ? isGame
                  ? "text-[#00ff66] border-b-2 border-[#00ff66]"
                  : isDark
                    ? "text-[#0bd1a2] border-b-2 border-[#0bd1a2]"
                    : "text-gray-900 border-b-2 border-black"
                : isGame
                  ? "text-white/50 hover:text-white"
                  : isDark
                    ? "text-[#0bd1a2]/50 hover:text-[#0bd1a2]"
                    : "text-gray-500 hover:text-gray-700"
            )}
          >
            Charts
          </button>
          <button
            onClick={() => setActiveTab("elements")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "elements"
                ? isGame
                  ? "text-[#00ff66] border-b-2 border-[#00ff66]"
                  : isDark
                    ? "text-[#0bd1a2] border-b-2 border-[#0bd1a2]"
                    : "text-gray-900 border-b-2 border-black"
                : isGame
                  ? "text-white/50 hover:text-white"
                  : isDark
                    ? "text-[#0bd1a2]/50 hover:text-[#0bd1a2]"
                    : "text-gray-500 hover:text-gray-700"
            )}
          >
            Elements
          </button>
          <button
            onClick={() => setActiveTab("layout")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "layout"
                ? isGame
                  ? "text-[#00ff66] border-b-2 border-[#00ff66]"
                  : isDark
                    ? "text-[#0bd1a2] border-b-2 border-[#0bd1a2]"
                    : "text-gray-900 border-b-2 border-black"
                : isGame
                  ? "text-white/50 hover:text-white"
                  : isDark
                    ? "text-[#0bd1a2]/50 hover:text-[#0bd1a2]"
                    : "text-gray-500 hover:text-gray-700"
            )}
          >
            Layout
          </button>
          <button
            onClick={() => setActiveTab("share")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "share"
                ? isGame
                  ? "text-[#00ff66] border-b-2 border-[#00ff66]"
                  : isDark
                    ? "text-[#0bd1a2] border-b-2 border-[#0bd1a2]"
                    : "text-gray-900 border-b-2 border-black"
                : isGame
                  ? "text-white/50 hover:text-white"
                  : isDark
                    ? "text-[#0bd1a2]/50 hover:text-[#0bd1a2]"
                    : "text-gray-500 hover:text-gray-700"
            )}
          >
            Share
          </button>
          <button
            onClick={() => setActiveTab("colors")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === "colors"
                ? isGame
                  ? "text-[#00ff66] border-b-2 border-[#00ff66]"
                  : isDark
                    ? "text-[#0bd1a2] border-b-2 border-[#0bd1a2]"
                    : "text-gray-900 border-b-2 border-black"
                : isGame
                  ? "text-white/50 hover:text-white"
                  : isDark
                    ? "text-[#0bd1a2]/50 hover:text-[#0bd1a2]"
                    : "text-gray-500 hover:text-gray-700"
            )}
          >
            <span className="flex items-center justify-center gap-1">
              <Palette className="h-3.5 w-3.5" />
              {colorPickerTarget && (
                <span
                  className={cn(
                    "absolute -top-1 -right-1 w-2 h-2 rounded-full",
                    isGame
                      ? "bg-[#00ff66]"
                      : isDark
                        ? "bg-[#0bd1a2]"
                        : "bg-black"
                  )}
                />
              )}
            </span>
          </button>
        </div>

        {/* Panel Content */}
        <div className="p-4 overflow-y-auto h-[calc(100%-120px)]">
          {/* Charts Tab */}
          {activeTab === "charts" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p
                  className={cn(
                    "text-sm",
                    isGame
                      ? "text-white/60"
                      : isDark
                        ? "text-[#0bd1a2]/70"
                        : "text-gray-500"
                  )}
                >
                  Toggle visibility and drag to reorder
                </p>
                <button
                  onClick={() => {
                    resetToDefaults();
                  }}
                  className={cn(
                    "flex items-center gap-1 text-xs px-2 py-1 transition-colors",
                    isGame
                      ? "rounded-none text-white/70 hover:text-[#00ff66] hover:bg-white/5"
                      : isDark
                        ? "rounded text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
                        : "rounded text-gray-500 hover:bg-gray-100"
                  )}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              </div>

              <div className="space-y-1">
                {orderedCharts.map((chart, index) => {
                  const isVisible = config.visibleCharts.includes(chart.id);
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
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all",
                        isGame
                          ? "rounded-none hover:bg-white/5"
                          : isDark
                            ? "rounded-lg hover:bg-[#0bd1a2]/10"
                            : "rounded-lg hover:bg-gray-50",
                        isDragging && "opacity-50",
                        isDragOver && (
                          isGame
                            ? "bg-white/10 border-t-2 border-[#00ff66]"
                            : isDark
                              ? "bg-[#0bd1a2]/20 border-t-2 border-[#0bd1a2]"
                              : "bg-blue-50 border-t-2 border-blue-400"
                        )
                      )}
                    >
                      {/* Drag handle */}
                      <div
                        className={cn(
                          "flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5",
                          isGame
                            ? "text-white/40 hover:text-white"
                            : isDark
                              ? "text-[#0bd1a2]/50 hover:text-[#0bd1a2]"
                              : "text-gray-400 hover:text-gray-600"
                        )}
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Checkbox */}
                      <button
                        onClick={() => toggleChartVisibility(chart.id)}
                        className={cn(
                          "flex-shrink-0 w-5 h-5 border flex items-center justify-center transition-colors",
                          isGame ? "rounded-none" : "rounded",
                          isVisible
                            ? isGame
                              ? "bg-[#00ff66] border-[#00ff66]"
                              : isDark
                                ? "bg-[#0bd1a2] border-[#0bd1a2]"
                                : "bg-black border-black"
                            : isGame
                              ? "border-white/40 hover:border-[#00ff66]"
                              : isDark
                                ? "border-[#0bd1a2]/50 hover:border-[#0bd1a2]"
                                : "border-gray-300 hover:border-gray-400"
                        )}
                      >
                        {isVisible && (
                          <Check
                            className={cn(
                              "h-3 w-3",
                              isGame ? "text-black" : isDark ? "text-black" : "text-white"
                            )}
                          />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "text-sm font-medium",
                            isGame
                              ? "text-white"
                              : isDark
                                ? "text-[#0bd1a2]"
                                : "text-gray-900"
                          )}
                        >
                          {chart.title}
                        </div>
                        <div
                          className={cn(
                            "text-xs truncate",
                            isGame
                              ? "text-white/50"
                              : isDark
                                ? "text-[#0bd1a2]/70"
                                : "text-gray-500"
                          )}
                        >
                          {chart.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Elements Tab */}
          {activeTab === "elements" && (
            <div className="space-y-2">
              <p
                className={cn(
                  "text-sm mb-4",
                  isGame
                    ? "text-white/60"
                    : isDark
                      ? "text-[#0bd1a2]/70"
                      : "text-gray-500"
                )}
              >
                Add custom elements to your dashboard
              </p>

              {/* Titles element */}
              <div
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors",
                  isGame
                    ? "rounded-none bg-white/5 hover:bg-white/10"
                    : isDark
                      ? "rounded-lg hover:bg-[#0bd1a2]/10 bg-[#0bd1a2]/5"
                      : "rounded-lg hover:bg-gray-100 bg-gray-50"
                )}
              >
                <Type
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isGame
                      ? "text-white"
                      : isDark
                        ? "text-[#0bd1a2]"
                        : "text-gray-500"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      isGame
                        ? "text-white"
                        : isDark
                          ? "text-[#0bd1a2]"
                          : "text-gray-900"
                    )}
                  >
                    Text Label
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      isGame
                        ? "text-white/50"
                        : isDark
                          ? "text-[#0bd1a2]/70"
                          : "text-gray-500"
                    )}
                  >
                    Add section titles to organize charts
                  </div>
                </div>
                <button
                  onClick={() => {
                    addTextElement();
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex-shrink-0 p-2 transition-colors",
                    isGame
                      ? "rounded-none text-white hover:text-[#00ff66] hover:bg-white/10"
                      : isDark
                        ? "rounded-md text-[#0bd1a2] hover:bg-[#0bd1a2]/20"
                        : "rounded-md text-gray-600 hover:bg-gray-200"
                  )}
                  aria-label="Add title"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Layout Tab */}
          {activeTab === "layout" && (
            <div className="space-y-6">
              <p
                className={cn(
                  "text-sm",
                  isGame
                    ? "text-white/60"
                    : isDark
                      ? "text-[#0bd1a2]/70"
                      : "text-gray-500"
                )}
              >
                Adjust page margins and layout settings
              </p>

              {/* Page Margins */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <MoveHorizontal
                    className={cn(
                      "h-4 w-4",
                      isGame
                        ? "text-white"
                        : isDark
                          ? "text-[#0bd1a2]"
                          : "text-gray-600"
                    )}
                  />
                  <h4
                    className={cn(
                      "text-sm font-semibold",
                      isGame
                        ? "text-white"
                        : isDark
                          ? "text-[#0bd1a2]"
                          : "text-gray-900"
                    )}
                  >
                    Page Margins
                  </h4>
                </div>

                {/* Left Margin */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className={cn(
                        "text-sm",
                        isGame
                          ? "text-white/80"
                          : isDark
                            ? "text-[#0bd1a2]/80"
                            : "text-gray-700"
                      )}
                    >
                      Left Margin
                    </label>
                    <span
                      className={cn(
                        "text-xs font-mono",
                        isGame
                          ? "text-white/60"
                          : isDark
                            ? "text-[#0bd1a2]/60"
                            : "text-gray-500"
                      )}
                    >
                      {config.pageMargins.left}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={PAGE_MARGIN_CONSTRAINTS.min}
                    max={PAGE_MARGIN_CONSTRAINTS.max}
                    step={PAGE_MARGIN_CONSTRAINTS.step}
                    value={config.pageMargins.left}
                    onChange={(e) => updatePageMargins({ left: parseInt(e.target.value) })}
                    className={cn(
                      "w-full h-2 rounded-lg appearance-none cursor-pointer",
                      isGame
                        ? "bg-white/20 accent-[#00ff66]"
                        : isDark
                          ? "bg-[#0bd1a2]/20 accent-[#0bd1a2]"
                          : "bg-gray-200 accent-black"
                    )}
                  />
                </div>

                {/* Right Margin */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className={cn(
                        "text-sm",
                        isGame
                          ? "text-white/80"
                          : isDark
                            ? "text-[#0bd1a2]/80"
                            : "text-gray-700"
                      )}
                    >
                      Right Margin
                    </label>
                    <span
                      className={cn(
                        "text-xs font-mono",
                        isGame
                          ? "text-white/60"
                          : isDark
                            ? "text-[#0bd1a2]/60"
                            : "text-gray-500"
                      )}
                    >
                      {config.pageMargins.right}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={PAGE_MARGIN_CONSTRAINTS.min}
                    max={PAGE_MARGIN_CONSTRAINTS.max}
                    step={PAGE_MARGIN_CONSTRAINTS.step}
                    value={config.pageMargins.right}
                    onChange={(e) => updatePageMargins({ right: parseInt(e.target.value) })}
                    className={cn(
                      "w-full h-2 rounded-lg appearance-none cursor-pointer",
                      isGame
                        ? "bg-white/20 accent-[#00ff66]"
                        : isDark
                          ? "bg-[#0bd1a2]/20 accent-[#0bd1a2]"
                          : "bg-gray-200 accent-black"
                    )}
                  />
                </div>

                {/* Reset margins button */}
                <button
                  onClick={() => updatePageMargins({ left: PAGE_MARGIN_CONSTRAINTS.min, right: PAGE_MARGIN_CONSTRAINTS.min })}
                  disabled={config.pageMargins.left === PAGE_MARGIN_CONSTRAINTS.min && config.pageMargins.right === PAGE_MARGIN_CONSTRAINTS.min}
                  className={cn(
                    "flex items-center gap-1 text-xs px-2 py-1 transition-colors",
                    isGame
                      ? "rounded-none text-white/70 hover:text-[#00ff66] hover:bg-white/5 disabled:opacity-30 disabled:hover:text-white/70 disabled:hover:bg-transparent"
                      : isDark
                        ? "rounded text-[#0bd1a2] hover:bg-[#0bd1a2]/10 disabled:opacity-30 disabled:hover:bg-transparent"
                        : "rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                  )}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset Margins
                </button>
              </div>
            </div>
          )}

          {/* Share Tab */}
          {activeTab === "share" && (
            <div className="space-y-6">
              {/* Export Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Share2
                    className={cn(
                      "h-4 w-4",
                      isGame
                        ? "text-white"
                        : isDark
                          ? "text-[#0bd1a2]"
                          : "text-gray-600"
                    )}
                  />
                  <h4
                    className={cn(
                      "text-sm font-semibold",
                      isGame
                        ? "text-white"
                        : isDark
                          ? "text-[#0bd1a2]"
                          : "text-gray-900"
                    )}
                  >
                    Share Your Dashboard
                  </h4>
                </div>
                <p
                  className={cn(
                    "text-xs mb-3",
                    isGame
                      ? "text-white/50"
                      : isDark
                        ? "text-[#0bd1a2]/70"
                        : "text-gray-500"
                  )}
                >
                  Copy this code and share it with others
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    readOnly
                    value={exportConfig()}
                    className={cn(
                      "w-full px-3 py-2 text-xs font-mono",
                      isGame
                        ? "rounded-none bg-white/5 border border-white/20 text-white"
                        : isDark
                          ? "rounded-md bg-black/30 border border-[#0bd1a2]/50 text-[#0bd1a2]"
                          : "rounded-md bg-gray-100 border border-gray-200 text-gray-700"
                    )}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(exportConfig());
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-3 py-2 text-sm transition-colors",
                      isGame ? "rounded-none" : "rounded-md",
                      copied
                        ? isGame
                          ? "bg-[#00ff66] text-black"
                          : isDark
                            ? "bg-[#0bd1a2] text-black"
                            : "bg-green-500 text-white"
                        : isGame
                          ? "bg-white/10 text-white hover:bg-white/20 hover:text-[#00ff66]"
                          : isDark
                            ? "bg-[#0bd1a2]/20 text-[#0bd1a2] hover:bg-[#0bd1a2]/30"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    )}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy Share Code
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div
                className={cn(
                  "border-t",
                  isGame
                    ? "border-white/20"
                    : isDark
                      ? "border-[#0bd1a2]/30"
                      : "border-gray-200"
                )}
              />

              {/* Import Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Download
                    className={cn(
                      "h-4 w-4",
                      isGame
                        ? "text-white"
                        : isDark
                          ? "text-[#0bd1a2]"
                          : "text-gray-600"
                    )}
                  />
                  <h4
                    className={cn(
                      "text-sm font-semibold",
                      isGame
                        ? "text-white"
                        : isDark
                          ? "text-[#0bd1a2]"
                          : "text-gray-900"
                    )}
                  >
                    Import Dashboard
                  </h4>
                </div>
                <p
                  className={cn(
                    "text-xs mb-3",
                    isGame
                      ? "text-white/50"
                      : isDark
                        ? "text-[#0bd1a2]/70"
                        : "text-gray-500"
                  )}
                >
                  Paste a shared dashboard code to apply it
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={importCode}
                    onChange={(e) => {
                      setImportCode(e.target.value);
                      setImportError(null);
                      setImportSuccess(false);
                    }}
                    placeholder="Paste share code here..."
                    className={cn(
                      "w-full px-3 py-2 text-xs font-mono",
                      isGame
                        ? "rounded-none bg-white/5 border border-white/20 text-white placeholder-white/30"
                        : isDark
                          ? "rounded-md bg-black/30 border border-[#0bd1a2]/50 text-[#0bd1a2] placeholder-[#0bd1a2]/40"
                          : "rounded-md bg-gray-100 border border-gray-200 text-gray-700 placeholder-gray-400"
                    )}
                  />
                  <button
                    onClick={() => {
                      if (!importCode.trim()) {
                        setImportError("Please enter a share code");
                        return;
                      }
                      const result = importConfig(importCode);
                      if (result.success) {
                        setImportSuccess(true);
                        setImportCode("");
                        setTimeout(() => {
                          setImportSuccess(false);
                          setIsOpen(false);
                        }, 1500);
                      } else {
                        setImportError(result.error || "Invalid code");
                      }
                    }}
                    disabled={!importCode.trim()}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-3 py-2 text-sm transition-colors",
                      isGame ? "rounded-none" : "rounded-md",
                      importSuccess
                        ? isGame
                          ? "bg-[#00ff66] text-black"
                          : isDark
                            ? "bg-[#0bd1a2] text-black"
                            : "bg-green-500 text-white"
                        : isGame
                          ? "bg-white/10 text-white hover:bg-white/20 hover:text-[#00ff66] disabled:opacity-50"
                          : isDark
                            ? "bg-[#0bd1a2]/20 text-[#0bd1a2] hover:bg-[#0bd1a2]/30 disabled:opacity-50"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                    )}
                  >
                    {importSuccess ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Applied!
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Apply Dashboard
                      </>
                    )}
                  </button>
                  {importError && (
                    <p className="text-xs text-red-500">{importError}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Colors Tab */}
          {activeTab === "colors" && (
            <div className="space-y-4">
              {colorPickerTarget ? (
                <>
                  <SidePanelColorPicker
                    chartTitle={colorPickerTarget.chartTitle}
                    elementLabel={colorPickerTarget.elementLabel}
                    currentColor={currentColor}
                    onColorChange={handleColorChange}
                    onReset={handleResetColor}
                  />

                  {/* Divider */}
                  <div
                    className={cn(
                      "border-t pt-4",
                      isGame
                        ? "border-white/20"
                        : isDark
                          ? "border-[#0bd1a2]/30"
                          : "border-gray-200"
                    )}
                  >
                    {/* Text Color Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Type
                          className={cn(
                            "h-4 w-4",
                            isGame
                              ? "text-white"
                              : isDark
                                ? "text-[#0bd1a2]"
                                : "text-gray-600"
                          )}
                        />
                        <h4
                          className={cn(
                            "text-sm font-medium",
                            isGame
                              ? "text-white"
                              : isDark
                                ? "text-[#0bd1a2]"
                                : "text-gray-900"
                          )}
                        >
                          Chart Text Color
                        </h4>
                      </div>
                      <p
                        className={cn(
                          "text-xs",
                          isGame
                            ? "text-white/50"
                            : isDark
                              ? "text-[#0bd1a2]/60"
                              : "text-gray-500"
                        )}
                      >
                        Customize the title and label colors for this chart
                      </p>

                      {/* Text color picker */}
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg border flex-shrink-0 overflow-hidden",
                            isGame
                              ? "border-white/30"
                              : isDark
                                ? "border-[#0bd1a2]/50"
                                : "border-gray-300"
                          )}
                          style={{
                            backgroundColor: getColor(colorPickerTarget.chartId, "_textColor", ""),
                          }}
                        >
                          <input
                            type="color"
                            value={getColor(colorPickerTarget.chartId, "_textColor", isGame ? "#ffffff" : isDark ? "#0bd1a2" : "#111827")}
                            onChange={(e) => setColor(colorPickerTarget.chartId, "_textColor", e.target.value)}
                            className="w-full h-full cursor-pointer opacity-0"
                            title="Pick text color"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={getColor(colorPickerTarget.chartId, "_textColor", "")}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (/^#[0-9A-Fa-f]{0,6}$/.test(val) || val === "") {
                                if (val === "" || /^#[0-9A-Fa-f]{6}$/.test(val)) {
                                  setColor(colorPickerTarget.chartId, "_textColor", val);
                                }
                              }
                            }}
                            placeholder={isGame ? "#ffffff" : isDark ? "#0bd1a2" : "#111827"}
                            className={cn(
                              "w-full text-sm px-3 py-2 rounded-lg border bg-transparent font-mono",
                              isGame
                                ? "border-white/30 text-white placeholder-white/40"
                                : isDark
                                  ? "border-[#0bd1a2]/50 text-[#0bd1a2] placeholder-[#0bd1a2]/40"
                                  : "border-gray-300 text-gray-700 placeholder-gray-400"
                            )}
                          />
                        </div>
                        <button
                          onClick={() => resetColor(colorPickerTarget.chartId, "_textColor")}
                          className={cn(
                            "p-2 transition-colors flex-shrink-0",
                            isGame
                              ? "rounded-none text-white/60 hover:text-[#00ff66] hover:bg-white/5"
                              : isDark
                                ? "rounded text-[#0bd1a2]/60 hover:text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
                                : "rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          )}
                          title="Reset to default"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Apply to all charts section */}
                  <div
                    className={cn(
                      "border-t pt-4",
                      isGame
                        ? "border-white/20"
                        : isDark
                          ? "border-[#0bd1a2]/30"
                          : "border-gray-200"
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Layers
                          className={cn(
                            "h-4 w-4",
                            isGame
                              ? "text-white"
                              : isDark
                                ? "text-[#0bd1a2]"
                                : "text-gray-600"
                          )}
                        />
                        <h4
                          className={cn(
                            "text-sm font-medium",
                            isGame
                              ? "text-white"
                              : isDark
                                ? "text-[#0bd1a2]"
                                : "text-gray-900"
                          )}
                        >
                          Apply to All Charts
                        </h4>
                      </div>
                      <p
                        className={cn(
                          "text-xs",
                          isGame
                            ? "text-white/50"
                            : isDark
                              ? "text-[#0bd1a2]/60"
                              : "text-gray-500"
                        )}
                      >
                        Apply this chart&apos;s background and text settings to all other charts (including defaults)
                      </p>
                      <button
                        onClick={() => {
                          applyStyleToAllCharts(colorPickerTarget.chartId, ALL_CHART_IDS);
                        }}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 px-3 py-2 text-sm transition-colors",
                          isGame
                            ? "rounded-none bg-white/10 text-white hover:bg-white/20 hover:text-[#00ff66]"
                            : isDark
                              ? "rounded-md bg-[#0bd1a2]/20 text-[#0bd1a2] hover:bg-[#0bd1a2]/30"
                              : "rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                      >
                        <Layers className="h-4 w-4" />
                        Apply styles to all charts
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Palette
                    className={cn(
                      "h-12 w-12 mx-auto mb-3",
                      isGame
                        ? "text-white/30"
                        : isDark
                          ? "text-[#0bd1a2]/30"
                          : "text-gray-300"
                    )}
                  />
                  <p
                    className={cn(
                      "text-sm",
                      isGame
                        ? "text-white/60"
                        : isDark
                          ? "text-[#0bd1a2]/70"
                          : "text-gray-500"
                    )}
                  >
                    Click the palette icon on a chart to customize its colors
                  </p>
                </div>
              )}

              {/* Close color picker button when active */}
              {colorPickerTarget && (
                <button
                  onClick={() => setColorPickerTarget(null)}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-3 py-2 text-sm transition-colors mt-4",
                    isGame
                      ? "rounded-none border border-white/30 text-white hover:bg-white/10"
                      : isDark
                        ? "rounded-md border border-[#0bd1a2]/50 text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
                        : "rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <X className="h-4 w-4" />
                  Done editing
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
