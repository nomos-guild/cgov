import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import type { NCLDisplayData } from "@/types/governance";

export function GovernanceStats() {
  const t = useTranslations("stats");
  const { actions, nclDataList } = useAppSelector((state) => state.governance);
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

  // Separate NCL data: 2025 (extended) and 2026 for separate boxes
  const ncl2025Data = useMemo(() => {
    return nclDataList.find((ncl) => ncl.year === 2025);
  }, [nclDataList]);

  const ncl2026Data = useMemo(() => {
    return nclDataList.find((ncl) => ncl.year === 2026);
  }, [nclDataList]);

  // Format large numbers of ADA (e.g. 290,000,000 → "290M", 4,000,000,000 → "4B")
  const formatToMillions = (value: number): string => {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(0)}B`;
    }
    return `${(value / 1_000_000).toFixed(0)}M`;
  };

  // Render a single NCL year box
  const NCLYearBox = ({ ncl }: { ncl: NCLDisplayData }) => {
    // Calculate percentage - use provided percentUsed or calculate from values
    const calculatedPercent = ncl.targetValueAda > 0
      ? (ncl.currentValueAda / ncl.targetValueAda) * 100
      : 0;
    const progress = Math.min(ncl.percentUsed || calculatedPercent, 100);

    return (
      <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-2.5 sm:p-3 md:p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none game-stats-ncl">
        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
          <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide dark:text-[#0bd1a2]">
            {t("ncl", { year: ncl.year })}
          </span>
          <span className="text-xs sm:text-sm font-semibold dark:text-[#0bd1a2]">
            {progress.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
          <span className="text-base sm:text-lg font-bold dark:text-[#0bd1a2]">
            {formatToMillions(ncl.currentValueAda)}
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground dark:text-[#0bd1a2]">
            / {formatToMillions(ncl.targetValueAda)}
          </span>
        </div>
        <Progress
          value={progress}
          className="h-1 sm:h-1.5 rounded-full bg-secondary dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:rounded-none"
          indicatorClassName={isDarkTheme ? "bg-[#0bd1a2]" : "bg-black"}
        />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6 game-stats">
      {/* Proposal Counter Box */}
      <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-2.5 sm:p-3 md:p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
        <div className="flex flex-col gap-3">
          {/* First row: Total */}
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
            <span className="text-xl sm:text-2xl md:text-3xl font-bold dark:text-[#0bd1a2]">{stats.total}</span>
            <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground uppercase tracking-wide dark:text-[#0bd1a2]">
              {t("total")}
            </span>
          </div>

          {/* Second row: Active, Ratified, Expired */}
          <div className="flex items-center gap-4 sm:gap-6 md:gap-8">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
              <span className="text-lg sm:text-xl md:text-2xl font-semibold dark:text-[#0bd1a2]">
                {stats.active}
              </span>
              <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground dark:text-[#0bd1a2]">
                {t("active")}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
              <span className="text-lg sm:text-xl md:text-2xl font-semibold dark:text-[#0bd1a2]">
                {stats.ratified}
              </span>
              <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground dark:text-[#0bd1a2]">
                {t("ratified")}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
              <span className="text-lg sm:text-xl md:text-2xl font-semibold dark:text-[#0bd1a2]">
                {stats.expired}
              </span>
              <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground dark:text-[#0bd1a2]">
                {t("expired")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* NCL 2025 Box */}
      {ncl2025Data && <NCLYearBox ncl={ncl2025Data} />}

      {/* NCL 2026 Box */}
      {ncl2026Data && <NCLYearBox ncl={ncl2026Data} />}
    </div>
  );
}
