import { useState } from "react";
import { useTranslations } from "next-intl";
import { VoteProgress } from "@/components/ui/vote-progress";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { RoleLegend } from "@/components/governance/RoleLegend";
import { ExcludedBreakdownDisplay } from "@/components/governance/ExcludedBreakdownDisplay";
import { RolePlaceholder } from "@/components/governance/RolePlaceholder";
import type { VoteSegment, ExcludedBreakdown } from "@/lib/voteBreakdownCalculator";

export interface LiveVotingTabProps {
  hasData: boolean;
  isInfoAction: boolean;
  // DRep
  allowDRep: boolean;
  hasDrepInfo: boolean;
  drepDonutSegments: VoteSegment[] | null;
  drepLegendSegments: VoteSegment[] | null;
  drepExcludedBreakdown: ExcludedBreakdown | null;
  // CC
  allowCC: boolean;
  hasCcInfo: boolean;
  ccYesPercent: number;
  ccNoPercent: number;
  ccPendingPercentRecalc: number;
  ccYesCount: number;
  ccNoCount: number;
  ccPendingCount: number;
  ccAbstainCount: number;
  // SPO
  allowSPO: boolean;
  hasSpoInfo: boolean;
  spoDonutSegments: VoteSegment[] | null;
  spoLegendSegments: VoteSegment[] | null;
  spoExcludedBreakdown: ExcludedBreakdown | null;
}

export function LiveVotingTab({
  hasData,
  isInfoAction,
  allowDRep,
  hasDrepInfo,
  drepDonutSegments,
  drepLegendSegments,
  drepExcludedBreakdown,
  allowCC,
  hasCcInfo,
  ccYesPercent,
  ccNoPercent,
  ccPendingPercentRecalc,
  ccYesCount,
  ccNoCount,
  ccPendingCount,
  ccAbstainCount,
  allowSPO,
  hasSpoInfo,
  spoDonutSegments,
  spoLegendSegments,
  spoExcludedBreakdown,
}: LiveVotingTabProps) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const tProposal = useTranslations("proposal");

  // Excluded breakdown expanded state (local to this tab)
  const [isDrepExcludedExpanded, setIsDrepExcludedExpanded] = useState(false);
  const [isSpoExcludedExpanded, setIsSpoExcludedExpanded] = useState(false);
  const [isCcExcludedExpanded, setIsCcExcludedExpanded] = useState(false);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
        {tProposal("noVotingActivity")}
      </div>
    );
  }

  return (
    <div className="space-y-0 sm:space-y-4">
      <div className={cn(
        "flex flex-col -space-y-20 sm:space-y-0 sm:flex-row sm:flex-wrap xl:flex-nowrap sm:items-start sm:justify-start",
        isGame ? "sm:gap-2 md:gap-3" : "sm:gap-4 md:gap-6"
      )}>
        {/* DRep */}
        <div className="flex flex-row items-center gap-1 sm:flex-col sm:items-center sm:gap-3 my-0">
          {allowDRep ? (
            hasDrepInfo ? (
              <>
                <VoteProgress
                  title={tProposal("drepVotes")}
                  segments={drepDonutSegments ?? undefined}
                  valueUnit="ada"
                  className="origin-left scale-[0.5] -mr-24 sm:mr-0 sm:origin-center sm:scale-90 md:scale-100 shrink-0"
                  fixedWidth={240}
                  showTooltip={false}
                  animate={false}
                  interactive={false}
                  showYesPercent={!!drepDonutSegments}
                />
                <RoleLegend
                  role="DRep"
                  segments={drepLegendSegments}
                  unit="ADA"
                />
                <ExcludedBreakdownDisplay
                  role="DRep"
                  breakdown={drepExcludedBreakdown}
                  isInfoAction={isInfoAction}
                  isExpanded={isDrepExcludedExpanded}
                  setIsExpanded={setIsDrepExcludedExpanded}
                />
              </>
            ) : (
              <RolePlaceholder
                role="DRep"
                message={tProposal("noOnChainData")}
              />
            )
          ) : (
            <RolePlaceholder
              role="DRep"
              message={tProposal("notEligibleForAction")}
              notEligible
            />
          )}
        </div>
        {/* Vertical divider */}
        {isGame && <div className="hidden sm:block w-0 self-stretch border-r border-white/20 mx-4" />}
        {/* CC */}
        <div className="flex flex-row items-center gap-1 sm:flex-col sm:items-center sm:gap-3 my-0">
          {allowCC ? (
            <>
              <VoteProgress
                title={tProposal("ccVotes")}
                yesPercent={ccYesPercent}
                noPercent={ccNoPercent}
                pendingPercent={ccPendingPercentRecalc}
                yesValue={ccYesCount}
                noValue={ccNoCount}
                pendingValue={ccPendingCount || 1}
                valueUnit="count"
                className="origin-left scale-[0.5] -mr-24 sm:mr-0 sm:origin-center sm:scale-90 md:scale-100 shrink-0"
                fixedWidth={240}
                showTooltip={false}
                animate={false}
                interactive={false}
                showYesPercent
              />
              <RoleLegend
                role="CC"
                yesLabel={`${ccYesCount}`}
                noLabel={`${ccNoCount}`}
                pendingLabel={hasCcInfo ? `${ccPendingCount}` : "100%"}
                unit="votes"
              />
              <ExcludedBreakdownDisplay
                role="CC"
                breakdown={{ abstain: ccAbstainCount }}
                isInfoAction={isInfoAction}
                isExpanded={isCcExcludedExpanded}
                setIsExpanded={setIsCcExcludedExpanded}
              />
            </>
          ) : (
            <RolePlaceholder
              role="CC"
              message={tProposal("notEligibleForAction")}
              notEligible
            />
          )}
        </div>
        {/* Vertical divider */}
        {isGame && <div className="hidden sm:block w-0 self-stretch border-r border-white/20 mx-4" />}
        {/* SPO */}
        <div className="flex flex-row items-center gap-1 sm:flex-col sm:items-center sm:gap-3 my-0">
          {allowSPO ? (
            hasSpoInfo ? (
              <>
                <VoteProgress
                  title={tProposal("spoVotes")}
                  segments={spoDonutSegments ?? undefined}
                  valueUnit="ada"
                  className="origin-left scale-[0.5] -mr-24 sm:mr-0 sm:origin-center sm:scale-90 md:scale-100 shrink-0"
                  fixedWidth={240}
                  showTooltip={false}
                  animate={false}
                  interactive={false}
                  showYesPercent={!!spoDonutSegments}
                />
                <RoleLegend
                  role="SPO"
                  segments={spoLegendSegments}
                  unit="ADA"
                />
                <ExcludedBreakdownDisplay
                  role="SPO"
                  breakdown={spoExcludedBreakdown}
                  isInfoAction={isInfoAction}
                  isExpanded={isSpoExcludedExpanded}
                  setIsExpanded={setIsSpoExcludedExpanded}
                />
              </>
            ) : (
              <RolePlaceholder
                role="SPO"
                message={tProposal("noOnChainData")}
              />
            )
          ) : (
            <RolePlaceholder
              role="SPO"
              message={tProposal("notEligibleForAction")}
              notEligible
            />
          )}
        </div>
      </div>
    </div>
  );
}
