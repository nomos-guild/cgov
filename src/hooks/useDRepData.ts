/**
 * SWR-based data fetching hooks for DRep data
 */

import useSWR from "swr";
import { API_ENDPOINTS } from "@/config/api";
import type { DRepStats } from "@/types/drep";

/**
 * Generic fetcher for SWR
 */
async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return response.json();
}

/** Raw API response for DRep stats */
interface DRepStatsApiResponse {
  totalDReps: number;
  totalDelegatedLovelace: string;
  totalDelegatedAda: string;
  totalVotesCast: number;
  activeDReps: number;
}

/**
 * Transform API response to frontend format
 */
function transformDRepStats(data: DRepStatsApiResponse): DRepStats {
  return {
    totalDReps: data.totalDReps,
    totalDelegatedLovelace: data.totalDelegatedLovelace,
    totalDelegatedAda: parseFloat(data.totalDelegatedAda) || 0,
    totalVotesCast: data.totalVotesCast,
    activeDReps: data.activeDReps,
  };
}

/**
 * Hook to fetch DRep statistics
 */
export function useDRepStats() {
  const { data, error, isLoading, mutate } = useSWR<DRepStatsApiResponse>(
    API_ENDPOINTS.drepStats,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    stats: data ? transformDRepStats(data) : null,
    isLoading,
    error: error?.message || null,
    refresh: () => mutate(),
  };
}
