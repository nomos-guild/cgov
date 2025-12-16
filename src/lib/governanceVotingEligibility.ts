import type { ProposalType, VoterType } from "@/types/governance";

type RoleEligibility = Record<VoterType, boolean>;

const ELIGIBILITY: Record<ProposalType, RoleEligibility> = {
  NoConfidence: { SPO: true, DRep: true, CC: false },
  UpdateCommittee: { SPO: true, DRep: true, CC: false },
  NewConstitution: { SPO: false, DRep: true, CC: true },
  HardForkInitiation: { SPO: true, DRep: true, CC: true },
  ParameterChange: { SPO: false, DRep: true, CC: true },
  Treasury: { SPO: false, DRep: true, CC: true },
  InfoAction: { SPO: true, DRep: true, CC: true },
};

const DEFAULT_ROLE_MATRIX: RoleEligibility = { SPO: false, DRep: true, CC: false };

export function canRoleVoteOnAction(type: ProposalType | string, role: VoterType): boolean {
  const matrix = ELIGIBILITY[type as ProposalType] ?? DEFAULT_ROLE_MATRIX;
  return matrix[role];
}

export function getEligibleRoles(type: ProposalType | string): VoterType[] {
  const matrix = ELIGIBILITY[type as ProposalType] ?? DEFAULT_ROLE_MATRIX;
  return (Object.keys(matrix) as VoterType[]).filter((role) => matrix[role]);
}

