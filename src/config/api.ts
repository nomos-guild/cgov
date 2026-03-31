/**
 * API Configuration
 * Centralizes API endpoint configuration for the frontend
 *
 * All API calls are routed through Next.js API routes to keep
 * the backend API key secure on the server side.
 */

// API endpoints - these point to local Next.js API routes
// The actual backend URL and API key are configured via server-side
// environment variables (BACKEND_API_URL and BACKEND_API_KEY)
export const API_ENDPOINTS = {
  // Overview endpoints
  overview: "/api/overview",
  proposals: "/api/overview/proposals",
  ncl: "/api/overview/ncl",
  treasury: "/api/overview/treasury",
  nclByYear: (year: number) => `/api/overview/ncl/${year}`,

  // Proposal detail endpoint (requires proposal_id parameter)
  proposalDetail: (proposalId: string) =>
    `/api/proposal/${encodeURIComponent(proposalId)}`,
  proposalSurvey: (proposalId: string) =>
    `/api/proposal/${encodeURIComponent(proposalId)}/survey`,
  proposalSurveyTally: (proposalId: string) =>
    `/api/proposal/${encodeURIComponent(proposalId)}/survey-tally`,

  // Development Activity endpoints
  devOverview: (range: string) => `/api/development/overview?range=${range}&compare=previous`,
  devActivity: (range: string) => `/api/development/activity?range=${range}&compare=previous`,
  devRepos: (range: string, sort: string = "commits") => `/api/development/repos?sort=${sort}&range=${range}&limit=50`,
  devContributors: (range: string) => `/api/development/contributors?range=${range}`,
  devHealth: (range: string) => `/api/development/health?range=${range}&compare=previous`,
  devStars: (range: string) => `/api/development/stars?range=${range}`,
  devLanguages: "/api/development/languages?compare=previous",
  devNetwork: "/api/development/network",
  devRecent: "/api/development/recent?limit=50",

  // DRep endpoints
  drepStats: "/api/dreps/stats",
  dreps: "/api/dreps",
  drepsAll: "/api/dreps/all",
  drepDetail: (drepId: string) => `/api/dreps/${encodeURIComponent(drepId)}`,
  drepVerify: (drepId: string) =>
    `/api/dreps/${encodeURIComponent(drepId)}/verify`,
  drepVotes: (drepId: string) =>
    `/api/dreps/${encodeURIComponent(drepId)}/votes`,
  drepHistory: (drepId: string) =>
    `/api/dreps/${encodeURIComponent(drepId)}/history`,
  drepEngagementStats: "/api/dreps/engagement-stats",

  // Analytics endpoints - Category 1: Ada Holder Participation
  analyticsVotingTurnout: "/api/analytics/voting-turnout",
  analyticsStakeParticipation: "/api/analytics/stake-participation",
  analyticsDelegationRate: "/api/analytics/delegation-rate",
  analyticsDelegationDistribution: "/api/analytics/delegation-distribution",
  analyticsNewDelegationRate: "/api/analytics/new-delegation-rate",
  analyticsInactiveAda: "/api/analytics/inactive-ada",

  // Analytics endpoints - Category 2: DRep Insights & Activity
  analyticsGiniCoefficient: "/api/analytics/gini-coefficient",
  analyticsDRepActivityRate: "/api/analytics/drep-activity-rate",
  analyticsDRepRationaleRate: "/api/analytics/drep-rationale-rate",
  analyticsDRepCorrelation: "/api/analytics/drep-correlation",
  analyticsDRepLifecycleRate: "/api/analytics/drep-lifecycle-rate",

  // Analytics endpoints - Category 3: SPO Governance Participation
  analyticsSpoSilentStake: "/api/analytics/spo-silent-stake",
  analyticsSpoDefaultStance: "/api/analytics/spo-default-stance",
  analyticsEntityConcentration: "/api/analytics/entity-concentration",
  analyticsVoteDivergence: "/api/analytics/vote-divergence",

  // Analytics endpoints - Category 4: Governance Action & Treasury Health
  analyticsActionVolume: "/api/analytics/action-volume",
  analyticsContentionRate: "/api/analytics/contention-rate",
  analyticsTreasuryRate: "/api/analytics/treasury-rate",
  analyticsTimeToEnactment: "/api/analytics/time-to-enactment",
  analyticsComplianceStatus: "/api/analytics/compliance-status",

  // Analytics endpoints - Category 5: Constitutional Committee Activity
  analyticsCCTimeToDecision: "/api/analytics/cc-time-to-decision",
  analyticsCCParticipation: "/api/analytics/cc-participation",
  analyticsCCAbstainRate: "/api/analytics/cc-abstain-rate",
  analyticsCCAgreementRate: "/api/analytics/cc-agreement-rate",

  // Analytics endpoints - Category 6: Tooling & UX
  analyticsInfoAvailability: "/api/analytics/info-availability",

  // Analytics endpoints - DRep Concentration
  analyticsConcentrationHistory: "/api/analytics/drep-concentration-history",

  // IPFS upload
  ipfsUpload: "/api/ipfs/upload",
} as const;
