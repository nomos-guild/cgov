import { Progress } from "@/components/ui/progress";
import { useAppSelector } from "@/store/hooks";

export function GovernanceStats() {
  const { actions, nclData } = useAppSelector((state) => state.governance);

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

  // Format large numbers of ADA to millions of ADA (e.g. 290,000,000 → "290M")
  const formatToMillions = (value: number): string => {
    return `${(value / 1_000_000).toFixed(0)}M`;
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      {/* Proposal Counter Box */}
      <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-3 sm:p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 md:gap-8">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold">{stats.total}</span>
            <span className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide">
              Total
            </span>
          </div>

          <div className="h-6 sm:h-8 w-px bg-border hidden sm:block" />

          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-semibold">
              {stats.active}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              Active
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-semibold">
              {stats.ratified}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              Ratified
            </span>
          </div>

          <div className="h-6 sm:h-8 w-px bg-border hidden sm:block" />

          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-semibold">
              {stats.expired}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              Expired
            </span>
          </div>
        </div>
      </div>

      {/* NCL Progress Box */}
      {nclData && (
        <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-3 sm:p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] md:flex-1 md:max-w-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              {nclData.year} NCL
            </span>
            <span className="text-sm font-semibold">
              {nclProgress.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-lg font-bold">
              {formatToMillions(nclData.currentValueAda)}
            </span>
            <span className="text-sm text-muted-foreground">
              / {formatToMillions(nclData.targetValueAda)}
            </span>
          </div>
          <Progress value={nclProgress} className="h-1.5" />
        </div>
      )}
    </div>
  );
}
