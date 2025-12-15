/**
 * Types for Cardano Governance API
 * Based on https://nomos-guild.github.io/cgov-api/swagger.json
 */

export interface Proposal {
  id: string;
  tx_hash: string;
  cert_index: number;
  governance_type: string;
}

export interface SignInRequest {
  walletAddress: string;
}

export interface SignInResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    walletAddress: string;
  };
}

export interface GetNCLDataResponse {
  year: number;
  currentValue: number;
  targetValue: number;
}

export interface ProposalListItem {
  proposalId: string; // Format: "txHash:certIndex"
  txHash: string;
  certIndex?: number; // Not in API response, needs to be parsed from proposalId
  type: string;
  title: string;
  status: ProposalStatus;
  constitutionality?: string;
  drep?: VotingInfo;
  spo?: VotingInfo;
  cc?: VotingInfo;
  submissionEpoch: number;
  expiryEpoch?: number;
}

export interface GetProposalListReponse {
  proposals: ProposalListItem[];
  total: number;
}

export type ProposalStatus = 
  | "Active"
  | "Ratified"
  | "Expired"
  | "Approved"
  | "Not approved";

export type ProposalType = 
  | "InfoAction"
  | "HardForkInitiation"
  | "ParameterChange"
  | "NoConfidence"
  | "UpdateCommittee"
  | "NewConstitution"
  | "Treasury";

export type VoteChoice = "Yes" | "No" | "Abstain";

export type VoterType = "DRep" | "SPO" | "CC";

export interface VotingInfo {
  yesPercent: number;
  noPercent: number;
  abstainPercent: number;
  yesAda?: string;
  noAda?: string;
  abstainAda?: string;
  yesCount?: number;
  noCount?: number;
  abstainCount?: number;
}

export interface Vote {
  voterType: VoterType;
  voterId: string;
  voterName?: string;
  vote: VoteChoice;
  votingPower?: string;
  anchorUrl?: string;
  anchorHash?: string;
  votedAt?: string;
}

export interface GetProposalInfoResponse {
  id: string;
  txHash: string;
  certIndex: number;
  type: ProposalType;
  title: string;
  status: ProposalStatus;
  constitutionality?: string;
  description?: string;
  rationale?: string;
  drep?: VotingInfo;
  spo?: VotingInfo;
  cc?: VotingInfo;
  submissionEpoch: number;
  expiryEpoch?: number;
  votes?: Vote[];
  ccVotes?: Vote[];
}

export interface ErrorResponse {
  error: string;
  message?: string;
}

export interface ProposalsQueryParams {
  count?: number; // 1-100, default 100
  page?: number; // If omitted, fetches all pages
  order?: "asc" | "desc"; // default "asc"
  [key: string]: string | number | undefined;
}

export interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

