/**
 * SWR-based data fetching hooks for DRep data
 */

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
    delegatorCount: data.delegatorCount,
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
