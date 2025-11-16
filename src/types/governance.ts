// Proposal status from API
export type ProposalStatus = 
  | "Active"
  | "Ratified"
  | "Expired"
  | "Approved"
  | "Not approved";

// Proposal type from API
export type ProposalType = 
  | "InfoAction"
  | "HardForkInitiation"
  | "ParameterChange"
  | "NoConfidence"
  | "UpdateCommittee"
  | "NewConstitution"
  | "Treasury";

// Voter type
export type VoterType = "DRep" | "SPO" | "CC";

// Vote choice
export type VoteChoice = "Yes" | "No" | "Abstain";

// Unified voting info for DRep, SPO, and CC
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

// Individual vote record
export interface Vote {
  voterType: VoterType;
  voterId: string;
  voterName?: string;
  vote: VoteChoice;
  votingPower?: string; // Voting power in lovelace (string)
  votingPowerAda?: number; // Voting power in ADA (number, calculated for UI)
  anchorUrl?: string;
  anchorHash?: string;
  votedAt?: string;
}

// Basic governance action (list view)
export interface GovernanceAction {
  id: string;
  txHash: string;
  certIndex: number;
  type: ProposalType | string;
  title: string;
  status: ProposalStatus;
  constitutionality?: string;
  drep?: VotingInfo;
  spo?: VotingInfo;
  cc?: VotingInfo;
  submissionEpoch: number;
  expiryEpoch?: number;
}

// Detailed governance action (detail view)
export interface GovernanceActionDetail extends GovernanceAction {
  description?: string;
  rationale?: string;
  votes?: Vote[];
  ccVotes?: Vote[];
}

// Filter types for UI
export type GovernanceActionType = "All" | "Info" | "Treasury" | "Constitution";
export type VoteType = "All" | "Yes" | "No" | "Abstain";

export interface NCLData {
  year: number;
  currentValue: number;
  targetValue: number;
}
