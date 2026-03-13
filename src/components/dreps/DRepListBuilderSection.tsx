import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";
import { useAllDReps, useDRepRationaleStats } from "@/hooks/useDRepData";
import DRepListBuilder from "@/components/dreps/DRepListBuilder";
import type { EnrichedDRep } from "@/components/dreps/DRepPickerResults";

interface DRepListBuilderSectionProps {
  initialDreps?: DRepSummary[];
}

export default function DRepListBuilderSection({ initialDreps }: DRepListBuilderSectionProps) {
  const t = useTranslations("drep");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  const { dreps: allDreps, isLoading: loadingDreps } = useAllDReps({}, initialDreps);
  const { dreps: rationaleStats, isLoading: loadingRationale } = useDRepRationaleStats();

  const isLoading = loadingDreps || loadingRationale;

  const enrichedDreps = useMemo((): EnrichedDRep[] => {
    if (!allDreps.length) return [];

    const rationaleMap = new Map<string, { rationalesProvided: number; participationPercent: number; totalVotesCast: number; uniqueProposals: number; voteChanges: number }>();
    for (const r of rationaleStats) {
      rationaleMap.set(r.drepId, {
        rationalesProvided: r.rationalesProvided,
        participationPercent: r.proposalParticipationPercent,
        totalVotesCast: r.totalVotesCast,
        uniqueProposals: r.uniqueProposals,
        voteChanges: r.voteChanges,
      });
    }

    return allDreps.filter((d) => d.totalVotesCast > 0 && d.votingPowerAda > 0).map((d): EnrichedDRep => {
      const rationale = rationaleMap.get(d.drepId);
      const votes = rationale?.totalVotesCast ?? d.totalVotesCast;
      return {
        drepId: d.drepId,
        name: d.name,
        iconUrl: d.iconUrl ?? null,
        votingPowerAda: d.votingPowerAda,
        delegatorCount: d.delegatorCount,
        totalVotesCast: d.totalVotesCast,
        activityPercent: rationale?.participationPercent ?? 0,
        rationalePercent: votes > 0 && rationale ? (rationale.rationalesProvided / votes) * 100 : 0,
        flexibilityPercent: rationale && rationale.uniqueProposals > 0 ? (rationale.voteChanges / rationale.uniqueProposals) * 100 : 0,
      };
    });
  }, [allDreps, rationaleStats]);

  const totalVotingPower = useMemo(
    () => enrichedDreps.reduce((sum, d) => sum + d.votingPowerAda, 0),
    [enrichedDreps]
  );

  if (isLoading) {
    return (
      <div className={`text-center py-16 text-xs ${isGame ? "text-white/50" : "text-muted-foreground"}`}>
        {t("loadingPickerData")}
      </div>
    );
  }

  return <DRepListBuilder dreps={enrichedDreps} totalVotingPower={totalVotingPower} />;
}
