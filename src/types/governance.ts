export interface GovernanceAction {
  hash: string;
  title: string;
  type: string;
  status: "Active" | "Ratified" | "Expired" | "Approved" | "Not approved";
  constitutionality: string;
  drepYesPercent: number;
  drepNoPercent: number;
  drepYesAda: string;
  drepNoAda: string;
  spoYesPercent?: number;
  spoNoPercent?: number;
  spoYesAda?: string;
  spoNoAda?: string;
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
  votedAt: string;
}

export interface GovernanceActionDetail extends GovernanceAction {
  description?: string;
  rationale?: string;
  votes?: VoteRecord[];
}

export type GovernanceActionType = "All" | "Info" | "Treasury" | "Constitution";
export type VoteType = "All" | "Yes" | "No" | "Abstain";

export interface NCLData {
  year: number;
  currentValue: number;
  targetValue: number;
}
