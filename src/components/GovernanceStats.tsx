import { Progress } from "@/components/ui/progress";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";

export function GovernanceStats() {
  const { actions, nclData } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const isDarkTheme = activeTheme.isDark;

  const stats = {
    total: actions.length,
    active: actions.filter((a) => a.status === "Active").length,
    // Treat "Enacted" as successfully ratified and "Closed" as an expired outcome
    ratified: actions.filter(
      (a) => a.status === "Ratified" || a.status === "Enacted"
    ).length,
    expired: actions.filter(
      (a) => a.status === "Expired" || a.status === "Closed"
    ).length,
  };

  // Calculate NCL progress percentage from Redux-managed display data
  const nclProgress = nclData ? nclData.percentUsed : 0;

  // Format large numbers of ADA (e.g. 290,000,000 → "290M", 4,000,000,000 → "4B")
  const formatToMillions = (value: number): string => {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(0)}B`;
    }
    return `${(value / 1_000_000).toFixed(0)}M`;
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6 game-stats">
      {/* Proposal Counter Box */}
      <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-2.5 sm:p-3 md:p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
        <div className="grid grid-cols-4 sm:flex sm:flex-wrap items-center gap-2 sm:gap-4 md:gap-6 lg:gap-8">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
            <span className="text-xl sm:text-2xl md:text-3xl font-bold dark:text-[#0bd1a2]">{stats.total}</span>
            <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground uppercase tracking-wide dark:text-[#0bd1a2]">
              Total
            </span>
          </div>

          <div className="h-6 sm:h-8 w-px bg-border hidden md:block dark:bg-[#0bd1a2]/60" />

          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
            <span className="text-lg sm:text-xl md:text-2xl font-semibold dark:text-[#0bd1a2]">
              {stats.active}
            </span>
            <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground dark:text-[#0bd1a2]">
              Active
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
            <span className="text-lg sm:text-xl md:text-2xl font-semibold dark:text-[#0bd1a2]">
              {stats.ratified}
            </span>
            <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground dark:text-[#0bd1a2]">
              Ratified
            </span>
          </div>

          <div className="h-6 sm:h-8 w-px bg-border hidden md:block dark:bg-[#0bd1a2]/60" />

          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
            <span className="text-lg sm:text-xl md:text-2xl font-semibold dark:text-[#0bd1a2]">
              {stats.expired}
            </span>
            <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground dark:text-[#0bd1a2]">
              Expired
            </span>
          </div>
        </div>
      </div>

      {/* NCL Progress Box */}
      {nclData && (
        <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-2.5 sm:p-3 md:p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] sm:flex-1 sm:max-w-xs md:max-w-md dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none game-stats-ncl">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide dark:text-[#0bd1a2]">
              {nclData.year} NCL
            </span>
            <span className="text-xs sm:text-sm font-semibold dark:text-[#0bd1a2]">
              {nclProgress.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <span className="text-base sm:text-lg font-bold dark:text-[#0bd1a2]">
              {formatToMillions(nclData.currentValueAda)}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground dark:text-[#0bd1a2]">
              / {formatToMillions(nclData.targetValueAda)}
            </span>
          </div>
          <Progress
            value={nclProgress}
            className="h-1 sm:h-1.5 rounded-full bg-secondary dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:rounded-none"
            indicatorClassName={isDarkTheme ? "bg-[#0bd1a2]" : "bg-black"}
          />
        </div>
      )}
    </div>
  );
}
