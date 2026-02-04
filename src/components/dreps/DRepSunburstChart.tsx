import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useTheme } from "@/lib/theme";
import { useAllDReps, useDRepStats } from "@/hooks/useDRepData";
import { getChartColors } from "@/components/dashboards/shared/chartTheme";

interface RadialDataItem {
  name: string;
  value: number;
  drepId: string;
  votingPowerAda: number;
  totalVotesCast: number;
  fill: string;
  originalIndex: number; // Index in the full dreps array
}

// Number of DReps to show in the chart at once (matches roughly what fits in viewport)
const CHART_WINDOW_SIZE = 12;

// Color palette for DReps - generates distinct colors based on global index
function generateColor(index: number, total: number): string {
  // Use HSL for better distribution of colors
  const hue = (index / Math.max(total, 1)) * 360;
  const saturation = 65 + (index % 3) * 10;
  const lightness = 45 + (index % 2) * 10;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Format voting power for display
function formatVotingPower(value: number, decimals: number = 1): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}K`;
  }
  return value.toLocaleString();
}

// Custom tooltip
interface TooltipPayload {
  payload: RadialDataItem;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  themeId: string;
}

function CustomTooltip({ active, payload, themeId }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  const chartColors = getChartColors(themeId);

  return (
    <div
      className="rounded-lg shadow-lg p-3 text-sm max-w-xs"
      style={{
        backgroundColor: chartColors.tooltipBg,
        color: chartColors.tooltipText,
        border: `1px solid ${chartColors.tooltipBorder}`,
      }}
    >
      <p className="font-semibold mb-1 truncate">#{data.originalIndex + 1} {data.name}</p>
      <p className="text-xs opacity-80 mb-2 truncate font-mono">
        {data.drepId.slice(0, 20)}...
      </p>
      <div className="space-y-1">
        <p>
          <span className="opacity-70">Voting Power:</span>{" "}
          <span className="font-medium">{formatVotingPower(data.votingPowerAda, 2)} ADA</span>
        </p>
        <p>
          <span className="opacity-70">Votes Cast:</span>{" "}
          <span className="font-medium">{data.totalVotesCast}</span>
        </p>
      </div>
    </div>
  );
}

interface DRepSunburstChartProps {
  className?: string;
}

export function DRepSunburstChart({ className }: DRepSunburstChartProps) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light";
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);

  // Load all DReps (auto-paginates if backend caps pageSize)
  const { dreps, isLoading, error } = useAllDReps({
    sortBy: "votingPower",
    sortOrder: "desc",
  });

  const { stats } = useDRepStats();
  const totalVotingPower = stats?.totalDelegatedAda || 0;

  // Filter dreps based on search term
  const filteredDreps = useMemo(() => {
    if (!searchTerm.trim()) return dreps;
    const term = searchTerm.toLowerCase();
    return dreps.filter(
      (drep) =>
        (drep.name?.toLowerCase().includes(term)) ||
        drep.drepId.toLowerCase().includes(term)
    );
  }, [dreps, searchTerm]);

  const totalDReps = filteredDreps.length;

  // Handle scroll to update visible window based on actual visible rows
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !rowsContainerRef.current) return;

    const container = scrollContainerRef.current;
    const rowsContainer = rowsContainerRef.current;
    const rows = rowsContainer.children;

    if (rows.length === 0) return;

    // Get the scroll container's visible area
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top;

    // Find first visible row
    let firstVisibleIndex = 0;
    for (let i = 0; i < rows.length; i++) {
      const rowRect = rows[i].getBoundingClientRect();
      // Row is visible if its bottom is below container top
      if (rowRect.bottom > containerTop + 50) { // +50 for header
        firstVisibleIndex = i;
        break;
      }
    }

    // Clamp to valid range
    const maxStartIndex = Math.max(0, totalDReps - CHART_WINDOW_SIZE);
    setVisibleStartIndex(Math.min(firstVisibleIndex, maxStartIndex));
  }, [totalDReps]);

  // Attach scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Hover handlers - now track global index
  const handleLegendMouseEnter = useCallback((globalIndex: number) => {
    setHoveredIndex(globalIndex);
  }, []);

  const handleLegendMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  const handleChartMouseEnter = useCallback((data: RadialDataItem) => {
    setHoveredIndex(data.originalIndex);
  }, []);

  const handleChartMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  // Get the visible window of DReps for the chart
  const visibleDReps = useMemo(() => {
    const endIndex = Math.min(visibleStartIndex + CHART_WINDOW_SIZE, totalDReps);
    return filteredDreps.slice(visibleStartIndex, endIndex);
  }, [filteredDreps, visibleStartIndex, totalDReps]);

  // Transform visible DReps into radial bar data
  const chartData = useMemo(() => {
    if (!visibleDReps.length) return [];

    // Find max and min voting power in visible window for normalization
    const votingPowers = visibleDReps.map(d => d.votingPowerAda);
    const maxVotingPower = Math.max(...votingPowers);
    const minVotingPower = Math.min(...votingPowers);
    const range = maxVotingPower - minVotingPower;

    // Reverse order so largest are on the outside (rendered last = outermost)
    return [...visibleDReps].reverse().map((drep, index): RadialDataItem => {
      const globalIndex = visibleStartIndex + (visibleDReps.length - 1 - index);

      // Normalize to 20-100% range so all bars are visible
      // 20% minimum ensures even smallest DReps have visible bars
      let normalizedValue: number;
      if (range === 0 || maxVotingPower === 0) {
        // All DReps have same voting power, give them all full bars
        normalizedValue = 100;
      } else {
        // Scale from 20% to 100% based on relative position in range
        const relativePosition = (drep.votingPowerAda - minVotingPower) / range;
        normalizedValue = 20 + (relativePosition * 80);
      }

      return {
        name: drep.name || "Anonymous DRep",
        value: normalizedValue,
        drepId: drep.drepId,
        votingPowerAda: drep.votingPowerAda,
        totalVotesCast: drep.totalVotesCast,
        // Light theme: pure white, others: colorful based on global index
        fill: isLight ? "#ffffff" : generateColor(globalIndex, totalDReps),
        // Store global index for hover sync
        originalIndex: globalIndex,
      };
    });
  }, [visibleDReps, visibleStartIndex, totalDReps, isLight]);

  // Calculate visible range for display
  const visibleEndIndex = Math.min(visibleStartIndex + CHART_WINDOW_SIZE, totalDReps);

  if (isLoading) {
    return (
      <div className={className}>
        <div className="h-[500px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="h-[500px] flex items-center justify-center text-muted-foreground">
          Failed to load DRep data
        </div>
      </div>
    );
  }

  if (!dreps.length) {
    return (
      <div className={className}>
        <div className="h-[500px] flex items-center justify-center text-muted-foreground">
          No DRep data available
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-4">
        <h3 className={`text-lg font-semibold ${isGame ? "text-white" : ""}`}>
          DReps by Voting Power
        </h3>
        <p className={`text-sm ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
          {searchTerm ? (
            <>Showing #{visibleStartIndex + 1} - #{visibleEndIndex} of {totalDReps} matching DReps</>
          ) : (
            <>Showing #{visibleStartIndex + 1} - #{visibleEndIndex} of {totalDReps} DReps
            <span className="opacity-60 ml-2">• Scroll or search to explore</span></>
          )}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Chart - shows visible window */}
        <div className="h-[450px] sm:h-[520px] w-full sm:w-[520px] flex-shrink-0 relative">
          {/* SVG filter definition for light theme shadows */}
          {isLight && (
            <svg width="0" height="0" className="absolute">
              <defs>
                <filter id="drep-bar-shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.15" />
                </filter>
              </defs>
            </svg>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="8%"
              outerRadius="98%"
              barSize={28}
              data={chartData}
              startAngle={90}
              endAngle={-270}
              style={isLight ? { filter: "url(#drep-bar-shadow)" } : undefined}
            >
              <RadialBar
                dataKey="value"
                cornerRadius={4}
                background={{ fill: isLight ? "rgba(0,0,0,0.06)" : isGame ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}
                stroke={isLight ? "rgba(0,0,0,0.08)" : undefined}
                strokeWidth={isLight ? 1 : 0}
                onMouseEnter={(_, i) => {
                  const item = chartData[i];
                  if (item) handleChartMouseEnter(item);
                }}
                onMouseLeave={handleChartMouseLeave}
              >
                {chartData.map((entry) => {
                  const isHovered = hoveredIndex === entry.originalIndex;
                  return (
                    <Cell
                      key={entry.drepId}
                      fill={entry.fill}
                      style={{
                        filter: isHovered ? "brightness(1.2) drop-shadow(0 0 8px rgba(0,0,0,0.3))" : undefined,
                        transform: isHovered ? "scale(1.02)" : undefined,
                        transformOrigin: "center",
                        transition: "filter 0.2s, transform 0.2s",
                      }}
                    />
                  );
                })}
              </RadialBar>
              <Tooltip
                content={<CustomTooltip themeId={activeTheme.id} />}
                isAnimationActive={false}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* DRep Table - scrollable, shows all DReps */}
        <div className="flex-1 flex flex-col sm:h-[520px]">
          {/* Search Input - fixed above scroll area */}
          <div className="px-[20px] pt-[12px] pb-2">
            <input
              type="text"
              placeholder="Search by name or DRep ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisibleStartIndex(0); // Reset scroll position on search
              }}
              className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors ${
                isLight
                  ? "bg-white border-black/10 text-black placeholder:text-black/40 focus:border-black/30 focus:ring-1 focus:ring-black/10"
                  : isGame
                  ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#0bd1a2] focus:ring-1 focus:ring-[#0bd1a2]/30"
                  : "bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30"
              }`}
            />
            {searchTerm && (
              <div className={`mt-1.5 text-xs ${isGame ? "text-white/60" : "text-muted-foreground"}`}>
                Found {filteredDreps.length} DRep{filteredDreps.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
          {/* Scrollable table area */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/20"
          >
            <div className="px-[20px] pb-[12px]">
              {/* Table Header */}
              <div className={`flex items-center gap-3 py-2 px-2 text-[10px] font-semibold uppercase tracking-wide border-b sticky top-0 z-20 ${
                isLight
                  ? "border-black/10 text-black/60 bg-[#faf9f6]"
                  : isGame
                  ? "border-white/10 text-white/60 bg-[#1a1a2e]"
                  : "border-white/10 text-muted-foreground bg-background"
              }`}>
                <span className="w-7 text-center">#</span>
                <span className="w-[140px] min-w-0">DRep Name</span>
                <span className="w-[80px] text-right">Power</span>
                <span className="w-[55px] text-right">%</span>
                <span className="w-[70px] text-right">Delegators</span>
                <span className="w-[50px] text-right">Votes</span>
              </div>
              {/* Table Rows */}
              <div ref={rowsContainerRef} className="flex flex-col gap-1.5 mt-2">
                {filteredDreps.map((drep, index) => {
                  const isHovered = hoveredIndex === index;
                  const isInVisibleWindow = index >= visibleStartIndex && index < visibleEndIndex;
                  const percentOfTotal = totalVotingPower > 0
                    ? ((drep.votingPowerAda / totalVotingPower) * 100).toFixed(2)
                    : "0.00";
                  return (
                    <div
                      key={drep.drepId}
                      className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-[11px] cursor-pointer transition-all ${
                        isLight
                          ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                          : isGame
                          ? "bg-white/5"
                          : "bg-white/5"
                      } ${isHovered
                        ? isLight
                          ? "shadow-[0_4px_12px_rgba(0,0,0,0.25)] scale-[1.01] ring-2 ring-black/20 z-10"
                          : "bg-white/20 scale-[1.01] shadow-[0_4px_12px_rgba(255,255,255,0.1)] z-10"
                        : ""
                      } ${!isInVisibleWindow && !isHovered
                        ? "opacity-50"
                        : ""
                      }`}
                      onMouseEnter={() => handleLegendMouseEnter(index)}
                      onMouseLeave={handleLegendMouseLeave}
                    >
                      {/* Rank with color indicator */}
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${
                          isLight
                            ? "bg-black/10 text-black/60"
                            : "text-white"
                        }`}
                        style={!isLight ? { backgroundColor: generateColor(index, totalDReps) } : undefined}
                      >
                        {index + 1}
                      </span>
                      {/* DRep Name */}
                      <Link
                        href={`/drep/${encodeURIComponent(drep.drepId)}`}
                        className={`w-[140px] truncate font-medium hover:underline ${
                          isGame ? "text-white hover:text-[#0bd1a2]" : "hover:text-primary"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {drep.name || "Anonymous"}
                      </Link>
                      {/* Voting Power */}
                      <span className={`w-[80px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {formatVotingPower(drep.votingPowerAda)}
                      </span>
                      {/* % of Total */}
                      <span className={`w-[55px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {percentOfTotal}%
                      </span>
                      {/* Delegators */}
                      <span className={`w-[70px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/50" : "text-muted-foreground/70"}`}>
                        --
                      </span>
                      {/* Votes Cast */}
                      <span className={`w-[50px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {drep.totalVotesCast}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`mt-3 text-xs ${isGame ? "text-white/60" : "text-muted-foreground"}`}>
        Search or scroll the table to explore all DReps • Chart shows current view
      </div>
    </div>
  );
}
