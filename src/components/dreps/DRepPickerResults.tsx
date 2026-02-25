import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const DEFAULT_DISPLAY_LIMIT = 50;

export interface EnrichedDRep {
  drepId: string;
  name: string | null;
  iconUrl: string | null;
  votingPowerAda: number;
  delegatorCount: number | null;
  totalVotesCast: number;
  activityPercent: number;
  rationalePercent: number;
  flexibilityPercent: number;
}

interface DRepPickerResultsProps {
  dreps: EnrichedDRep[];
  totalVotingPower: number;
}

function formatVotingPower(value: number, decimals: number = 1): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(decimals)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(decimals)}K`;
  return value.toLocaleString();
}

export default function DRepPickerResults({ dreps }: DRepPickerResultsProps) {
  const t = useTranslations("drep");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";
  const [showAll, setShowAll] = useState(false);

  const visibleDreps = showAll ? dreps : dreps.slice(0, DEFAULT_DISPLAY_LIMIT);
  const hasMore = dreps.length > DEFAULT_DISPLAY_LIMIT;

  const cardClass = isLight
    ? "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
    : isGame
    ? "game-detail-card rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : "rounded-none border border-[#0bd1a2] bg-transparent shadow-none";

  const headerClass = isLight
    ? "border-black/10 text-black/60 bg-[#faf9f6]"
    : isGame
    ? "border-white/10 text-white/60 bg-[#0c0c0c]"
    : "border-[#0bd1a2]/30 text-[#0bd1a2]/70 bg-background";

  const rowClass = isLight
    ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:scale-[1.01] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)]"
    : isGame
    ? "bg-white/5 hover:scale-[1.01] hover:bg-white/10 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
    : "rounded-none border border-[#0bd1a2]/30 bg-transparent hover:scale-[1.01] hover:border-[#0bd1a2] hover:shadow-[0_4px_16px_rgba(11,209,162,0.15)]";

  if (dreps.length === 0) {
    return (
      <div className={`${cardClass} p-8`}>
        <div className={`text-center text-xs ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
          {t("noMatches")}
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardClass} h-full overflow-hidden`}>
      <div className="flex flex-col h-full min-h-0">
        <div className={`flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full ${
          isGame ? "[&::-webkit-scrollbar-thumb]:bg-white/35" : "[&::-webkit-scrollbar-thumb]:bg-black/20"
        }`}>
          <div className="px-4">
            {/* Table Header */}
            <div className={`flex items-center gap-4 py-2 pl-2 pr-8 text-[10px] font-semibold uppercase tracking-wide border-b sticky top-0 z-20 ${headerClass}`}>
              <span className="w-7 text-center">#</span>
              <span className="flex-1 min-w-0">{t("columnName")}</span>
              <span className="w-[90px] text-right">{t("columnPower")}</span>
              <span className="hidden sm:inline w-[75px] text-right">{t("pickerColumnActivity")}</span>
              <span className="hidden sm:inline w-[80px] text-right">{t("pickerColumnRationales")}</span>
              <span className="hidden md:inline w-[75px] text-right">{t("pickerColumnFlexibility")}</span>
              <span className="hidden sm:inline w-[80px] text-right">{t("columnDelegators")}</span>
            </div>

            {/* Table Rows */}
            <div className="flex flex-col gap-1.5 mt-2 pb-2">
              {visibleDreps.map((drep, index) => (
                <Link
                  key={drep.drepId}
                  href={`/drep/${encodeURIComponent(drep.drepId)}`}
                  className={`flex items-center gap-4 py-1.5 pl-2 pr-8 rounded-lg text-[11px] transition-all duration-200 ease-out no-underline ${rowClass}`}
                >
                  {/* Rank */}
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
                  {/* Name */}
                  <span className={`flex-1 min-w-0 truncate font-medium ${isGame ? "text-white" : ""}`}>
                    {drep.name || t("anonymous")}
                  </span>
                  {/* Voting Power */}
                  <span className={`w-[90px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                    {formatVotingPower(drep.votingPowerAda)}
                  </span>
                  {/* Activity % */}
                  <span className={`hidden sm:inline w-[75px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                    {drep.activityPercent.toFixed(0)}%
                  </span>
                  {/* Rationale % */}
                  <span className={`hidden sm:inline w-[80px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                    {drep.rationalePercent.toFixed(0)}%
                  </span>
                  {/* Flexibility % */}
                  <span className={`hidden md:inline w-[75px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                    {drep.flexibilityPercent.toFixed(0)}%
                  </span>
                  {/* Delegators */}
                  <span className={`hidden sm:inline w-[80px] text-right tabular-nums flex-shrink-0 ${isGame ? "text-white/70" : "text-muted-foreground"}`}>
                    {drep.delegatorCount != null ? drep.delegatorCount.toLocaleString() : "--"}
                  </span>
                </Link>
              ))}

              {hasMore && (
                <button
                  onClick={(e) => { e.preventDefault(); setShowAll(!showAll); }}
                  className={cn(
                    "w-full py-2 mt-1 text-[11px] font-medium transition-colors duration-150",
                    isLight
                      ? "rounded-lg text-black/50 hover:text-black hover:bg-black/5"
                      : isGame
                        ? "rounded-[2px] text-white/40 hover:text-white hover:bg-white/5"
                        : "rounded-none text-[#0bd1a2]/50 hover:text-[#0bd1a2] hover:bg-[#0bd1a2]/5"
                  )}
                >
                  {showAll
                    ? `Show Top ${DEFAULT_DISPLAY_LIMIT}`
                    : `Show All ${dreps.length.toLocaleString()} DReps`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
