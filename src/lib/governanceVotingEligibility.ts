import type { ProposalType, VoterType } from "@/types/governance";
import { PROPOSAL_TYPES } from "@/types/governance";

type RoleEligibility = Record<VoterType, boolean>;

const ELIGIBILITY: Record<ProposalType, RoleEligibility> = {
  NoConfidence: { SPO: true, DRep: true, CC: false },
  UpdateCommittee: { SPO: true, DRep: true, CC: false },
  NewConstitution: { SPO: false, DRep: true, CC: true },
  HardForkInitiation: { SPO: true, DRep: false, CC: true },
  ParameterChange: { SPO: false, DRep: true, CC: true },
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

export function canRoleVoteOnAction(type: ProposalType | string, role: VoterType): boolean {
  const matrix = getRoleMatrixForType(type);
  return matrix[role];
}

export function getEligibleRoles(type: ProposalType | string): VoterType[] {
  const matrix = getRoleMatrixForType(type);
  return (Object.keys(matrix) as VoterType[]).filter((role) => matrix[role]);
}

