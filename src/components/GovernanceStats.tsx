import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";

export function GovernanceStats() {
  const t = useTranslations("stats");
  const { actions, treasuryAda, yearlySpent } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const isDarkTheme = activeTheme.isDark;

  const stats = {
    total: actions.length,
    active: actions.filter((a) => a.status === "Active").length,
    passed: actions.filter(
      (a) => a.status === "Ratified" || a.status === "Enacted"
    ).length,
    failed: actions.filter(
      (a) => a.status === "Expired" || a.status === "Closed"
    ).length,
  };

  const { requestedAda } = useMemo(() => {
    const activeWithdrawals = actions.filter(
      (a) => a.status === "Active" && a.type === "Treasury Withdrawals" && a.withdrawalAmount
    );
    const totalLovelace = activeWithdrawals.reduce((sum, a) => {
      return sum + Number(a.withdrawalAmount || 0);
    }, 0);
    return { requestedAda: totalLovelace / 1_000_000 };
  }, [actions]);

  const spent2026 = yearlySpent["2026"] ?? 0;

  const formatAdaValue = (value: number): string => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
    return value.toLocaleString();
  };

  const formatSpentValue = (value: number): string => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return value.toLocaleString();
  };

  const formatAdaFull = (value: number): string => `₳ ${Math.round(value).toLocaleString()}`;

  const cardClass = "rounded-xl border border-border bg-card p-2.5 sm:p-3 md:p-4 shadow-elevation-1 dark:rounded-none dark:border-[#0bd1a2] dark:bg-background dark:shadow-none min-h-[80px] sm:min-h-[90px] flex flex-col justify-center";

  return (
    <div className="relative z-20 grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6 game-stats">
      {/* Proposal Counter Box */}
      <div className={cardClass}>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide dark:text-[#0bd1a2]">
            {t("total")}
          </span>
          <span className="text-lg sm:text-xl md:text-2xl font-bold dark:text-[#0bd1a2]">{stats.total}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 pt-2 border-t border-border/50 dark:border-[#0bd1a2]/20">
          <div className="flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-semibold dark:text-[#0bd1a2]">{stats.active}</span>
            <span className="text-2xs sm:text-xs text-muted-foreground dark:text-[#0bd1a2]">{t("active")}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-semibold dark:text-[#0bd1a2]">{stats.passed}</span>
            <span className="text-2xs sm:text-xs text-muted-foreground dark:text-[#0bd1a2] inline-flex items-center gap-0.5">
              {t("passed")}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-2.5 w-2.5 cursor-help opacity-60 hover:opacity-100 transition-opacity" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{t("passedInfo")}</p>
                </TooltipContent>
              </Tooltip>
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-semibold dark:text-[#0bd1a2]">{stats.failed}</span>
            <span className="text-2xs sm:text-xs text-muted-foreground dark:text-[#0bd1a2] inline-flex items-center gap-0.5">
              {t("failed")}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-2.5 w-2.5 cursor-help opacity-60 hover:opacity-100 transition-opacity" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{t("failedInfo")}</p>
                </TooltipContent>
              </Tooltip>
            </span>
          </div>
        </div>
      </div>

      {/* Treasury Balance Box */}
      <div className={`${cardClass} game-stats-ncl`}>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide dark:text-[#0bd1a2]">
            {t("treasury")}
          </span>
          <span className={`text-lg sm:text-xl md:text-2xl font-bold ${isDarkTheme ? "text-[#0bd1a2]" : "text-black"}`}>
            {treasuryAda != null ? `₳ ${formatAdaValue(treasuryAda)}` : "—"}
          </span>
        </div>
      </div>

      {/* Requested Withdrawals Box */}
      <div className={cardClass}>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide dark:text-[#0bd1a2]">
            {t("requested")}
          </span>
          <span className={`text-lg sm:text-xl md:text-2xl font-bold ${isDarkTheme ? "text-[#0bd1a2]" : "text-black"}`}>
            {requestedAda > 0 ? `₳ ${formatAdaValue(requestedAda)}` : "₳ 0"}
          </span>
        </div>
      </div>

      {/* Spent Box */}
      <div className={cardClass}>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide dark:text-[#0bd1a2]">
            {t("spent")} 2026
          </span>
          <div className="flex items-center gap-1">
            <span className={`text-lg sm:text-xl md:text-2xl font-bold ${isDarkTheme ? "text-[#0bd1a2]" : "text-black"}`}>
              ₳ {formatSpentValue(spent2026)}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-2.5 w-2.5 cursor-help opacity-60 hover:opacity-100 transition-opacity text-muted-foreground dark:text-[#0bd1a2]" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{formatAdaFull(spent2026)}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
