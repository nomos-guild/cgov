/**
 * Cardano Conway-era Governance Rules
 * Extracted from: "Formal Specification of the Cardano Ledger for the Conway era"
 * Authors: Andre Knispel, William DeMeo, Joosep Jääger, Carlos Tomé Cortiñas (IOHK)
 * Reference: docs/conway-ledger.pdf
 */

// =============================================================================
// GOVERNANCE ACTION TYPES
// =============================================================================

export type GovernanceActionType =
  | "NoConfidence"
  | "UpdateCommittee"
  | "NewConstitution"
  | "TriggerHF" // Hard Fork Initiation
  | "ChangePParams" // Protocol Parameter Change
  | "TreasuryWdrl" // Treasury Withdrawal
  | "Info"; // Info Action

export const GOVERNANCE_ACTION_TYPES: Record<GovernanceActionType, {
  description: string;
  effect: string;
  requirements: string[];
}> = {
  NoConfidence: {
    description: "A motion to declare no confidence in the current Constitutional Committee",
    effect: "If ratified, moves the CC into a no-confidence state. New CC members cannot be added until an UpdateCommittee action passes.",
    requirements: [
      "Requires DRep and SPO approval",
      "CC does NOT vote on this action type",
      "DRep threshold: 67%",
      "SPO threshold: 51%"
    ]
  },
  UpdateCommittee: {
    description: "Add or remove members from the Constitutional Committee, or change the quorum threshold",
    effect: "Updates CC membership and/or changes the required quorum for CC decisions",
    requirements: [
      "Requires DRep and SPO approval",
      "CC does NOT vote on this action type",
      "DRep threshold varies: 67% (normal state) or 60% (if CC in no-confidence state)",
      "SPO threshold: 51%"
    ]
  },
  NewConstitution: {
    description: "Propose a new constitution or change the constitution hash",
    effect: "Replaces the current constitution with a new one",
    requirements: [
      "Requires DRep and CC approval",
      "SPO does NOT vote on this action type",
      "DRep threshold: 75%",
      "CC threshold: 2/3 of quorum"
    ]
  },
  TriggerHF: {
    description: "Trigger a hard fork to a new protocol version",
    effect: "Initiates a hard fork, upgrading the protocol to a new major/minor version",
    requirements: [
      "Requires ALL THREE bodies: CC, DRep, and SPO",
      "CC threshold: 2/3 of quorum",
      "DRep threshold: 60%",
      "SPO threshold: 51%"
    ]
  },
  ChangePParams: {
    description: "Change one or more protocol parameters",
    effect: "Updates protocol parameters within allowed bounds",
    requirements: [
      "Requires DRep and CC approval",
      "SPO does NOT vote on this action type",
      "DRep threshold varies by parameter group:",
      "  - Network/Economic/Technical groups: 67%",
      "  - Governance group: 75%",
      "CC threshold: 2/3 of quorum"
    ]
  },
  TreasuryWdrl: {
    description: "Withdraw funds from the treasury to specified addresses",
    effect: "Transfers ADA from the treasury to the specified stake credentials",
    requirements: [
      "Requires DRep and CC approval",
      "SPO does NOT vote on this action type",
      "DRep threshold: 67%",
      "CC threshold: 2/3 of quorum",
      "Subject to Net Change Limit (NCL) constraints"
    ]
  },
  Info: {
    description: "An informational action with no on-chain effect",
    effect: "No direct on-chain effect - used for gauging sentiment or recording decisions",
    requirements: [
      "All three bodies CAN vote, but thresholds are effectively 100%",
      "Cannot be ratified in practice - always expires",
      "Used for sentiment polling"
    ]
  }
};

// =============================================================================
// VOTER ELIGIBILITY MATRIX
// =============================================================================

export type VoterType = "CC" | "DRep" | "SPO";

export const VOTER_ELIGIBILITY: Record<GovernanceActionType, Record<VoterType, boolean>> = {
  NoConfidence:     { CC: false, DRep: true,  SPO: true  },
  UpdateCommittee:  { CC: false, DRep: true,  SPO: true  },
  NewConstitution:  { CC: true,  DRep: true,  SPO: false },
  TriggerHF:        { CC: true,  DRep: true,  SPO: true  }, // All three vote!
  ChangePParams:    { CC: true,  DRep: true,  SPO: false },
  TreasuryWdrl:     { CC: true,  DRep: true,  SPO: false },
  Info:             { CC: true,  DRep: true,  SPO: true  }
};

// =============================================================================
// VOTING THRESHOLDS
// =============================================================================

export interface VotingThreshold {
  ccThreshold: number | null;     // null = CC doesn't vote
  drepThreshold: number | null;   // null = DRep doesn't vote
  spoThreshold: number | null;    // null = SPO doesn't vote
  notes?: string;
}

// Conway Genesis default thresholds (from Fig. 42 of the spec)
export const VOTING_THRESHOLDS: Record<GovernanceActionType, VotingThreshold> = {
  NoConfidence: {
    ccThreshold: null,
    drepThreshold: 0.67,  // P1: dvtMotionNoConfidence
    spoThreshold: 0.51,   // Q1: pvtMotionNoConfidence
  },
  UpdateCommittee: {
    ccThreshold: null,
    drepThreshold: 0.67,  // P2b: dvtCommitteeNormal (or 0.60 if CC in no-confidence)
    spoThreshold: 0.51,   // Q2: pvtCommitteeNormal
    notes: "DRep threshold is 60% (P2a: dvtUpdateToNoConfidence) when CC is in no-confidence state"
  },
  NewConstitution: {
    ccThreshold: 0.6667,  // 2/3
    drepThreshold: 0.75,  // P3: dvtNewConstitution (not in threshold table, but 75%)
    spoThreshold: null,
  },
  TriggerHF: {
    ccThreshold: 0.6667,  // Q1: 2/3
    drepThreshold: 0.60,  // P4: dvtHardForkInitiation
    spoThreshold: 0.51,   // Q4: pvtHardForkInitiation
  },
  ChangePParams: {
    ccThreshold: 0.6667,  // 2/3
    drepThreshold: 0.67,  // Default (network/economic/technical groups)
    spoThreshold: null,
    notes: "DRep threshold is 75% (P5c) for governance group parameters"
  },
  TreasuryWdrl: {
    ccThreshold: 0.6667,  // 2/3
    drepThreshold: 0.67,  // P6: dvtTreasuryWithdrawal
    spoThreshold: null,
  },
  Info: {
    ccThreshold: 1.0,     // 100% - effectively impossible
    drepThreshold: 1.0,   // 100% - effectively impossible
    spoThreshold: 1.0,    // 100% - effectively impossible
    notes: "Info actions cannot be ratified - they always expire"
  }
};

// Protocol parameter threshold symbols from spec
export const THRESHOLD_SYMBOLS = {
  // DRep thresholds (P-series)
  P1: { name: "dvtMotionNoConfidence", value: 0.67, description: "NoConfidence motion" },
  P2a: { name: "dvtUpdateToNoConfidence", value: 0.60, description: "UpdateCommittee when CC in no-confidence" },
  P2b: { name: "dvtCommitteeNormal", value: 0.67, description: "UpdateCommittee normal state" },
  P3: { name: "dvtNewConstitution", value: 0.75, description: "New constitution" },
  P4: { name: "dvtHardForkInitiation", value: 0.60, description: "Hard fork initiation" },
  P5a: { name: "dvtPPNetworkGroup", value: 0.67, description: "Protocol params - network group" },
  P5b: { name: "dvtPPEconomicGroup", value: 0.67, description: "Protocol params - economic group" },
  P5c: { name: "dvtPPGovGroup", value: 0.75, description: "Protocol params - governance group" },
  P5d: { name: "dvtPPTechnicalGroup", value: 0.67, description: "Protocol params - technical group" },
  P6: { name: "dvtTreasuryWithdrawal", value: 0.67, description: "Treasury withdrawal" },

  // SPO thresholds (Q-series)
  Q1: { name: "pvtMotionNoConfidence", value: 0.51, description: "NoConfidence motion" },
  Q2a: { name: "pvtCommitteeNormal", value: 0.51, description: "UpdateCommittee normal state" },
  Q2b: { name: "pvtCommitteeNoConfidence", value: 0.51, description: "UpdateCommittee when CC in no-confidence" },
  Q4: { name: "pvtHardForkInitiation", value: 0.51, description: "Hard fork initiation" },
  Q5: { name: "pvtSecurityGroup", value: 0.51, description: "Protocol params - security group" },
};

// =============================================================================
// PROTOCOL PARAMETER GROUPS
// =============================================================================

export const PROTOCOL_PARAMETER_GROUPS = {
  network: {
    description: "Network-related parameters",
    drepThreshold: 0.67,
    parameters: [
      "maxBBSize",      // Maximum block body size
      "maxTxSize",      // Maximum transaction size
      "maxBHSize",      // Maximum block header size
      "maxValSize",     // Maximum value size
      "maxTxExUnits",   // Maximum transaction execution units
      "maxBlockExUnits", // Maximum block execution units
      "maxCollateralInputs" // Maximum collateral inputs
    ]
  },
  economic: {
    description: "Economic parameters",
    drepThreshold: 0.67,
    parameters: [
      "minFeeA",        // Minimum fee coefficient A
      "minFeeB",        // Minimum fee coefficient B
      "keyDeposit",     // Stake key deposit
      "poolDeposit",    // Pool registration deposit
      "monetaryExpansion", // Monetary expansion (rho)
      "treasuryCut",    // Treasury cut (tau)
      "minPoolCost",    // Minimum pool cost
      "coinsPerUTxOByte", // Coins per UTxO byte
      "prices"          // Execution unit prices
    ]
  },
  technical: {
    description: "Technical parameters",
    drepThreshold: 0.67,
    parameters: [
      "a0",             // Pool pledge influence
      "nopt",           // Desired number of pools
      "collateralPercent", // Collateral percentage
      "costModels",     // Plutus cost models
      "maxTxExUnits",   // Maximum transaction execution units
      "maxBlockExUnits", // Maximum block execution units
      "maxValSize",     // Maximum value size
      "maxCollateralInputs" // Maximum collateral inputs
    ]
  },
  governance: {
    description: "Governance parameters (require 75% DRep threshold)",
    drepThreshold: 0.75,
    parameters: [
      "govActionLifetime",    // Governance action lifetime (epochs)
      "govActionDeposit",     // Governance action deposit
      "drepDeposit",          // DRep registration deposit
      "drepActivity",         // DRep activity period (epochs)
      "ccMinSize",            // Minimum CC size
      "ccMaxTermLength"       // Maximum CC term length
    ]
  },
  security: {
    description: "Security parameters (overlap with other groups)",
    spoCanVote: true,
    parameters: [
      "maxBBSize",
      "maxTxSize",
      "maxBHSize",
      "maxValSize",
      "minFeeA",
      "minFeeB"
    ]
  }
};

// =============================================================================
// DREP PREDEFINED DELEGATIONS
// =============================================================================

export const DREP_PREDEFINED_DELEGATIONS = {
  alwaysAbstain: {
    description: "Delegated voting power that always abstains",
    behavior: "Does not count toward active voting stake for any proposal",
    effect: "Reduces the denominator in vote calculations"
  },
  alwaysNoConfidence: {
    description: "Delegated voting power that always votes for no-confidence",
    behavior: {
      noConfidenceMotion: "Counts as YES vote",
      otherActions: "Counts as NO vote"
    },
    effect: "Automatically participates in voting with predetermined stance"
  }
};

// =============================================================================
// VOTE CALCULATION FORMULAS
// =============================================================================

/**
 * CRITICAL: Threshold Progress Calculation
 *
 * The threshold progress shows how close a proposal is to reaching the required
 * threshold for ratification. The formula is:
 *
 *   Yes % = (yesTotal / (yesTotal + noTotal)) * 100
 *
 * CRITICAL: notVoted stake counts as NO (except for abstain/inactive which are excluded)
 *
 * DRep Calculation:
 * - NoConfidence: yes = activeYes + alwaysNoConfidence, no = activeNo + notVoted
 * - Other actions: yes = activeYes, no = activeNo + alwaysNoConfidence + notVoted
 *
 * SPO Calculation (epoch 534+):
 * - HardFork: yes = activeYes, no = activeNo + alwaysNoConfidence + alwaysAbstain + notVoted
 * - NoConfidence: yes = activeYes + alwaysNoConfidence, no = activeNo + notVoted
 * - Other actions: yes = activeYes, no = activeNo + alwaysNoConfidence + notVoted
 *
 * Example (Treasury Withdrawal with 67% threshold, newly submitted):
 *   - activeYes: 100M ADA (a few DReps voted)
 *   - activeNo: 50M ADA
 *   - alwaysNoConfidence: 500M ADA
 *   - notVoted: 10B ADA (most haven't voted yet)
 *   - yesTotal: 100M ADA
 *   - noTotal: 50M + 500M + 10B = 10.55B ADA
 *   - Current progress: (100M / 10.65B) * 100 = 0.94%
 *   - This makes sense! Newly submitted = low approval
 *
 * Source: cgov-project MCP get_vote_calculation_rules
 */
export const VOTE_CALCULATION = {
  thresholdProgress: {
    description: "How to calculate progress toward meeting a threshold",
    critical: "notVoted stake counts as NO! Formula: yes / (yes + no) where no includes notVoted",
    formulas: {
      drep: {
        noConfidence: {
          yes: "activeYes + alwaysNoConfidence",
          no: "activeNo + notVoted"
        },
        otherActions: {
          yes: "activeYes",
          no: "activeNo + alwaysNoConfidence + notVoted"
        },
        formula: "yesTotal / (yesTotal + noTotal) * 100",
        dataFields: {
          activeYes: "drep_active_yes_vote_power",
          activeNo: "drep_active_no_vote_power",
          alwaysNoConfidence: "drep_always_no_confidence_power",
          notVoted: "drepBreakdown.notVoted"
        }
      },
      spo: {
        hardFork: {
          yes: "activeYes",
          no: "activeNo + alwaysNoConfidence + alwaysAbstain + notVoted"
        },
        noConfidence: {
          yes: "activeYes + alwaysNoConfidence",
          no: "activeNo + notVoted"
        },
        otherActions: {
          yes: "activeYes",
          no: "activeNo + alwaysNoConfidence + notVoted"
        },
        formula: "yesTotal / (yesTotal + noTotal) * 100",
        dataFields: {
          activeYes: "spo_active_yes_vote_power",
          activeNo: "spo_active_no_vote_power",
          alwaysNoConfidence: "spo_always_no_confidence_power",
          alwaysAbstain: "spo_always_abstain_vote_power",
          notVoted: "spoBreakdown.notVoted"
        }
      },
      cc: {
        numerator: "ccYesCount",
        denominator: "ccYesCount + ccNoCount + ccPendingCount (or default 7 if no votes)",
        formula: "(ccYesCount / totalMembers) * 100"
      }
    }
  },
  drepVoteRatio: {
    description: "DRep threshold progress calculation",
    formula: "yesTotal / (yesTotal + noTotal)",
    noConfidence: {
      yes: "activeYes + alwaysNoConfidence",
      no: "activeNo + notVoted"
    },
    other: {
      yes: "activeYes",
      no: "activeNo + alwaysNoConfidence + notVoted"
    },
    wrongFormulas: [
      "DO NOT USE: activeYes / totalVotePower (notVoted not counted correctly)",
      "DO NOT USE: activeYes / (activeYes + activeNo) (missing alwaysNoConfidence and notVoted)",
      "DO NOT USE: activeYes / (activeYes + activeNo + alwaysNoConfidence) (missing notVoted!)"
    ],
    notes: [
      "notVoted stake counts as NO for threshold calculation",
      "Abstain and inactive are completely excluded",
      "AlwaysNoConfidence counts as YES for NoConfidence actions, NO for others"
    ]
  },
  spoVoteRatio: {
    description: "SPO threshold progress calculation (epoch 534+)",
    formula: "yesTotal / (yesTotal + noTotal)",
    hardFork: {
      yes: "activeYes",
      no: "activeNo + alwaysNoConfidence + alwaysAbstain + notVoted"
    },
    noConfidence: {
      yes: "activeYes + alwaysNoConfidence",
      no: "activeNo + notVoted"
    },
    other: {
      yes: "activeYes",
      no: "activeNo + alwaysNoConfidence + notVoted"
    },
    wrongFormulas: [
      "DO NOT USE: activeYes / totalVotePower",
      "DO NOT USE: activeYes / (activeYes + activeNo + alwaysNoConfidence) (missing notVoted!)"
    ],
    notes: [
      "notVoted stake counts as NO for threshold calculation",
      "For HardFork: alwaysAbstain also counts as NO",
      "Abstain (except for HardFork) is excluded"
    ]
  },
  ccVoteRatio: {
    description: "Constitutional Committee threshold progress calculation",
    formula: "ccYesCount / totalCCMembers",
    notes: [
      "Count-based, not stake-weighted",
      "Total members = yesCount + noCount + pendingCount",
      "Default to 7 members if no vote data available",
      "Expired CC members don't count toward total"
    ]
  },
  commonMistakes: [
    "CRITICAL: Not including notVoted in the NO total - this makes newly submitted proposals show high approval!",
    "Using totalVotePower as denominator instead of yes+no",
    "For NoConfidence: forgetting to add alwaysNoConfidence to yes total",
    "For HardFork: forgetting that alwaysAbstain counts as NO"
  ]
};

// =============================================================================
// RATIFICATION REQUIREMENTS
// =============================================================================

export const RATIFICATION_REQUIREMENTS = {
  general: [
    "All applicable thresholds must be met simultaneously",
    "Action must not have expired (expiryEpoch not reached)",
    "For actions requiring CC: CC must not be in expired/no-confidence state (except for specific actions)"
  ],
  delayedRatification: {
    description: "Some actions have delayed ratification after threshold is met",
    applies: ["TriggerHF", "ChangePParams"],
    delay: "Ratification happens at epoch boundary after thresholds are met"
  },
  enactmentPriority: {
    description: "Multiple ratified actions are enacted in specific order",
    order: [
      "1. NoConfidence",
      "2. UpdateCommittee",
      "3. NewConstitution",
      "4. TriggerHF (Hard Fork)",
      "5. ChangePParams (Protocol Parameters)",
      "6. TreasuryWdrl (Treasury Withdrawals)",
      "7. Info (never enacted)"
    ]
  }
};

// =============================================================================
// GOVERNANCE ACTION LIFECYCLE
// =============================================================================

export const GOVERNANCE_ACTION_LIFECYCLE = {
  states: {
    Active: "Voting is ongoing, action has not expired",
    Ratified: "Voting thresholds met, awaiting enactment",
    Enacted: "Action has been applied to the ledger state",
    Expired: "Voting period ended without meeting thresholds",
    Dropped: "Superseded by another action or removed"
  },
  timing: {
    submissionEpoch: "Epoch when the action was submitted",
    expiryEpoch: "Last epoch for voting (calculated as submissionEpoch + govActionLifetime)",
    enactmentEpoch: "Epoch when ratified action takes effect (usually next epoch boundary)"
  },
  deposits: {
    govActionDeposit: "Required deposit to submit a governance action",
    returnConditions: [
      "Deposit returned when action expires",
      "Deposit returned when action is enacted",
      "Deposit NOT returned if action is dropped due to conflicting action"
    ]
  }
};

// =============================================================================
// CURRENCY UNITS AND CONVERSIONS
// =============================================================================

export const CURRENCY_UNITS = {
  lovelace: {
    description: "The smallest unit of ADA (like satoshis for Bitcoin)",
    relation: "1 ADA = 1,000,000 lovelace",
    usage: "All on-chain values are stored in lovelace"
  },
  ada: {
    description: "The primary currency unit of Cardano",
    relation: "1 ADA = 1,000,000 lovelace",
    usage: "Display unit for user interfaces"
  },
  conversion: {
    lovelaceToAda: "lovelace / 1,000,000",
    adaToLovelace: "ada * 1,000,000"
  },
  apiDataFormats: {
    drep_total_vote_power: "Stored in LOVELACE - divide by 1,000,000 to get ADA",
    spo_total_vote_power: "Stored in LOVELACE - divide by 1,000,000 to get ADA",
    yesLovelace: "Stored in LOVELACE - divide by 1,000,000 to get ADA",
    noLovelace: "Stored in LOVELACE - divide by 1,000,000 to get ADA",
    abstainLovelace: "Stored in LOVELACE - divide by 1,000,000 to get ADA",
    votingPower: "Stored in LOVELACE - divide by 1,000,000 to get ADA"
  },
  importantNote: "ALWAYS check if a value is in lovelace or ADA before performing calculations. Mixing units will result in values that are off by a factor of 1,000,000."
};

// =============================================================================
// EPOCH CONSTANTS
// =============================================================================

export const EPOCH_CONSTANTS = {
  shelleyStartEpoch: 208,
  shelleyStartTime: "2020-07-29T21:44:51Z",
  epochDurationMs: 5 * 24 * 60 * 60 * 1000, // 5 days in milliseconds
  epoch534: {
    description: "Epoch when SPO vote calculation rules changed",
    change: "NotVoted stake handling updated for various action types"
  }
};

// =============================================================================
// CONSTITUTIONAL COMMITTEE RULES
// =============================================================================

export const CC_RULES = {
  quorum: {
    description: "Minimum number of CC members required for decisions",
    default: "Set by protocol parameter, can be changed via UpdateCommittee"
  },
  termLimits: {
    description: "CC members have term limits",
    maxTermLength: "Defined by ccMaxTermLength protocol parameter",
    expiration: "Members expire at their specified epoch"
  },
  states: {
    normal: {
      description: "CC is functioning normally",
      canVote: true
    },
    noConfidence: {
      description: "NoConfidence motion has passed",
      effects: [
        "CC cannot vote on most actions",
        "UpdateCommittee threshold reduced to 60%",
        "Cannot add new members until UpdateCommittee passes"
      ]
    },
    expired: {
      description: "All CC members have expired",
      effects: [
        "Similar to no-confidence state",
        "Requires UpdateCommittee to restore functionality"
      ]
    }
  }
};
