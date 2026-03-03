import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { formatAdaValue } from "@/lib/formatters";
import type { GovernanceActionDetail } from "@/types/governance";
import type { VoteSegment } from "@/lib/voteBreakdownCalculator";

export interface ThresholdsTabProps {
  action: GovernanceActionDetail;
  hasSpoVotes: boolean;
  ccYesCount: number;
  ccNoCount: number;
  ccPendingCount: number;
  drepDonutSegments: VoteSegment[] | null;
  spoDonutSegments: VoteSegment[] | null;
}

export function ThresholdsTab({
  action,
  hasSpoVotes,
  ccYesCount,
  ccNoCount,
  ccPendingCount,
  drepDonutSegments,
  spoDonutSegments,
}: ThresholdsTabProps) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const tProposal = useTranslations("proposal");
  const tVoting = useTranslations("voting");

  const threshold = action.threshold;

  return (
    <div className={cn(
      "p-4 sm:p-5 space-y-6",
      isGame
        ? "game-detail-card"
        : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
    )}>
      {/* Total Voting Power Section */}
      <div className="space-y-3">
        <h4 className={cn("text-sm font-semibold", isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]")}>
          {tProposal("totalVotingPower")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* DRep Total */}
          {threshold?.drepThreshold !== null && threshold?.drepThreshold !== undefined && (
            <PowerCard
              label={tVoting("dreps")}
              value={action.rawVotingPowerValues?.drep_total_vote_power
                ? formatAdaValue(Number(action.rawVotingPowerValues.drep_total_vote_power) / 1_000_000)
                : "N/A"}
              isGame={isGame}
            />
          )}
          {/* SPO Total */}
          {((threshold?.spoThreshold !== null && threshold?.spoThreshold !== undefined) || hasSpoVotes) && (
            <PowerCard
              label={tVoting("spos")}
              value={action.rawVotingPowerValues?.spo_total_vote_power
                ? formatAdaValue(Number(action.rawVotingPowerValues.spo_total_vote_power) / 1_000_000)
                : "N/A"}
              isGame={isGame}
            />
          )}
          {/* CC Total */}
          {threshold?.ccThreshold !== null && threshold?.ccThreshold !== undefined && (() => {
            const ccTotalMembers = (ccYesCount + ccNoCount + ccPendingCount) || 7;
            return (
              <PowerCard
                label={tProposal("ccMembers")}
                value={tProposal("members", { count: ccTotalMembers })}
                isGame={isGame}
              />
            );
          })()}
        </div>
      </div>

      {/* Threshold Progress Section */}
      <div className="space-y-4">
        <h4 className={cn("text-sm font-semibold", isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]")}>
          {tProposal("approvalProgress")}
        </h4>

        {/* DRep Threshold */}
        {threshold?.drepThreshold !== null && threshold?.drepThreshold !== undefined && (() => {
          const thresholdPercent = threshold.drepThreshold * 100;
          const currentPercent = drepDonutSegments?.find(s => s.type === "yes")?.percent ?? action.drepYesPercent ?? 0;
          return (
            <ThresholdBar
              label={tVoting("dreps")}
              currentPercent={currentPercent}
              thresholdPercent={thresholdPercent}
              isGame={isGame}
            />
          );
        })()}

        {/* SPO Threshold */}
        {((threshold?.spoThreshold !== null && threshold?.spoThreshold !== undefined) || hasSpoVotes) && (() => {
          const thresholdPercent = threshold?.spoThreshold != null
            ? threshold.spoThreshold * 100
            : 51;
          const currentPercent = spoDonutSegments?.find(s => s.type === "yes")?.percent ?? action.spoYesPercent ?? 0;
          return (
            <ThresholdBar
              label={tVoting("spos")}
              currentPercent={currentPercent}
              thresholdPercent={thresholdPercent}
              isGame={isGame}
            />
          );
        })()}

        {/* CC Threshold */}
        {threshold?.ccThreshold !== null && threshold?.ccThreshold !== undefined && (() => {
          const totalMembers = (ccYesCount + ccNoCount + ccPendingCount) || 7;
          const currentPercent = (ccYesCount / totalMembers) * 100;
          const thresholdPercent = threshold.ccThreshold * 100;
          return (
            <ThresholdBar
              label={tVoting("ccFull")}
              currentPercent={currentPercent}
              thresholdPercent={thresholdPercent}
              isGame={isGame}
            />
          );
        })()}
      </div>

      {/* No thresholds available message */}
      {threshold?.drepThreshold === null &&
       threshold?.spoThreshold === null &&
       threshold?.ccThreshold === null && (
        <p className={cn("text-sm", isGame ? "text-white/70" : "text-muted-foreground")}>
          {tProposal("noThresholdData")}
        </p>
      )}
    </div>
  );
}

function PowerCard({ label, value, isGame }: { label: string; value: string; isGame: boolean }) {
  return (
    <div className={cn("p-3 rounded-lg", isGame ? "bg-white/10" : "bg-gray-100 dark:bg-gray-800")}>
      <div className={cn("text-xs", isGame ? "text-white/60" : "text-muted-foreground")}>
        {label}
      </div>
      <div className={cn("text-lg font-semibold", isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]")}>
        {value}
      </div>
    </div>
  );
}

function ThresholdBar({
  label,
  currentPercent,
  thresholdPercent,
  isGame,
}: {
  label: string;
  currentPercent: number;
  thresholdPercent: number;
  isGame: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className={cn("text-sm font-medium", isGame ? "text-white" : "text-foreground")}>
          {label}
        </span>
        <span className={cn("text-sm", isGame ? "text-white/70" : "text-muted-foreground")}>
          {currentPercent.toFixed(1)}% / {thresholdPercent.toFixed(1)}%
        </span>
      </div>
      <div className="relative">
        <Progress
          value={Math.min(currentPercent, 100)}
          className={cn("h-3", isGame ? "bg-white/20" : "bg-gray-200 dark:bg-gray-700")}
          indicatorClassName={isGame ? "bg-gray-400" : "bg-black dark:bg-[#0bd1a2]"}
        />
        <div
          className="absolute top-0 h-3 w-0.5 bg-black dark:bg-white"
          style={{ left: `${thresholdPercent}%` }}
        />
      </div>
    </div>
  );
}
