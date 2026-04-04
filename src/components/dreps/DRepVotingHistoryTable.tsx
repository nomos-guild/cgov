import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate, getVoteBadgeClass, toVoteRecord, truncateId } from "@/lib/drepFormatters";
import { VotingRationaleModal } from "@/components/VotingRationaleModal";
import type { VoteRecord } from "@/types/governance";
import type { DRepVoteRecord } from "@/types/drep";

/** Display item that works for both voted and not-voted proposals */
export interface VotingDisplayItem {
  proposalId: string;
  proposalTitle: string;
  proposalType: string | null;
  vote: "Yes" | "No" | "Abstain" | null;
  votedAt: string | null;
  txHash: string;
  rationale: string | null;
  anchorUrl: string | null;
  votingPower: string | null;
  votingPowerAda: number;
  /** Previous vote (only set for vote-change items) */
  previousVote?: "Yes" | "No" | "Abstain";
  previousVotedAt?: string | null;
}

export type VoteFilter = "voted" | "not_voted" | "all" | "changed";

export interface VotingHistoryTableProps {
  items: VotingDisplayItem[];
  drepId: string;
  drepName: string;
  isGame: boolean;
  isLight: boolean;
  isLoading: boolean;
  locale: string;
  labels: {
    empty: string;
    proposal: string;
    type: string;
    vote: string;
    votingPower: string;
    date: string;
    rationale: string;
    view: string;
    unknown: string;
    yes: string;
    no: string;
    abstain: string;
    notVoted: string;
  };
}

export function VotingHistoryTable({ items, drepId, drepName, isGame, isLight, isLoading, locale, labels }: VotingHistoryTableProps) {
  const [selectedVote, setSelectedVote] = useState<VoteRecord | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {labels.empty}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={cn(
              "border-b text-left",
              isGame ? "border-white/10 text-white/60" : isLight ? "border-gray-200 text-muted-foreground" : "border-[#0bd1a2]/30 text-[#0bd1a2]/60"
            )}>
              <th className="py-3 px-2 font-medium">{labels.proposal}</th>
              <th className="py-3 px-2 font-medium hidden sm:table-cell">{labels.type}</th>
              <th className="py-3 px-2 font-medium">{labels.vote}</th>
              <th className="py-3 px-2 font-medium">{labels.date}</th>
              <th className="py-3 px-2 font-medium hidden sm:table-cell">{labels.rationale}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const hasRationale = item.rationale != null && item.rationale.trim().length > 0;
              const isNotVoted = item.vote === null;
              const hasVoteChange = !!item.previousVote;
              return (
                <tr
                  key={`${item.proposalId}-${item.txHash}`}
                  className={cn(
                    "border-b transition-colors",
                    isGame
                      ? "border-white/5 hover:bg-white/5"
                      : isLight
                      ? "border-gray-100 hover:bg-gray-50"
                      : "border-[#0bd1a2]/10 hover:bg-[#0bd1a2]/5"
                  )}
                >
                  <td className="py-3 px-2">
                    <Link
                      href={`/governance/${encodeURIComponent(item.proposalId)}`}
                      className={cn(
                        "hover:underline font-medium",
                        isGame ? "text-white" : isLight ? "text-primary" : "text-[#0bd1a2]"
                      )}
                    >
                      {item.proposalTitle || truncateId(item.proposalId)}
                    </Link>
                  </td>
                  <td className="py-3 px-2 hidden sm:table-cell">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      isGame ? "bg-white/10 text-white/70" : isLight ? "bg-gray-100 text-muted-foreground" : "bg-[#0bd1a2]/10 text-[#0bd1a2]/70"
                    )}>
                      {item.proposalType || labels.unknown}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    {isNotVoted ? (
                      <span className={cn(
                        "text-xs px-2 py-1 font-medium",
                        isGame ? "rounded-full text-white/30" : isLight ? "rounded-full text-muted-foreground/50" : "rounded-none text-[#0bd1a2]/30"
                      )}>
                        --
                      </span>
                    ) : hasVoteChange ? (
                      <span className="inline-flex items-center gap-1">
                        <span className={cn(
                          "text-xs px-2 py-1 font-medium opacity-50 line-through",
                          isGame ? "rounded-full" : isLight ? "rounded-full" : "rounded-none",
                          getVoteBadgeClass(item.previousVote!, isGame, isLight)
                        )}>
                          {item.previousVote === "Yes" ? labels.yes : item.previousVote === "No" ? labels.no : labels.abstain}
                        </span>
                        <span className={cn(
                          "text-xs",
                          isGame ? "text-white/40" : isLight ? "text-muted-foreground/50" : "text-[#0bd1a2]/40"
                        )}>→</span>
                        <span className={cn(
                          "text-xs px-2 py-1 font-medium",
                          isGame ? "rounded-full" : isLight ? "rounded-full" : "rounded-none",
                          getVoteBadgeClass(item.vote!, isGame, isLight)
                        )}>
                          {item.vote === "Yes" ? labels.yes : item.vote === "No" ? labels.no : labels.abstain}
                        </span>
                      </span>
                    ) : (
                      <span className={cn(
                        "text-xs px-2 py-1 font-medium",
                        isGame ? "rounded-full" : isLight ? "rounded-full" : "rounded-none",
                        getVoteBadgeClass(item.vote!, isGame, isLight)
                      )}>
                        {item.vote === "Yes" ? labels.yes : item.vote === "No" ? labels.no : labels.abstain}
                      </span>
                    )}
                  </td>
                  <td className={cn(
                    "py-3 px-2",
                    isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                  )}>
                    {isNotVoted ? "--" : formatDate(item.votedAt, locale)}
                  </td>
                  <td className="py-3 px-2 hidden sm:table-cell">
                    {hasRationale && !isNotVoted ? (
                      <button
                        onClick={() => setSelectedVote(toVoteRecord(item as DRepVoteRecord, drepId, drepName))}
                        className={cn(
                          "text-xs font-medium px-2.5 py-1 transition-colors",
                          isGame
                            ? "game-nav-btn-sm"
                            : isLight
                            ? "rounded-md bg-white text-black shadow-elevation-1 hover:bg-black hover:text-white"
                            : "rounded-none border border-[#0bd1a2]/40 text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
                        )}
                      >
                        {labels.view}
                      </button>
                    ) : (
                      <span className={isGame ? "text-white/30" : isLight ? "text-muted-foreground/50" : "text-[#0bd1a2]/30"}>--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <VotingRationaleModal
        vote={selectedVote}
        open={selectedVote !== null}
        onOpenChange={(open) => { if (!open) setSelectedVote(null); }}
      />
    </>
  );
}
