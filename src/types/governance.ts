/**
 * Vote info for DRep and SPO voters (ADA-based voting power)
 * API returns values in lovelace, frontend converts to ADA for display
 */
export interface GovernanceActionVoteInfo {
  yesPercent: number;
  noPercent: number;
  abstainPercent: number;
  // API returns lovelace values
  yesLovelace?: string;
  noLovelace?: string;
  abstainLovelace?: string;
  // Frontend uses ADA values for display
  yesAda?: number;
  noAda?: number;
  abstainAda?: number;
}

/**
 * Vote info for Constitutional Committee (count-based)
 */
export interface CCGovernanceActionVoteInfo {
  yesPercent: number;
  noPercent: number;
  abstainPercent: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  notVotedCount?: number;
  notVotedPercent?: number;
}

/**
 * Vote breakdown by delegation status for DRep and SPO voters.
 * All values are stringified lovelace amounts for BigInt precision.
 */
export interface VoteBreakdown {
  activeYes: string;
  activeNo: string;
  activeAbstain: string;
  alwaysAbstain: string;
  alwaysNoConfidence: string;
  inactive: string; // DRep only (SPO doesn't have inactive)
  notVoted: string;
}

/**
 * Governance action type code for vote calculation logic
 */
export type GovernanceActionTypeCode =
  | "NO_CONFIDENCE"
  | "HARD_FORK_INITIATION"
  | "OTHER";

/**
 * Raw voting power values by voter group and status as returned by the API.
 * All values are stringified lovelace amounts for maximum precision.
 * Note: API returns snake_case field names (converted from Prisma camelCase).
 */
export interface RawVotingPowerValues {
  // DRep voting power values
  drep_active_abstain_vote_power?: string;
  drep_active_no_vote_power?: string;
  drep_active_yes_vote_power?: string;
  drep_always_abstain_vote_power?: string;
  drep_always_no_confidence_power?: string;
  drep_inactive_vote_power?: string;
  drep_total_vote_power?: string;
  // SPO voting power values
  spo_active_abstain_vote_power?: string;
  spo_active_no_vote_power?: string;
  spo_active_yes_vote_power?: string;
  spo_always_abstain_vote_power?: string;
  spo_always_no_confidence_power?: string;
  spo_total_vote_power?: string;
}

/**
 * Main governance action interface
 * Matches the API response from /overview/proposals
 */
export interface GovernanceAction {
  // Identifiers
  hash: string; // Used for routing - typically proposalId
  proposalId?: string; // Cardano governance action ID (txHash:certIndex)
  txHash?: string; // Transaction hash

  // Content
  title: string;
  type: string; // Governance action type label
  withdrawalAmount?: string | null; // Treasury withdrawal amount in lovelace
  status: "Active" | "Ratified" | "Enacted" | "Expired" | "Closed";
  constitutionality: string;

  // DRep voting data (flattened for easy access)
  drepYesPercent: number;
  drepNoPercent: number;
  drepAbstainPercent?: number;
  drepYesAda: number;
  drepNoAda: number;
  drepAbstainAda?: number;

  // SPO voting data (optional - not all actions require SPO votes)
  spoYesPercent?: number;
  spoNoPercent?: number;
  spoAbstainPercent?: number;
  spoYesAda?: number;
  spoNoAda?: number;
  spoAbstainAda?: number;

  // CC voting data (optional - not all actions require CC votes)
  ccYesPercent?: number;
  ccNoPercent?: number;
  ccAbstainPercent?: number;
  ccYesCount?: number;
  ccNoCount?: number;
  ccAbstainCount?: number;

  // Vote totals (counts across all voter types)
  totalYes: number;
  totalNo: number;
  totalAbstain: number;

  // Epoch information
  submissionEpoch: number;
  expiryEpoch: number;

  // Thresholds for each voter group (optional, provided by backend)
  threshold?: {
    ccThreshold: number | null;
    drepThreshold: number | null;
    spoThreshold: number | null;
  };

  // Passing status for each voter group (optional, provided by backend)
  votingStatus?: {
    ccPassing: boolean | null;
    drepPassing: boolean | null;
    spoPassing: boolean | null;
  };

  // Raw API vote info objects (for advanced use)
  drep?: GovernanceActionVoteInfo;
  spo?: GovernanceActionVoteInfo;
  cc?: CCGovernanceActionVoteInfo;

  /**
   * Raw voting power values grouped by voter role and activity status.
   * These are kept as raw lovelace strings for advanced analytics and
   * precise display in the UI.
   */
  rawVotingPowerValues?: RawVotingPowerValues;

  /**
   * Vote breakdown by delegation status for DRep voters.
   * Used for detailed donut chart visualization.
   */
  drepBreakdown?: VoteBreakdown;

  /**
   * Vote breakdown by delegation status for SPO voters.
   * Used for detailed donut chart visualization.
   */
  spoBreakdown?: VoteBreakdown;

  /**
   * Governance action type code from API (e.g., "NoConfidence", "HardForkInitiation")
   */
  governanceActionType?: string;
}

/**
 * Individual vote record
 * Matches the API response for vote details
 */
export interface VoteRecord {
  voterType?: "DRep" | "SPO" | "CC";
  voterId?: string;
  voterName?: string;
  // Legacy fields for backwards compatibility
  drepId: string;
  drepName: string;
  vote: "Yes" | "No" | "Abstain";
  votingPower: string;
  votingPowerAda: number;
  anchorUrl?: string;
  anchorHash?: string;
  // Optional textual rationale provided directly by the backend (e.g. resolved from IPFS)
  rationale?: string;
  votedAt: string;
  // Transaction hash of the vote transaction
  txHash?: string;
  // True when the vote was frontloaded and chain has not yet confirmed it
  isPendingConfirmation?: boolean;
}

/**
 * Raw reference object as returned by some upstream APIs.
 * We only care about a human–readable label, a URI, and an optional type.
 */
export interface ProposalReferenceObject {
  uri?: string;
  label?: string;
  /**
   * Optional type of the reference, typically mapped from the upstream
   * `"@type"` field (e.g. "Other", "Constitution", etc).
   */
  type?: string;
  // Allow any extra metadata fields without typing them all out
  // (e.g. "@type", "canonical", etc.)
  [key: string]: unknown;
}

/**
 * Detailed governance action with full description and vote records
 * Matches the API response from /proposal/:id
 */
export interface GovernanceActionDetail extends GovernanceAction {
  description?: string;
  rationale?: string;
  /**
   * References/links from proposal metadata.
   *
   * Upstream may return an array of strings or objects like
   * { uri, label, "@type", ... }. The client code normalises these to a
   * consistent `ProposalReferenceObject` shape before rendering.
   */
  references?: ProposalReferenceObject[];
  votes?: VoteRecord[]; // DRep and SPO votes
  ccVotes?: VoteRecord[]; // Constitutional Committee votes
}

export interface ProposalSurveyResponse {
  linked: boolean;
  surveyRef: { txId: string; index: number } | null;
  linkValidation: {
    valid: boolean;
    errors: string[];
    linkedActions: string[];
  };
  phase: "open" | "closed" | "cancelled" | "unavailable";
  bundle: import("cip-179/domain").SurveyBundle | null;
}

export interface ProposalSurveyTallyResponse {
  phase: "open" | "finalization_pending" | "finalized" | "unsupported";
  artifact: import("cip-179/tally").TallyArtifact | null;
  errors: string[];
}

/**
 * Governance action type filter options
 */
export type GovernanceActionType =
  | "All"
  | "Info Action"
  | "Treasury Withdrawals"
  | "New Constitution"
  | "Hard Fork Initiation"
  | "Protocol Parameter Change"
  | "No Confidence"
  | "Update Committee";

/**
 * Vote type filter options
 */
export type VoteType = "All" | "Yes" | "No" | "Abstain";

/**
 * Overview summary data from API
 * Matches the API response from /overview
 */
export interface OverviewSummary {
  year: number;
  currentValue: number; // Active proposals
  targetValue: number; // Total proposals
  totalProposals: number;
  activeProposals: number;
  ratifiedProposals: number;
  enactedProposals: number;
  expiredProposals: number;
  closedProposals: number;
}

/**
 * Raw NCL data as returned by the legacy Cgov API client
 * Kept for backwards compatibility with older API wrappers
 */
export interface NCLData {
  year: number;
  currentValue: number;
  targetValue: number;
}

/**
 * NCL (Net Change Limit) data for treasury withdrawal tracking
 * Values are in lovelace (1 ADA = 1,000,000 lovelace)
 */
export interface NCLYearData {
  year: number;
  currentValue: string; // In lovelace (string for BigInt serialization)
  targetValue: string; // In lovelace (string for BigInt serialization)
  epoch: number;
  updatedAt: string;
}

/**
 * NCL data formatted for display (in ADA)
 */
export interface NCLDisplayData {
  year: number;
  currentValueAda: number;
  targetValueAda: number;
  percentUsed: number;
  epoch: number;
  updatedAt: string;
}

/**
 * High–level vote type used by UI components
 */
export type Vote = VoteRecord;

/**
 * Proposal status values used across the app
 */
export type ProposalStatus =
  | "Active"
  | "Ratified"
  | "Enacted"
  | "Expired"
  | "Closed";

/**
 * Proposal type values used across the app
 */
export type ProposalType =
  | "InfoAction"
  | "HardForkInitiation"
  | "ParameterChange"
  | "NoConfidence"
  | "UpdateCommittee"
  | "NewConstitution"
  | "Treasury";

/**
 * Convenience list of all proposal types, in a stable order
 */
export const PROPOSAL_TYPES: ProposalType[] = [
  "NoConfidence",
  "UpdateCommittee",
  "NewConstitution",
  "HardForkInitiation",
  "ParameterChange",
  "Treasury",
  "InfoAction",
];

/**
 * Voter roles
 */
export type VoterType = "DRep" | "SPO" | "CC";
