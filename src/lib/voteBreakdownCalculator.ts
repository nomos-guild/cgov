import type {
  VoteBreakdown,
  GovernanceActionTypeCode,
} from "@/types/governance";

const EPOCH_534_THRESHOLD = 534;

/**
 * Calculated vote totals for legend display (legacy grouped format)
 */
export interface CalculatedVoteTotals {
  yes: number;
  no: number;
  abstain: number;
  inactive?: number; // DRep only
  notCounted?: number; // SPO old formula only
}

/**
 * Excluded items breakdown for separate display
 */
export interface ExcludedBreakdown {
  activeAbstain: number;
  alwaysAbstain: number;
  inactive?: number; // DRep only
  total: number;
}

/**
 * Donut chart segment values in ADA
 */
export interface DonutSegmentValues {
  yes: number; // activeYes
  no: number; // activeNo
  alwaysNoConfidence: number;
  notVoted: number;
  excluded: number; // activeAbstain + alwaysAbstain + inactive
}

/**
 * Segment data for VoteProgress component
 */
export interface VoteSegment {
  type: string;
  percent: number;
  value: number;
  color: string;
  label: string;
}

/**
 * Segment colors
 */
export const SEGMENT_COLORS = {
  yes: "#22C55E", // Green
  no: "#8C200B", // Brown (rgb(140, 32, 11))
  alwaysNoConfidenceYes: "#22C55E", // Green (for NO_CONFIDENCE actions - counts as Yes)
  alwaysNoConfidenceNo: "#000000", // Black (for other actions - counts as No)
  notVoted: "#D1D5DB", // Neutral gray - pending votes, not yet decided
  excluded: "#9CA3AF", // Gray
};

/**
 * Convert lovelace string to ADA number
 */
function lovelaceToAda(lovelace: string | undefined | null): number {
  if (!lovelace) return 0;
  return parseInt(lovelace, 10) / 1_000_000;
}

/**
 * Calculate donut chart segment values from breakdown
 * @param breakdown - Vote breakdown data
 * @param includeInactive - Whether to include inactive stake (false for SPO)
 * @param totalVotePowerLovelace - Optional total vote power in lovelace to calculate notVoted if missing
 */
export function calculateDonutSegments(
  breakdown: VoteBreakdown,
  includeInactive: boolean = true, // false for SPO
  totalVotePowerLovelace?: string
): DonutSegmentValues {
  const activeYes = lovelaceToAda(breakdown.activeYes);
  const activeNo = lovelaceToAda(breakdown.activeNo);
  const activeAbstain = lovelaceToAda(breakdown.activeAbstain);
  const alwaysAbstain = lovelaceToAda(breakdown.alwaysAbstain);
  const alwaysNoConfidence = lovelaceToAda(breakdown.alwaysNoConfidence);
  const inactive = includeInactive ? lovelaceToAda(breakdown.inactive) : 0;

  // Calculate notVoted: use provided value, or calculate from total if available
  let notVoted = lovelaceToAda(breakdown.notVoted);

  // If notVoted is 0 or missing and we have total vote power, calculate it
  if (notVoted === 0 && totalVotePowerLovelace) {
    const totalVotePower = lovelaceToAda(totalVotePowerLovelace);
    const votedSum = activeYes + activeNo + activeAbstain + alwaysAbstain + alwaysNoConfidence + inactive;
    notVoted = Math.max(0, totalVotePower - votedSum);
  }

  return {
    yes: activeYes,
    no: activeNo,
    alwaysNoConfidence,
    notVoted,
    excluded: activeAbstain + alwaysAbstain + inactive,
  };
}

/**
 * Calculate DRep legend totals based on action type
 */
export function calculateDrepLegendTotals(
  breakdown: VoteBreakdown,
  actionType: GovernanceActionTypeCode
): CalculatedVoteTotals {
  const activeYes = lovelaceToAda(breakdown.activeYes);
  const activeNo = lovelaceToAda(breakdown.activeNo);
  const activeAbstain = lovelaceToAda(breakdown.activeAbstain);
  const alwaysAbstain = lovelaceToAda(breakdown.alwaysAbstain);
  const alwaysNoConfidence = lovelaceToAda(breakdown.alwaysNoConfidence);
  const inactive = lovelaceToAda(breakdown.inactive);
  const notVoted = lovelaceToAda(breakdown.notVoted);

  if (actionType === "NO_CONFIDENCE") {
    return {
      yes: activeYes + alwaysNoConfidence,
      no: activeNo + notVoted,
      abstain: activeAbstain + alwaysAbstain,
      inactive: inactive,
    };
  }

  // Other actions (including HARD_FORK_INITIATION for DRep)
  return {
    yes: activeYes,
    no: activeNo + alwaysNoConfidence + notVoted,
    abstain: activeAbstain + alwaysAbstain,
    inactive: inactive,
  };
}

/**
 * Calculate SPO legend totals based on action type and epoch
 */
export function calculateSpoLegendTotals(
  breakdown: VoteBreakdown,
  actionType: GovernanceActionTypeCode,
  submissionEpoch: number
): CalculatedVoteTotals {
  const activeYes = lovelaceToAda(breakdown.activeYes);
  const activeNo = lovelaceToAda(breakdown.activeNo);
  const activeAbstain = lovelaceToAda(breakdown.activeAbstain);
  const alwaysAbstain = lovelaceToAda(breakdown.alwaysAbstain);
  const alwaysNoConfidence = lovelaceToAda(breakdown.alwaysNoConfidence);
  const notVoted = lovelaceToAda(breakdown.notVoted);

  // Old formula for epoch < 534
  if (submissionEpoch < EPOCH_534_THRESHOLD) {
    return {
      yes: activeYes,
      no: activeNo + alwaysNoConfidence,
      abstain: activeAbstain + alwaysAbstain,
      notCounted: notVoted, // Excluded from calculation
    };
  }

  // New formula for epoch >= 534
  if (actionType === "HARD_FORK_INITIATION") {
    return {
      yes: activeYes,
      no: activeNo + alwaysNoConfidence + alwaysAbstain + notVoted,
      abstain: activeAbstain, // Explicit abstain only
    };
  }

  if (actionType === "NO_CONFIDENCE") {
    return {
      yes: activeYes + alwaysNoConfidence,
      no: activeNo + notVoted,
      abstain: activeAbstain + alwaysAbstain,
    };
  }

  // Other actions (epoch >= 534)
  return {
    yes: activeYes,
    no: activeNo + alwaysNoConfidence + notVoted,
    abstain: activeAbstain + alwaysAbstain,
  };
}

/**
 * Determine AlwaysNoConfidence segment color based on action type
 */
export function getAlwaysNoConfidenceColor(
  actionType: GovernanceActionTypeCode
): string {
  return actionType === "NO_CONFIDENCE"
    ? SEGMENT_COLORS.alwaysNoConfidenceYes
    : SEGMENT_COLORS.alwaysNoConfidenceNo;
}

/**
 * Map governance action type string to code
 */
export function getGovernanceActionTypeCode(
  type: string | undefined
): GovernanceActionTypeCode {
  if (!type) return "OTHER";

  const normalized = type.toLowerCase().replace(/[\s_-]/g, "");

  if (normalized.includes("noconfidence")) return "NO_CONFIDENCE";
  if (normalized.includes("hardfork")) return "HARD_FORK_INITIATION";

  return "OTHER";
}

/**
 * Build donut segments array for VoteProgress component
 * Only includes segments with values > 0 (for donut chart rendering)
 * @param breakdown - Vote breakdown data
 * @param actionType - Governance action type code
 * @param includeInactive - Whether to include inactive stake (false for SPO)
 * @param totalVotePowerLovelace - Optional total vote power in lovelace to calculate notVoted if missing
 */
export function buildDonutSegments(
  breakdown: VoteBreakdown,
  actionType: GovernanceActionTypeCode,
  includeInactive: boolean = true,
  totalVotePowerLovelace?: string
): VoteSegment[] {
  const segments = calculateDonutSegments(breakdown, includeInactive, totalVotePowerLovelace);

  // Calculate total excluding the "excluded" segment since it doesn't
  // impact ratification. The donut should show only ratification-impacting
  // segments summing to 100%.
  const total =
    segments.yes +
    segments.no +
    segments.alwaysNoConfidence +
    segments.notVoted;

  if (total === 0) return [];

  const alwaysNoConfidenceColor = getAlwaysNoConfidenceColor(actionType);

  const result: VoteSegment[] = [];

  if (segments.yes > 0) {
    result.push({
      type: "yes",
      percent: (segments.yes / total) * 100,
      value: segments.yes,
      color: SEGMENT_COLORS.yes,
      label: "Yes",
    });
  }

  if (segments.no > 0) {
    result.push({
      type: "no",
      percent: (segments.no / total) * 100,
      value: segments.no,
      color: SEGMENT_COLORS.no,
      label: "No",
    });
  }

  if (segments.alwaysNoConfidence > 0) {
    result.push({
      type: "alwaysNoConfidence",
      percent: (segments.alwaysNoConfidence / total) * 100,
      value: segments.alwaysNoConfidence,
      color: alwaysNoConfidenceColor,
      label: "ANC",
    });
  }

  if (segments.notVoted > 0) {
    result.push({
      type: "notVoted",
      percent: (segments.notVoted / total) * 100,
      value: segments.notVoted,
      color: SEGMENT_COLORS.notVoted,
      label: "Not Voted",
    });
  }

  // Excluded segment is intentionally not included in the donut chart
  // since it doesn't impact the ratification process. It's displayed
  // separately in the ExcludedBreakdownDisplay component.

  return result;
}

/**
 * Build legend segments array - always includes all categories (even with 0 values)
 * @param breakdown - Vote breakdown data
 * @param actionType - Governance action type code
 * @param includeInactive - Whether to include inactive stake (false for SPO)
 * @param totalVotePowerLovelace - Optional total vote power in lovelace to calculate notVoted if missing
 */
export function buildLegendSegments(
  breakdown: VoteBreakdown,
  actionType: GovernanceActionTypeCode,
  includeInactive: boolean = true,
  totalVotePowerLovelace?: string
): VoteSegment[] {
  const segments = calculateDonutSegments(breakdown, includeInactive, totalVotePowerLovelace);

  const total =
    segments.yes +
    segments.no +
    segments.alwaysNoConfidence +
    segments.notVoted;

  const alwaysNoConfidenceColor = getAlwaysNoConfidenceColor(actionType);

  // Always include all categories for legend display
  return [
    {
      type: "yes",
      percent: total > 0 ? (segments.yes / total) * 100 : 0,
      value: segments.yes,
      color: SEGMENT_COLORS.yes,
      label: "Yes",
    },
    {
      type: "no",
      percent: total > 0 ? (segments.no / total) * 100 : 0,
      value: segments.no,
      color: SEGMENT_COLORS.no,
      label: "No",
    },
    {
      type: "alwaysNoConfidence",
      percent: total > 0 ? (segments.alwaysNoConfidence / total) * 100 : 0,
      value: segments.alwaysNoConfidence,
      color: alwaysNoConfidenceColor,
      label: "ANC",
    },
    {
      type: "notVoted",
      percent: total > 0 ? (segments.notVoted / total) * 100 : 0,
      value: segments.notVoted,
      color: SEGMENT_COLORS.notVoted,
      label: "Not Voted",
    },
  ];
}

/**
 * Calculate excluded breakdown for separate display below the donut legend
 */
export function calculateExcludedBreakdown(
  breakdown: VoteBreakdown,
  includeInactive: boolean = true
): ExcludedBreakdown {
  const activeAbstain = lovelaceToAda(breakdown.activeAbstain);
  const alwaysAbstain = lovelaceToAda(breakdown.alwaysAbstain);
  const inactive = includeInactive ? lovelaceToAda(breakdown.inactive) : 0;
  const total = activeAbstain + alwaysAbstain + inactive;

  return {
    activeAbstain,
    alwaysAbstain,
    inactive: includeInactive ? inactive : undefined,
    total,
  };
}
