import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { formatAdaValue } from "@/lib/formatters";
import type { ExcludedBreakdown } from "@/lib/voteBreakdownCalculator";

export function ExcludedBreakdownDisplay({
  role,
  breakdown,
  isInfoAction = false,
  isExpanded,
  setIsExpanded,
}: {
  role: "DRep" | "SPO" | "CC";
  breakdown: ExcludedBreakdown | { abstain: number } | null;
  isInfoAction?: boolean;
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
}) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const tVoting = useTranslations("voting");
  const tProposal = useTranslations("proposal");

  if (!breakdown) return null;

  // CC uses simple abstain count, DRep/SPO use full breakdown
  const isCC = role === "CC";
  const ccAbstain = isCC && "abstain" in breakdown ? breakdown.abstain : 0;
  const fullBreakdown = !isCC && "total" in breakdown ? breakdown : null;

  // For CC: always show the excluded section (even if 0)
  // For DRep/SPO: only show if there's actual excluded data
  if (!isCC && (!fullBreakdown || fullBreakdown.total === 0)) return null;

  const items = isCC
    ? [{ label: tVoting("abstain"), value: ccAbstain }]
    : [
        { label: tProposal("activeAbstain"), value: fullBreakdown!.activeAbstain },
        { label: tProposal("alwaysAbstain"), value: fullBreakdown!.alwaysAbstain },
        ...(fullBreakdown!.inactive !== undefined && role === "DRep"
          ? [{ label: tProposal("inactive"), value: fullBreakdown!.inactive }]
          : []),
      ];

  const totalValue = isCC ? ccAbstain : fullBreakdown!.total;

  return (
    <div className={cn(
      "hidden sm:block w-full max-w-[200px] sm:max-w-none text-xs mt-1 sm:mt-2",
      isGame
        ? "sm:w-[180px] border-none bg-transparent"
        : "sm:w-[240px] rounded-xl border border-dashed border-border/40 bg-card/20 dark:rounded-none dark:border-[#0bd1a2]/50 dark:bg-transparent"
    )}>
      {/* Header with total - always visible */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 cursor-pointer",
          isGame ? "text-white/60" : "text-muted-foreground/70 dark:text-[#0bd1a2]/70"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-2xs uppercase tracking-wide">
          {isInfoAction ? tProposal("excluded") : tProposal("excludedFromRatification")}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-mono text-2xs",
            isGame ? "text-white/60" : "text-muted-foreground/80 dark:text-[#0bd1a2]/70"
          )}>
            {isCC ? `${totalValue}` : formatAdaValue(totalValue)}
          </span>
          <svg
            className={cn(
              "h-3 w-3 transition-transform duration-normal",
              isExpanded ? "rotate-180" : "",
              isGame ? "text-white/60" : "text-foreground dark:text-[#0bd1a2]"
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expandable breakdown details */}
      <div className={cn(
        "overflow-hidden transition-all duration-normal ease-in-out",
        isExpanded ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className={cn(
          "px-3 pb-2 border-t",
          isGame ? "border-white/10" : "border-border/20 dark:border-[#0bd1a2]/20",
          isGame && "space-y-0.5",
          !isGame && "space-y-1"
        )}>
          <div className="h-2" /> {/* Spacer */}
          {items.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center justify-between",
                isGame ? "gap-1" : "gap-3"
              )}
            >
              <span className={cn(
                "text-2xs",
                isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
              )}>
                {item.label}
              </span>
              <span className={cn(
                "font-mono text-2xs",
                isGame ? "text-white/60" : "text-muted-foreground/80 dark:text-[#0bd1a2]/70"
              )}>
                {isCC ? `${item.value}` : formatAdaValue(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
