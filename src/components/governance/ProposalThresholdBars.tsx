import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  buildDonutSegments,
  getGovernanceActionTypeCode,
} from "@/lib/voteBreakdownCalculator";
import { canRoleVoteOnAction, getVoteDataPresence } from "@/lib/governanceVotingEligibility";
import type { GovernanceAction } from "@/types/governance";

interface ProposalThresholdBarsProps {
  action: GovernanceAction;
  isGame: boolean;
  maxWidth?: string;
}

export function ProposalThresholdBars({ action, isGame, maxWidth = "200px" }: ProposalThresholdBarsProps) {
  const threshold = action.threshold;
  if (!threshold) return null;
  if (threshold.drepThreshold === null && threshold.spoThreshold === null && threshold.ccThreshold === null) return null;

  const actionTypeCode = getGovernanceActionTypeCode(action.governanceActionType || action.type);
  const voteData = getVoteDataPresence(action);

  return (
    <div className="space-y-1.5" style={{ maxWidth }}>
      {/* DRep Threshold */}
      {threshold.drepThreshold !== null && threshold.drepThreshold !== undefined && (() => {
        const thresholdPercent = threshold.drepThreshold! * 100;
        const drepTotalVotePower = action.rawVotingPowerValues?.drep_total_vote_power;
        const drepSegments = action.drepBreakdown
          ? buildDonutSegments(action.drepBreakdown, actionTypeCode, true, drepTotalVotePower)
          : null;
        const currentPercent = drepSegments?.find(s => s.type === "yes")?.percent ?? action.drepYesPercent ?? 0;
        return (
          <ThresholdBarRow label="DReps" currentPercent={currentPercent} thresholdPercent={thresholdPercent} isGame={isGame} />
        );
      })()}
      {/* SPO Threshold */}
      {(() => {
        const spoCanVote = canRoleVoteOnAction(action.type, "SPO", threshold, voteData);
        if (!spoCanVote) return null;
        const thresholdPercent = threshold.spoThreshold != null ? threshold.spoThreshold * 100 : 51;
        const spoTotalVotePower = action.rawVotingPowerValues?.spo_total_vote_power;
        const spoSegments = action.spoBreakdown
          ? buildDonutSegments(action.spoBreakdown, actionTypeCode, false, spoTotalVotePower)
          : null;
        const currentPercent = spoSegments?.find(s => s.type === "yes")?.percent ?? action.spoYesPercent ?? 0;
        return (
          <ThresholdBarRow label="SPOs" currentPercent={currentPercent} thresholdPercent={thresholdPercent} isGame={isGame} />
        );
      })()}
      {/* CC Threshold */}
      {threshold.ccThreshold !== null && threshold.ccThreshold !== undefined && (() => {
        const ccData = action.cc;
        const ccYesCount = ccData?.yesCount ?? 0;
        const ccNoCount = ccData?.noCount ?? 0;
        const ccNotVotedCount = ccData?.notVotedCount ?? 0;
        const totalMembers = (ccYesCount + ccNoCount + ccNotVotedCount) || 7;
        const currentPercent = (ccYesCount / totalMembers) * 100;
        const thresholdPercent = threshold.ccThreshold! * 100;
        return (
          <ThresholdBarRow label="CC" currentPercent={currentPercent} thresholdPercent={thresholdPercent} isGame={isGame} />
        );
      })()}
    </div>
  );
}

function ThresholdBarRow({ label, currentPercent, thresholdPercent, isGame }: {
  label: string;
  currentPercent: number;
  thresholdPercent: number;
  isGame: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center">
        <span className={cn("text-[10px] font-medium", isGame ? "text-white/80" : "text-muted-foreground")}>{label}</span>
        <span className={cn("text-[10px]", isGame ? "text-white/60" : "text-muted-foreground")}>{currentPercent.toFixed(1)}% / {thresholdPercent.toFixed(1)}%</span>
      </div>
      <div className="relative">
        <Progress value={Math.min(currentPercent, 100)} className={cn("h-1.5", isGame ? "bg-white/20" : "bg-gray-200 dark:bg-gray-700")} indicatorClassName={isGame ? "bg-gray-400" : "bg-black dark:bg-[#0bd1a2]"} />
        <div className="absolute top-0 h-1.5 w-0.5 bg-black dark:bg-white" style={{ left: `${thresholdPercent}%` }} />
      </div>
    </div>
  );
}
