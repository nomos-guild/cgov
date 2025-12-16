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
} as const;
