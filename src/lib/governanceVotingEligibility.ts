import type { ProposalType, VoterType, GovernanceAction, VoteRecord } from "@/types/governance";
import { PROPOSAL_TYPES } from "@/types/governance";

type RoleEligibility = Record<VoterType, boolean>;
type ThresholdData = GovernanceAction["threshold"];

// Union type for actions that may or may not have vote records
type ActionWithOptionalVotes = GovernanceAction & {
  votes?: VoteRecord[];
  ccVotes?: VoteRecord[];
};

// Data that indicates a role has vote data from the API
type VoteDataPresence = {
  hasSpoData?: boolean;
  hasDrepData?: boolean;
  hasCcData?: boolean;
};

// Voter eligibility matrix per Conway Ledger formal specification (Fig. 42)
// See: docs/conway-ledger.pdf
const ELIGIBILITY: Record<ProposalType, RoleEligibility> = {
  NoConfidence: { SPO: true, DRep: true, CC: false },
  UpdateCommittee: { SPO: true, DRep: true, CC: false }, // DRep threshold: 67% (normal) or 60% (CC no-confidence state)
  NewConstitution: { SPO: false, DRep: true, CC: true },
  HardForkInitiation: { SPO: true, DRep: true, CC: true }, // All three bodies vote: CC (2/3), DRep (60%), SPO (51%)
  ParameterChange: { SPO: false, DRep: true, CC: true }, // DRep threshold: 67% (network/economic/technical) or 75% (governance)
  Treasury: { SPO: false, DRep: true, CC: true },
  InfoAction: { SPO: true, DRep: true, CC: true },
};

const DEFAULT_ROLE_MATRIX: RoleEligibility = { SPO: false, DRep: true, CC: false };

// Map human–readable governance action labels (as returned by the API / used
// in filters) to the internal ProposalType enum used by the eligibility matrix.
// This keeps the rest of the app free to use user–friendly strings while we
// still resolve to the correct eligibility row here.
const LABEL_TO_PROPOSAL_TYPE: Record<string, ProposalType> = {
  // Info / informational actions
  "Info Action": "InfoAction",
  InfoAction: "InfoAction",

  // Treasury withdrawals
  "Treasury Withdrawals": "Treasury",
  Treasury: "Treasury",

  // New constitution
  "New Constitution": "NewConstitution",
  NewConstitution: "NewConstitution",

  // Hard fork initiation
  "Hard Fork Initiation": "HardForkInitiation",
  HardForkInitiation: "HardForkInitiation",

  // Protocol parameter changes
  "Protocol Parameter Change": "ParameterChange",
  ParameterChange: "ParameterChange",

  // No confidence motions
  "No Confidence": "NoConfidence",
  NoConfidence: "NoConfidence",

  // Committee updates
  "Update Committee": "UpdateCommittee",
  UpdateCommittee: "UpdateCommittee",
};

function resolveProposalType(type: ProposalType | string | undefined | null): ProposalType | undefined {
  if (!type) return undefined;

  // If it's already a valid ProposalType, just use it directly.
  if (PROPOSAL_TYPES.includes(type as ProposalType)) {
    return type as ProposalType;
  }

  // Fallback to explicit label → ProposalType mapping.
  return LABEL_TO_PROPOSAL_TYPE[type] ?? undefined;
}

function getRoleMatrixForType(type: ProposalType | string): RoleEligibility {
  const resolved = resolveProposalType(type);
  if (resolved && ELIGIBILITY[resolved]) {
    return ELIGIBILITY[resolved];
  }
  return DEFAULT_ROLE_MATRIX;
}

/**
 * Check if a voter role can vote on a governance action.
 *
 * For most actions, eligibility is determined by the static matrix based on action type.
 * However, for security-critical protocol parameter changes, the API may return a valid
 * threshold even when the static matrix says the role cannot vote.
 *
 * Eligibility is determined by (in order of precedence):
 * 1. If threshold data shows a valid threshold for this role → can vote
 * 2. If vote data exists for this role (votes were cast) → can vote
 * 3. Fall back to static eligibility matrix
 */
export function canRoleVoteOnAction(
  type: ProposalType | string,
  role: VoterType,
  threshold?: ThresholdData,
  voteData?: VoteDataPresence
): boolean {
  // If threshold data is provided, check if this role has a valid threshold from the API.
  // This handles security-critical parameter changes where SPOs can vote even though
  // the static matrix says they can't for general ParameterChange actions.
  if (threshold) {
    const thresholdValue =
      role === "SPO" ? threshold.spoThreshold :
      role === "DRep" ? threshold.drepThreshold :
      role === "CC" ? threshold.ccThreshold :
      null;

    // If the API returned a valid threshold for this role, they can vote
    if (thresholdValue !== null && thresholdValue !== undefined) {
      return true;
    }
  }

  // If there's vote data for this role from the API, they can vote
  // (this handles cases where threshold is null but votes exist)
  if (voteData) {
    const hasData =
      role === "SPO" ? voteData.hasSpoData :
      role === "DRep" ? voteData.hasDrepData :
      role === "CC" ? voteData.hasCcData :
      false;

    if (hasData) {
      return true;
    }
  }

  // Fall back to static eligibility matrix
  const matrix = getRoleMatrixForType(type);
  return matrix[role];
}

export function getEligibleRoles(
  type: ProposalType | string,
  threshold?: ThresholdData,
  voteData?: VoteDataPresence
): VoterType[] {
  const roles: VoterType[] = ["DRep", "SPO", "CC"];
  return roles.filter((role) => canRoleVoteOnAction(type, role, threshold, voteData));
}

/**
 * Helper to create VoteDataPresence from a GovernanceAction or GovernanceActionDetail
 */
export function getVoteDataPresence(action: ActionWithOptionalVotes): VoteDataPresence {
  // Check if there are SPO votes in the votes array (only available on detail page)
  const hasSpoVotesInArray = action.votes?.some((v: VoteRecord) => v.voterType === "SPO") ?? false;
  // Check if there are DRep votes in the votes array
  const hasDrepVotesInArray = action.votes?.some((v: VoteRecord) => v.voterType === "DRep" || (!v.voterType && v.drepId)) ?? false;
  // Check if there are CC votes
  const hasCcVotesInArray = (action.ccVotes?.length ?? 0) > 0;

  return {
    // Only consider SPO data present if there's actual breakdown data, vote info object, or votes in array
    // Don't use spoYesPercent as it might be 0 for all proposals
    hasSpoData: !!(action.spoBreakdown || action.spo || hasSpoVotesInArray),
    hasDrepData: !!(action.drepBreakdown || action.drep || hasDrepVotesInArray),
    hasCcData: !!(action.cc || hasCcVotesInArray),
  };
}

