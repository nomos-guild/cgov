import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { getEligibleRoles, getVoteDataPresence } from "@/lib/governanceVotingEligibility";
import type { GovernanceActionDetail } from "@/types/governance";

export function ProposalDetailsTab({
  action,
}: {
  action: GovernanceActionDetail;
}) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const tProposal = useTranslations("proposal");
  const tVoting = useTranslations("voting");

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Silently fail
    }
  };

  const cardClass = cn(
    "p-4 sm:p-5",
    isGame
      ? "game-detail-card"
      : "rounded-2xl border border-border/40 bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
  );

  const copyBtnClass = cn(
    "flex h-7 w-7 shrink-0 items-center justify-center transition-colors",
    isGame
      ? "game-nav-btn !p-0 !min-w-0 !min-h-0"
      : "rounded-full bg-white text-black hover:bg-black hover:text-white shadow-elevation-2 dark:rounded-none dark:border dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2] dark:hover:text-black dark:shadow-none"
  );

  const codeClass = cn(
    "flex-1 break-all px-2 py-1 font-mono text-xs sm:px-3 sm:text-sm",
    isGame
      ? "rounded bg-white/10 text-white/80"
      : "rounded bg-secondary text-muted-foreground dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
  );

  // Voting participation
  const votes = action.votes || [];
  const ccVotes = action.ccVotes || [];
  const drepVotes = votes.filter(v => v.voterType === "DRep" || (!v.voterType && v.drepId));
  const spoVotes = votes.filter(v => v.voterType === "SPO");
  const actionVoteData = getVoteDataPresence(action);
  const eligibleRoles = getEligibleRoles(action.type, action.threshold, actionVoteData);

  const idFields = [
    { label: tProposal("governanceActionId"), value: action.proposalId, id: "proposalId" },
    { label: tProposal("legacyGovActionId"), value: action.hash?.replace(/:/g, '#'), id: "hash" },
    { label: tProposal("transactionHash"), value: action.txHash, id: "txHash" },
  ];

  return (
    <div className="space-y-4">
      {/* Voting Participation Metrics */}
      <div className={cardClass}>
        <label className={cn(
          "mb-3 block text-sm font-semibold sm:text-base",
          isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
        )}>
          {tProposal("votingParticipation")}
        </label>
        <div className={cn(
          "overflow-hidden",
          isGame
            ? "rounded border border-white/30"
            : "rounded-lg border border-border/50 dark:border-[#0bd1a2]/50"
        )}>
          <table className="w-full">
            <tbody>
              {eligibleRoles.includes("DRep") && (
                <tr className={cn(
                  "border-b last:border-b-0",
                  isGame ? "border-white/30" : "border-border/50 dark:border-[#0bd1a2]/50"
                )}>
                  <td className={cn("px-3 py-2.5 text-sm", isGame ? "text-white/80" : "text-muted-foreground dark:text-[#0bd1a2]/80")}>
                    {tVoting("dreps")}
                  </td>
                  <td className={cn("px-3 py-2.5 text-sm font-semibold text-right", isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]")}>
                    {drepVotes.length.toLocaleString()} {tProposal("voted")}
                  </td>
                </tr>
              )}
              {eligibleRoles.includes("SPO") && (
                <tr className={cn(
                  "border-b last:border-b-0",
                  isGame ? "border-white/30" : "border-border/50 dark:border-[#0bd1a2]/50"
                )}>
                  <td className={cn("px-3 py-2.5 text-sm", isGame ? "text-white/80" : "text-muted-foreground dark:text-[#0bd1a2]/80")}>
                    {tVoting("spos")}
                  </td>
                  <td className={cn("px-3 py-2.5 text-sm font-semibold text-right", isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]")}>
                    {spoVotes.length.toLocaleString()} {tProposal("voted")}
                  </td>
                </tr>
              )}
              {eligibleRoles.includes("CC") && (
                <tr className="last:border-b-0">
                  <td className={cn("px-3 py-2.5 text-sm", isGame ? "text-white/80" : "text-muted-foreground dark:text-[#0bd1a2]/80")}>
                    {tProposal("ccMembers")}
                  </td>
                  <td className={cn("px-3 py-2.5 text-sm font-semibold text-right", isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]")}>
                    {ccVotes.length.toLocaleString()} {tProposal("voted")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ID fields */}
      {idFields.map((field) => (
        <div key={field.id} className={cardClass}>
          <label className={cn(
            "mb-3 block text-sm font-semibold sm:text-base",
            isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
          )}>
            {field.label}
          </label>
          <div className="flex items-start gap-2">
            <code className={codeClass}>
              {field.value}
            </code>
            <button
              onClick={() => handleCopy(field.value || "", field.id)}
              className={copyBtnClass}
              aria-label={`Copy ${field.label}`}
            >
              {copiedId === field.id ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
