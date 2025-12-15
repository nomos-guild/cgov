/**
 * Real API implementation of Governance API
 * Wraps the CgovApiClient with minimal conversion
 */

import type { IGovernanceApiClient } from "./governance-api-interface";
import type {
  GovernanceAction,
  GovernanceActionDetail,
  NCLData,
} from "@/types/governance";
import type { 
  GetProposalListReponse,
  GetProposalInfoResponse,
} from "./cgov-api-types";
import { CgovApiClient } from "./cgov-api-client";

export class RealGovernanceApiClient implements IGovernanceApiClient {
  private client: CgovApiClient;

  constructor(baseUrl?: string, headers?: Record<string, string>) {
    this.client = new CgovApiClient({ baseUrl, headers });
  }

  /**
   * Get list of governance proposals from real API
   * Note: params not yet implemented in API client
   */
  async getProposals(): Promise<GovernanceAction[]> {
    try {
      const response = await this.client.getProposalsList();
      return this.convertProposalsList(response);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      throw error;
    }
  }

  /**
   * Get detailed proposal by ID from real API
   */
  async getProposalById(
    proposalId: string
  ): Promise<GovernanceActionDetail | null> {
    try {
      const response = await this.client.getProposalById(proposalId);
      return this.convertProposalDetail(response);
    } catch (error) {
      console.error(`Error fetching proposal ${proposalId}:`, error);
      return null;
    }
  }

  /**
   * Get NCL data from real API
   */
  async getNCLData(): Promise<NCLData> {
    try {
      const response = await this.client.getNCLData();
      return {
        year: response.year,
        currentValue: response.currentValue,
        targetValue: response.targetValue,
      };
    } catch (error) {
      console.error("Error fetching NCL data:", error);
      throw error;
    }
  }

  /**
   * Sign in with wallet address
   */
  async signIn(walletAddress: string): Promise<{
    success: boolean;
    token?: string;
  }> {
    try {
      const response = await this.client.signInAndSetToken(walletAddress);
      return {
        success: response.success,
        token: response.token,
      };
    } catch (error) {
      console.error("Error signing in:", error);
      return { success: false };
    }
  }

  /**
   * Convert API proposal list to app format (minimal conversion)
   */
  private convertProposalsList(
    response: GetProposalListReponse
  ): GovernanceAction[] {
    // Validate response structure
    if (!response || !Array.isArray(response.proposals)) {
      console.error("Invalid proposals list response:", response);
      return [];
    }

    return response.proposals.map((proposal) => {
      // Parse certIndex from proposalId (format: "txHash:certIndex")
      let certIndex = 0;
      if (proposal.proposalId && proposal.proposalId.includes(':')) {
        const parts = proposal.proposalId.split(':');
        certIndex = parseInt(parts[1], 10) || 0;
      }

      return {
        ...proposal,
        id: proposal.proposalId, // Map proposalId to id
        certIndex, // Add parsed certIndex
      };
    }) as GovernanceAction[];
  }

  /**
   * Convert API proposal detail to app format (minimal conversion)
   */
  private convertProposalDetail(
    response: GetProposalInfoResponse
  ): GovernanceActionDetail {
    // Validate response structure
    if (!response) {
      throw new Error("Invalid proposal detail response: response is null or undefined");
    }

    // Convert votes to add votingPowerAda
    const votes = Array.isArray(response.votes)
      ? response.votes.map((vote) => ({
          ...vote,
          votingPowerAda: vote.votingPower
            ? parseFloat(vote.votingPower) / 1_000_000
            : undefined,
        }))
      : undefined;

    const ccVotes = Array.isArray(response.ccVotes)
      ? response.ccVotes.map((vote) => ({
          ...vote,
          votingPowerAda: vote.votingPower
            ? parseFloat(vote.votingPower) / 1_000_000
            : undefined,
        }))
      : undefined;

    return {
      ...response,
      certIndex: response.certIndex || 0,
      votes,
      ccVotes,
    } as GovernanceActionDetail;
  }

  /**
   * Get the underlying client for direct access if needed
   */
  getClient(): CgovApiClient {
    return this.client;
  }
}

