/**
 * Global API Context - single instance created at app startup
 * Provides either Real API or Mock client based on environment
 */

import { createContext, useContext, ReactNode } from "react";
import { getGovernanceApiClient } from "@/lib/governance-api-factory";
import type { IGovernanceApiClient } from "@/lib/governance-api-interface";

const GovernanceApiContext = createContext<IGovernanceApiClient | null>(null);

interface GovernanceApiProviderProps {
  children: ReactNode;
}

export function GovernanceApiProvider({ children }: GovernanceApiProviderProps) {
  // Single global instance - created once at app startup
  const client = getGovernanceApiClient();

  return (
    <GovernanceApiContext.Provider value={client}>
      {children}
    </GovernanceApiContext.Provider>
  );
}

/**
 * Hook to access the global API client
 * Throws error if used outside provider
 */
export function useGovernanceApi(): IGovernanceApiClient {
  const context = useContext(GovernanceApiContext);
  
  if (!context) {
    throw new Error("useGovernanceApi must be used within GovernanceApiProvider");
  }
  
  return context;
}

