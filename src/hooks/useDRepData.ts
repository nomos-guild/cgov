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
export interface DRepStatsApiResponse {
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
export function useDRepStats(fallbackData?: DRepStatsApiResponse) {
  const { data, error, isLoading, mutate } = useSWR<DRepStatsApiResponse>(
    API_ENDPOINTS.drepStats,
    fetcher,
    {
      fallbackData,
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
    delegatorCount?: number | null;
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
    delegatorCount: drep.delegatorCount ?? null,
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
 * Module-level cache for useAllDReps to avoid re-fetching on remount.
 */
const allDrepsCache = new Map<string, { data: DRepSummary[]; timestamp: number }>();
const ALL_DREPS_CACHE_TTL = 60000; // 1 minute

/**
 * Hook to fetch ALL DReps across all pages.
 * Handles backends that cap pageSize by auto-paginating.
 * Results are cached in memory so remounting doesn't trigger new API calls.
 */
export function useAllDReps(options: Omit<UseDRepListOptions, "page"> = {}, initialData?: DRepSummary[]) {
  const { pageSize = 100, sortBy = "votingPower", sortOrder = "desc", search } = options;

  const cacheKey = `${pageSize}:${sortBy}:${sortOrder}:${search ?? ""}`;
  const cached = allDrepsCache.get(cacheKey);
  const isCacheValid = cached && Date.now() - cached.timestamp < ALL_DREPS_CACHE_TTL;

  // Seed module cache from ISR data if no cache exists yet
  if (!isCacheValid && initialData?.length && !allDrepsCache.has(cacheKey)) {
    allDrepsCache.set(cacheKey, { data: initialData, timestamp: Date.now() });
  }

  const seeded = !isCacheValid && initialData?.length ? initialData : undefined;

  const [allDreps, setAllDreps] = useState<DRepSummary[]>(() => isCacheValid ? cached.data : seeded ?? []);
  const [isLoading, setIsLoading] = useState(() => !(isCacheValid || seeded));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    allDrepsCache.delete(cacheKey);
    setRefreshKey((k) => k + 1);
  }, [cacheKey]);

  useEffect(() => {
    // Serve from cache if still valid
    const entry = allDrepsCache.get(cacheKey);
    if (entry && Date.now() - entry.timestamp < ALL_DREPS_CACHE_TTL && refreshKey === 0) {
      setAllDreps(entry.data);
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
          allDrepsCache.set(cacheKey, { data: accumulated, timestamp: Date.now() });
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
  }, [pageSize, sortBy, sortOrder, search, cacheKey, refreshKey]);

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
    vote: string;
    votingPower: string | null;
    votingPowerAda?: string;
    rationale: string | null;
    anchorUrl: string | null;
    votedAt: string | null;
    txHash: string;
  }>;
  pagination: DRepPagination;
}

/**
 * Normalise vote string from backend (uppercase) to title-case.
 * Backend returns "YES" / "NO" / "ABSTAIN"; frontend uses "Yes" / "No" / "Abstain".
 */
function normalizeVote(raw: string): "Yes" | "No" | "Abstain" {
  const upper = raw.toUpperCase();
  if (upper === "YES") return "Yes";
  if (upper === "NO") return "No";
  return "Abstain";
}

/**
 * Format SCREAMING_SNAKE_CASE proposal type to human-readable label.
 * e.g. "TREASURY_WITHDRAWALS" → "Treasury Withdrawals"
 */
function formatProposalType(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Transform API vote record to frontend format
 */
function transformVoteRecord(vote: DRepVotesApiResponse["votes"][0]): DRepVoteRecord {
  // Backend may or may not include votingPowerAda; fall back to lovelace conversion
  const votingPowerAda = vote.votingPowerAda
    ? parseFloat(vote.votingPowerAda) || 0
    : vote.votingPower
      ? Number(vote.votingPower) / 1_000_000
      : 0;

  return {
    proposalId: vote.proposalId,
    proposalTitle: vote.proposalTitle,
    proposalType: formatProposalType(vote.proposalType),
    vote: normalizeVote(vote.vote),
    votingPower: vote.votingPower,
    votingPowerAda,
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

/** Response from /api/dreps/rationale-stats */
interface DRepRationaleStatsResponse {
  dreps: Array<{
    drepId: string;
    totalVotesCast: number;
    rationalesProvided: number;
  }>;
}

/**
 * Hook to fetch aggregated rationale stats for ALL DReps.
 * Single API call — the server does the heavy lifting.
 * Results are sorted by voting power (desc) to match the DRep list.
 */
export function useDRepRationaleStats() {
  const { data, error, isLoading, mutate } = useSWR<DRepRationaleStatsResponse>(
    API_ENDPOINTS.drepRationaleStats,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 300000, // 5 minutes (server caches for 5 min too)
    }
  );

  return {
    dreps: data?.dreps || [],
    isLoading,
    error: error?.message || null,
    refresh: () => mutate(),
  };
}
