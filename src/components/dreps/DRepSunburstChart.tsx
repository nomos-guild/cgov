import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Search, Download } from "lucide-react";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GameDropdown } from "@/components/ui/game-dropdown";
import { useAllDReps, useDRepStats, useDRepRationaleStats } from "@/hooks/useDRepData";
import { DRepBubbleMap } from "@/components/dreps/DRepBubbleMap";
import { DRepTreeMap } from "@/components/dreps/DRepTreeMap";
import { DRepDonutChart } from "@/components/dreps/DRepDonutChart";
import { DRepScatterPlot } from "@/components/dreps/DRepScatterPlot";
import { DRepActivityDonut } from "@/components/dreps/DRepActivityDonut";
import { DRepDelegatorsDonut } from "@/components/dreps/DRepDelegatorsDonut";
import { DRepDelegatedAdaDonut } from "@/components/dreps/DRepDelegatedAdaDonut";
import { DRepConcentrationChart } from "@/components/dreps/DRepConcentrationChart";
import { handleDRepExport } from "@/lib/exportDReps";
import type { DRepExportLabels } from "@/lib/exportDReps";
import { cn } from "@/lib/utils";

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
  initialRationaleStats?: Array<{ drepId: string; totalVotesCast: number; rationalesProvided: number; proposalParticipationPercent: number; uniqueProposals: number; voteChanges: number }>;
  /** Which sections to show: "all" (default), "chart" (chart + controls only), "list" (table only) */
  view?: "all" | "chart" | "list";
}

export function DRepSunburstChart({ className, initialDreps, initialRationaleStats, view = "all" }: DRepSunburstChartProps) {
  const t = useTranslations();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";
  const [searchTerm, setSearchTerm] = useState("");
  const [chartType, setChartType] = useState<"bubble" | "treemap" | "donut" | "scatter">("bubble");
  const [chartMetric, setChartMetric] = useState<"votingPower" | "delegators">("votingPower");
  const [chartVisible, setChartVisible] = useState(true);
  const [topN, setTopN] = useState<number | null>(null); // null = all
  const [powerSort, setPowerSort] = useState<string>("none");
  const [delegatorSort, setDelegatorSort] = useState<string>("none");
  const [votesSort, setVotesSort] = useState<string>("none");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);

  const locale = useLocale();
  const tCommon = useTranslations("common");
  const tSort = useTranslations("sort");
  const tDownload = useTranslations("download");
  const tDRepExport = useTranslations("drepExport");

  const selectItemClass =
    "rounded-none data-[highlighted]:bg-black/10 data-[highlighted]:text-foreground data-[state=checked]:bg-black data-[state=checked]:text-white dark:data-[highlighted]:bg-[#0bd1a2]/15 dark:data-[highlighted]:text-[#0bd1a2] dark:data-[state=checked]:bg-[#0bd1a2] dark:data-[state=checked]:text-black";

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
  const { dreps: rationaleStats } = useDRepRationaleStats(initialRationaleStats);
  const rationaleMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of rationaleStats) {
      map.set(d.drepId, d.rationalesProvided);
    }
    return map;
  }, [rationaleStats]);

  // Vote change stats (derived from rationale stats)
  const voteChangesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of rationaleStats) {
      map.set(d.drepId, d.voteChanges);
    }
    return map;
  }, [rationaleStats]);

  // Unique proposals voted on (deduped vote count per DRep)
  const uniqueProposalsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of rationaleStats) {
      map.set(d.drepId, d.uniqueProposals);
    }
    return map;
  }, [rationaleStats]);

  // Engagement % per DRep (from server-side calculation matching profile page)
  const engagementMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of rationaleStats) {
      map.set(d.drepId, d.proposalParticipationPercent);
    }
    return map;
  }, [rationaleStats]);


  // All valid DReps sorted (no search filter) — used by charts
  const chartDreps = useMemo(() => {
    const nonZero = dreps.filter((drep) => drep.votingPowerAda > 0 && drep.totalVotesCast > 0);

    if (powerSort === "high") return [...nonZero].sort((a, b) => b.votingPowerAda - a.votingPowerAda);
    if (powerSort === "low") return [...nonZero].sort((a, b) => a.votingPowerAda - b.votingPowerAda);
    if (delegatorSort === "most") return [...nonZero].sort((a, b) => (b.delegatorCount ?? 0) - (a.delegatorCount ?? 0));
    if (delegatorSort === "fewest") return [...nonZero].sort((a, b) => (a.delegatorCount ?? 0) - (b.delegatorCount ?? 0));
    if (votesSort === "most") return [...nonZero].sort((a, b) => b.totalVotesCast - a.totalVotesCast);
    if (votesSort === "fewest") return [...nonZero].sort((a, b) => a.totalVotesCast - b.totalVotesCast);
    if (chartMetric === "delegators") return [...nonZero].sort((a, b) => (b.delegatorCount ?? 0) - (a.delegatorCount ?? 0));
    return nonZero;
  }, [dreps, chartMetric, powerSort, delegatorSort, votesSort]);

  // DRep IDs matching the search (empty set when no search)
  const highlightedIds = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return new Set<string>();
    return new Set(
      chartDreps
        .filter((drep) => drep.name?.toLowerCase().includes(term) || drep.drepId.toLowerCase().includes(term))
        .map((drep) => drep.drepId)
    );
  }, [chartDreps, searchTerm]);

  // Search-filtered DReps — used by table/list view + stats
  const filteredDreps = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return chartDreps;
    return chartDreps.filter((drep) =>
      drep.name?.toLowerCase().includes(term) || drep.drepId.toLowerCase().includes(term)
    );
  }, [chartDreps, searchTerm]);

  // Aggregated stats for the selection (top-N or all)
  const selectionStats = useMemo(() => {
    const selected = topN === null ? filteredDreps : filteredDreps.slice(0, topN);
    const votingPower = selected.reduce((sum, d) => sum + d.votingPowerAda, 0);
    const delegators = selected.reduce((sum, d) => sum + (d.delegatorCount ?? 0), 0);
    const votes = selected.reduce((sum, d) => sum + (uniqueProposalsMap.get(d.drepId) ?? d.totalVotesCast), 0);

    const totalDelegators = filteredDreps.reduce((sum, d) => sum + (d.delegatorCount ?? 0), 0);
    const totalVotes = filteredDreps.reduce((sum, d) => sum + (uniqueProposalsMap.get(d.drepId) ?? d.totalVotesCast), 0);

    return {
      votingPower,
      votingPowerPct: totalVotingPower > 0 ? (votingPower / totalVotingPower) * 100 : 0,
      delegators,
      delegatorsPct: totalDelegators > 0 ? (delegators / totalDelegators) * 100 : 0,
      votes,
      votesPct: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
    };
  }, [filteredDreps, topN, totalVotingPower, uniqueProposalsMap]);

  // Export labels for DRep list download
  const exportLabels = useMemo<DRepExportLabels>(() => ({
    headerRank: tDRepExport("headerRank"),
    headerName: tDRepExport("headerName"),
    headerDRepId: tDRepExport("headerDRepId"),
    headerVotingPower: tDRepExport("headerVotingPower"),
    headerPercentOfTotal: tDRepExport("headerPercentOfTotal"),
    headerDelegators: tDRepExport("headerDelegators"),
    headerVotesCast: tDRepExport("headerVotesCast"),
    headerVoteChanges: tDRepExport("headerVoteChanges"),
    anonymous: t("drep.anonymous"),
    title: tDRepExport("title"),
    exported: tDRepExport("exported"),
    totalDReps: tDRepExport("totalDReps"),
  }), [tDRepExport, t]);

  const onExportFormat = useCallback((format: string) => {
    handleDRepExport(
      format as "json" | "markdown" | "csv",
      filteredDreps,
      totalVotingPower,
      voteChangesMap,
      exportLabels,
      locale,
      uniqueProposalsMap,
    );
  }, [filteredDreps, totalVotingPower, voteChangesMap, exportLabels, locale, uniqueProposalsMap]);

  // Stable scroll handler (no-op now, kept for list ref)
  const handleScroll = useCallback(() => {}, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Close download menu on outside click
  useEffect(() => {
    if (!downloadMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [downloadMenuOpen]);

  if (isLoading) {
    return (
      <div className={className}>
        <div className="h-[500px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error && !dreps.length) {
    return (
      <div className={className}>
        <div className="h-[500px] flex items-center justify-center text-muted-foreground">
          {t("drep.failedToLoad")}
        </div>
      </div>
    );
  }

  if (!dreps.length && !error) {
    return (
      <div className={className}>
        <div className="h-[500px] flex items-center justify-center text-muted-foreground">
          {t("drep.noDataAvailable")}
        </div>
      </div>
    );
  }

  const cardClass = isLight
    ? "rounded-2xl border border-border/40 bg-card p-4 sm:p-6 shadow-elevation-2"
    : isGame
    ? "game-drep-content rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] p-4 sm:p-6 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : "rounded-none border border-[#0bd1a2] bg-transparent p-4 sm:p-6 shadow-none";

  const tabBtnClass = isGame
    ? "game-tab-btn data-[state=active]:game-tab-btn-active text-2xs sm:text-xs"
    : "rounded-none border border-border/40 bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-2xs sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-normal ease-in-out shadow-elevation-2 data-[state=active]:bg-black data-[state=active]:text-white hover:scale-101 hover:shadow-elevation-3 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon";

  return (
    <div className={className}>
      {/* Chart section */}
      {view !== "list" && <div className="flex flex-col sm:flex-row gap-4">
        {/* Left column: controls + summary */}
        <div className="flex flex-col gap-4 sm:w-[230px] sm:flex-shrink-0">
        {/* Search card */}
        <div className={`${cardClass} flex flex-col gap-2`}>
          <p className={`text-2xs font-semibold uppercase tracking-wide ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
            {tCommon("search")}
          </p>
          <div className="relative">
            <Search className={cn("absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transform", isGame ? "text-white/50" : "text-muted-foreground")} />
            <Input
              placeholder={t("drep.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn("pl-8 h-8 text-xs", isGame ? "game-nav-input" : "filter-input")}
            />
          </div>
          {searchTerm && (
            <p className={`text-xs ${isGame ? "text-white/60" : "text-muted-foreground"}`}>
              {filteredDreps.length === 1
                ? t("drep.found", { count: filteredDreps.length })
                : t("drep.foundPlural", { count: filteredDreps.length })}
            </p>
          )}
        </div>

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
            <p className={`text-2xs font-semibold uppercase tracking-wide mb-1.5 ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
              {t("drep.chartType")}
            </p>
            <div className="flex sm:flex-col flex-wrap gap-1.5">
              {([
                { key: "bubble", label: t("drep.bubbleMap") },
                { key: "treemap", label: t("drep.treeMap") },
                { key: "donut", label: t("drep.donut") },
                { key: "scatter", label: t("drep.scatter") },
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
            <p className={`text-2xs font-semibold uppercase tracking-wide mb-1.5 ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
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
            <p className={`text-2xs font-semibold uppercase tracking-wide mb-1.5 ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
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
          <p className={`text-2xs font-semibold uppercase tracking-wide mb-2 ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
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
                <th className={`text-left text-2xs font-medium pb-1 ${isGame ? "text-white/40" : "text-muted-foreground"}`}>{t("drep.metricLabel")}</th>
                <th className={`text-right text-2xs font-medium pb-1 ${isGame ? "text-white/40" : "text-muted-foreground"}`}>{t("drep.value")}</th>
                <th className={`text-right text-2xs font-medium pb-1 ${isGame ? "text-white/40" : "text-muted-foreground"}`}>{t("drep.percent")}</th>
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
            className="transition-opacity duration-normal ease-in-out"
            style={{ opacity: chartVisible ? 1 : 0 }}
          >
            {chartType === "bubble" && (
              <DRepBubbleMap
                key={chartMetric}
                dreps={chartDreps}
                metric={chartMetric}
                topN={topN}
                rationaleMap={rationaleMap}
                highlightedIds={highlightedIds}
              />
            )}
            {chartType === "treemap" && (
              <DRepTreeMap
                key={chartMetric}
                dreps={chartDreps}
                metric={chartMetric}
                topN={topN}
                rationaleMap={rationaleMap}
                highlightedIds={highlightedIds}
              />
            )}
            {chartType === "donut" && (
              <DRepDonutChart
                key={chartMetric}
                dreps={chartDreps}
                metric={chartMetric}
                topN={topN}
                rationaleMap={rationaleMap}
                highlightedIds={highlightedIds}
              />
            )}
            {chartType === "scatter" && (
              <DRepScatterPlot
                key={chartMetric}
                dreps={chartDreps}
                metric={chartMetric}
                topN={topN}
                rationaleMap={rationaleMap}
                highlightedIds={highlightedIds}
              />
            )}
          </div>
        </div>
      </div>}

      {/* Concentration History Chart */}
      {view !== "list" && (
        <div className={`${cardClass} mt-4`}>
          <DRepConcentrationChart metric={chartMetric} isGame={isGame} isLight={isLight} />
        </div>
      )}

      {/* Donut Chart Cards */}
      {view !== "chart" && (
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${view === "all" ? "mt-4" : ""}`}>
          {/* DRep Activity Donut */}
          <div className={`${cardClass} flex flex-col items-center justify-center min-h-[220px]`}>
            <DRepActivityDonut dreps={dreps} />
          </div>
          {/* DRep Delegators Donut */}
          <div className={`${cardClass} flex flex-col min-h-[220px]`}>
            <DRepDelegatorsDonut dreps={dreps} />
          </div>
          {/* DRep Delegated ADA Donut */}
          <div className={`${cardClass} flex flex-col min-h-[220px]`}>
            <DRepDelegatedAdaDonut dreps={dreps} />
          </div>
        </div>
      )}

      {/* DRep List Card */}
      {view !== "chart" && <div className="mt-4 space-y-3 sm:space-y-4">
        {/* Filter Section */}
        <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4">
          {/* Search Card */}
          <div className={cn(
            "w-full sm:w-auto sm:min-w-[300px] sm:flex-1 p-2.5 sm:p-3 md:p-4",
            isGame
              ? "game-detail-card"
              : "rounded-2xl border border-border/40 bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
          )}>
            <div className="relative">
              <Search className={cn("absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 transform", isGame ? "text-white/50" : "text-muted-foreground")} />
              <Input
                placeholder={tCommon("search")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn("pl-8 sm:pl-10 h-8 sm:h-9 md:h-10 text-xs sm:text-sm", isGame ? "game-nav-input" : "filter-input")}
              />
            </div>
            {searchTerm && (
              <div className={cn("mt-1.5 text-xs", isGame ? "text-white/60" : "text-muted-foreground")}>
                {filteredDreps.length === 1
                  ? t("drep.found", { count: filteredDreps.length })
                  : t("drep.foundPlural", { count: filteredDreps.length })}
              </div>
            )}
          </div>

          {/* Sort Dropdowns Card */}
          <div className={cn(
            "flex-1 min-w-0 p-2.5 sm:p-3 md:p-4",
            isGame
              ? "game-detail-card"
              : "rounded-2xl border border-border/40 bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
          )}>
            <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4">
              {/* Sort by Voting Power */}
              <div className="flex-1 min-w-[100px]">
                {isGame ? (
                  <GameDropdown
                    value={powerSort}
                    onValueChange={(v) => { setPowerSort(v); if (v !== "none") { setDelegatorSort("none"); setVotesSort("none"); } }}
                    placeholder={tSort("sortByVotingPower")}                    options={[
                      { value: "none", label: tSort("votingPower") },
                      { value: "high", label: tSort("highestPower") },
                      { value: "low", label: tSort("lowestPower") },
                    ]}
                  />
                ) : (
                  <Select value={powerSort} onValueChange={(v) => { setPowerSort(v); if (v !== "none") { setDelegatorSort("none"); setVotesSort("none"); } }}>
                    <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2] [&>span]:truncate">
                      <SelectValue placeholder={tSort("sortByVotingPower")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                      <SelectItem className={selectItemClass} value="none">{tSort("votingPower")}</SelectItem>
                      <SelectItem className={selectItemClass} value="high">{tSort("highestPower")}</SelectItem>
                      <SelectItem className={selectItemClass} value="low">{tSort("lowestPower")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Sort by Delegators */}
              <div className="flex-1 min-w-[100px]">
                {isGame ? (
                  <GameDropdown
                    value={delegatorSort}
                    onValueChange={(v) => { setDelegatorSort(v); if (v !== "none") { setPowerSort("none"); setVotesSort("none"); } }}
                    placeholder={tSort("sortByDelegators")}                    options={[
                      { value: "none", label: tSort("sortByDelegators") },
                      { value: "most", label: tSort("mostDelegators") },
                      { value: "fewest", label: tSort("fewestDelegators") },
                    ]}
                  />
                ) : (
                  <Select value={delegatorSort} onValueChange={(v) => { setDelegatorSort(v); if (v !== "none") { setPowerSort("none"); setVotesSort("none"); } }}>
                    <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2] [&>span]:truncate">
                      <SelectValue placeholder={tSort("sortByDelegators")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                      <SelectItem className={selectItemClass} value="none">{tSort("sortByDelegators")}</SelectItem>
                      <SelectItem className={selectItemClass} value="most">{tSort("mostDelegators")}</SelectItem>
                      <SelectItem className={selectItemClass} value="fewest">{tSort("fewestDelegators")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Sort by Votes Cast */}
              <div className="flex-1 min-w-[100px]">
                {isGame ? (
                  <GameDropdown
                    value={votesSort}
                    onValueChange={(v) => { setVotesSort(v); if (v !== "none") { setPowerSort("none"); setDelegatorSort("none"); } }}
                    placeholder={tSort("sortByVotesCast")}                    options={[
                      { value: "none", label: tSort("sortByVotesCast") },
                      { value: "most", label: tSort("mostVotes") },
                      { value: "fewest", label: tSort("fewestVotes") },
                    ]}
                  />
                ) : (
                  <Select value={votesSort} onValueChange={(v) => { setVotesSort(v); if (v !== "none") { setPowerSort("none"); setDelegatorSort("none"); } }}>
                    <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2] [&>span]:truncate">
                      <SelectValue placeholder={tSort("sortByVotesCast")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                      <SelectItem className={selectItemClass} value="none">{tSort("sortByVotesCast")}</SelectItem>
                      <SelectItem className={selectItemClass} value="most">{tSort("mostVotes")}</SelectItem>
                      <SelectItem className={selectItemClass} value="fewest">{tSort("fewestVotes")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Download DRep List */}
              <div ref={downloadMenuRef} className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setDownloadMenuOpen((v) => !v)}
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-full border transition-colors",
                    isGame
                      ? "border-white/20 bg-black/50 text-white/80 hover:bg-white/10"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-[#0bd1a2]/40 dark:bg-transparent dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2]/10"
                  )}
                  title={tDownload("downloadDRepList")}
                >
                  <Download className="w-4 h-4" />
                </button>

                {downloadMenuOpen && (
                  <div className={cn(
                    "absolute top-full right-0 mt-2 z-50 min-w-[160px] py-1 shadow-lg",
                    isGame
                      ? "bg-black/90 border border-white/20 text-white"
                      : "bg-white border border-gray-200 dark:bg-black dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                  )}>
                    {(["csv", "json", "markdown"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        className={cn(
                          "w-full px-3 py-1.5 text-sm text-left transition-colors",
                          isGame
                            ? "hover:bg-white/10"
                            : "hover:bg-gray-100 dark:hover:bg-[#0bd1a2]/10"
                        )}
                        onClick={() => {
                          setDownloadMenuOpen(false);
                          onExportFormat(fmt);
                        }}
                      >
                        {tDownload(fmt)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className={cardClass}>
        <div className="flex flex-col h-[820px]">
          {/* Scrollable table area */}
          <div
            ref={scrollContainerRef}
            className={`flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full ${
              isGame ? "[&::-webkit-scrollbar-thumb]:bg-white/35" : "[&::-webkit-scrollbar-thumb]:bg-black/20"
            }`}
          >
            <div className="px-4">
              {/* Table Header */}
              <div className={`flex items-center gap-6 py-2 px-2 text-2xs font-semibold uppercase tracking-wide border-b sticky top-0 z-20 ${
                isLight
                  ? "border-black/10 text-black/60 bg-card"
                  : isGame
                  ? "border-white/10 text-white/60 bg-[#0c0c0c]"
                  : "border-[#0bd1a2]/30 text-[#0bd1a2]/70 bg-background"
              }`}>
                <span className="w-7 text-center">{t("drep.columnRank")}</span>
                <span className="flex-1 min-w-0 sm:w-[140px] sm:flex-none">{t("drep.columnName")}</span>
                <span className="w-[100px] text-center">{t("drep.columnPower")}</span>
                <span className="hidden sm:inline w-[65px] text-center">{t("drep.columnPercent")}</span>
                <span className="hidden sm:inline w-[70px] text-center">{t("drep.columnDelegators")}</span>
                <span className="hidden sm:inline w-[50px] text-center">{t("drep.columnVotes")}</span>
                <span className="hidden sm:inline w-[60px] text-center">{t("drep.columnVoteChanges")}</span>
                <span className="hidden sm:inline w-[75px] text-center">{t("drep.columnEngagement")}</span>
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
                      className={`flex items-center gap-6 py-1.5 px-2 rounded-lg text-xs transition-all duration-200 ease-out no-underline ${
                        isLight
                          ? "bg-white shadow-elevation-1 hover:scale-101 hover:shadow-elevation-2"
                          : isGame
                          ? "bg-white/5 hover:scale-101 hover:bg-white/10 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                          : "rounded-none border border-[#0bd1a2]/30 bg-transparent hover:scale-101 hover:border-[#0bd1a2] hover:shadow-[0_4px_16px_rgba(11,209,162,0.15)]"
                      }`}
                    >
                      {/* Rank with color indicator */}
                      <span
                        className={`w-7 h-7 flex items-center justify-center text-2xs flex-shrink-0 ${
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
                      <span className={`w-[100px] text-center tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {formatVotingPower(drep.votingPowerAda)}
                      </span>
                      {/* % of Total */}
                      <span className={`hidden sm:inline w-[65px] text-center tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {percentOfTotal}%
                      </span>
                      {/* Delegators */}
                      <span className={`hidden sm:inline w-[70px] text-center tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {drep.delegatorCount != null ? drep.delegatorCount.toLocaleString() : "--"}
                      </span>
                      {/* Votes Cast (unique proposals) */}
                      <span className={`hidden sm:inline w-[50px] text-center tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {uniqueProposalsMap.get(drep.drepId) ?? drep.totalVotesCast}
                      </span>
                      {/* Vote Changes */}
                      <span className={`hidden sm:inline w-[60px] text-center tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {voteChangesMap.has(drep.drepId) ? voteChangesMap.get(drep.drepId) : "--"}
                      </span>
                      {/* Engagement % */}
                      <span className={`hidden sm:inline w-[75px] text-center tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                        {engagementMap.has(drep.drepId) ? `${engagementMap.get(drep.drepId)!.toFixed(1)}%` : "--"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>}
    </div>
  );
}
