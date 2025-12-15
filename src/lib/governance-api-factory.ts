/**
 * Factory for creating Governance API clients
 * Provides easy switching between real API and mock data
 */

import type {
  IGovernanceApiClient,
  GovernanceApiConfig,
} from "./governance-api-interface";
import { RealGovernanceApiClient } from "./governance-api-real";

/**
 * Create a Governance API client based on configuration
 */
export function createGovernanceApiClient(
  config: GovernanceApiConfig
): IGovernanceApiClient {
  return new RealGovernanceApiClient(config.baseUrl, config.headers);
}

/**
 * Create a Governance API client based on environment
 * Currently always uses the real API implementation
 */
export function createGovernanceApiClientFromEnv(): IGovernanceApiClient {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

  return createGovernanceApiClient({
    baseUrl,
  });
}

/**
 * Singleton instance for convenience
 * Can be configured via environment variables:
 * - NEXT_PUBLIC_API_MODE: "real" | "mock"
 * - NEXT_PUBLIC_API_BASE_URL: API base URL
 */
let defaultClient: IGovernanceApiClient | null = null;

export function getGovernanceApiClient(): IGovernanceApiClient {
  if (!defaultClient) {
    defaultClient = createGovernanceApiClientFromEnv();
  }
  return defaultClient;
}

/**
 * Reset the default client (useful for testing)
 */
export function resetGovernanceApiClient(): void {
  defaultClient = null;
}

/**
 * Set a custom default client
 */
export function setGovernanceApiClient(client: IGovernanceApiClient): void {
  defaultClient = client;
}

// Export convenience function
export { RealGovernanceApiClient } from "./governance-api-real";

