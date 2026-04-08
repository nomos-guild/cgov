import type { VoteRecord } from "@/types/governance";
import type { DRepVoteRecord } from "@/types/drep";
import { getDRepIds } from "@meshsdk/core-cst";

/**
 * Format large numbers with appropriate suffix (K, M, B)
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format number with commas
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "--";
  return value.toLocaleString();
}

/**
 * Truncate DRep ID for display
 */
export function truncateId(id: string, startChars = 12, endChars = 8): string {
  if (id.length <= startChars + endChars + 3) return id;
  return `${id.slice(0, startChars)}...${id.slice(-endChars)}`;
}

/**
 * Format date for display using the active locale
 */
export function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get vote badge color
 */
export function getVoteBadgeClass(vote: "Yes" | "No" | "Abstain", isGame: boolean, isLight: boolean): string {
  if (isGame) {
    switch (vote) {
      case "Yes":
        return "bg-[#00ff66]/15 text-[#00ff66] border border-[#00ff66]/25";
      case "No":
        return "bg-[#ff3333]/15 text-[#ff3333] border border-[#ff3333]/25";
      case "Abstain":
        return "bg-white/10 text-white/60 border border-white/15";
    }
  }
  if (!isLight) {
    switch (vote) {
      case "Yes":
        return "bg-[#0bd1a2]/15 text-[#0bd1a2] border border-[#0bd1a2]/25";
      case "No":
        return "bg-red-900/30 text-red-400 border border-red-400/25";
      case "Abstain":
        return "bg-[#0bd1a2]/5 text-[#0bd1a2]/60 border border-[#0bd1a2]/15";
    }
  }
  switch (vote) {
    case "Yes":
      return "text-foreground border border-foreground/40 bg-foreground/5";
    case "No":
      return "text-foreground border border-foreground/40 bg-destructive/10";
    case "Abstain":
      return "text-foreground/60 border border-foreground/20 bg-transparent";
  }
}

/**
 * Convert a CIP-105 DRep ID to CIP-129 format.
 * CIP-129 is the format used by chain indexers (Koios, Cardanoscan)
 * and stored in the cgov backend database.
 */
export function toCip129DRepId(cip105Id: string): string {
  return getDRepIds(cip105Id).cip129;
}

/** Convert a DRepVoteRecord to the VoteRecord shape the rationale modal expects */
export function toVoteRecord(vote: DRepVoteRecord, drepId: string, drepName: string): VoteRecord {
  return {
    voterType: "DRep",
    voterId: drepId,
    voterName: drepName,
    drepId,
    drepName,
    vote: vote.vote,
    votingPower: vote.votingPower ?? "0",
    votingPowerAda: vote.votingPowerAda,
    anchorUrl: vote.anchorUrl ?? undefined,
    rationale: vote.rationale ?? undefined,
    votedAt: vote.votedAt ?? "",
    txHash: vote.txHash,
  };
}
