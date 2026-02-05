/**
 * Governance Analytics Response Types
 * Based on backend analytics endpoints
 */

// ============================================
// Common Types
// ============================================

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// ============================================
// Category 1 – Ada Holder Participation
// ============================================

/**
 * 1.1 Voting Turnout per proposal
 */
export interface ProposalTurnout {
  proposalId: string;
  title: string;
  governanceActionType: string | null;
  submissionEpoch: number | null;
  status: string;
  /** DRep turnout percentage (0-100) */
  drepTurnoutPct: number | null;
  /** SPO turnout percentage (0-100) */
  spoTurnoutPct: number | null;
  /** DRep active yes vote power (lovelace as string) */
  drepActiveYesVotePower: string | null;
  /** DRep active no vote power (lovelace as string) */
  drepActiveNoVotePower: string | null;
  /** DRep active abstain vote power (lovelace as string) */
  drepActiveAbstainVotePower: string | null;
  /** DRep total vote power (lovelace as string) */
  drepTotalVotePower: string | null;
  /** SPO active yes vote power (lovelace as string) */
  spoActiveYesVotePower: string | null;
  /** SPO active no vote power (lovelace as string) */
  spoActiveNoVotePower: string | null;
  /** SPO active abstain vote power (lovelace as string) */
  spoActiveAbstainVotePower: string | null;
  /** SPO total vote power (lovelace as string) */
  spoTotalVotePower: string | null;
}

export interface GetVotingTurnoutResponse {
  proposals: ProposalTurnout[];
  /** Aggregate DRep turnout across all proposals (weighted average) */
  aggregateDrepTurnoutPct: number | null;
  /** Aggregate SPO turnout across all proposals (weighted average) */
  aggregateSpoTurnoutPct: number | null;
  pagination: PaginationInfo;
}

/**
 * 1.2 Active Stake Address Participation
 */
export interface StakeParticipationStats {
  /** Total number of delegators who participated via their DRep */
  participatingDelegators: number;
  /** Total number of delegators */
  totalDelegators: number;
  /** Participation rate percentage (0-100) */
  participationRatePct: number | null;
  /** Sum of delegated amount for participating delegators (lovelace as string) */
  participatingAmount: string;
  /** Total delegated amount (lovelace as string) */
  totalAmount: string;
}

export interface GetStakeParticipationResponse {
  /** For a specific proposal, or aggregate over proposals */
  proposalId: string | null;
  stats: StakeParticipationStats;
}

/**
 * 1.3 Delegation Rate
 */
export interface EpochDelegationRate {
  epoch: number;
  /** Delegated DRep power (lovelace as string) */
  delegatedDrepPower: string | null;
  /** Circulation (lovelace as string) */
  circulation: string | null;
  /** Delegation rate percentage (0-100) */
  delegationRatePct: number | null;
  startTime: string | null;
  endTime: string | null;
}

export interface GetDelegationRateResponse {
  epochs: EpochDelegationRate[];
}

/**
 * 1.4 Delegation Distribution by Wallet Size
 */
export interface DelegationBand {
  /** Band label (e.g., "0-1k ADA", "1k-10k ADA") */
  band: string;
  /** Minimum amount in lovelace */
  minLovelace: string;
  /** Maximum amount in lovelace */
  maxLovelace: string;
  /** Number of stake addresses in this band */
  stakeAddressCount: number;
  /** Sum of delegated amount in this band (lovelace as string) */
  totalAmountLovelace: string;
  /** Sum of delegated amount in ADA */
  totalAmountAda: string;
  /** Percentage of total stake addresses */
  stakeAddressSharePct: number;
  /** Percentage of total delegated amount */
  amountSharePct: number;
}

export interface GetDelegationDistributionResponse {
  bands: DelegationBand[];
  totalStakeAddresses: number;
  totalAmountLovelace: string;
  totalAmountAda: string;
}

/**
 * 1.5 New Wallet Delegation Rate
 */
export interface EpochNewDelegationRate {
  epoch: number;
  /** Number of new delegators in this epoch */
  newDelegators: number;
  /** Total delegators at the end of this epoch */
  totalDelegators: number;
  /** New delegation rate percentage */
  newDelegationRatePct: number | null;
}

export interface GetNewDelegationRateResponse {
  epochs: EpochNewDelegationRate[];
}

/**
 * 1.6 Inactive Delegated Ada
 */
export interface ProposalInactiveAda {
  proposalId: string;
  title: string;
  /** Inactive DRep vote power (lovelace as string) */
  drepInactiveVotePower: string | null;
  /** Total DRep vote power (lovelace as string) */
  drepTotalVotePower: string | null;
  /** Inactive percentage (0-100) */
  inactivePct: number | null;
  /** Always abstain vote power (lovelace as string) */
  drepAlwaysAbstainVotePower: string | null;
  /** Always no confidence vote power (lovelace as string) */
  drepAlwaysNoConfidencePower: string | null;
}

export interface EpochInactiveAda {
  epoch: number;
  /** Always abstain voting power (lovelace as string) */
  drepAlwaysAbstainVotingPower: string | null;
  /** Always no confidence voting power (lovelace as string) */
  drepAlwaysNoConfidenceVotingPower: string | null;
  /** Always abstain delegator count */
  drepAlwaysAbstainDelegatorCount: number | null;
  /** Always no confidence delegator count */
  drepAlwaysNoConfidenceDelegatorCount: number | null;
}

export interface GetInactiveAdaResponse {
  /** Per-proposal inactive data (if requested) */
  proposals?: ProposalInactiveAda[];
  /** Per-epoch inactive data (special DReps) */
  epochs?: EpochInactiveAda[];
}

// ============================================
// Category 2 – DRep Insights & Activity
// ============================================

/**
 * 2.1 Delegation Decentralization (Gini)
 */
export interface GetGiniCoefficientResponse {
  /** Gini coefficient (0-1, where 0 = perfect equality, 1 = perfect inequality) */
  gini: number;
  /** Number of active DReps included in calculation */
  drepCount: number;
  /** Summary statistics */
  stats: {
    minVotingPower: string;
    maxVotingPower: string;
    medianVotingPower: string;
    p90VotingPower: string;
    totalVotingPower: string;
  };
}

/**
 * 2.2 DRep Activity Rate
 */
export interface DRepActivitySummary {
  drepId: string;
  name: string | null;
  /** Number of proposals voted on */
  proposalsVoted: number;
  /** Total proposals in scope */
  totalProposals: number;
  /** Activity rate percentage (0-100) */
  activityRatePct: number;
}

export interface GetDRepActivityRateResponse {
  dreps: DRepActivitySummary[];
  /** Aggregate activity rate across all DReps */
  aggregateActivityRatePct: number;
  /** Filter criteria used */
  filter: {
    epochStart: number | null;
    epochEnd: number | null;
    statuses: string[];
  };
  pagination: PaginationInfo;
}

/**
 * 2.3 DRep Rationale Rate
 */
export interface DRepRationaleSummary {
  drepId: string;
  name: string | null;
  /** Votes with rationale */
  votesWithRationale: number;
  /** Total votes */
  totalVotes: number;
  /** Rationale rate percentage (0-100) */
  rationaleRatePct: number;
}

export interface GetDRepRationaleRateResponse {
  dreps: DRepRationaleSummary[];
  /** Aggregate rationale rate */
  aggregateRationaleRatePct: number;
  pagination: PaginationInfo;
}

/**
 * 2.4 DRep Voting Correlation
 */
export interface DRepPairCorrelation {
  drepId1: string;
  drepId2: string;
  drepName1: string | null;
  drepName2: string | null;
  /** Number of proposals both voted on */
  sharedProposals: number;
  /** Agreement percentage (0-100) */
  agreementPct: number;
  /** Correlation coefficient (-1 to 1) */
  correlation: number | null;
}

export interface GetDRepCorrelationResponse {
  /** Top correlated pairs (most similar) */
  topCorrelated: DRepPairCorrelation[];
  /** Top divergent pairs (most different) */
  topDivergent: DRepPairCorrelation[];
  /** Correlation for a specific DRep pair (if requested) */
  pairCorrelation?: DRepPairCorrelation;
}

/**
 * 2.5 DRep Lifecycle Rate
 */
export interface EpochLifecycleEvents {
  epoch: number;
  registrations: number;
  deregistrations: number;
  updates: number;
}

export interface GetDRepLifecycleRateResponse {
  epochs: EpochLifecycleEvents[];
  totals: {
    registrations: number;
    deregistrations: number;
    updates: number;
  };
}

// ============================================
// Category 3 – SPO Governance Participation
// ============================================

/**
 * 3.1 SPO Voting Turnout (same structure as DRep)
 */
export interface GetSpoVotingTurnoutResponse {
  proposals: ProposalTurnout[];
  aggregateSpoTurnoutPct: number | null;
  pagination: PaginationInfo;
}

/**
 * 3.2 SPO Silent Stake Rate
 */
export interface ProposalSilentStake {
  proposalId: string;
  title: string;
  /** SPO no vote power (stake that did not vote) - lovelace as string */
  spoNoVotePower: string | null;
  /** SPO total vote power - lovelace as string */
  spoTotalVotePower: string | null;
  /** Silent stake percentage (0-100) */
  silentPct: number | null;
}

export interface GetSpoSilentStakeResponse {
  proposals: ProposalSilentStake[];
  aggregateSilentPct: number | null;
  pagination: PaginationInfo;
}

/**
 * 3.3 Default Stance Adoption
 */
export interface ProposalDefaultStance {
  proposalId: string;
  title: string;
  /** Always abstain vote power - lovelace as string */
  spoAlwaysAbstainVotePower: string | null;
  /** Always no confidence vote power - lovelace as string */
  spoAlwaysNoConfidencePower: string | null;
  /** SPO total vote power - lovelace as string */
  spoTotalVotePower: string | null;
  /** Always abstain percentage (0-100) */
  alwaysAbstainPct: number | null;
  /** Always no confidence percentage (0-100) */
  alwaysNoConfidencePct: number | null;
}

export interface GetSpoDefaultStanceResponse {
  proposals: ProposalDefaultStance[];
  pagination: PaginationInfo;
}

/**
 * 3.4 Entity Voting Power Concentration
 */
export interface PoolGroupConcentration {
  poolGroup: string;
  /** Total voting power of all pools in this group - lovelace as string */
  totalVotingPower: string;
  /** Voting power in ADA */
  totalVotingPowerAda: string;
  /** Number of pools in this group */
  poolCount: number;
  /** Share of total voting power (0-100) */
  sharePct: number;
}

export interface GetEntityConcentrationResponse {
  entities: PoolGroupConcentration[];
  /** Herfindahl-Hirschman Index (0-10000, higher = more concentrated) */
  hhi: number;
  /** Top 5 entity share percentage */
  top5SharePct: number;
  /** Top 10 entity share percentage */
  top10SharePct: number;
  totalVotingPower: string;
  totalEntities: number;
}

/**
 * 3.5 SPO-DRep Vote Divergence
 */
export interface ProposalVoteDivergence {
  proposalId: string;
  title: string;
  /** DRep yes percentage (0-100) */
  drepYesPct: number | null;
  /** DRep no percentage (0-100) */
  drepNoPct: number | null;
  /** DRep abstain percentage (0-100) */
  drepAbstainPct: number | null;
  /** SPO yes percentage (0-100) */
  spoYesPct: number | null;
  /** SPO no percentage (0-100) */
  spoNoPct: number | null;
  /** SPO abstain percentage (0-100) */
  spoAbstainPct: number | null;
  /** Divergence score (0-100, higher = more different) */
  divergenceScore: number | null;
}

export interface GetVoteDivergenceResponse {
  proposals: ProposalVoteDivergence[];
  averageDivergence: number | null;
  pagination: PaginationInfo;
}

// ============================================
// Category 4 – Governance Action & Treasury Health
// ============================================

/**
 * 4.1 Governance Action Volume & Source
 */
export interface EpochActionVolume {
  epoch: number;
  total: number;
  byType: Record<string, number>;
}

export interface GetActionVolumeResponse {
  epochs: EpochActionVolume[];
  totalProposals: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

/**
 * 4.2 Governance Action Contention Rate
 */
export interface ProposalContention {
  proposalId: string;
  title: string;
  governanceActionType: string | null;
  /** DRep yes percentage */
  drepYesPct: number | null;
  /** DRep no percentage */
  drepNoPct: number | null;
  /** SPO yes percentage */
  spoYesPct: number | null;
  /** SPO no percentage */
  spoNoPct: number | null;
  /** Is this proposal contentious (close vote)? */
  isContentious: boolean;
  /** Contention score (0-100, higher = more contentious) */
  contentionScore: number | null;
}

export interface GetContentionRateResponse {
  proposals: ProposalContention[];
  /** Percentage of proposals that are contentious */
  contentionRatePct: number;
  /** Total contentious proposals */
  contentiousCount: number;
  /** Total proposals analyzed */
  totalProposals: number;
  pagination: PaginationInfo;
}

/**
 * 4.3 Treasury Balance Rate
 */
export interface EpochTreasuryRate {
  epoch: number;
  /** Treasury balance - lovelace as string */
  treasury: string | null;
  /** Circulation - lovelace as string */
  circulation: string | null;
  /** Treasury rate percentage */
  treasuryRatePct: number | null;
  startTime: string | null;
  endTime: string | null;
}

export interface GetTreasuryRateResponse {
  epochs: EpochTreasuryRate[];
}

/**
 * 4.4 Time-to-Enactment
 */
export interface ProposalTimeToEnactment {
  proposalId: string;
  title: string;
  governanceActionType: string | null;
  status: string;
  submissionEpoch: number | null;
  ratifiedEpoch: number | null;
  enactedEpoch: number | null;
  /** Epochs from submission to ratification */
  submissionToRatifiedEpochs: number | null;
  /** Epochs from submission to enactment */
  submissionToEnactedEpochs: number | null;
  /** Wall-clock time from submission to enactment (days) */
  submissionToEnactedDays: number | null;
}

export interface GetTimeToEnactmentResponse {
  proposals: ProposalTimeToEnactment[];
  stats: {
    medianEpochsToEnactment: number | null;
    p90EpochsToEnactment: number | null;
    medianDaysToEnactment: number | null;
    p90DaysToEnactment: number | null;
  };
  pagination: PaginationInfo;
}

/**
 * 4.5 Constitutional Compliance Clarity
 */
export interface ProposalComplianceStatus {
  proposalId: string;
  title: string;
  status: string;
  /** Whether proposal passed CC vote */
  ccApproved: boolean | null;
  /** Constitutional status: "Constitutional" | "Unconstitutional" | "Pending" | "Committee Too Small" */
  constitutionalStatus: string;
  /** CC yes votes */
  ccYesVotes: number;
  /** CC no votes */
  ccNoVotes: number;
  /** CC abstain votes */
  ccAbstainVotes: number;
  /** CC not voted */
  ccNotVoted: number;
  /** Eligible CC members */
  eligibleMembers: number;
}

export interface GetComplianceStatusResponse {
  proposals: ProposalComplianceStatus[];
  pagination: PaginationInfo;
}

// ============================================
// Category 5 – Constitutional Committee Activity
// ============================================

/**
 * 5.1 Time-to-Decision
 */
export interface ProposalCCTimeToDecision {
  proposalId: string;
  title: string;
  submissionEpoch: number | null;
  /** First CC vote timestamp */
  firstCcVoteAt: string | null;
  /** Time from submission to first CC vote (hours) */
  hoursToFirstVote: number | null;
  /** Time from submission to first CC vote (days) */
  daysToFirstVote: number | null;
}

export interface GetCCTimeToDecisionResponse {
  proposals: ProposalCCTimeToDecision[];
  stats: {
    medianHoursToVote: number | null;
    medianDaysToVote: number | null;
    p90HoursToVote: number | null;
    p90DaysToVote: number | null;
  };
  pagination: PaginationInfo;
}

/**
 * 5.2 CC Member Participation Rate
 */
export interface CCMemberParticipation {
  ccId: string;
  memberName: string | null;
  proposalsVoted: number;
  totalProposals: number;
  participationRatePct: number;
}

export interface GetCCParticipationResponse {
  members: CCMemberParticipation[];
  aggregateParticipationPct: number;
  eligibleMembers: number;
  totalProposals: number;
}

/**
 * 5.3 CC Abstain Rate
 */
export interface ProposalCCAbstainRate {
  proposalId: string;
  title: string;
  abstainVotes: number;
  totalVotes: number;
  abstainRatePct: number;
}

export interface GetCCAbstainRateResponse {
  proposals: ProposalCCAbstainRate[];
  aggregateAbstainRatePct: number;
  pagination: PaginationInfo;
}

/**
 * 5.4 CC Vote Agreement Rate
 */
export interface ProposalCCAgreement {
  proposalId: string;
  title: string;
  majorityVote: string | null;
  /** Votes matching majority */
  matchingVotes: number;
  totalVotes: number;
  agreementRatePct: number;
}

export interface GetCCAgreementRateResponse {
  proposals: ProposalCCAgreement[];
  aggregateAgreementRatePct: number;
  pagination: PaginationInfo;
}

// ============================================
// Category 6 – Tooling & UX
// ============================================

/**
 * 6.3 Gov Info Availability
 */
export interface ProposalInfoCompleteness {
  proposalId: string;
  title: string;
  hasTitle: boolean;
  hasDescription: boolean;
  hasRationale: boolean;
  hasMetadata: boolean;
  /** Completeness score (0-100) */
  completenessScore: number;
}

export interface VoteInfoCompleteness {
  /** Votes with rationale or anchor */
  votesWithInfo: number;
  totalVotes: number;
  infoRatePct: number;
}

export interface GetInfoAvailabilityResponse {
  proposals: ProposalInfoCompleteness[];
  votes: VoteInfoCompleteness;
  aggregateProposalCompletenessPct: number;
  pagination: PaginationInfo;
}

// ============================================
// Analytics Query Parameters
// ============================================

export interface AnalyticsQueryParams {
  page?: number;
  pageSize?: number;
  epochStart?: number;
  epochEnd?: number;
  statuses?: string[];
  proposalId?: string;
  drepId?: string;
  drepId1?: string;
  drepId2?: string;
  groupBy?: "proposal" | "epoch";
}
