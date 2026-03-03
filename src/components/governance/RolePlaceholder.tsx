import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { VoteProgress } from "@/components/ui/vote-progress";
import { SEGMENT_COLORS } from "@/lib/voteBreakdownCalculator";

export function RolePlaceholder({ role, message, notEligible }: { role: string; message: string; notEligible?: boolean }) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const tVoting = useTranslations("voting");

  if (notEligible) {
    // Show empty donut with single gray slice and legend showing "Not eligible"
    return (
      <>
        <VoteProgress
          title={`${role} ${tVoting("notEligible")}`}
          titlePosition="top"
          centerText={tVoting("notEligible")}
          yesPercent={0}
          noPercent={0}
          abstainPercent={0}
          pendingPercent={100}
          pendingValue={1}
          className="origin-left scale-[0.5] -mr-24 sm:mr-0 sm:origin-center sm:scale-90 md:scale-100 shrink-0"
          fixedWidth={240}
          showTooltip={false}
          animate={false}
          interactive={false}
        />
        <div className={cn(
          "w-[240px] px-3 py-2 text-xs",
          isGame
            ? "border-none bg-transparent"
            : "rounded-xl border border-border/60 bg-card/40 shadow-sm dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
        )}>
          <div className={cn(
            "mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide",
            isGame ? "text-white" : "text-muted-foreground dark:text-[#0bd1a2]"
          )}>
            <span className={cn("font-semibold", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>{role}</span>
          </div>
          <div className="space-y-1.5">
            {([
              { label: tVoting("yes"), colorKey: "yes" as keyof typeof SEGMENT_COLORS, hasBorder: false },
              { label: tVoting("no"), colorKey: "no" as keyof typeof SEGMENT_COLORS, hasBorder: false },
              { label: tVoting("abstain"), colorKey: "abstain" as keyof typeof SEGMENT_COLORS, hasBorder: true },
              { label: tVoting("notVoted"), colorKey: "notVoted" as keyof typeof SEGMENT_COLORS, hasBorder: true },
            ]).map((item) => (
              <div
                key={item.colorKey}
                className="flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span
                    className="h-2.5 w-2.5 border shrink-0 mt-0.5"
                    style={{
                      backgroundColor: `${SEGMENT_COLORS[item.colorKey] || SEGMENT_COLORS.excluded}73`,
                      borderColor: item.hasBorder ? "rgba(148, 163, 184, 0.85)" : "transparent",
                    }}
                  />
                  <span className={cn(
                    "font-semibold leading-tight",
                    isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                  )}>
                    {item.label}
                  </span>
                </div>
                <span className={cn(
                  "font-mono text-[11px] shrink-0 text-right italic",
                  isGame ? "text-white/60" : "text-muted-foreground/60 dark:text-[#0bd1a2]/60"
                )}>
                  {tVoting("notEligible")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  // Default placeholder for "No on-chain data yet"
  return (
    <div className={cn(
      "flex h-full min-h-[180px] w-full max-w-[220px] flex-col items-center justify-center px-4 py-6 text-center text-xs text-muted-foreground",
      isGame
        ? "border-none bg-transparent"
        : "rounded-xl border border-dashed border-border/60 bg-card/30 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none"
    )}>
      <span className={cn(
        "mb-1 font-semibold",
        isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
      )}>{role}</span>
      <span className={isGame ? "text-white/70" : "dark:text-[#0bd1a2]"}>{message}</span>
    </div>
  );
}
