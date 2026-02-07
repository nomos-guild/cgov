import { useState, useRef, useEffect, useMemo } from "react";
import { Settings, Check, RotateCcw, GripVertical, Plus, Type, Share2, Download, Copy, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "./DashboardProvider";
import { useTheme } from "@/lib/theme";

type TabId = "charts" | "elements" | "share";

export function ChartVisibilityDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("charts");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { config, getChartById, toggleChartVisibility, reorderCharts, resetToDefaults, addTextElement, exportConfig, importConfig, mounted } = useDashboard();
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;

  // Get charts in the user's custom order
  const orderedCharts = useMemo(() => {
    return config.chartOrder
      .map((id) => getChartById(id))
      .filter((chart) => chart !== undefined);
  }, [config.chartOrder, getChartById]);

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
            "absolute right-0 top-full mt-2 w-[600px] z-[100] rounded-lg shadow-lg",
            isDark
              ? "bg-[#1a1a2e] border border-[#0bd1a2]"
              : "bg-white border border-gray-200"
          )}
        >
          {/* Tabs */}
          <div
            className={cn(
              "flex border-b",
              isDark ? "border-[#0bd1a2]/30" : "border-gray-200"
            )}
          >
            <button
              onClick={() => setActiveTab("charts")}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "charts"
                  ? isDark
                    ? "text-[#0bd1a2] border-b-2 border-[#0bd1a2]"
                    : "text-gray-900 border-b-2 border-black"
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
                "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "elements"
                  ? isDark
                    ? "text-[#0bd1a2] border-b-2 border-[#0bd1a2]"
                    : "text-gray-900 border-b-2 border-black"
                  : isDark
                    ? "text-[#0bd1a2]/50 hover:text-[#0bd1a2]"
                    : "text-gray-500 hover:text-gray-700"
              )}
            >
              Elements
            </button>
            <button
              onClick={() => setActiveTab("share")}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "share"
                  ? isDark
                    ? "text-[#0bd1a2] border-b-2 border-[#0bd1a2]"
                    : "text-gray-900 border-b-2 border-black"
                  : isDark
                    ? "text-[#0bd1a2]/50 hover:text-[#0bd1a2]"
                    : "text-gray-500 hover:text-gray-700"
              )}
            >
              Share
            </button>
          </div>

          <div className="p-3">
            {/* Charts Tab */}
            {activeTab === "charts" && (
              <>
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
              </>
            )}

            {/* Elements Tab */}
            {activeTab === "elements" && (
              <div className="space-y-1">
                {/* Titles element */}
                <div
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left",
                    isDark ? "hover:bg-[#0bd1a2]/10" : "hover:bg-gray-50"
                  )}
                >
                  <Type
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      isDark ? "text-[#0bd1a2]" : "text-gray-500"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        "text-sm font-medium",
                        isDark ? "text-[#0bd1a2]" : "text-gray-900"
                      )}
                    >
                      Titles
                    </div>
                    <div
                      className={cn(
                        "text-xs",
                        isDark ? "text-[#0bd1a2]/70" : "text-gray-500"
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
                      "flex-shrink-0 p-1.5 rounded-md transition-colors",
                      isDark
                        ? "text-[#0bd1a2] hover:bg-[#0bd1a2]/20"
                        : "text-gray-600 hover:bg-gray-200"
                    )}
                    aria-label="Add title"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Share Tab */}
            {activeTab === "share" && (
              <div className="space-y-4">
                {/* Export Section */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Share2
                      className={cn(
                        "h-4 w-4",
                        isDark ? "text-[#0bd1a2]" : "text-gray-600"
                      )}
                    />
                    <h4
                      className={cn(
                        "text-sm font-semibold",
                        isDark ? "text-[#0bd1a2]" : "text-gray-900"
                      )}
                    >
                      Share Your Dashboard
                    </h4>
                  </div>
                  <p
                    className={cn(
                      "text-xs mb-2",
                      isDark ? "text-[#0bd1a2]/70" : "text-gray-500"
                    )}
                  >
                    Copy this code and share it with others
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={exportConfig()}
                      className={cn(
                        "flex-1 px-3 py-2 text-xs rounded-md font-mono",
                        isDark
                          ? "bg-black/30 border border-[#0bd1a2]/50 text-[#0bd1a2]"
                          : "bg-gray-100 border border-gray-200 text-gray-700"
                      )}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(exportConfig());
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className={cn(
                        "flex items-center gap-1 px-3 py-2 text-xs rounded-md transition-colors",
                        copied
                          ? isDark
                            ? "bg-[#0bd1a2] text-black"
                            : "bg-green-500 text-white"
                          : isDark
                            ? "bg-[#0bd1a2]/20 text-[#0bd1a2] hover:bg-[#0bd1a2]/30"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      )}
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div
                  className={cn(
                    "border-t",
                    isDark ? "border-[#0bd1a2]/30" : "border-gray-200"
                  )}
                />

                {/* Import Section */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Download
                      className={cn(
                        "h-4 w-4",
                        isDark ? "text-[#0bd1a2]" : "text-gray-600"
                      )}
                    />
                    <h4
                      className={cn(
                        "text-sm font-semibold",
                        isDark ? "text-[#0bd1a2]" : "text-gray-900"
                      )}
                    >
                      Import Dashboard
                    </h4>
                  </div>
                  <p
                    className={cn(
                      "text-xs mb-2",
                      isDark ? "text-[#0bd1a2]/70" : "text-gray-500"
                    )}
                  >
                    Paste a shared dashboard code to apply it
                  </p>
                  <div className="flex gap-2">
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
                        "flex-1 px-3 py-2 text-xs rounded-md font-mono",
                        isDark
                          ? "bg-black/30 border border-[#0bd1a2]/50 text-[#0bd1a2] placeholder-[#0bd1a2]/40"
                          : "bg-gray-100 border border-gray-200 text-gray-700 placeholder-gray-400"
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
                        "flex items-center gap-1 px-3 py-2 text-xs rounded-md transition-colors",
                        importSuccess
                          ? isDark
                            ? "bg-[#0bd1a2] text-black"
                            : "bg-green-500 text-white"
                          : isDark
                            ? "bg-[#0bd1a2]/20 text-[#0bd1a2] hover:bg-[#0bd1a2]/30 disabled:opacity-50"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                      )}
                    >
                      {importSuccess ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Applied
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3" />
                          Apply
                        </>
                      )}
                    </button>
                  </div>
                  {importError && (
                    <p className="mt-1 text-xs text-red-500">{importError}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
