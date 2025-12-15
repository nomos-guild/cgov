/**
 * Mock implementation of Governance API
 * Uses local mock data for development and testing
 */

import type { IGovernanceApiClient } from "./governance-api-interface";
import type {
  GovernanceAction,
  GovernanceActionDetail,
  NCLData,
} from "@/types/governance";
import type { ProposalsQueryParams } from "./cgov-api-types";
import {
  mockGovernanceActions,
  getActionByProposalId,
  mockNCLData,
} from "@/data/mockData";

export class MockGovernanceApiClient implements IGovernanceApiClient {
  /**
   * Get list of governance proposals from mock data
   */
  async getProposals(
    params?: ProposalsQueryParams
  ): Promise<GovernanceAction[]> {
    // Simulate network delay
    await this.simulateDelay();

    let results = [...mockGovernanceActions];

    // Apply sorting
    if (params?.order === "desc") {
      results = results.reverse();
    }

    // Apply pagination
    if (params?.page && params?.count) {
      const start = (params.page - 1) * params.count;
      const end = start + params.count;
      results = results.slice(start, end);
    } else if (params?.count) {
      results = results.slice(0, params.count);
    }

    return results;
  }

  /**
   * Get detailed proposal by ID from mock data
   */
  async getProposalById(
    proposalId: string
  ): Promise<GovernanceActionDetail | null> {
    // Simulate network delay
    await this.simulateDelay();

    const action = getActionByProposalId(proposalId);
    return action || null;
  }

  /**
   * Get NCL data from mock data
   */
  async getNCLData(): Promise<NCLData> {
    // Simulate network delay
    await this.simulateDelay();

    return mockNCLData;
  }

  /**
   * Mock sign in (always succeeds)
   */
  async signIn(walletAddress: string): Promise<{
    success: boolean;
    token?: string;
  }> {
    // Simulate network delay
    await this.simulateDelay();

    return {
      success: true,
      token: `mock_token_${walletAddress.substring(0, 10)}`,
    };
  }

  /**
   * Simulate network delay for more realistic mock behavior
   */
  private async simulateDelay(ms: number = 300): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

