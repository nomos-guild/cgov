import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import type { Vote } from "@/types/governance";

interface VotingSummaryProps {
  votes: Vote[];
  proposalTitle?: string;
}

export function VotingSummary({ votes }: VotingSummaryProps) {
  const t = useTranslations("votingSummary");

  const voteStats = {
    total: votes.length,
    yes: votes.filter((v) => v.vote === "Yes").length,
    no: votes.filter((v) => v.vote === "No").length,
    abstain: votes.filter((v) => v.vote === "Abstain").length,
  };

  return (
    <Card className="p-4 sm:p-6 mb-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">{t("votingRecords")}</h2>
        <p className="text-sm sm:text-base text-muted-foreground">{t("summaryOfVotes")}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold">{voteStats.total}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">{t("totalVotes")}</div>
        </Card>
        <Card className="p-3 sm:p-4 border-border">
          <div className="text-xl sm:text-2xl font-bold">{voteStats.yes}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">{t("yesVotes")}</div>
        </Card>
        <Card className="p-3 sm:p-4 border-border">
          <div className="text-xl sm:text-2xl font-bold">{voteStats.no}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">{t("noVotes")}</div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold">{voteStats.abstain}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">{t("abstain")}</div>
        </Card>
      </div>
    </Card>
  );
}

