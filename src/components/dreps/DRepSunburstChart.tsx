import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";
import { useAllDReps, useDRepStats, useDRepRationaleStats, useDRepVoteChanges } from "@/hooks/useDRepData";
import { DRepBubbleMap } from "@/components/dreps/DRepBubbleMap";
import { DRepTreeMap } from "@/components/dreps/DRepTreeMap";
import { DRepDonutChart } from "@/components/dreps/DRepDonutChart";

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
  initialDreps?: DRepSummary[];
  /** Which sections to show: "all" (default), "chart" (chart + controls only), "list" (table only) */
  view?: "all" | "chart" | "list";
}

export function DRepSunburstChart({ className, initialDreps, view = "all" }: DRepSunburstChartProps) {
  const t = useTranslations();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light";
  const [searchTerm, setSearchTerm] = useState("");
  const [chartType, setChartType] = useState<"bubble" | "treemap" | "donut">("bubble");
  const [chartMetric, setChartMetric] = useState<"votingPower" | "delegators">("votingPower");
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
  }, initialDreps);

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

  // Vote change stats (keyed by drepId)
  const { dreps: voteChangeStats } = useDRepVoteChanges();
  const voteChangesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of voteChangeStats) {
      map.set(d.drepId, d.voteChanges);
    }
    return map;
  }, [voteChangeStats]);

  // Filter dreps: exclude 0 voting power, apply search, then sort by active metric
  const filteredDreps = useMemo(() => {
    const nonZero = dreps.filter((drep) => drep.votingPowerAda > 0);
    const searched = searchTerm.trim()
      ? nonZero.filter((drep) => {
          const term = searchTerm.toLowerCase();
          return (drep.name?.toLowerCase().includes(term)) || drep.drepId.toLowerCase().includes(term);
        })
      : nonZero;
    // Sort by the active chart metric so charts reflect correct ranking
    if (chartMetric === "delegators") {
      return [...searched].sort((a, b) => (b.delegatorCount ?? 0) - (a.delegatorCount ?? 0));
    }
    return searched; // already sorted by votingPower from the hook
  }, [dreps, searchTerm, chartMetric]);

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
          {t("drep.failedToLoad")}
        </div>
      </div>
    );
  }

  if (!dreps.length) {
    return (
      <div className={className}>
        <div className="h-[500px] flex items-center justify-center text-muted-foreground">
          {t("drep.noDataAvailable")}
        </div>
      </div>
    );
  }

  const cardClass = isLight
    ? "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-6 shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
    : isGame
    ? "game-drep-content rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] p-4 sm:p-6 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : "rounded-none border border-[#0bd1a2] bg-transparent p-4 sm:p-6 shadow-none";

  const tabBtnClass = isGame
    ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
    : "rounded-none border border-white/8 bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-450 ease-in-out shadow-[0_12px_30px_rgba(15,23,42,0.25)] data-[state=active]:bg-black data-[state=active]:text-white hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon";

  return (
    <div className={className}>
      {/* Chart section */}
      {view !== "list" && <div className="flex flex-col sm:flex-row gap-4">
        {/* Left column: controls + summary */}
        <div className="flex flex-col gap-4 sm:w-[230px] sm:flex-shrink-0">
        {/* Controls card */}
        <div className={`${cardClass} flex flex-col gap-3`}>
          <div>
            <h3 className={`text-lg font-semibold ${isGame ? "text-white" : ""}`}>
              {chartMetric === "votingPower" ? t("drep.drepsByVotingPower") : t("drep.drepsByDelegators")}
            </h3>
            {searchTerm && (
              <p className={`text-sm ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                {t("drep.matching", { term: searchTerm })}
              </p>
            )}
          </div>
          {/* Chart type tabs */}
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
              {t("drep.chartType")}
            </p>
            <div className="flex sm:flex-col flex-wrap gap-1.5">
              {([
                { key: "bubble", label: t("drep.bubbleMap") },
                { key: "treemap", label: t("drep.treeMap") },
                { key: "donut", label: t("drep.donut") },
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
              {t("drep.metric")}
            </p>
            <div className="flex sm:flex-col flex-wrap gap-1.5">
              {([
                { key: "votingPower", label: t("drep.votingPower") },
                { key: "delegators", label: t("drep.delegators") },
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
              {t("drep.show")}
            </p>
            <div className="flex sm:flex-col flex-wrap gap-1.5">
              {([
                { value: 10, label: t("drep.top", { count: 10 }) },
                { value: 20, label: t("drep.top", { count: 20 }) },
                { value: 50, label: t("drep.top", { count: 50 }) },
                { value: null, label: t("common.all") },
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
        </div>

        {/* Selection summary card */}
        <div className={cardClass}>
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
            {topN !== null ? t("drep.topSummary", { count: topN }) : t("drep.summary")}
          </p>
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[45%]" />
              <col className="w-[30%]" />
              <col className="w-[25%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={`text-left text-[10px] font-medium pb-1 ${isGame ? "text-white/40" : "text-muted-foreground"}`}>{t("drep.metricLabel")}</th>
                <th className={`text-right text-[10px] font-medium pb-1 ${isGame ? "text-white/40" : "text-muted-foreground"}`}>{t("drep.value")}</th>
                <th className={`text-right text-[10px] font-medium pb-1 ${isGame ? "text-white/40" : "text-muted-foreground"}`}>{t("drep.percent")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`text-xs py-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>{t("drep.votingPower")}</td>
                <td className={`text-xs font-semibold text-right py-0.5 ${isGame ? "text-white" : ""}`}>{formatVotingPower(selectionStats.votingPower)}</td>
                <td className={`text-xs font-semibold text-right py-0.5 ${isGame ? "text-white/60" : "text-muted-foreground"}`}>{selectionStats.votingPowerPct.toFixed(1)}%</td>
              </tr>
              <tr>
                <td className={`text-xs py-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>{t("drep.delegators")}</td>
                <td className={`text-xs font-semibold text-right py-0.5 ${isGame ? "text-white" : ""}`}>{selectionStats.delegators.toLocaleString()}</td>
                <td className={`text-xs font-semibold text-right py-0.5 ${isGame ? "text-white/60" : "text-muted-foreground"}`}>{selectionStats.delegatorsPct.toFixed(1)}%</td>
              </tr>
              <tr>
                <td className={`text-xs py-0.5 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>{t("drep.votesCast")}</td>
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
      </div>}

      {/* Donut Chart Cards */}
      {view !== "chart" && (
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${view === "all" ? "mt-4" : ""}`}>
          {[
            { title: t("drep.columnPower"), key: "power" },
            { title: t("drep.columnDelegators"), key: "delegators" },
            { title: t("drep.columnVotes"), key: "votes" },
          ].map(({ title, key }) => (
            <div key={key} className={`${cardClass} flex flex-col items-center justify-center min-h-[220px]`}>
              <h4 className={`text-xs font-semibold uppercase tracking-wide mb-4 ${
                isGame ? "text-white/60" : "text-muted-foreground"
              }`}>
                {title}
              </h4>
              <div className={`w-[140px] h-[140px] rounded-full border-2 border-dashed flex items-center justify-center ${
                isLight
                  ? "border-black/10 text-black/30"
                  : isGame
                  ? "border-white/15 text-white/30"
                  : "border-[#0bd1a2]/30 text-[#0bd1a2]/40"
              }`}>
                <span className="text-xs">{t("drep.chartPlaceholder")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DRep List Card */}
      {view !== "chart" && <div className={`${cardClass} mt-4`}>
        <div className="flex flex-col h-[820px]">
          {/* Search Input */}
          <div className="pb-3">
            <input
              type="text"
              placeholder={t("drep.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full px-3 py-2 text-sm transition-colors ${
                isLight
                  ? "rounded-lg border bg-white border-black/10 text-black placeholder:text-black/40 focus:border-black/30 focus:ring-1 focus:ring-black/10"
                  : isGame
                  ? "game-nav-input"
                  : "rounded-none border bg-transparent border-[#0bd1a2] text-foreground placeholder:text-muted-foreground focus:border-[#0bd1a2] focus:ring-1 focus:ring-[#0bd1a2]/30"
              }`}
            />
            {searchTerm && (
              <div className={`mt-1.5 text-xs ${isGame ? "text-white/60" : "text-muted-foreground"}`}>
                {filteredDreps.length === 1
                  ? t("drep.found", { count: filteredDreps.length })
                  : t("drep.foundPlural", { count: filteredDreps.length })}
              </div>
            )}
          </div>
          {/* Scrollable table area */}
          <div
            ref={scrollContainerRef}
            className={`flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full ${
              isGame ? "[&::-webkit-scrollbar-thumb]:bg-white/35" : "[&::-webkit-scrollbar-thumb]:bg-black/20"
            }`}
          >
            <div className="px-4">
              {/* Table Header */}
              <div className={`flex items-center gap-3 py-2 px-2 text-[10px] font-semibold uppercase tracking-wide border-b sticky top-0 z-20 ${
                isLight
                  ? "border-black/10 text-black/60 bg-[#faf9f6]"
                  : isGame
                  ? "border-white/10 text-white/60 bg-[#0c0c0c]"
                  : "border-[#0bd1a2]/30 text-[#0bd1a2]/70 bg-background"
              }`}>
                <span className="w-7 text-center">{t("drep.columnRank")}</span>
                <span className="flex-1 min-w-0 sm:w-[140px] sm:flex-none">{t("drep.columnName")}</span>
                <span className="w-[100px] text-right">{t("drep.columnPower")}</span>
                <span className="hidden sm:inline w-[65px] text-right">{t("drep.columnPercent")}</span>
                <span className="hidden sm:inline w-[70px] text-right">{t("drep.columnDelegators")}</span>
                <span className="hidden sm:inline w-[50px] text-right">{t("drep.columnVotes")}</span>
                <span className="hidden sm:inline w-[60px] text-right">{t("drep.columnVoteChanges")}</span>
              </div>
              {/* Table Rows */}
              <div ref={rowsContainerRef} className="flex flex-col gap-1.5 mt-2">
                {filteredDreps.map((drep, index) => {
                  const percentOfTotal = totalVotingPower > 0
                    ? ((drep.votingPowerAda / totalVotingPower) * 100).toFixed(2)
                    : "0.00";
                  return (
                    <Link
                      key={drep.drepId}
                      href={`/drep/${encodeURIComponent(drep.drepId)}`}
                      className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-[11px] transition-all duration-200 ease-out no-underline ${
                        isLight
                          ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:scale-[1.02] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)]"
                          : isGame
                          ? "bg-white/5 hover:scale-[1.02] hover:bg-white/10 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                          : "rounded-none border border-[#0bd1a2]/30 bg-transparent hover:scale-[1.02] hover:border-[#0bd1a2] hover:shadow-[0_4px_16px_rgba(11,209,162,0.15)]"
                      }`}
                    >
                      {/* Rank with color indicator */}
                      <span
                        className={`w-7 h-7 flex items-center justify-center text-[10px] flex-shrink-0 ${
                          isLight
                            ? "rounded-full bg-black/10 text-black/60 font-medium"
                            : isGame
                            ? "rounded-full text-white font-bold"
                            : "rounded-none border border-[#0bd1a2] text-[#0bd1a2] bg-transparent font-medium"
                        }`}
                        style={isGame ? {
                          background: "linear-gradient(to bottom, #171717, #242424)",
                          border: "1px solid #292929",
                          boxShadow: "0 2px 4px rgba(0,0,0,1), 0 10px 20px rgba(0,0,0,0.4)",
                        } : undefined}
                      >
                        {index + 1}
                      </span>
                      {/* DRep Name */}
                      <span
                        className={`flex-1 min-w-0 sm:w-[140px] sm:flex-none truncate font-medium ${
                          isGame ? "text-white" : ""
                        }`}
                      >
                        {drep.name || t("drep.anonymous")}
                      </span>
                      {/* Voting Power */}
                      <span className={`w-[100px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {formatVotingPower(drep.votingPowerAda)}
                      </span>
                      {/* % of Total */}
                      <span className={`hidden sm:inline w-[65px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {percentOfTotal}%
                      </span>
                      {/* Delegators */}
                      <span className={`hidden sm:inline w-[70px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {drep.delegatorCount != null ? drep.delegatorCount.toLocaleString() : "--"}
                      </span>
                      {/* Votes Cast */}
                      <span className={`hidden sm:inline w-[50px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {drep.totalVotesCast}
                      </span>
                      {/* Vote Changes */}
                      <span className={`hidden sm:inline w-[60px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {voteChangesMap.has(drep.drepId) ? voteChangesMap.get(drep.drepId) : "--"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}
