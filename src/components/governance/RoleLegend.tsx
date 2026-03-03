import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { formatAdaValue } from "@/lib/formatters";
import { SEGMENT_COLORS, type VoteSegment } from "@/lib/voteBreakdownCalculator";

export function RoleLegend({
  role,
  segments,
  yesLabel,
  noLabel,
  pendingLabel,
  unit,
}: {
  role: string;
  segments?: VoteSegment[] | null;
  // Legacy props for CC only (no breakdown data from API)
  yesLabel?: string;
  noLabel?: string;
  pendingLabel?: string;
  unit: string;
}) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const tVoting = useTranslations("voting");
  const tProposal = useTranslations("proposal");

  // Translate segment type to localized label
  const segmentLabel = (type: string, fallback: string) => {
    const map: Record<string, string> = {
      yes: tVoting("yes"),
      no: tVoting("no"),
      abstain: tVoting("abstain"),
      notVoted: tVoting("notVoted"),
      alwaysNoConfidence: "ANC",
    };
    return map[type] ?? fallback;
  };

  // Use segments when provided (DRep/SPO), otherwise use legacy props (CC)
  const items = segments && segments.length > 0
    ? segments.map((seg) => ({
        label: segmentLabel(seg.type, seg.label),
        type: seg.type,
        value: formatAdaValue(seg.value),
        // For ANC with black color, don't apply opacity to keep it black
        color: seg.type === "alwaysNoConfidence" && seg.color === "#000000"
          ? seg.color
          : `${seg.color}73`, // Apply 45% opacity to match donut inactive state
        border: seg.type === "abstain" || seg.type === "notVoted" || seg.type === "excluded" || seg.type === "alwaysNoConfidence"
          ? "rgba(148, 163, 184, 0.85)"
          : "transparent",
      }))
    : [
        // CC legacy fallback - uses SEGMENT_COLORS with 45% opacity
        {
          label: tVoting("yes"),
          type: "yes",
          value: yesLabel ?? "0",
          color: `${SEGMENT_COLORS.yes}73`,
          border: "transparent",
        },
        {
          label: tVoting("no"),
          type: "no",
          value: noLabel ?? "0",
          color: `${SEGMENT_COLORS.no}73`,
          border: "transparent",
        },
        {
          label: tVoting("notVoted"),
          type: "notVoted",
          value: pendingLabel ?? (unit === "ADA" ? "0 ₳" : `0 ${tProposal("votes")}`),
          color: `${SEGMENT_COLORS.notVoted}73`,
          border: "rgba(148, 163, 184, 0.85)",
        },
      ];

  return (
    <div className={cn(
      "w-full max-w-none px-2 py-0 text-[10px] sm:text-xs",
      isGame
        ? "sm:w-[180px] border-none bg-transparent"
        : "sm:w-[240px] sm:px-3 sm:py-2 rounded-xl border border-border/60 bg-card/40 shadow-sm dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
    )}>
      <div className={cn(
        "mb-0.5 sm:mb-2 flex items-center justify-between text-[10px] sm:text-[11px] uppercase tracking-wide",
        isGame ? "text-white" : "text-muted-foreground dark:text-[#0bd1a2]"
      )}>
        <span className={cn("font-semibold", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>{role}</span>
        <span className={isGame ? "text-white" : "dark:text-[#0bd1a2]"}>{unit}</span>
      </div>
      <div className={cn("space-y-1.5", isGame && "space-y-1")}>
        {items.map((item) => (
          <div
            key={item.label}
            className={cn(
              "flex items-start justify-between",
              isGame ? "gap-1" : "gap-2"
            )}
          >
            <div className={cn(
              "flex items-start min-w-0 flex-1",
              isGame ? "gap-1.5" : "gap-2"
            )}>
              <span
                className="h-2.5 w-2.5 border shrink-0 mt-0.5"
                style={{
                  backgroundColor: item.color,
                  borderColor: item.border,
                }}
              />
              <div className="flex items-center gap-1">
                <span className={cn(
                  "font-semibold leading-tight",
                  isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                )}>
                  {item.label}
                </span>
                {item.type === "alwaysNoConfidence" && (
                  <div className="group relative inline-block">
                    <Info className={cn(
                      "h-3 w-3 cursor-help",
                      isGame ? "text-white/60" : "text-muted-foreground dark:text-[#0bd1a2]/60"
                    )} />
                    <div className={cn(
                      "absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-max max-w-[200px] rounded px-2 py-1 text-[10px] shadow-lg",
                      isGame
                        ? "bg-black/90 text-white border border-white/20"
                        : "bg-popover text-popover-foreground border border-border"
                    )}>
                      {tProposal("alwaysNoConfidence")}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <span className={cn(
              "font-mono text-[11px] shrink-0 text-right",
              isGame ? "text-white/80" : "text-muted-foreground dark:text-[#0bd1a2]"
            )}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
