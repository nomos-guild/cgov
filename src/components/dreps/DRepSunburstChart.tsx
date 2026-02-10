import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { useAllDReps, useDRepStats, useDRepRationaleStats } from "@/hooks/useDRepData";
import { DRepBubbleMap } from "@/components/dreps/DRepBubbleMap";
import { DRepTreeMap } from "@/components/dreps/DRepTreeMap";
import { DRepDonutChart } from "@/components/dreps/DRepDonutChart";

// Color palette for DReps - generates distinct colors based on global index
function generateColor(index: number, total: number): string {
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

interface DRepSunburstChartProps {
  className?: string;
}

export function DRepSunburstChart({ className }: DRepSunburstChartProps) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light";
  const [searchTerm, setSearchTerm] = useState("");
  const [chartType, setChartType] = useState<"bubble" | "treemap" | "donut">("bubble");
  const [chartMetric, setChartMetric] = useState<"votingPower" | "delegators" | "votesCast">("votingPower");
  const [chartVisible, setChartVisible] = useState(true);
  const [topN, setTopN] = useState<number | null>(null); // null = all
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);

  // Fade out, switch metric, fade back in
  const switchMetric = useCallback((metric: typeof chartMetric) => {
    if (metric === chartMetric) return;
    setChartVisible(false);
    setTimeout(() => {
      setChartMetric(metric);
      setChartVisible(true);
    }, 350);
  }, [chartMetric]);

  // Load all DReps (auto-paginates if backend caps pageSize)
  const { dreps, isLoading, error } = useAllDReps({
    sortBy: "votingPower",
    sortOrder: "desc",
  });

  const { stats } = useDRepStats();
  const totalVotingPower = stats?.totalDelegatedAda || 0;

  // Rationale stats (keyed by drepId for fast lookup)
  const { dreps: rationaleStats } = useDRepRationaleStats();
  const rationaleMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of rationaleStats) {
      map.set(d.drepId, d.rationalesProvided);
    }
    return map;
  }, [rationaleStats]);

  // Filter dreps: exclude 0 voting power, then apply search term
  const filteredDreps = useMemo(() => {
    const nonZero = dreps.filter((drep) => drep.votingPowerAda > 0);
    if (!searchTerm.trim()) return nonZero;
    const term = searchTerm.toLowerCase();
    return nonZero.filter(
      (drep) =>
        (drep.name?.toLowerCase().includes(term)) ||
        drep.drepId.toLowerCase().includes(term)
    );
  }, [dreps, searchTerm]);

  const totalDReps = filteredDreps.length;

  // Aggregated stats for the selection (top-N or all)
  const selectionStats = useMemo(() => {
    const selected = topN === null ? filteredDreps : filteredDreps.slice(0, topN);
    const votingPower = selected.reduce((sum, d) => sum + d.votingPowerAda, 0);
    const delegators = selected.reduce((sum, d) => sum + (d.delegatorCount ?? 0), 0);
    const votes = selected.reduce((sum, d) => sum + d.totalVotesCast, 0);

    const totalDelegators = filteredDreps.reduce((sum, d) => sum + (d.delegatorCount ?? 0), 0);
    const totalVotes = filteredDreps.reduce((sum, d) => sum + d.totalVotesCast, 0);

    return {
      votingPower,
      votingPowerPct: totalVotingPower > 0 ? (votingPower / totalVotingPower) * 100 : 0,
      delegators,
      delegatorsPct: totalDelegators > 0 ? (delegators / totalDelegators) * 100 : 0,
      votes,
      votesPct: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
    };
  }, [filteredDreps, topN, totalVotingPower]);

  // Stable scroll handler (no-op now, kept for list ref)
  const handleScroll = useCallback(() => {}, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

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

  const cardClass = "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-6 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none";

  const tabBtnClass = isGame
    ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
    : "rounded-none border border-white/8 bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-450 ease-in-out shadow-[0_12px_30px_rgba(15,23,42,0.25)] data-[state=active]:bg-black data-[state=active]:text-white hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon";

  return (
    <div className={className}>
      {/* Chart section */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Side panel card */}
        <div className={`${cardClass} flex flex-col gap-3 sm:w-[230px] sm:flex-shrink-0`}>
          <div>
            <h3 className={`text-lg font-semibold ${isGame ? "text-white" : ""}`}>
              DReps by {chartMetric === "votingPower" ? "Voting Power" : chartMetric === "delegators" ? "Delegators" : "Votes Cast"}
            </h3>
            <p className={`text-sm ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
              {totalDReps} DReps
              {searchTerm && <span> matching &ldquo;{searchTerm}&rdquo;</span>}
            </p>
          </div>
          {/* Chart type tabs */}
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
              Chart Type
            </p>
            <div className="flex sm:flex-col flex-wrap gap-1.5">
              {([
                { key: "bubble", label: "Bubble Map" },
                { key: "treemap", label: "Tree Map" },
                { key: "donut", label: "Donut" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setChartType(key)}
                  data-state={chartType === key ? "active" : "inactive"}
                  className={tabBtnClass}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Metric tabs */}
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
              Metric
            </p>
            <div className="flex sm:flex-col flex-wrap gap-1.5">
              {([
                { key: "votingPower", label: "Voting Power" },
                { key: "delegators", label: "Delegators" },
                { key: "votesCast", label: "Votes Cast" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => switchMetric(key)}
                  data-state={chartMetric === key ? "active" : "inactive"}
                  className={tabBtnClass}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Top N filter */}
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
              Show
            </p>
            <div className="flex sm:flex-col flex-wrap gap-1.5">
              {([
                { value: 10, label: "Top 10" },
                { value: 20, label: "Top 20" },
                { value: 50, label: "Top 50" },
                { value: null, label: "All" },
              ] as const).map(({ value, label }) => (
                <button
                  key={label}
                  onClick={() => setTopN(value)}
                  data-state={topN === value ? "active" : "inactive"}
                  className={tabBtnClass}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Selection summary stats */}
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
              {topN !== null ? `Top ${topN} Summary` : "Summary"}
            </p>
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[45%]" />
                <col className="w-[30%]" />
                <col className="w-[25%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className={`text-left text-[10px] font-medium pb-1 ${isGame ? "text-white/40" : "text-muted-foreground"}`}>Metric</th>
                  <th className={`text-right text-[10px] font-medium pb-1 ${isGame ? "text-white/40" : "text-muted-foreground"}`}>Value</th>
                  <th className={`text-right text-[10px] font-medium pb-1 ${isGame ? "text-white/40" : "text-muted-foreground"}`}>%</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`text-xs py-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>Voting Power</td>
                  <td className={`text-xs font-semibold text-right py-0.5 ${isGame ? "text-white" : ""}`}>{formatVotingPower(selectionStats.votingPower)}</td>
                  <td className={`text-xs font-semibold text-right py-0.5 ${isGame ? "text-white/60" : "text-muted-foreground"}`}>{selectionStats.votingPowerPct.toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className={`text-xs py-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>Delegators</td>
                  <td className={`text-xs font-semibold text-right py-0.5 ${isGame ? "text-white" : ""}`}>{selectionStats.delegators.toLocaleString()}</td>
                  <td className={`text-xs font-semibold text-right py-0.5 ${isGame ? "text-white/60" : "text-muted-foreground"}`}>{selectionStats.delegatorsPct.toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className={`text-xs py-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>Votes Cast</td>
                  <td className={`text-xs font-semibold text-right py-0.5 ${isGame ? "text-white" : ""}`}>{selectionStats.votes.toLocaleString()}</td>
                  <td className={`text-xs font-semibold text-right py-0.5 ${isGame ? "text-white/60" : "text-muted-foreground"}`}>{selectionStats.votesPct.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart area card */}
        <div className={`${cardClass} flex-1 min-w-0 relative`}>
          <div
            className="transition-opacity duration-300 ease-in-out"
            style={{ opacity: chartVisible ? 1 : 0 }}
          >
            {chartType === "bubble" && (
              <DRepBubbleMap
                key={chartMetric}
                dreps={filteredDreps}
                metric={chartMetric}
                topN={topN}
                rationaleMap={rationaleMap}
              />
            )}
            {chartType === "treemap" && (
              <DRepTreeMap
                key={chartMetric}
                dreps={filteredDreps}
                metric={chartMetric}
                topN={topN}
                rationaleMap={rationaleMap}
              />
            )}
            {chartType === "donut" && (
              <DRepDonutChart
                key={chartMetric}
                dreps={filteredDreps}
                metric={chartMetric}
                topN={topN}
                rationaleMap={rationaleMap}
              />
            )}
          </div>
        </div>
      </div>

      {/* DRep List Card */}
      <div className={`${cardClass} mt-4`}>
        <div className="flex flex-col h-[520px]">
          {/* Search Input */}
          <div className="pb-3">
            <input
              type="text"
              placeholder="Search by name or DRep ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
            className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/20"
          >
            <div className="px-3">
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
                  const percentOfTotal = totalVotingPower > 0
                    ? ((drep.votingPowerAda / totalVotingPower) * 100).toFixed(2)
                    : "0.00";
                  return (
                    <div
                      key={drep.drepId}
                      className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-[11px] ${
                        isLight
                          ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                          : isGame
                          ? "bg-white/5"
                          : "bg-white/5"
                      }`}
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
                      <span className={`w-[70px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {drep.delegatorCount != null ? drep.delegatorCount.toLocaleString() : "--"}
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
    </div>
  );
}
