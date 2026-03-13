import { useState, useMemo } from "react";
import { X, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { EnrichedDRep } from "@/components/dreps/DRepPickerResults";

interface DRepListBuilderProps {
  dreps: EnrichedDRep[];
  totalVotingPower: number;
}

function formatVotingPower(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

const MAX_SEARCH_RESULTS = 80;

export default function DRepListBuilder({ dreps, totalVotingPower }: DRepListBuilderProps) {
  const t = useTranslations("drep");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedDreps = useMemo(
    () => dreps.filter((d) => selectedIds.has(d.drepId)),
    [dreps, selectedIds]
  );

  const searchResults = useMemo(() => {
    if (!search.trim()) return dreps.slice(0, MAX_SEARCH_RESULTS);
    const q = search.toLowerCase();
    return dreps
      .filter((d) => {
        const name = (d.name ?? "anonymous").toLowerCase();
        return name.includes(q) || d.drepId.toLowerCase().includes(q);
      })
      .slice(0, MAX_SEARCH_RESULTS);
  }, [dreps, search]);

  const metrics = useMemo(() => {
    const totalDelegators = selectedDreps.reduce((sum, d) => sum + (d.delegatorCount ?? 0), 0);
    const totalAda = selectedDreps.reduce((sum, d) => sum + d.votingPowerAda, 0);
    const powerPct = totalVotingPower > 0 ? (totalAda / totalVotingPower) * 100 : 0;
    return { totalDelegators, totalAda, powerPct };
  }, [selectedDreps, totalVotingPower]);

  const toggle = (drepId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(drepId)) next.delete(drepId);
      else next.add(drepId);
      return next;
    });
  };

  const hasSelection = selectedIds.size > 0;

  // Shared card base
  const cardClass = isLight
    ? "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
    : isGame
    ? "game-detail-card rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : "rounded-none border border-[#0bd1a2] bg-transparent shadow-none";

  // Metrics card — more pronounced background / border to stand out
  const metricsCardClass = hasSelection
    ? isLight
      ? "rounded-2xl border border-black/12 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.3),0_4px_12px_rgba(15,23,42,0.12)]"
      : isGame
      ? "rounded-[2px] border border-white/20 bg-[rgba(255,255,255,0.06)] shadow-[0_18px_36px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.08)]"
      : "rounded-none border border-[#0bd1a2] bg-[rgba(11,209,162,0.05)] shadow-[0_0_20px_rgba(11,209,162,0.15),inset_0_0_20px_rgba(11,209,162,0.04)]"
    : cardClass;

  const dividerClass = isLight
    ? "border-black/8"
    : isGame
    ? "border-white/10"
    : "border-[#0bd1a2]/20";

  const inputClass = isLight
    ? "rounded-lg border border-black/10 bg-white text-black placeholder-black/40 text-xs px-3 py-2 w-full outline-none focus:border-black/30"
    : isGame
    ? "rounded-[2px] border border-white/20 bg-white/5 text-white placeholder-white/30 text-xs px-3 py-2 w-full outline-none focus:border-white/40"
    : "rounded-none border border-[#0bd1a2]/40 bg-transparent text-[#0bd1a2] placeholder-[#0bd1a2]/30 text-xs px-3 py-2 w-full outline-none focus:border-[#0bd1a2]";

  const labelClass = cn(
    "text-[10px]",
    isGame ? "text-white/50" : isLight ? "text-black/40" : "text-[#0bd1a2]/50"
  );

  const accentClass = isGame ? "text-white" : isLight ? "text-black" : "text-[#0bd1a2]";

  const metricValueClass = cn(
    "text-sm font-bold tabular-nums leading-none tracking-tight whitespace-nowrap",
    hasSelection
      ? isGame ? "text-white" : isLight ? "text-black" : "text-[#0bd1a2]"
      : isGame ? "text-white/20" : isLight ? "text-black/15" : "text-[#0bd1a2]/20"
  );

  const metricLabelClass = cn(
    "text-[9px] uppercase tracking-widest font-semibold mt-1",
    isGame ? "text-white/40" : isLight ? "text-black/35" : "text-[#0bd1a2]/45"
  );

  const rowHoverClass = isLight
    ? "hover:bg-black/5 rounded-lg"
    : isGame
    ? "hover:bg-white/8 rounded-[2px]"
    : "hover:bg-[#0bd1a2]/5";

  const scrollbarClass = isGame
    ? "[&::-webkit-scrollbar-thumb]:bg-white/25"
    : "[&::-webkit-scrollbar-thumb]:bg-black/15";

  const selectedBtnClass = isGame
    ? "bg-white text-black"
    : isLight
    ? "bg-black text-white"
    : "bg-[#0bd1a2] text-black";

  const unselectedBtnClass = isGame
    ? "border border-white/25 text-white/30"
    : isLight
    ? "border border-black/15 text-black/25"
    : "border border-[#0bd1a2]/30 text-[#0bd1a2]/30";

  const removeCardBtnClass = isGame
    ? "bg-white/10 hover:bg-white/20 text-white"
    : isLight
    ? "bg-black/8 hover:bg-black/16 text-black"
    : "bg-[#0bd1a2]/10 hover:bg-[#0bd1a2]/20 text-[#0bd1a2]";

  const titleCardClass = isLight
    ? "rounded-2xl border border-white/8 bg-[#faf9f6] px-4 sm:px-6 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
    : isGame
    ? "game-drep-content rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] px-4 sm:px-6 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : "rounded-none border border-[#0bd1a2] bg-transparent px-4 sm:px-6 py-3 shadow-none";

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Section title card — full width, matches tab nav style */}
      <div className={titleCardClass}>
        <span className={cn("text-xs font-semibold uppercase tracking-widest", labelClass)}>
          {t("listBuilderTitle")}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Left column: search card + metrics card stacked */}
        <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-4">

          {/* Card 1: Search + DRep list */}
          <div className={cn("flex flex-col overflow-hidden", cardClass)}>
            {/* Search input */}
            <div className={cn("p-4 border-b", dividerClass)}>
              <div className="relative">
                <Search className={cn("absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3", isGame ? "text-white/40" : isLight ? "text-black/30" : "text-[#0bd1a2]/40")} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("listBuilderSearch")}
                  className={cn(inputClass, "pl-7")}
                />
              </div>
            </div>

            {/* Scrollable DRep list */}
            <div className={cn(
              "overflow-y-auto max-h-[260px] py-1",
              "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full",
              scrollbarClass
            )}>
              {searchResults.length === 0 ? (
                <div className={cn("text-center py-8 text-xs", isGame ? "text-white/40" : "text-muted-foreground")}>
                  {t("listBuilderNoDrepsFound")}
                </div>
              ) : (
                searchResults.map((drep) => {
                  const isSelected = selectedIds.has(drep.drepId);
                  return (
                    <button
                      key={drep.drepId}
                      onClick={() => toggle(drep.drepId)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 transition-colors text-left",
                        rowHoverClass
                      )}
                    >
                      <span className={cn(
                        "flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full transition-colors",
                        isSelected ? selectedBtnClass : unselectedBtnClass
                      )}>
                        {isSelected
                          ? <X className="h-2.5 w-2.5" />
                          : <Plus className="h-2.5 w-2.5" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-[11px] font-medium truncate", accentClass)}>
                          {drep.name ?? "Anonymous"}
                        </div>
                        <div className={cn("text-[10px]", isGame ? "text-white/40" : isLight ? "text-black/35" : "text-[#0bd1a2]/45")}>
                          {formatVotingPower(drep.votingPowerAda)} ₳
                          {drep.delegatorCount != null && (
                            <> · {drep.delegatorCount.toLocaleString()} del</>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Card 2: Metrics — separate highlighted card */}
          <div className={cn("p-5 transition-all duration-300", metricsCardClass)}>
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className={cn(
                  "text-[10px] font-semibold uppercase tracking-widest",
                  hasSelection
                    ? isGame ? "text-white/60" : isLight ? "text-black/50" : "text-[#0bd1a2]/60"
                    : isGame ? "text-white/25" : isLight ? "text-black/20" : "text-[#0bd1a2]/25"
                )}>
                  {t("listBuilderMetricsTitle")}
                </div>
                <div className={cn(
                  "text-[11px] font-bold mt-0.5",
                  hasSelection
                    ? isGame ? "text-white" : isLight ? "text-black" : "text-[#0bd1a2]"
                    : isGame ? "text-white/20" : isLight ? "text-black/15" : "text-[#0bd1a2]/20"
                )}>
                  {hasSelection
                    ? t("listBuilderSelectedCount", { count: selectedIds.size })
                    : t("listBuilderNoSelection")}
                </div>
              </div>
              {hasSelection && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className={cn(
                    "text-[10px] px-2 py-1 transition-opacity opacity-60 hover:opacity-100",
                    isGame ? "rounded-[2px] border border-white/20 text-white" : isLight ? "rounded-full border border-black/15 text-black" : "rounded-none border border-[#0bd1a2]/40 text-[#0bd1a2]"
                  )}
                >
                  {t("listBuilderClearAll")}
                </button>
              )}
            </div>

            {/* Three metric blocks */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-start min-w-0">
                <div className={metricValueClass}>
                  {hasSelection ? metrics.totalDelegators.toLocaleString() : "—"}
                </div>
                <div className={metricLabelClass}>{t("listBuilderDelegators")}</div>
              </div>

              <div className="flex flex-col items-start min-w-0">
                <div className={metricValueClass}>
                  {hasSelection ? `${formatVotingPower(metrics.totalAda)} ₳` : "—"}
                </div>
                <div className={metricLabelClass}>{t("listBuilderDelegated")}</div>
              </div>

              <div className="flex flex-col items-start min-w-0">
                <div className={cn(
                  metricValueClass,
                  hasSelection && !isLight && !isGame && "drop-shadow-[0_0_8px_rgba(11,209,162,0.6)]"
                )}>
                  {hasSelection ? `${metrics.powerPct.toFixed(2)}%` : "—"}
                </div>
                <div className={metricLabelClass}>{t("listBuilderPowerPct")}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: selected DRep cards grid */}
        <div className="flex-1 min-w-0">
          {!hasSelection ? (
            <div className={cn(cardClass, "h-full min-h-[220px] flex items-center justify-center p-8")}>
              <div className="text-center">
                <div className={cn("text-xs font-medium mb-1.5", isGame ? "text-white/50" : isLight ? "text-black/40" : "text-[#0bd1a2]/50")}>
                  {t("listBuilderEmptyTitle")}
                </div>
                <div className={cn("text-[10px]", isGame ? "text-white/30" : isLight ? "text-black/25" : "text-[#0bd1a2]/30")}>
                  {t("listBuilderEmptyDesc")}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {selectedDreps.map((drep) => (
                <div key={drep.drepId} className={cn(cardClass, "p-4 relative group")}>
                  <button
                    onClick={() => toggle(drep.drepId)}
                    className={cn(
                      "absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center rounded-full",
                      "opacity-0 group-hover:opacity-100 transition-opacity",
                      removeCardBtnClass
                    )}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>

                  <div className={cn("text-[11px] font-semibold truncate pr-6 mb-3", accentClass)}>
                    {drep.name ?? "Anonymous"}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={labelClass}>{t("listBuilderDelegated")}</span>
                      <span className={cn("text-[11px] font-medium tabular-nums", accentClass)}>
                        {formatVotingPower(drep.votingPowerAda)} ₳
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={labelClass}>{t("listBuilderDelegators")}</span>
                      <span className={cn("text-[11px] font-medium tabular-nums", accentClass)}>
                        {drep.delegatorCount?.toLocaleString() ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={labelClass}>{t("listBuilderPowerPct")}</span>
                      <span className={cn("text-[11px] font-medium tabular-nums", accentClass)}>
                        {totalVotingPower > 0 ? ((drep.votingPowerAda / totalVotingPower) * 100).toFixed(2) : "0.00"}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

