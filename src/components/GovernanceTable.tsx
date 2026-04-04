import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslations } from "next-intl";
import { TranslatedText } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoteProgress } from "@/components/ui/vote-progress";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  setSelectedTypes,
  setSelectedStatuses,
  STATUS_OPTIONS,
} from "@/store/governanceSlice";
import type {
  GovernanceAction,
  ProposalType,
  ProposalStatus,
} from "@/types/governance";
import { PROPOSAL_TYPES } from "@/types/governance";
import { ChevronDown, Search, LayoutList, LayoutGrid, Download } from "lucide-react";
import {
  downloadBulkMetrics,
  type BulkMetricsExportLabels,
  type ProposalVoteCounts,
} from "@/lib/exportMetrics";
import { deriveCcAbstainCount } from "@/lib/voteMath";
import { useTheme } from "@/lib/theme";
import {
  buildDonutSegments,
  getGovernanceActionTypeCode,
} from "@/lib/voteBreakdownCalculator";
import { canRoleVoteOnAction, getVoteDataPresence } from "@/lib/governanceVotingEligibility";
import {
  TYPE_LABELS, STATUS_LABELS, SHOWCASE_ORDER,
  mapTypeLabelToProposalType, getStatusColor, getStatusIndicatorColor, getTypeLabel,
} from "@/lib/proposalLabels";
import { formatCompactNumber } from "@/lib/drepFormatters";
import { ProposalThresholdBars } from "@/components/governance/ProposalThresholdBars";

function WithdrawalAmountTag({ amount, isGame }: { amount: string | null | undefined; isGame: boolean }) {
  if (!amount) return null;
  const ada = Number(BigInt(amount) / BigInt(1_000_000));
  return (
    <span
      className={cn(
        "inline-flex items-center shrink-0 px-1.5 py-0.5 text-2xs font-semibold leading-none border",
        isGame
          ? "rounded-none bg-[rgba(20,20,20,0.7)] text-white/70 border-white/15"
          : "rounded border-gray-300 bg-gray-100 text-gray-700 dark:border-[#0bd1a2]/30 dark:bg-[#0bd1a2]/10 dark:text-[#0bd1a2]"
      )}
    >
      ₳{formatCompactNumber(ada)}
    </span>
  );
}


export function GovernanceTable() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const t = useTranslations();
  const actions = useAppSelector((state) => state.governance.actions);
  const selectedTypes =
    useAppSelector((state) => state.governance.filters?.selectedTypes) ??
    PROPOSAL_TYPES;
  const selectedStatuses =
    useAppSelector((state) => state.governance.filters?.selectedStatuses) ??
    STATUS_OPTIONS;
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [showAllProposals, setShowAllProposals] = useState(false);
  const [viewMode, setViewMode] = useState<"default" | "compact">("default");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const isAllSelected = selectedTypes.length === PROPOSAL_TYPES.length;
  
  const INITIAL_PROPOSALS_LIMIT = 20;
  const isAllStatusesSelected =
    selectedStatuses.length === STATUS_OPTIONS.length;

  const tDownload = useTranslations("download");
  const tMetrics = useTranslations("metricsExport");

  const metricsLabels: BulkMetricsExportLabels = useMemo(
    () => ({
      title: tMetrics("title"),
      type: tMetrics("type"),
      status: tMetrics("status"),
      ccVotes: tMetrics("ccVotes"),
      drepVotes: tMetrics("drepVotes"),
      spoVotes: tMetrics("spoVotes"),
      totalVotes: tMetrics("totalVotes"),
      yesAda: tMetrics("yesAda"),
      noAda: tMetrics("noAda"),
      abstainAda: tMetrics("abstainAda"),
      totalAdaVoted: tMetrics("totalAdaVoted"),
      alwaysNoConfidence: tMetrics("alwaysNoConfidence"),
      notVotedAda: tMetrics("notVotedAda"),
    }),
    [tMetrics],
  );

  useEffect(() => {
    if (!isFilterMenuOpen && !isStatusMenuOpen && !downloadMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target as Node)
      ) {
        setIsFilterMenuOpen(false);
      }
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(event.target as Node)
      ) {
        setIsStatusMenuOpen(false);
      }
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(event.target as Node)
      ) {
        setDownloadMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterMenuOpen, isStatusMenuOpen, downloadMenuOpen]);

  const handleToggleFilterMenu = useCallback(() => {
    setIsFilterMenuOpen((prev) => !prev);
    setIsStatusMenuOpen(false);
  }, []);

  const handleToggleStatusMenu = useCallback(() => {
    setIsStatusMenuOpen((prev) => !prev);
    setIsFilterMenuOpen(false);
  }, []);

  const handleTriggerPointerDown = useCallback(
    (event: React.PointerEvent, toggle: () => void) => {
      event.preventDefault(); // avoid focus jumps that feel laggy
      toggle();
    },
    []
  );

  const handleTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent, toggle: () => void) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
      if (event.key === "Escape") {
        setIsFilterMenuOpen(false);
        setIsStatusMenuOpen(false);
      }
    },
    []
  );

  const sortedActions = useMemo(() => {
    return [...actions].sort((a, b) => {
      // Sort by submission epoch (newest first)
      // Higher epoch number = newer proposal
      const epochA = a.submissionEpoch ?? 0;
      const epochB = b.submissionEpoch ?? 0;
      
      // Primary sort: submission epoch descending (newest first)
      if (epochA !== epochB) {
        return epochB - epochA;
      }
      
      // Secondary sort: if same submission epoch, sort by expiry epoch descending
      return (b.expiryEpoch ?? 0) - (a.expiryEpoch ?? 0);
    });
  }, [actions]);

  const filteredActions = useMemo(() => {
    if (!sortedActions.length) return [];
    const selectionSet = new Set(selectedTypes);
    const statusSet = new Set<string>(selectedStatuses);

    const applySearch = (list: GovernanceAction[]) => {
      if (!searchQuery.trim()) return list;
      const q = searchQuery.toLowerCase();
      return list.filter((action) => action.title.toLowerCase().includes(q));
    };

    // Filter by status first.
    // When all statuses are selected (default), don't filter by status so that
    // any new/unknown statuses from the API (e.g. "Enacted", "Closed") are still shown.
    const statusFiltered =
      isAllStatusesSelected || selectedStatuses.length === 0
        ? sortedActions
        : sortedActions.filter((action) => statusSet.has(action.status));

    // Then filter by proposal type.
    // When all types are selected, include unknown / new types as well.
    const typeFiltered = statusFiltered.filter((action) => {
      const actionType = mapTypeLabelToProposalType(action.type as string);
      if (!actionType || !SHOWCASE_ORDER.includes(actionType)) {
        return selectionSet.size === PROPOSAL_TYPES.length;
      }
      return selectionSet.has(actionType);
    });

    // Finally, apply search over the remaining list.
    // This returns *all* matching proposals (no per-type limiting).
    return applySearch(typeFiltered);
  }, [
    sortedActions,
    selectedTypes,
    selectedStatuses,
    searchQuery,
    isAllStatusesSelected,
  ]);

  const displayedActions = useMemo(() => {
    if (showAllProposals) return filteredActions;
    return filteredActions.slice(0, INITIAL_PROPOSALS_LIMIT);
  }, [filteredActions, showAllProposals, INITIAL_PROPOSALS_LIMIT]);

  const hasMoreProposals = filteredActions.length > INITIAL_PROPOSALS_LIMIT;
  const remainingProposals = filteredActions.length - INITIAL_PROPOSALS_LIMIT;

  const handleToggleType = (type: ProposalType) => {
    // If currently all items are selected or no items are selected (showing "All")
    // clicking any specific item should select only that item
    if (isAllSelected || selectedTypes.length === 0) {
      dispatch(setSelectedTypes([type]));
    }
    // If the clicked item is already selected, deselect it
    else if (selectedTypes.includes(type)) {
      dispatch(setSelectedTypes(selectedTypes.filter((item) => item !== type)));
    }
    // Otherwise, add it to the selection
    else {
      dispatch(setSelectedTypes([...selectedTypes, type]));
    }
  };

  const handleSelectAll = () => {
    dispatch(setSelectedTypes(PROPOSAL_TYPES));
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      handleSelectAll();
    } else {
      dispatch(setSelectedTypes([]));
    }
  };

  const handleToggleStatus = (status: ProposalStatus) => {
    // If currently all items are selected or no items are selected (showing "All")
    // clicking any specific item should select only that item
    if (isAllStatusesSelected || selectedStatuses.length === 0) {
      dispatch(setSelectedStatuses([status]));
    }
    // If the clicked item is already selected, deselect it
    else if (selectedStatuses.includes(status)) {
      dispatch(setSelectedStatuses(selectedStatuses.filter((item) => item !== status)));
    }
    // Otherwise, add it to the selection
    else {
      dispatch(setSelectedStatuses([...selectedStatuses, status]));
    }
  };

  const handleSelectAllStatuses = () => {
    dispatch(setSelectedStatuses(STATUS_OPTIONS));
  };

  const handleToggleAllStatuses = (checked: boolean) => {
    if (checked) {
      handleSelectAllStatuses();
    } else {
      dispatch(setSelectedStatuses([]));
    }
  };


  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4">
        {/* Download metrics button — own card */}
        <div ref={downloadMenuRef} className={cn(
          "relative w-full sm:w-auto p-2.5 sm:p-3 md:p-4",
          isGame
            ? "game-filters-card"
            : "rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
        )}>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => setDownloadMenuOpen((prev) => !prev)}
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full border transition-colors",
              isExporting && "opacity-50 cursor-not-allowed",
              isGame
                ? "border-white/20 bg-black/50 text-white/80 hover:bg-white/10"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-[#0bd1a2]/40 dark:bg-transparent dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2]/10"
            )}
            title={tDownload("downloadAllMetrics")}
          >
            {isExporting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>

          {downloadMenuOpen && (
            <div className={cn(
              "absolute top-full left-0 mt-2 z-50 min-w-[180px] py-1 shadow-lg",
              isGame
                ? "bg-black/90 border border-white/20 text-white"
                : "bg-white border border-gray-200 dark:bg-black dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
            )}>
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-[#0bd1a2]/70">
                {tDownload("downloadAllMetrics")}
              </div>
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
                  disabled={isExporting}
                  onClick={async () => {
                    setDownloadMenuOpen(false);
                    setIsExporting(true);
                    try {
                      let voteCountsMap: Record<string, ProposalVoteCounts> | undefined;
                      try {
                        const res = await fetch("/api/analytics/vote-counts");
                        if (res.ok) {
                          voteCountsMap = await res.json();
                        }
                      } catch {
                        // Backend endpoint not available — export without per-type counts
                      }
                      downloadBulkMetrics(filteredActions, fmt, metricsLabels, voteCountsMap);
                    } finally {
                      setIsExporting(false);
                    }
                  }}
                >
                  {tDownload(fmt)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div className="relative overflow-visible flex-1 min-w-0 border-border rounded-2xl border bg-card p-2.5 sm:p-3 md:p-4 shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none game-filters-card">
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground z-10" />
            <Input
              placeholder={t("common.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={
                isGame
                  ? "pl-10 h-9 sm:h-10 filter-input game-nav-input text-sm"
                  : "pl-10 h-8 sm:h-9 filter-input text-sm"
              }
            />
          </div>
          <div className="flex gap-2 sm:gap-3">
            <div className="relative flex-1 sm:flex-none" ref={filterMenuRef}>
              <Button
                variant="outline"
                size="sm"
                className={
                  isGame
                    ? "game-nav-btn h-9 sm:h-10 px-2.5 sm:px-4 w-full sm:w-auto sm:min-w-[150px] text-xs sm:text-sm"
                    : "h-8 sm:h-9 min-h-0 px-2.5 sm:px-3 py-2 text-xs sm:text-sm btn-neon rounded-2xl hover:bg-black hover:text-white transition-none dark:hover:bg-[#0bd1a2] dark:hover:text-black dark:rounded-none w-full sm:w-auto"
                }
                aria-haspopup="true"
                aria-expanded={isFilterMenuOpen}
                onPointerDown={(e) =>
                  handleTriggerPointerDown(e, handleToggleFilterMenu)
                }
                onKeyDown={(e) => handleTriggerKeyDown(e, handleToggleFilterMenu)}
              >
                <span className="hidden sm:inline">Filter action types</span>
                <span className="sm:hidden">Types</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isFilterMenuOpen ? "rotate-180" : ""}`}
                />
              </Button>
            {isFilterMenuOpen ? (
              <div
                className={
                  isGame
                    ? "game-filter-dropdown"
                    : "border-border absolute left-0 sm:left-0 right-0 sm:right-auto z-20 mt-2 w-auto sm:w-64 rounded-2xl border bg-card p-2 shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-black dark:shadow-none"
                }
              >
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-transparent dark:text-[#0bd1a2]">
                  <span>Action Types</span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs font-semibold text-primary hover:underline dark:text-[#0bd1a2]"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-black/10 dark:hover:bg-[#0bd1a2]/10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-foreground dark:accent-[#0bd1a2]"
                      checked={isAllSelected}
                      onChange={(e) => handleToggleAll(e.target.checked)}
                    />
                    <span className="font-semibold text-foreground dark:text-[#0bd1a2]">All</span>
                  </label>
                  {SHOWCASE_ORDER.map((type) => {
                    const checked = selectedTypes.includes(type);
                    return (
                      <label
                        key={type}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-black/10 dark:hover:bg-[#0bd1a2]/10"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-foreground dark:accent-[#0bd1a2]"
                          checked={checked}
                          onChange={() => handleToggleType(type)}
                        />
                        <span className="text-foreground dark:text-[#0bd1a2]">
                          {TYPE_LABELS[type]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
            </div>
            <div className="relative flex-1 sm:flex-none" ref={statusMenuRef}>
              <Button
                variant="outline"
                size="sm"
                className={
                  isGame
                    ? "game-nav-btn h-9 sm:h-10 px-2.5 sm:px-4 w-full sm:w-auto sm:min-w-[150px] text-xs sm:text-sm"
                    : "h-8 sm:h-9 min-h-0 px-2.5 sm:px-3 py-2 text-xs sm:text-sm btn-neon rounded-2xl hover:bg-black hover:text-white transition-none dark:hover:bg-[#0bd1a2] dark:hover:text-black dark:rounded-none w-full sm:w-auto"
                }
                aria-haspopup="true"
                aria-expanded={isStatusMenuOpen}
                onPointerDown={(e) =>
                  handleTriggerPointerDown(e, handleToggleStatusMenu)
                }
                onKeyDown={(e) => handleTriggerKeyDown(e, handleToggleStatusMenu)}
              >
                <span className="hidden sm:inline">Filter by status</span>
                <span className="sm:hidden">Status</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isStatusMenuOpen ? "rotate-180" : ""}`}
                />
              </Button>
              {isStatusMenuOpen ? (
                <div
                  className={
                    isGame
                      ? "game-filter-dropdown"
                      : "border-border absolute left-0 sm:left-0 right-0 sm:right-auto z-20 mt-2 w-auto sm:w-64 rounded-2xl border bg-card p-2 shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-black dark:shadow-none"
                  }
                >
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-transparent dark:text-[#0bd1a2]">
                  <span>Status</span>
                  <button
                    type="button"
                    onClick={handleSelectAllStatuses}
                    className="text-xs font-semibold text-primary hover:underline dark:text-[#0bd1a2]"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-black/10 dark:hover:bg-[#0bd1a2]/10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-foreground dark:accent-[#0bd1a2]"
                      checked={isAllStatusesSelected}
                      onChange={(e) =>
                        handleToggleAllStatuses(e.target.checked)
                      }
                    />
                    <span className="font-semibold text-foreground dark:text-[#0bd1a2]">All</span>
                  </label>
                  {STATUS_OPTIONS.map((status) => {
                    const checked = selectedStatuses.includes(status);
                    return (
                      <label
                        key={status}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-black/10 dark:hover:bg-[#0bd1a2]/10"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-foreground dark:accent-[#0bd1a2]"
                          checked={checked}
                          onChange={() => handleToggleStatus(status)}
                        />
                        <span className="text-foreground dark:text-[#0bd1a2]">
                          {STATUS_LABELS[status]}
                        </span>
                      </label>
                    );
                  })}
                  </div>
                </div>
              ) : null}
            </div>
            {/* View toggle */}
            <Button
              variant="outline"
              size="sm"
              className={
                isGame
                  ? "game-nav-btn h-9 sm:h-10 px-2.5 sm:px-3"
                  : "h-8 sm:h-9 min-h-0 px-2.5 sm:px-3 py-2 btn-neon rounded-2xl hover:bg-black hover:text-white transition-none dark:hover:bg-[#0bd1a2] dark:hover:text-black dark:rounded-none"
              }
              aria-label={viewMode === "default" ? t("accessibility.switchToCompactView") : t("accessibility.switchToDefaultView")}
              onClick={() => setViewMode(viewMode === "default" ? "compact" : "default")}
            >
              {viewMode === "default" ? (
                <LayoutGrid className="h-4 w-4" />
              ) : (
                <LayoutList className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
      </div>

      {filteredActions.length === 0 ? (
        <div className="border-border rounded-2xl border bg-card p-6 sm:p-8 md:p-12 shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
          <p className="text-center text-muted-foreground text-sm sm:text-base">
            {t("table.noActionsFound")}
          </p>
        </div>
      ) : (
        <>
        {/* Mobile card layout */}
        <div className="sm:hidden space-y-3 pb-6 overflow-visible">
          {displayedActions.map((action, cardIndex) => (
            <Link
              key={action.proposalId ?? action.hash}
              href={`/governance/${action.hash}`}
              className="stagger-card block"
              style={{ animationDelay: `${Math.min(cardIndex, 8) * 60}ms` }}
            >
              <div
                className={
                  isGame
                    ? "game-detail-card p-3"
                    : "rounded-xl border border-border bg-card p-3 shadow-elevation-1 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
                }
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-3xs uppercase tracking-wide font-semibold text-muted-foreground dark:text-[#0bd1a2]/70">
                    {getTypeLabel(action.type)}
                  </span>
                  <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wide shrink-0">
                    {(() => {
                      const indicator = getStatusIndicatorColor(action.status, isGame);
                      if (!indicator) return null;
                      if (indicator.animate) {
                        return (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${indicator.color} opacity-75`}></span>
                            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${indicator.color}`}></span>
                          </span>
                        );
                      }
                      return <span className={`inline-flex h-1.5 w-1.5 rounded-full ${indicator.color}`}></span>;
                    })()}
                    <span className={`${getStatusColor(action.status)} dark:text-[#0bd1a2]`}>
                      {action.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-1.5">
                  <WithdrawalAmountTag amount={action.withdrawalAmount} isGame={isGame} />
                  <h3 className={`text-sm font-semibold line-clamp-2 ${isGame ? "text-white" : "dark:text-[#0bd1a2]"}`}>
                    <TranslatedText text={action.title} />
                  </h3>
                </div>
                <div className="mt-2">
                  <ProposalThresholdBars action={action} isGame={isGame} maxWidth="200px" />
                </div>
              </div>
            </Link>
          ))}
          {hasMoreProposals && !showAllProposals && (
            <Button
              variant="outline"
              onClick={() => setShowAllProposals(true)}
              className={
                isGame
                  ? "game-nav-btn w-full"
                  : "w-full bg-white text-black hover:bg-black hover:text-white transition-colors shadow-elevation-1 btn-neon"
              }
            >
              {t("common.showMoreProposals", { count: remainingProposals })}
            </Button>
          )}
        </div>

        {/* Desktop table layout - Default view */}
        {viewMode === "default" && (
        <div className="hidden sm:block rounded-2xl border border-border bg-card overflow-x-auto shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none game-proposals-card">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="proposal-header-row hover:bg-transparent">
                <TableHead className="hidden md:table-cell w-[30px] px-0 text-center h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm">DRep</TableHead>
                <TableHead className="hidden md:table-cell w-[30px] px-0 text-center h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm">SPO</TableHead>
                <TableHead className="hidden md:table-cell w-[30px] px-0 text-center h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm">CC</TableHead>
                <TableHead className="md:border-l md:border-border/50 pl-2 sm:pl-4 h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm">{t("table.proposalTitle")}</TableHead>
                <TableHead className="hidden sm:table-cell w-[140px] md:w-[180px] h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm">{t("table.actionType")}</TableHead>
                <TableHead className="w-[80px] sm:w-[120px] h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm">{t("filters.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedActions.map((action, index) => {
                const isFirstRow = index === 0;
                // Only show donut charts for roles that are eligible to vote on this action type
                // This follows Cardano governance rules (e.g., DRep doesn't vote on Hard Fork Initiation)
                const voteData = getVoteDataPresence(action);
                const showDrep = canRoleVoteOnAction(action.type, "DRep", action.threshold, voteData);
                const showSpo = canRoleVoteOnAction(action.type, "SPO", action.threshold, voteData);
                const showCc = canRoleVoteOnAction(action.type, "CC", action.threshold, voteData);

                // CC vote data (still uses legacy props - no breakdown data from API)
                const ccData = action.cc;
                const ccYesPercent = ccData?.yesPercent ?? 0;
                const ccNoPercent = ccData?.noPercent ?? 0;
                // Only calculate abstain fallback if we have CC data
                const ccAbstainPercent = ccData
                  ? (ccData.abstainPercent ?? Math.max(0, 100 - ccYesPercent - ccNoPercent))
                  : 0;
                const ccYesCount = ccData?.yesCount;
                const ccNoCount = ccData?.noCount;
                const ccAbstainCount = ccData
                  ? (ccData.abstainCount ?? deriveCcAbstainCount(
                      ccYesCount,
                      ccNoCount,
                      ccYesPercent,
                      ccNoPercent,
                      ccAbstainPercent
                    ))
                  : 0;

                // Calculate CC pending votes - if no CC data, show 100% as "Not Voted"
                const ccPendingCount = ccData?.notVotedCount ?? 0;
                const ccPendingPercent = ccData
                  ? (ccData.notVotedPercent ?? 0)
                  : 100; // No CC data means 100% not voted

                const rowId = action.proposalId ?? action.hash;

                return (
                  <TableRow
                    key={rowId}
                    className={`stagger-item proposal-row cursor-pointer transition-all duration-normal ease-out transform-gpu hover:scale-101 hover:bg-transparent border-b-0 ${
                      isFirstRow ? "first-row" : ""
                    }`}
                    onClick={() => router.push(`/governance/${action.hash}`)}
                    style={{ cursor: 'pointer', animationDelay: `${Math.min(index, 10) * 50}ms` }}
                  >
                    <TableCell className="hidden md:table-cell py-1 px-0">
                      <div
                        className="flex justify-center -mr-4"
                        style={{ overflow: "visible" }}
                      >
                        {showDrep ? (
                          (() => {
                            const actionTypeCode = getGovernanceActionTypeCode(action.governanceActionType || action.type);
                            const drepTotalVotePower = action.rawVotingPowerValues?.drep_total_vote_power;
                            const drepSegments = action.drepBreakdown
                              ? buildDonutSegments(action.drepBreakdown, actionTypeCode, true, drepTotalVotePower)
                              : null;
                            return (
                              <VoteProgress
                                title="DRep"
                                titlePosition="center"
                                segments={drepSegments ?? undefined}
                                valueUnit="ada"
                                className="origin-center scale-[0.6]"
                                style={{ padding: "8px 10px 10px" }}
                                showTooltip={false}
                                animate={false}
                                interactive={false}
                              />
                            );
                          })()
                        ) : (
                          <VoteProgress
                            title="DRep"
                            titlePosition="center"
                            centerText={t("voting.notEligible")}
                            yesPercent={0}
                            noPercent={0}
                            abstainPercent={0}
                            pendingPercent={100}
                            pendingValue={1}
                            className="origin-center scale-[0.6]"
                            style={{ padding: "8px 10px 10px" }}
                            showTooltip={false}
                            animate={false}
                            interactive={false}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-1 px-0">
                      <div
                        className="flex justify-center -mx-4"
                        style={{ overflow: "visible" }}
                      >
                        {showSpo ? (
                          (() => {
                            const actionTypeCode = getGovernanceActionTypeCode(action.governanceActionType || action.type);
                            const spoTotalVotePower = action.rawVotingPowerValues?.spo_total_vote_power;
                            const spoSegments = action.spoBreakdown
                              ? buildDonutSegments(action.spoBreakdown, actionTypeCode, false, spoTotalVotePower)
                              : null;
                            return (
                              <VoteProgress
                                title="SPO"
                                titlePosition="center"
                                segments={spoSegments ?? undefined}
                                valueUnit="ada"
                                className="origin-center scale-[0.6]"
                                style={{ padding: "8px 10px 10px" }}
                                showTooltip={false}
                                animate={false}
                                interactive={false}
                              />
                            );
                          })()
                        ) : (
                          <VoteProgress
                            title="SPO"
                            titlePosition="center"
                            centerText={t("voting.notEligible")}
                            yesPercent={0}
                            noPercent={0}
                            abstainPercent={0}
                            pendingPercent={100}
                            pendingValue={1}
                            className="origin-center scale-[0.6]"
                            style={{ padding: "8px 10px 10px" }}
                            showTooltip={false}
                            animate={false}
                            interactive={false}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-1 px-0">
                      <div
                        className="flex justify-center -ml-4"
                        style={{ overflow: "visible" }}
                      >
                        {showCc ? (
                          <VoteProgress
                            title="CC"
                            titlePosition="center"
                            yesPercent={ccYesPercent}
                            noPercent={ccNoPercent || 0}
                            abstainPercent={ccAbstainPercent}
                            pendingPercent={ccPendingPercent}
                            yesValue={ccYesCount}
                            noValue={ccNoCount}
                            abstainValue={ccAbstainCount}
                            pendingValue={ccPendingCount}
                            valueUnit="count"
                            className="origin-center scale-[0.6]"
                            style={{ padding: "8px 10px 10px" }}
                            showTooltip={false}
                            animate={false}
                            interactive={false}
                          />
                        ) : (
                          <VoteProgress
                            title="CC"
                            titlePosition="center"
                            centerText={t("voting.notEligible")}
                            yesPercent={0}
                            noPercent={0}
                            abstainPercent={0}
                            pendingPercent={100}
                            pendingValue={1}
                            className="origin-center scale-[0.6]"
                            style={{ padding: "8px 10px 10px" }}
                            showTooltip={false}
                            animate={false}
                            interactive={false}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-0.5 sm:py-1 md:border-l md:border-border/50 pl-2 sm:pl-4">
                      <div className="flex items-center gap-2">
                        <WithdrawalAmountTag amount={action.withdrawalAmount} isGame={isGame} />
                        <h3 className="text-sm sm:text-base font-semibold line-clamp-1 dark:text-[#0bd1a2]">
                          <TranslatedText text={action.title} />
                        </h3>
                      </div>
                      <div className="mt-1">
                        <ProposalThresholdBars action={action} isGame={isGame} maxWidth="280px" />
                      </div>
                      {(action.totalYes + action.totalNo + action.totalAbstain) > 0 && (
                        <div className="mt-1">
                          <span className={cn("text-2xs", isGame ? "text-white/60" : "text-muted-foreground")}>
                            {(action.totalYes + action.totalNo + action.totalAbstain).toLocaleString()} {t("table.votes").toLowerCase()}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell py-1 sm:py-1.5">
                      <span className="text-2xs sm:text-xs uppercase tracking-wide font-semibold text-foreground dark:text-[#0bd1a2]">
                        {getTypeLabel(action.type)}
                      </span>
                    </TableCell>
                    <TableCell className="py-1 sm:py-1.5">
                      <div className="flex items-center gap-1 sm:gap-2 text-2xs sm:text-xs uppercase tracking-wide dark:text-[#0bd1a2]">
                        {(() => {
                          const indicator = getStatusIndicatorColor(action.status, isGame);
                          if (!indicator) return null;
                          if (indicator.animate) {
                            return (
                              <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${indicator.color} opacity-75`}></span>
                                <span className={`relative inline-flex h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${indicator.color}`}></span>
                              </span>
                            );
                          }
                          return <span className={`inline-flex h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${indicator.color}`}></span>;
                        })()}
                        <span className={getStatusColor(action.status)}>
                          {action.status}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {hasMoreProposals && !showAllProposals && (
            <div className="p-4">
              <Button
                variant="outline"
                onClick={() => setShowAllProposals(true)}
                className={
                  isGame
                    ? "game-nav-btn w-full"
                    : "w-full bg-white text-black hover:bg-black hover:text-white transition-colors shadow-elevation-1 btn-neon"
                }
              >
                {t("common.showMoreProposals", { count: remainingProposals })}
              </Button>
            </div>
          )}
        </div>
        )}

        {/* Desktop table layout - Compact view */}
        {viewMode === "compact" && (
        <div className="hidden sm:block rounded-2xl border border-border bg-card overflow-x-auto shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none game-proposals-card">
          <Table>
            <TableHeader>
              <TableRow className="proposal-header-row hover:bg-transparent">
                <TableHead className="pl-3 sm:pl-4 h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm">{t("table.proposalTitle")}</TableHead>
                <TableHead className="w-[140px] h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm">{t("table.type")}</TableHead>
                <TableHead className="w-[100px] h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm text-center">DRep</TableHead>
                <TableHead className="w-[100px] h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm text-center">SPO</TableHead>
                <TableHead className="w-[100px] h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm text-center">CC</TableHead>
                <TableHead className="w-[70px] h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm text-center">{t("table.votes")}</TableHead>
                <TableHead className="w-[80px] h-8 sm:h-10 py-1 sm:py-2 text-xs sm:text-sm">{t("filters.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedActions.map((action, compactIndex) => {
                const rowId = action.proposalId ?? action.hash;
                const voteData = getVoteDataPresence(action);
                const showDrep = canRoleVoteOnAction(action.type, "DRep", action.threshold, voteData);
                const showSpo = canRoleVoteOnAction(action.type, "SPO", action.threshold, voteData);
                const showCc = canRoleVoteOnAction(action.type, "CC", action.threshold, voteData);
                const actionTypeCode = getGovernanceActionTypeCode(action.governanceActionType || action.type);

                // DRep calculations
                const drepThreshold = action.threshold?.drepThreshold;
                const drepTotalVotePower = action.rawVotingPowerValues?.drep_total_vote_power;
                const drepSegments = action.drepBreakdown
                  ? buildDonutSegments(action.drepBreakdown, actionTypeCode, true, drepTotalVotePower)
                  : null;
                const drepYes = drepSegments?.find(s => s.type === "yes")?.percent ?? action.drepYesPercent ?? 0;

                // SPO calculations
                const spoThreshold = action.threshold?.spoThreshold;
                const spoTotalVotePower = action.rawVotingPowerValues?.spo_total_vote_power;
                const spoSegments = action.spoBreakdown
                  ? buildDonutSegments(action.spoBreakdown, actionTypeCode, false, spoTotalVotePower)
                  : null;
                const spoYes = spoSegments?.find(s => s.type === "yes")?.percent ?? action.spoYesPercent ?? 0;

                // CC calculations
                const ccThreshold = action.threshold?.ccThreshold;
                const ccData = action.cc;
                const ccYesCount = ccData?.yesCount ?? 0;
                const ccNoCount = ccData?.noCount ?? 0;
                const ccNotVotedCount = ccData?.notVotedCount ?? 0;
                const ccTotalMembers = (ccYesCount + ccNoCount + ccNotVotedCount) || 7;
                const ccYes = (ccYesCount / ccTotalMembers) * 100;

                return (
                  <TableRow
                    key={rowId}
                    className="stagger-item proposal-row cursor-pointer transition-colors hover:bg-muted/50 border-b-0"
                    onClick={() => router.push(`/governance/${action.hash}`)}
                    style={{ animationDelay: `${Math.min(compactIndex, 10) * 50}ms` }}
                  >
                    <TableCell className="py-2 pl-3 sm:pl-4 max-w-[300px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <WithdrawalAmountTag amount={action.withdrawalAmount} isGame={isGame} />
                        <h3 className="text-sm font-medium truncate dark:text-[#0bd1a2]">
                          <TranslatedText text={action.title} />
                        </h3>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 whitespace-nowrap">
                      <span className="text-2xs sm:text-xs uppercase tracking-wide font-semibold text-foreground dark:text-[#0bd1a2]">
                        {getTypeLabel(action.type)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-center whitespace-nowrap">
                      {showDrep && drepThreshold != null ? (
                        <span className={cn(
                          "text-xs font-medium",
                          drepYes >= drepThreshold * 100 ? "text-green-600 dark:text-green-400" : "text-foreground dark:text-[#0bd1a2]"
                        )}>
                          {drepYes.toFixed(1)}%
                          <span className="text-muted-foreground text-2xs ml-1">/ {(drepThreshold * 100).toFixed(0)}%</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-center whitespace-nowrap">
                      {showSpo && spoThreshold != null ? (
                        <span className={cn(
                          "text-xs font-medium",
                          spoYes >= spoThreshold * 100 ? "text-green-600 dark:text-green-400" : "text-foreground dark:text-[#0bd1a2]"
                        )}>
                          {spoYes.toFixed(1)}%
                          <span className="text-muted-foreground text-2xs ml-1">/ {(spoThreshold * 100).toFixed(0)}%</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-center whitespace-nowrap">
                      {showCc && ccThreshold != null ? (
                        <span className={cn(
                          "text-xs font-medium",
                          ccYes >= ccThreshold * 100 ? "text-green-600 dark:text-green-400" : "text-foreground dark:text-[#0bd1a2]"
                        )}>
                          {ccYes.toFixed(1)}%
                          <span className="text-muted-foreground text-2xs ml-1">/ {(ccThreshold * 100).toFixed(0)}%</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-center whitespace-nowrap">
                      <span className="text-xs font-medium text-foreground dark:text-[#0bd1a2]">
                        {(action.totalYes + action.totalNo + action.totalAbstain).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-2xs sm:text-xs uppercase tracking-wide dark:text-[#0bd1a2]">
                        {(() => {
                          const indicator = getStatusIndicatorColor(action.status, isGame);
                          if (!indicator) return null;
                          if (indicator.animate) {
                            return (
                              <span className="relative flex h-1.5 w-1.5">
                                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${indicator.color} opacity-75`}></span>
                                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${indicator.color}`}></span>
                              </span>
                            );
                          }
                          return <span className={`inline-flex h-1.5 w-1.5 rounded-full ${indicator.color}`}></span>;
                        })()}
                        <span className={getStatusColor(action.status)}>
                          {action.status}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {hasMoreProposals && !showAllProposals && (
            <div className="p-4">
              <Button
                variant="outline"
                onClick={() => setShowAllProposals(true)}
                className={
                  isGame
                    ? "game-nav-btn w-full"
                    : "w-full bg-white text-black hover:bg-black hover:text-white transition-colors shadow-elevation-1 btn-neon"
                }
              >
                {t("common.showMoreProposals", { count: remainingProposals })}
              </Button>
            </div>
          )}
        </div>
        )}
        </>
      )}
    </div>
  );
}
