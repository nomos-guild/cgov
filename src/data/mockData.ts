import type { GovernanceAction, GovernanceActionDetail, VoteRecord } from "@/types/governance";

export const mockGovernanceActions: GovernanceAction[] = [
  {
    hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855abc123",
    title: "Treasury Withdrawal for Development Fund",
    type: "Treasury",
    status: "Active",
    constitutionality: "Constitutional",
    drepYesPercent: 65.4,
    drepNoPercent: 34.6,
    drepYesAda: "12500000",
    drepNoAda: "6620000",
    spoYesPercent: 58.2,
    spoNoPercent: 41.8,
    spoYesAda: "8900000",
    spoNoAda: "6400000",
    totalYes: 1247,
    totalNo: 658,
    totalAbstain: 95,
    submissionEpoch: 450,
    expiryEpoch: 456,
  },
  {
    hash: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3",
    title: "Protocol Parameter Update - Transaction Fee",
    type: "Info",
    status: "Ratified",
    constitutionality: "Constitutional",
    drepYesPercent: 78.9,
    drepNoPercent: 21.1,
    drepYesAda: "18750000",
    drepNoAda: "5020000",
    spoYesPercent: 82.5,
    spoNoPercent: 17.5,
    spoYesAda: "16200000",
    spoNoAda: "3440000",
    totalYes: 1889,
    totalNo: 504,
    totalAbstain: 107,
    submissionEpoch: 445,
    expiryEpoch: 451,
  },
  {
    hash: "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4",
    title: "New Constitution Proposal",
    type: "Constitution",
    status: "Active",
    constitutionality: "Constitutional",
    drepYesPercent: 52.3,
    drepNoPercent: 47.7,
    drepYesAda: "9840000",
    drepNoAda: "8970000",
    spoYesPercent: 48.6,
    spoNoPercent: 51.4,
    spoYesAda: "7650000",
    spoNoAda: "8090000",
    totalYes: 987,
    totalNo: 901,
    totalAbstain: 112,
    submissionEpoch: 452,
    expiryEpoch: 458,
  },
  {
    hash: "c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5",
    title: "Info Action - Network Upgrade Notification",
    type: "Info",
    status: "Approved",
    constitutionality: "Constitutional",
    drepYesPercent: 91.2,
    drepNoPercent: 8.8,
    drepYesAda: "21500000",
    drepNoAda: "2070000",
    totalYes: 2145,
    totalNo: 207,
    totalAbstain: 48,
    submissionEpoch: 448,
    expiryEpoch: 454,
  },
  {
    hash: "d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6",
    title: "Treasury Withdrawal for Marketing Campaign",
    type: "Treasury",
    status: "Expired",
    constitutionality: "Constitutional",
    drepYesPercent: 42.7,
    drepNoPercent: 57.3,
    drepYesAda: "6540000",
    drepNoAda: "8770000",
    spoYesPercent: 39.4,
    spoNoPercent: 60.6,
    spoYesAda: "5230000",
    spoNoAda: "8050000",
    totalYes: 654,
    totalNo: 877,
    totalAbstain: 169,
    submissionEpoch: 440,
    expiryEpoch: 446,
  },
  {
    hash: "e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7",
    title: "Constitutional Committee Update",
    type: "Constitution",
    status: "Not approved",
    constitutionality: "Unconstitutional",
    drepYesPercent: 28.5,
    drepNoPercent: 71.5,
    drepYesAda: "4120000",
    drepNoAda: "10340000",
    spoYesPercent: 31.2,
    spoNoPercent: 68.8,
    spoYesAda: "4780000",
    spoNoAda: "10530000",
    totalYes: 412,
    totalNo: 1034,
    totalAbstain: 154,
    submissionEpoch: 449,
    expiryEpoch: 455,
  },
  {
    hash: "f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8",
    title: "Info Action - Quarterly Development Report",
    type: "Info",
    status: "Active",
    constitutionality: "Constitutional",
    drepYesPercent: 85.6,
    drepNoPercent: 14.4,
    drepYesAda: "19870000",
    drepNoAda: "3340000",
    totalYes: 1987,
    totalNo: 334,
    totalAbstain: 79,
    submissionEpoch: 451,
    expiryEpoch: 457,
  },
];

const generateMockVotes = (count: number): VoteRecord[] => {
  const votes: VoteRecord[] = [];
  const voteTypes: ("Yes" | "No" | "Abstain")[] = ["Yes", "No", "Abstain"];

  for (let i = 0; i < count; i++) {
    const voteType = voteTypes[Math.floor(Math.random() * voteTypes.length)];
    votes.push({
      drepId: `drep1${Math.random().toString(36).substring(2, 15)}`,
      drepName: `DRep ${i + 1}`,
      vote: voteType,
      votingPower: `${(Math.random() * 100000).toFixed(0)}`,
      votingPowerAda: Math.random() * 100000,
      anchorUrl: Math.random() > 0.5 ? `ipfs://Qm${Math.random().toString(36).substring(2, 15)}` : undefined,
      anchorHash: Math.random() > 0.5 ? `hash${Math.random().toString(36).substring(2, 15)}` : undefined,
      votedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return votes.sort((a, b) => b.votingPowerAda - a.votingPowerAda);
};

export const mockDetailedActions: GovernanceActionDetail[] = [
  {
    ...mockGovernanceActions[0],
    description: "This governance action proposes to withdraw 50,000,000 ADA from the treasury to fund continued development of core infrastructure and ecosystem tools. The funds will be allocated across multiple development teams working on critical projects.",
    rationale: "The Cardano ecosystem requires sustained investment in infrastructure development to maintain competitiveness and deliver on roadmap commitments. This proposal outlines a comprehensive funding plan for Q1-Q2 development efforts.",
    votes: generateMockVotes(150),
  },
  {
    ...mockGovernanceActions[2],
    description: "A proposal to ratify a new constitution that updates governance procedures and establishes clearer guidelines for future governance actions. This represents a significant evolution in Cardano's on-chain governance framework.",
    rationale: "The current constitutional framework requires updates to address emerging governance challenges and provide more detailed guidance on decision-making processes. This new constitution incorporates community feedback gathered over the past six months.",
    votes: generateMockVotes(200),
  },
];

export const getActionByHash = (hash: string): GovernanceActionDetail | undefined => {
  const detailed = mockDetailedActions.find((a) => a.hash === hash);
  if (detailed) return detailed;

  const basic = mockGovernanceActions.find((a) => a.hash === hash);
  if (basic) {
    return {
      ...basic,
      description: "No detailed description available.",
      rationale: "No rationale provided.",
      votes: generateMockVotes(50),
    };
  }

  return undefined;
};
