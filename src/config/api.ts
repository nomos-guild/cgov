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
  nclByYear: (year: number) => `/api/overview/ncl/${year}`,

  // Proposal detail endpoint (requires proposal_id parameter)
  proposalDetail: (proposalId: string) =>
    `/api/proposal/${encodeURIComponent(proposalId)}`,

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
} as const;
