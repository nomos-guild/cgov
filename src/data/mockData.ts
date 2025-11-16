import type {
  GovernanceAction,
  GovernanceActionDetail,
  Vote,
  NCLData,
} from "@/types/governance";

export const mockGovernanceActions: GovernanceAction[] = [
  {
    id: "gov_action1x2z9kq7h4p2r6n5t8v0w3y6d9a2c5e7m4n8p2",
    txHash:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855abc123",
    certIndex: 0,
    title: "Treasury Withdrawal for Development Fund",
    type: "Treasury",
    status: "Active",
    constitutionality: "Constitutional",
    drep: {
      yesPercent: 65.4,
      noPercent: 34.6,
      abstainPercent: 0,
      yesAda: "12500000",
      noAda: "6620000",
      abstainAda: "0",
    },
    spo: {
      yesPercent: 58.2,
      noPercent: 41.8,
      abstainPercent: 0,
      yesAda: "8900000",
      noAda: "6400000",
      abstainAda: "0",
    },
    cc: {
      yesPercent: 60.0,
      noPercent: 40.0,
      abstainPercent: 0,
      yesCount: 4,
      noCount: 3,
      abstainCount: 0,
    },
    submissionEpoch: 450,
    expiryEpoch: 456,
  },
  {
    id: "gov_action1q9w8e7r6t5y4u3i2o1p0a9s8d7f6g5h4j3k2l1",
    txHash:
      "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3",
    certIndex: 1,
    title: "Protocol Parameter Update - Transaction Fee",
    type: "InfoAction",
    status: "Ratified",
    constitutionality: "Constitutional",
    drep: {
      yesPercent: 78.9,
      noPercent: 21.1,
      abstainPercent: 0,
      yesAda: "18750000",
      noAda: "5020000",
      abstainAda: "0",
    },
    spo: {
      yesPercent: 82.5,
      noPercent: 17.5,
      abstainPercent: 0,
      yesAda: "16200000",
      noAda: "3440000",
      abstainAda: "0",
    },
    cc: {
      yesPercent: 100.0,
      noPercent: 0.0,
      abstainPercent: 0,
      yesCount: 7,
      noCount: 0,
      abstainCount: 0,
    },
    submissionEpoch: 445,
    expiryEpoch: 451,
  },
  {
    id: "gov_action1m2n3b4v5c6x7z8l9k0j1h2g3f4d5s6a7p8o9i",
    txHash:
      "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4",
    certIndex: 2,
    title: "New Constitution Proposal",
    type: "NewConstitution",
    status: "Active",
    constitutionality: "Constitutional",
    drep: {
      yesPercent: 52.3,
      noPercent: 47.7,
      abstainPercent: 0,
      yesAda: "9840000",
      noAda: "8970000",
      abstainAda: "0",
    },
    spo: {
      yesPercent: 48.6,
      noPercent: 51.4,
      abstainPercent: 0,
      yesAda: "7650000",
      noAda: "8090000",
      abstainAda: "0",
    },
    cc: {
      yesPercent: 50.0,
      noPercent: 50.0,
      abstainPercent: 0,
      yesCount: 4,
      noCount: 3,
      abstainCount: 0,
    },
    submissionEpoch: 452,
    expiryEpoch: 458,
  },
  {
    id: "gov_action1a2s3d4f5g6h7j8k9l0q1w2e3r4t5y6u7i8o9p",
    txHash:
      "c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5",
    certIndex: 3,
    title: "Info Action - Network Upgrade Notification",
    type: "InfoAction",
    status: "Approved",
    constitutionality: "Constitutional",
    drep: {
      yesPercent: 91.2,
      noPercent: 8.8,
      abstainPercent: 0,
      yesAda: "21500000",
      noAda: "2070000",
      abstainAda: "0",
    },
    cc: {
      yesPercent: 80.0,
      noPercent: 20.0,
      abstainPercent: 0,
      yesCount: 6,
      noCount: 1,
      abstainCount: 0,
    },
    submissionEpoch: 448,
    expiryEpoch: 454,
  },
  {
    id: "gov_action1z9x8c7v6b5n4m3l2k1j0h9g8f7d6s5a4p3o2i",
    txHash:
      "d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6",
    certIndex: 4,
    title: "Treasury Withdrawal for Marketing Campaign",
    type: "Treasury",
    status: "Expired",
    constitutionality: "Constitutional",
    drep: {
      yesPercent: 42.7,
      noPercent: 57.3,
      abstainPercent: 0,
      yesAda: "6540000",
      noAda: "8770000",
      abstainAda: "0",
    },
    spo: {
      yesPercent: 39.4,
      noPercent: 60.6,
      abstainPercent: 0,
      yesAda: "5230000",
      noAda: "8050000",
      abstainAda: "0",
    },
    cc: {
      yesPercent: 33.0,
      noPercent: 67.0,
      abstainPercent: 0,
      yesCount: 2,
      noCount: 5,
      abstainCount: 0,
    },
    submissionEpoch: 440,
    expiryEpoch: 446,
  },
  {
    id: "gov_action1p0o9i8u7y6t5r4e3w2q1l0k9j8h7g6f5d4s3a",
    txHash:
      "e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7",
    certIndex: 5,
    title: "CC Update",
    type: "UpdateCommittee",
    status: "Not approved",
    constitutionality: "Unconstitutional",
    drep: {
      yesPercent: 28.5,
      noPercent: 71.5,
      abstainPercent: 0,
      yesAda: "4120000",
      noAda: "10340000",
      abstainAda: "0",
    },
    spo: {
      yesPercent: 31.2,
      noPercent: 68.8,
      abstainPercent: 0,
      yesAda: "4780000",
      noAda: "10530000",
      abstainAda: "0",
    },
    cc: {
      yesPercent: 20.0,
      noPercent: 80.0,
      abstainPercent: 0,
      yesCount: 1,
      noCount: 6,
      abstainCount: 0,
    },
    submissionEpoch: 449,
    expiryEpoch: 455,
  },
  {
    id: "gov_action1l2k3j4h5g6f7d8s9a0p1o2i3u4y5t6r7e8w9q",
    txHash:
      "f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8",
    certIndex: 6,
    title: "Info Action - Quarterly Development Report",
    type: "InfoAction",
    status: "Active",
    constitutionality: "Constitutional",
    drep: {
      yesPercent: 85.6,
      noPercent: 14.4,
      abstainPercent: 0,
      yesAda: "19870000",
      noAda: "3340000",
      abstainAda: "0",
    },
    cc: {
      yesPercent: 75.0,
      noPercent: 25.0,
      abstainPercent: 0,
      yesCount: 5,
      noCount: 2,
      abstainCount: 0,
    },
    submissionEpoch: 451,
    expiryEpoch: 457,
  },
];

const generateMockVotes = (count: number): Vote[] => {
  const votes: Vote[] = [];
  const voteTypes: ("Yes" | "No" | "Abstain")[] = ["Yes", "No", "Abstain"];

  for (let i = 0; i < count; i++) {
    const voteType = voteTypes[Math.floor(Math.random() * voteTypes.length)];
    const powerLovelace = Math.floor(Math.random() * 100000000);
    votes.push({
      voterType: "DRep",
      voterId: `drep1${Math.random().toString(36).substring(2, 15)}`,
      voterName: `DRep ${i + 1}`,
      vote: voteType,
      votingPower: `${powerLovelace}`,
      votingPowerAda: powerLovelace / 1_000_000,
      anchorUrl:
        Math.random() > 0.5
          ? `ipfs://Qm${Math.random().toString(36).substring(2, 15)}`
          : undefined,
      anchorHash:
        Math.random() > 0.5
          ? `hash${Math.random().toString(36).substring(2, 15)}`
          : undefined,
      votedAt: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
  }

  return votes.sort(
    (a, b) => (b.votingPowerAda || 0) - (a.votingPowerAda || 0)
  );
};

const generateMockCCVotes = (
  count: number,
  yesPercent: number,
  noPercent: number
): Vote[] => {
  const members: Vote[] = [];
  const total = count;
  const yesCount = Math.round(
    (yesPercent / (yesPercent + noPercent || 100)) * total
  );
  for (let i = 0; i < total; i++) {
    const yes = i < yesCount;
    members.push({
      voterType: "CC",
      voterId: `cc${Math.random().toString(36).substring(2, 8)}`,
      voterName: `CC Member ${i + 1}`,
      vote: yes ? "Yes" : "No",
      votedAt: new Date().toISOString(),
    });
  }
  return members;
};

export const mockDetailedActions: GovernanceActionDetail[] = [
  {
    ...mockGovernanceActions[0],
    description:
      "This governance action proposes to withdraw 50,000,000 ADA from the treasury to fund continued development of core infrastructure and ecosystem tools. The funds will be allocated across multiple development teams working on critical projects.",
    rationale:
      "The Cardano ecosystem requires sustained investment in infrastructure development to maintain competitiveness and deliver on roadmap commitments. This proposal outlines a comprehensive funding plan for Q1-Q2 development efforts.",
    votes: generateMockVotes(150),
    ccVotes: generateMockCCVotes(
      7,
      mockGovernanceActions[0].cc?.yesPercent || 0,
      mockGovernanceActions[0].cc?.noPercent || 0
    ),
  },
  {
    ...mockGovernanceActions[2],
    description:
      "A proposal to ratify a new constitution that updates governance procedures and establishes clearer guidelines for future governance actions. This represents a significant evolution in Cardano's on-chain governance framework.",
    rationale:
      "The current constitutional framework requires updates to address emerging governance challenges and provide more detailed guidance on decision-making processes. This new constitution incorporates community feedback gathered over the past six months.",
    votes: generateMockVotes(200),
    ccVotes: generateMockCCVotes(
      7,
      mockGovernanceActions[2].cc?.yesPercent || 0,
      mockGovernanceActions[2].cc?.noPercent || 0
    ),
  },
];

export const getActionByProposalId = (
  proposalId: string
): GovernanceActionDetail | undefined => {
  const detailed = mockDetailedActions.find((a) => a.id === proposalId);
  if (detailed) return detailed;

  const basic = mockGovernanceActions.find((a) => a.id === proposalId);
  if (basic) {
    return {
      ...basic,
      description: "No detailed description available.",
      rationale: "No rationale provided.",
      votes: generateMockVotes(50),
      ccVotes: generateMockCCVotes(
        7,
        basic.cc?.yesPercent || 0,
        basic.cc?.noPercent || 0
      ),
    };
  }

  return undefined;
};

export const mockNCLData: NCLData = {
  year: 2025,
  currentValue: 290000000,
  targetValue: 350000000,
};
