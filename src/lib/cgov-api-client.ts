/**
 * Client for Cardano Governance API
 * Based on https://nomos-guild.github.io/cgov-api/swagger.json
 */

import type {
  Proposal,
  SignInRequest,
  SignInResponse,
  GetNCLDataResponse,
  GetProposalListReponse,
  GetProposalInfoResponse,
  ProposalListItem,
  ErrorResponse,
  ProposalsQueryParams,
  ApiClientConfig,
} from "./cgov-api-types";

export class CgovApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || "http://localhost:3000";
    this.headers = {
      "Content-Type": "application/json",
      ...config.headers,
    };
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.headers["Authorization"] = `Bearer ${token}`;
  }

  /**
   * Remove authentication token
   */
  clearAuthToken(): void {
    delete this.headers["Authorization"];
  }

  /**
   * Internal fetch wrapper with error handling
   */
  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const error = data as ErrorResponse;
        throw new Error(error.message || error.error || `HTTP ${response.status}`);
      }

      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Unknown error occurred");
    }
  }

  /**
   * Build query string from params
   */
  private buildQueryString(params: Record<string, unknown>): string {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : "";
  }

  /**
   * Get Cardano governance proposals
   * Default behavior fetches ALL proposals across all pages automatically.
   * Specify the 'page' parameter to fetch only that specific page.
   */
  async getProposals(params: ProposalsQueryParams = {}): Promise<Proposal[]> {
    const queryString = this.buildQueryString(params);
    return this.fetch<Proposal[]>(`/data/proposals${queryString}`);
  }

  /**
   * Get NCL (Net Carbon Liability) data overview
   */
  async getNCLData(): Promise<GetNCLDataResponse> {
    return this.fetch<GetNCLDataResponse>("/overview");
  }

  /**
   * Get governance proposals list
   */
  async getProposalsList(): Promise<GetProposalListReponse> {
    // API returns a plain array, so we need to wrap it
    const proposals = await this.fetch<ProposalListItem[]>("/overview/proposals");
    return {
      proposals: proposals || [],
      total: proposals?.length || 0,
    };
  }

  /**
   * Get proposal details by ID
   * @param proposalId - Proposal lookup key (tx hash or txHash:certIndex)
   */
  async getProposalById(proposalId: string): Promise<GetProposalInfoResponse> {
    const encodedId = encodeURIComponent(proposalId);
    return this.fetch<GetProposalInfoResponse>(`/proposal/${encodedId}`);
  }

  /**
   * Sign in with wallet address
   */
  async signIn(request: SignInRequest): Promise<SignInResponse> {
    return this.fetch<SignInResponse>("/user/sign-in", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * Sign in and automatically set the auth token
   */
  async signInAndSetToken(walletAddress: string): Promise<SignInResponse> {
    const response = await this.signIn({ walletAddress });
    
    if (response.success && response.token) {
      this.setAuthToken(response.token);
    }
    
    return response;
  }
}

/**
 * Create a new API client instance
 */
export function createCgovApiClient(config?: ApiClientConfig): CgovApiClient {
  return new CgovApiClient(config);
}

// Export default instance for convenience
export const cgovApi = new CgovApiClient();

