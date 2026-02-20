/**
 * DRep Dashboard Types
 * Types for DRep listing and profile pages
 */

/**
 * Pagination metadata for paginated responses
 */
export interface DRepPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/**
 * DRep summary for listing page
 */
export interface DRepSummary {
  drepId: string;
  name: string | null;
  iconUrl: string | null;
  /** Voting power in lovelace (as string for BigInt) */
  votingPower: string;
  /** Voting power in ADA */
  votingPowerAda: number;
  /** Total number of votes cast by this DRep */
  totalVotesCast: number;
  /** Number of wallets delegated to this DRep */
  delegatorCount: number | null;
}

/**
 * Aggregate DRep statistics for the overview
 */
export interface DRepStats {
  /** Total number of DReps */
  totalDReps: number;
  /** Total delegated voting power in lovelace (as string) */
  totalDelegatedLovelace: string;
  /** Total delegated voting power in ADA */
  totalDelegatedAda: number;
  /** Total number of votes cast by all DReps */
  totalVotesCast: number;
  /** Number of DReps who have cast at least one vote */
  activeDReps: number;
}

/**
 * Vote breakdown counts
 */
export interface VoteBreakdown {
  yes: number;
  no: number;
  abstain: number;
}

/**
 * Detailed DRep profile
 */
export interface DRepDetail {
  drepId: string;
  name: string | null;
  iconUrl: string | null;
  paymentAddr: string | null;
  /** Voting power in lovelace */
  votingPower: string;
  /** Voting power in ADA */
  votingPowerAda: number;
  /** Total number of votes cast */
  totalVotesCast: number;
  /** Breakdown of votes by type */
  voteBreakdown: VoteBreakdown;
  /** Number of votes with rationale provided */
  rationalesProvided: number;
  /** Percentage of proposals this DRep has voted on (0-100) */
  proposalParticipationPercent: number;
  /** Number of wallets delegated to this DRep */
  delegatorCount: number | null;
  /** Epoch when DRep registered */
  registeredEpoch: number | null;
  /** ISO date string of registration epoch start */
  registeredDate: string | null;
}

/**
 * Single vote record in DRep voting history
 */
export interface DRepVoteRecord {
  /** Proposal ID */
  proposalId: string;
  /** Proposal title */
  proposalTitle: string;
  /** Governance action type */
  proposalType: string | null;
  /** Vote cast (Yes, No, Abstain) */
  vote: "Yes" | "No" | "Abstain";
  /** Voting power at time of vote (lovelace as string) */
  votingPower: string | null;
  /** Voting power in ADA */
  votingPowerAda: number;
  /** Vote rationale text */
  rationale: string | null;
  /** Anchor URL for rationale */
  anchorUrl: string | null;
  /** Timestamp when vote was cast */
  votedAt: string | null;
  /** Transaction hash */
  txHash: string;
}

/**
 * Single data point in DRep delegation history time series
 */
export interface DRepHistoryDataPoint {
  epoch: number;
  date: string | null;
  delegatorCount: number;
  votingPower: string;
  votingPowerAda: number;
}

/**
 * Response for DRep history endpoint
 */
export interface DRepHistoryResponse {
  drepId: string;
  history: DRepHistoryDataPoint[];
}

/**
 * Response for DRep list endpoint
 */
export interface DRepListResponse {
  dreps: DRepSummary[];
  pagination: DRepPagination;
}

/**
 * Response for DRep votes endpoint
 */
export interface DRepVotesResponse {
  drepId: string;
  votes: DRepVoteRecord[];
  pagination: DRepPagination;
}

/**
 * Sort options for DRep list
 */
export type DRepSortBy = "votingPower" | "name" | "totalVotes";
export type SortOrder = "asc" | "desc";

/**
 * Single epoch data point for DRep power concentration history
 */
export interface ConcentrationHistoryPoint {
  epoch: number;
  top10VpPct: number;
  top20VpPct: number;
  top50VpPct: number;
  top10DelPct: number;
  top20DelPct: number;
  top50DelPct: number;
  top10VpAda: number;
  top20VpAda: number;
  top50VpAda: number;
  top10Del: number;
  top20Del: number;
  top50Del: number;
  [key: string]: string | number;
}
