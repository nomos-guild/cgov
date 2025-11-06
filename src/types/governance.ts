export interface GovernanceAction {
  proposal_id: string;
  txhash: string;
  title: string;
  type: string;
  status: "Active" | "Ratified" | "Expired" | "Approved" | "Not approved";
  constitutionality: string;
  drepYesPercent: number;
  drepNoPercent: number;
  drepYesAda: string;
  drepNoAda: string;
  drepAbstainAda?: string;
  spoYesPercent?: number;
  spoNoPercent?: number;
  spoYesAda?: string;
  spoNoAda?: string;
  spoAbstainAda?: string;
  ccYesPercent?: number;
  ccNoPercent?: number;
  ccYesCount?: number;
  ccNoCount?: number;
  ccAbstainCount?: number;
  totalYes: number;
  totalNo: number;
  totalAbstain: number;
  submissionEpoch: number;
  expiryEpoch: number;
}

export interface VoteRecord {
  drepId: string;
  drepName: string;
  vote: "Yes" | "No" | "Abstain";
  votingPower: string;
  votingPowerAda: number;
  anchorUrl?: string;
  anchorHash?: string;
  voteTxHash?: string;
  votedAt: string;
}

export interface GovernanceActionDetail extends GovernanceAction {
  description?: string;
  rationale?: string;
  motivation?: string;
  references?: string;
  votes?: VoteRecord[];
}

export type GovernanceActionType = "All" | "Info" | "Treasury" | "Constitution";
export type VoteType = "All" | "Yes" | "No" | "Abstain";

export interface NCLData {
  year: number;
  currentValue: number;
  targetValue: number;
}
