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
  votedAt: string;
}

/**
 * Detailed governance action with full description and vote records
 * Matches the API response from /proposal/:id
 */
export interface GovernanceActionDetail extends GovernanceAction {
  description?: string;
  rationale?: string;
  votes?: VoteRecord[]; // DRep and SPO votes
  ccVotes?: VoteRecord[]; // Constitutional Committee votes
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
  | "Expired"
  | "Approved"
  | "Not approved";

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
