/**
 * SWR-based data fetching hooks for DRep data
 */

import { useState, useEffect, useCallback, useRef } from "react";
import useSWR from "swr";
import { API_ENDPOINTS } from "@/config/api";
import type {
  DRepStats,
  DRepSummary,
  DRepDetail,
  DRepVoteRecord,
  DRepPagination,
  DRepSortBy,
  SortOrder,
  VoteBreakdown,
} from "@/types/drep";

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

/** Raw API response for DRep list */
interface DRepListApiResponse {
  dreps: Array<{
    drepId: string;
    name: string | null;
    iconUrl: string | null;
    votingPower: string;
    votingPowerAda: string;
    totalVotesCast: number;
  }>;
  pagination: DRepPagination;
}

/**
 * Transform API DRep summary to frontend format
 */
function transformDRepSummary(drep: DRepListApiResponse["dreps"][0]): DRepSummary {
  return {
    drepId: drep.drepId,
    name: drep.name,
    iconUrl: drep.iconUrl,
    votingPower: drep.votingPower,
    votingPowerAda: parseFloat(drep.votingPowerAda) || 0,
    totalVotesCast: drep.totalVotesCast,
  };
}

interface UseDRepListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: DRepSortBy;
  sortOrder?: SortOrder;
  search?: string;
}

/**
 * Hook to fetch paginated DRep list
 */
export function useDRepList(options: UseDRepListOptions = {}) {
  const { page = 1, pageSize = 100, sortBy = "votingPower", sortOrder = "desc", search } = options;

  // Build URL with query params
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  params.set("sortBy", sortBy);
  params.set("sortOrder", sortOrder);
  if (search) params.set("search", search);

  const url = `${API_ENDPOINTS.dreps}?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<DRepListApiResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    dreps: data?.dreps.map(transformDRepSummary) || [],
    pagination: data?.pagination || null,
    isLoading,
    error: error?.message || null,
    refresh: () => mutate(),
  };
}

/**
 * Hook to fetch ALL DReps across all pages.
 * Handles backends that cap pageSize by auto-paginating.
 */
export function useAllDReps(options: Omit<UseDRepListOptions, "page"> = {}) {
  const { pageSize = 100, sortBy = "votingPower", sortOrder = "desc", search } = options;

  const [allDreps, setAllDreps] = useState<DRepSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    async function fetchAllPages() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch page 1 to learn totalPages
        const firstParams = new URLSearchParams();
        firstParams.set("page", "1");
        firstParams.set("pageSize", String(pageSize));
        firstParams.set("sortBy", sortBy);
        firstParams.set("sortOrder", sortOrder);
        if (search) firstParams.set("search", search);

        const firstRes = await fetch(
          `${API_ENDPOINTS.dreps}?${firstParams.toString()}`,
          { signal: controller.signal }
        );
        if (!firstRes.ok) throw new Error(await firstRes.text() || firstRes.statusText);

        const firstData: DRepListApiResponse = await firstRes.json();
        const accumulated = firstData.dreps.map(transformDRepSummary);
        const { totalPages } = firstData.pagination;

        // Fetch remaining pages in parallel
        if (totalPages > 1) {
          const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
          const results = await Promise.all(
            remaining.map(async (pg) => {
              const p = new URLSearchParams();
              p.set("page", String(pg));
              p.set("pageSize", String(pageSize));
              p.set("sortBy", sortBy);
              p.set("sortOrder", sortOrder);
              if (search) p.set("search", search);

              const res = await fetch(
                `${API_ENDPOINTS.dreps}?${p.toString()}`,
                { signal: controller.signal }
              );
              if (!res.ok) throw new Error(await res.text() || res.statusText);
              const data: DRepListApiResponse = await res.json();
              return data.dreps.map(transformDRepSummary);
            })
          );
          for (const page of results) {
            accumulated.push(...page);
          }
        }

        if (!controller.signal.aborted) {
          setAllDreps(accumulated);
          setIsLoading(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to fetch DReps");
          setIsLoading(false);
        }
      }
    }

    fetchAllPages();
    return () => controller.abort();
  }, [pageSize, sortBy, sortOrder, search, refreshKey]);

  return { dreps: allDreps, isLoading, error, refresh };
}

/** Raw API response for DRep detail */
interface DRepDetailApiResponse {
  drepId: string;
  name: string | null;
  iconUrl: string | null;
  paymentAddr: string | null;
  votingPower: string;
  votingPowerAda: string;
  totalVotesCast: number;
  voteBreakdown: VoteBreakdown;
  rationalesProvided: number;
  proposalParticipationPercent: number;
  delegatorCount: number | null;
}

/**
 * Transform API DRep detail to frontend format
 */
function transformDRepDetail(data: DRepDetailApiResponse): DRepDetail {
  return {
    drepId: data.drepId,
    name: data.name,
    iconUrl: data.iconUrl,
    paymentAddr: data.paymentAddr,
    votingPower: data.votingPower,
    votingPowerAda: parseFloat(data.votingPowerAda) || 0,
    totalVotesCast: data.totalVotesCast,
    voteBreakdown: data.voteBreakdown,
    rationalesProvided: data.rationalesProvided,
    proposalParticipationPercent: data.proposalParticipationPercent,
    delegatorCount: data.delegatorCount ?? null,
  };
}

/**
 * Hook to fetch DRep detail by ID
 */
export function useDRepDetail(drepId: string | null) {
  const url = drepId ? API_ENDPOINTS.drepDetail(drepId) : null;

  const { data, error, isLoading, mutate } = useSWR<DRepDetailApiResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000,
    }
  );

  return {
    drep: data ? transformDRepDetail(data) : null,
    isLoading,
    error: error?.message || null,
    refresh: () => mutate(),
  };
}

/** Raw API response for DRep votes */
interface DRepVotesApiResponse {
  drepId: string;
  votes: Array<{
    proposalId: string;
    proposalTitle: string;
    proposalType: string | null;
    vote: "Yes" | "No" | "Abstain";
    votingPower: string | null;
    votingPowerAda: string;
    rationale: string | null;
    anchorUrl: string | null;
    votedAt: string | null;
    txHash: string;
  }>;
  pagination: DRepPagination;
}

/**
 * Transform API vote record to frontend format
 */
function transformVoteRecord(vote: DRepVotesApiResponse["votes"][0]): DRepVoteRecord {
  return {
    proposalId: vote.proposalId,
    proposalTitle: vote.proposalTitle,
    proposalType: vote.proposalType,
    vote: vote.vote,
    votingPower: vote.votingPower,
    votingPowerAda: parseFloat(vote.votingPowerAda) || 0,
    rationale: vote.rationale,
    anchorUrl: vote.anchorUrl,
    votedAt: vote.votedAt,
    txHash: vote.txHash,
  };
}

interface UseDRepVotesOptions {
  page?: number;
  pageSize?: number;
}

/**
 * Hook to fetch DRep voting history
 */
export function useDRepVotes(drepId: string | null, options: UseDRepVotesOptions = {}) {
  const { page = 1, pageSize = 20 } = options;

  // Build URL with query params
  let url: string | null = null;
  if (drepId) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    url = `${API_ENDPOINTS.drepVotes(drepId)}?${params.toString()}`;
  }

  const { data, error, isLoading, mutate } = useSWR<DRepVotesApiResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000,
    }
  );

  return {
    votes: data?.votes.map(transformVoteRecord) || [],
    pagination: data?.pagination || null,
    isLoading,
    error: error?.message || null,
    refresh: () => mutate(),
  };
}

/**
 * Hook to fetch ALL votes for a DRep across all pages.
 * Useful for building aggregate charts (e.g. monthly activity).
 */
export function useAllDRepVotes(drepId: string | null) {
  const [allVotes, setAllVotes] = useState<DRepVoteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!drepId) {
      setAllVotes([]);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    async function fetchAllPages() {
      setIsLoading(true);
      setError(null);

      try {
        const pageSize = 100;
        const firstParams = new URLSearchParams();
        firstParams.set("page", "1");
        firstParams.set("pageSize", String(pageSize));

        const firstRes = await fetch(
          `${API_ENDPOINTS.drepVotes(drepId!)}?${firstParams.toString()}`,
          { signal: controller.signal }
        );
        if (!firstRes.ok) throw new Error(await firstRes.text() || firstRes.statusText);

        const firstData: DRepVotesApiResponse = await firstRes.json();
        const accumulated = firstData.votes.map(transformVoteRecord);
        const { totalPages } = firstData.pagination;

        if (totalPages > 1) {
          const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
          const results = await Promise.all(
            remaining.map(async (pg) => {
              const p = new URLSearchParams();
              p.set("page", String(pg));
              p.set("pageSize", String(pageSize));

              const res = await fetch(
                `${API_ENDPOINTS.drepVotes(drepId!)}?${p.toString()}`,
                { signal: controller.signal }
              );
              if (!res.ok) throw new Error(await res.text() || res.statusText);
              const data: DRepVotesApiResponse = await res.json();
              return data.votes.map(transformVoteRecord);
            })
          );
          for (const page of results) {
            accumulated.push(...page);
          }
        }

        if (!controller.signal.aborted) {
          setAllVotes(accumulated);
          setIsLoading(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to fetch votes");
          setIsLoading(false);
        }
      }
    }

    fetchAllPages();
    return () => controller.abort();
  }, [drepId]);

  return { votes: allVotes, isLoading, error };
}
