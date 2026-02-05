/**
 * Analytics API Service
 * Client-side functions for fetching analytics data from Next.js API routes
 */

import { API_ENDPOINTS } from "@/config/api";
import type {
  AnalyticsQueryParams,
  GetVotingTurnoutResponse,
  GetStakeParticipationResponse,
  GetDelegationRateResponse,
  GetDelegationDistributionResponse,
  GetNewDelegationRateResponse,
  GetInactiveAdaResponse,
  GetGiniCoefficientResponse,
  GetDRepActivityRateResponse,
  GetDRepRationaleRateResponse,
  GetDRepCorrelationResponse,
  GetDRepLifecycleRateResponse,
  GetSpoSilentStakeResponse,
  GetSpoDefaultStanceResponse,
  GetEntityConcentrationResponse,
  GetVoteDivergenceResponse,
  GetActionVolumeResponse,
  GetContentionRateResponse,
  GetTreasuryRateResponse,
  GetTimeToEnactmentResponse,
  GetComplianceStatusResponse,
  GetCCTimeToDecisionResponse,
  GetCCParticipationResponse,
  GetCCAbstainRateResponse,
  GetCCAgreementRateResponse,
  GetInfoAvailabilityResponse,
} from "@/types/analytics";

/**
 * Generic fetch wrapper for analytics API
 */
async function fetchAnalyticsApi<T>(
  url: string,
  params?: AnalyticsQueryParams
): Promise<T> {
  const queryString = params
    ? new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : String(v)])
      ).toString()
    : "";

  const fullUrl = queryString ? `${url}?${queryString}` : url;

  const response = await fetch(fullUrl);

  if (!response.ok) {
    let errorMessage = `Failed to fetch analytics data: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// ============================================
// Category 1 – Ada Holder Participation
// ============================================

/**
 * 1.1 Voting Turnout per proposal
 */
export async function fetchVotingTurnout(
  params?: AnalyticsQueryParams
): Promise<GetVotingTurnoutResponse> {
  return fetchAnalyticsApi<GetVotingTurnoutResponse>(
    API_ENDPOINTS.analyticsVotingTurnout,
    params
  );
}

/**
 * 1.2 Active Stake Address Participation
 */
export async function fetchStakeParticipation(
  params?: AnalyticsQueryParams
): Promise<GetStakeParticipationResponse> {
  return fetchAnalyticsApi<GetStakeParticipationResponse>(
    API_ENDPOINTS.analyticsStakeParticipation,
    params
  );
}

/**
 * 1.3 Delegation Rate
 */
export async function fetchDelegationRate(
  params?: AnalyticsQueryParams
): Promise<GetDelegationRateResponse> {
  return fetchAnalyticsApi<GetDelegationRateResponse>(
    API_ENDPOINTS.analyticsDelegationRate,
    params
  );
}

/**
 * 1.4 Delegation Distribution by Wallet Size
 */
export async function fetchDelegationDistribution(
  params?: AnalyticsQueryParams
): Promise<GetDelegationDistributionResponse> {
  return fetchAnalyticsApi<GetDelegationDistributionResponse>(
    API_ENDPOINTS.analyticsDelegationDistribution,
    params
  );
}

/**
 * 1.5 New Wallet Delegation Rate
 */
export async function fetchNewDelegationRate(
  params?: AnalyticsQueryParams
): Promise<GetNewDelegationRateResponse> {
  return fetchAnalyticsApi<GetNewDelegationRateResponse>(
    API_ENDPOINTS.analyticsNewDelegationRate,
    params
  );
}

/**
 * 1.6 Inactive Delegated Ada
 */
export async function fetchInactiveAda(
  params?: AnalyticsQueryParams
): Promise<GetInactiveAdaResponse> {
  return fetchAnalyticsApi<GetInactiveAdaResponse>(
    API_ENDPOINTS.analyticsInactiveAda,
    params
  );
}

// ============================================
// Category 2 – DRep Insights & Activity
// ============================================

/**
 * 2.1 Delegation Decentralization (Gini)
 */
export async function fetchGiniCoefficient(
  params?: AnalyticsQueryParams
): Promise<GetGiniCoefficientResponse> {
  return fetchAnalyticsApi<GetGiniCoefficientResponse>(
    API_ENDPOINTS.analyticsGiniCoefficient,
    params
  );
}

/**
 * 2.2 DRep Activity Rate
 */
export async function fetchDRepActivityRate(
  params?: AnalyticsQueryParams
): Promise<GetDRepActivityRateResponse> {
  return fetchAnalyticsApi<GetDRepActivityRateResponse>(
    API_ENDPOINTS.analyticsDRepActivityRate,
    params
  );
}

/**
 * 2.3 DRep Rationale Rate
 */
export async function fetchDRepRationaleRate(
  params?: AnalyticsQueryParams
): Promise<GetDRepRationaleRateResponse> {
  return fetchAnalyticsApi<GetDRepRationaleRateResponse>(
    API_ENDPOINTS.analyticsDRepRationaleRate,
    params
  );
}

/**
 * 2.4 DRep Voting Correlation
 */
export async function fetchDRepCorrelation(
  params?: AnalyticsQueryParams
): Promise<GetDRepCorrelationResponse> {
  return fetchAnalyticsApi<GetDRepCorrelationResponse>(
    API_ENDPOINTS.analyticsDRepCorrelation,
    params
  );
}

/**
 * 2.5 DRep Lifecycle Rate
 */
export async function fetchDRepLifecycleRate(
  params?: AnalyticsQueryParams
): Promise<GetDRepLifecycleRateResponse> {
  return fetchAnalyticsApi<GetDRepLifecycleRateResponse>(
    API_ENDPOINTS.analyticsDRepLifecycleRate,
    params
  );
}

// ============================================
// Category 3 – SPO Governance Participation
// ============================================

/**
 * 3.2 SPO Silent Stake Rate
 */
export async function fetchSpoSilentStake(
  params?: AnalyticsQueryParams
): Promise<GetSpoSilentStakeResponse> {
  return fetchAnalyticsApi<GetSpoSilentStakeResponse>(
    API_ENDPOINTS.analyticsSpoSilentStake,
    params
  );
}

/**
 * 3.3 Default Stance Adoption
 */
export async function fetchSpoDefaultStance(
  params?: AnalyticsQueryParams
): Promise<GetSpoDefaultStanceResponse> {
  return fetchAnalyticsApi<GetSpoDefaultStanceResponse>(
    API_ENDPOINTS.analyticsSpoDefaultStance,
    params
  );
}

/**
 * 3.4 Entity Voting Power Concentration
 */
export async function fetchEntityConcentration(
  params?: AnalyticsQueryParams
): Promise<GetEntityConcentrationResponse> {
  return fetchAnalyticsApi<GetEntityConcentrationResponse>(
    API_ENDPOINTS.analyticsEntityConcentration,
    params
  );
}

/**
 * 3.5 SPO-DRep Vote Divergence
 */
export async function fetchVoteDivergence(
  params?: AnalyticsQueryParams
): Promise<GetVoteDivergenceResponse> {
  return fetchAnalyticsApi<GetVoteDivergenceResponse>(
    API_ENDPOINTS.analyticsVoteDivergence,
    params
  );
}

// ============================================
// Category 4 – Governance Action & Treasury Health
// ============================================

/**
 * 4.1 Governance Action Volume & Source
 */
export async function fetchActionVolume(
  params?: AnalyticsQueryParams
): Promise<GetActionVolumeResponse> {
  return fetchAnalyticsApi<GetActionVolumeResponse>(
    API_ENDPOINTS.analyticsActionVolume,
    params
  );
}

/**
 * 4.2 Governance Action Contention Rate
 */
export async function fetchContentionRate(
  params?: AnalyticsQueryParams
): Promise<GetContentionRateResponse> {
  return fetchAnalyticsApi<GetContentionRateResponse>(
    API_ENDPOINTS.analyticsContentionRate,
    params
  );
}

/**
 * 4.3 Treasury Balance Rate
 */
export async function fetchTreasuryRate(
  params?: AnalyticsQueryParams
): Promise<GetTreasuryRateResponse> {
  return fetchAnalyticsApi<GetTreasuryRateResponse>(
    API_ENDPOINTS.analyticsTreasuryRate,
    params
  );
}

/**
 * 4.4 Time-to-Enactment
 */
export async function fetchTimeToEnactment(
  params?: AnalyticsQueryParams
): Promise<GetTimeToEnactmentResponse> {
  return fetchAnalyticsApi<GetTimeToEnactmentResponse>(
    API_ENDPOINTS.analyticsTimeToEnactment,
    params
  );
}

/**
 * 4.5 Constitutional Compliance Clarity
 */
export async function fetchComplianceStatus(
  params?: AnalyticsQueryParams
): Promise<GetComplianceStatusResponse> {
  return fetchAnalyticsApi<GetComplianceStatusResponse>(
    API_ENDPOINTS.analyticsComplianceStatus,
    params
  );
}

// ============================================
// Category 5 – Constitutional Committee Activity
// ============================================

/**
 * 5.1 Time-to-Decision
 */
export async function fetchCCTimeToDecision(
  params?: AnalyticsQueryParams
): Promise<GetCCTimeToDecisionResponse> {
  return fetchAnalyticsApi<GetCCTimeToDecisionResponse>(
    API_ENDPOINTS.analyticsCCTimeToDecision,
    params
  );
}

/**
 * 5.2 CC Member Participation Rate
 */
export async function fetchCCParticipation(
  params?: AnalyticsQueryParams
): Promise<GetCCParticipationResponse> {
  return fetchAnalyticsApi<GetCCParticipationResponse>(
    API_ENDPOINTS.analyticsCCParticipation,
    params
  );
}

/**
 * 5.3 CC Abstain Rate
 */
export async function fetchCCAbstainRate(
  params?: AnalyticsQueryParams
): Promise<GetCCAbstainRateResponse> {
  return fetchAnalyticsApi<GetCCAbstainRateResponse>(
    API_ENDPOINTS.analyticsCCAbstainRate,
    params
  );
}

/**
 * 5.4 CC Vote Agreement Rate
 */
export async function fetchCCAgreementRate(
  params?: AnalyticsQueryParams
): Promise<GetCCAgreementRateResponse> {
  return fetchAnalyticsApi<GetCCAgreementRateResponse>(
    API_ENDPOINTS.analyticsCCAgreementRate,
    params
  );
}

// ============================================
// Category 6 – Tooling & UX
// ============================================

/**
 * 6.3 Gov Info Availability
 */
export async function fetchInfoAvailability(
  params?: AnalyticsQueryParams
): Promise<GetInfoAvailabilityResponse> {
  return fetchAnalyticsApi<GetInfoAvailabilityResponse>(
    API_ENDPOINTS.analyticsInfoAvailability,
    params
  );
}

// ============================================
// All Analytics Endpoints Map
// ============================================

export const ANALYTICS_ENDPOINTS = {
  // Category 1 - Ada Holder Participation
  votingTurnout: {
    name: "Voting Turnout",
    description: "Voting turnout per proposal (DRep and SPO)",
    category: "Ada Holder Participation",
    fetch: fetchVotingTurnout,
  },
  stakeParticipation: {
    name: "Stake Participation",
    description: "Active stake address participation",
    category: "Ada Holder Participation",
    fetch: fetchStakeParticipation,
  },
  delegationRate: {
    name: "Delegation Rate",
    description: "Delegation rate over time",
    category: "Ada Holder Participation",
    fetch: fetchDelegationRate,
  },
  delegationDistribution: {
    name: "Delegation Distribution",
    description: "Delegation distribution by wallet size",
    category: "Ada Holder Participation",
    fetch: fetchDelegationDistribution,
  },
  newDelegationRate: {
    name: "New Delegation Rate",
    description: "New wallet delegation rate",
    category: "Ada Holder Participation",
    fetch: fetchNewDelegationRate,
  },
  inactiveAda: {
    name: "Inactive ADA",
    description: "Inactive delegated ADA",
    category: "Ada Holder Participation",
    fetch: fetchInactiveAda,
  },

  // Category 2 - DRep Insights & Activity
  giniCoefficient: {
    name: "Gini Coefficient",
    description: "Delegation decentralization (Gini coefficient)",
    category: "DRep Insights & Activity",
    fetch: fetchGiniCoefficient,
  },
  drepActivityRate: {
    name: "DRep Activity Rate",
    description: "DRep voting activity rate",
    category: "DRep Insights & Activity",
    fetch: fetchDRepActivityRate,
  },
  drepRationaleRate: {
    name: "DRep Rationale Rate",
    description: "DRep rationale submission rate",
    category: "DRep Insights & Activity",
    fetch: fetchDRepRationaleRate,
  },
  drepCorrelation: {
    name: "DRep Correlation",
    description: "DRep voting correlation",
    category: "DRep Insights & Activity",
    fetch: fetchDRepCorrelation,
  },
  drepLifecycleRate: {
    name: "DRep Lifecycle Rate",
    description: "DRep registration/deregistration rate",
    category: "DRep Insights & Activity",
    fetch: fetchDRepLifecycleRate,
  },

  // Category 3 - SPO Governance Participation
  spoSilentStake: {
    name: "SPO Silent Stake",
    description: "SPO silent stake rate",
    category: "SPO Governance Participation",
    fetch: fetchSpoSilentStake,
  },
  spoDefaultStance: {
    name: "SPO Default Stance",
    description: "SPO default stance adoption",
    category: "SPO Governance Participation",
    fetch: fetchSpoDefaultStance,
  },
  entityConcentration: {
    name: "Entity Concentration",
    description: "Entity voting power concentration",
    category: "SPO Governance Participation",
    fetch: fetchEntityConcentration,
  },
  voteDivergence: {
    name: "Vote Divergence",
    description: "SPO-DRep vote divergence",
    category: "SPO Governance Participation",
    fetch: fetchVoteDivergence,
  },

  // Category 4 - Governance Action & Treasury Health
  actionVolume: {
    name: "Action Volume",
    description: "Governance action volume & source",
    category: "Governance Action & Treasury Health",
    fetch: fetchActionVolume,
  },
  contentionRate: {
    name: "Contention Rate",
    description: "Governance action contention rate",
    category: "Governance Action & Treasury Health",
    fetch: fetchContentionRate,
  },
  treasuryRate: {
    name: "Treasury Rate",
    description: "Treasury balance rate",
    category: "Governance Action & Treasury Health",
    fetch: fetchTreasuryRate,
  },
  timeToEnactment: {
    name: "Time to Enactment",
    description: "Time-to-enactment statistics",
    category: "Governance Action & Treasury Health",
    fetch: fetchTimeToEnactment,
  },
  complianceStatus: {
    name: "Compliance Status",
    description: "Constitutional compliance clarity",
    category: "Governance Action & Treasury Health",
    fetch: fetchComplianceStatus,
  },

  // Category 5 - Constitutional Committee Activity
  ccTimeToDecision: {
    name: "CC Time to Decision",
    description: "CC time-to-decision statistics",
    category: "Constitutional Committee Activity",
    fetch: fetchCCTimeToDecision,
  },
  ccParticipation: {
    name: "CC Participation",
    description: "CC member participation rate",
    category: "Constitutional Committee Activity",
    fetch: fetchCCParticipation,
  },
  ccAbstainRate: {
    name: "CC Abstain Rate",
    description: "CC abstain rate",
    category: "Constitutional Committee Activity",
    fetch: fetchCCAbstainRate,
  },
  ccAgreementRate: {
    name: "CC Agreement Rate",
    description: "CC vote agreement rate",
    category: "Constitutional Committee Activity",
    fetch: fetchCCAgreementRate,
  },

  // Category 6 - Tooling & UX
  infoAvailability: {
    name: "Info Availability",
    description: "Gov info availability",
    category: "Tooling & UX",
    fetch: fetchInfoAvailability,
  },
} as const;

export type AnalyticsEndpointKey = keyof typeof ANALYTICS_ENDPOINTS;
