/**
 * Interface for Governance API operations
 * Allows switching between real API and mock data
 */

import type {
  GovernanceAction,
  GovernanceActionDetail,
  NCLData,
} from "@/types/governance";
import type { ProposalsQueryParams } from "./cgov-api-types";

export interface IGovernanceApiClient {
  /**
   * Get list of governance proposals
   */
  getProposals(params?: ProposalsQueryParams): Promise<GovernanceAction[]>;

  /**
   * Get detailed proposal by ID
   */
  getProposalById(proposalId: string): Promise<GovernanceActionDetail | null>;

  /**
   * Get NCL data
   */
  getNCLData(): Promise<NCLData>;

  /**
   * Sign in with wallet address (optional for some implementations)
   */
  signIn?(walletAddress: string): Promise<{ success: boolean; token?: string }>;
}

export type ApiMode = "real" | "mock";

export interface GovernanceApiConfig {
  mode: ApiMode;
  baseUrl?: string;
  headers?: Record<string, string>;
}

