/**
 * SWR-based data fetching hooks for governance data
 *
 * These hooks provide client-side caching with stale-while-revalidate pattern.
 * They sync data to Redux for compatibility with existing components.
 */

import useSWR from "swr";
import { useCallback, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { API_ENDPOINTS } from "@/config/api";
import { normalizeProposalSurveyResponse } from "@/lib/surveyMetadata";
import { correctedWithdrawalAmount } from "@/lib/withdrawalAmountOverrides";

// useLayoutEffect on client (fires before paint), useEffect on server (avoids SSR warning)
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
import type {
  GovernanceAction,
  GovernanceActionDetail,
  OverviewSummary,
  NCLDisplayData,
  NCLYearData,
  ProposalSurveyResponse,
  ProposalSurveyTallyResponse,
  VoteRecord,
  ProposalReferenceObject,
} from "@/types/governance";
import { useAppDispatch } from "@/store/hooks";
import {
  setActions,
  setOverview,
  setNCLDataList,
  setTreasuryAda,
  setTreasuryHistory,
  setYearlySpent,
  setSelectedAction,
} from "@/store/governanceSlice";

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

/**
 * Convert lovelace string to ADA number
 */
function lovelaceToAdaNumber(lovelace: string | undefined): number {
  if (!lovelace) return 0;
  const adaValue = Number(lovelace) / 1_000_000;
  return Number.isFinite(adaValue) ? adaValue : 0;
}

/**
 * Transform API governance action to frontend format
 */
function transformGovernanceAction(action: GovernanceAction): GovernanceAction {
  const derivedTxHash =
    action.txHash ||
    (action.hash ? action.hash.split(/[:#]/)[0] : undefined);

  const drepYesAda = lovelaceToAdaNumber(action.drep?.yesLovelace);
  const drepNoAda = lovelaceToAdaNumber(action.drep?.noLovelace);
  const drepAbstainAda = lovelaceToAdaNumber(action.drep?.abstainLovelace);

  const spoYesAda = action.spo ? lovelaceToAdaNumber(action.spo.yesLovelace) : undefined;
  const spoNoAda = action.spo ? lovelaceToAdaNumber(action.spo.noLovelace) : undefined;
  const spoAbstainAda = action.spo ? lovelaceToAdaNumber(action.spo.abstainLovelace) : undefined;

  return {
    hash: action.hash,
    proposalId: action.proposalId,
    txHash: derivedTxHash,
    title: action.title || "Untitled Proposal",
    type: action.type,
    withdrawalAmount: correctedWithdrawalAmount(action.proposalId, action.withdrawalAmount),
    status: action.status,
    constitutionality: action.constitutionality || "Unspecified",
    drepYesPercent: action.drep?.yesPercent ?? 0,
    drepNoPercent: action.drep?.noPercent ?? 0,
    drepAbstainPercent: action.drep?.abstainPercent ?? 0,
    drepYesAda,
    drepNoAda,
    drepAbstainAda,
    spoYesPercent: action.spo?.yesPercent,
    spoNoPercent: action.spo?.noPercent,
    spoAbstainPercent: action.spo?.abstainPercent,
    spoYesAda,
    spoNoAda,
    spoAbstainAda,
    ccYesPercent: action.cc?.yesPercent,
    ccNoPercent: action.cc?.noPercent,
    ccAbstainPercent: action.cc?.abstainPercent,
    ccYesCount: action.cc?.yesCount,
    ccNoCount: action.cc?.noCount,
    ccAbstainCount: action.cc?.abstainCount,
    totalYes: action.totalYes ?? 0,
    totalNo: action.totalNo ?? 0,
    totalAbstain: action.totalAbstain ?? 0,
    submissionEpoch: action.submissionEpoch ?? 0,
    expiryEpoch: action.expiryEpoch ?? 0,
    threshold: action.threshold,
    votingStatus: action.votingStatus,
    rawVotingPowerValues: action.rawVotingPowerValues,
    drepBreakdown: (action.drep as { breakdown?: typeof action.drepBreakdown })?.breakdown ?? action.drepBreakdown,
    spoBreakdown: (action.spo as { breakdown?: typeof action.spoBreakdown })?.breakdown ?? action.spoBreakdown,
    governanceActionType: action.governanceActionType ?? action.type,
    drep: action.drep ? { ...action.drep, yesAda: drepYesAda, noAda: drepNoAda, abstainAda: drepAbstainAda } : undefined,
    spo: action.spo ? { ...action.spo, yesAda: spoYesAda, noAda: spoNoAda, abstainAda: spoAbstainAda } : undefined,
    cc: action.cc,
  };
}

/**
 * Transform NCL API response to display format
 */
// Known NCL targets (in ADA) – fallback when backend returns 0
const NCL_TARGETS_ADA: Record<number, number> = {
  2025: 350_000_000,
  2026: 350_000_000,
};

function transformNCLData(data: NCLYearData): NCLDisplayData {
  const currentAda = lovelaceToAdaNumber(data.currentValue);
  let targetAda = lovelaceToAdaNumber(data.targetValue);
  if (targetAda === 0 && NCL_TARGETS_ADA[data.year]) {
    targetAda = NCL_TARGETS_ADA[data.year];
  }
  const percentUsed = targetAda > 0 ? (currentAda / targetAda) * 100 : 0;

  return {
    year: data.year,
    currentValueAda: currentAda,
    targetValueAda: targetAda,
    percentUsed,
    epoch: data.epoch,
    updatedAt: data.updatedAt,
  };
}

/**
 * SWR configuration for governance data
 */
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60000, // Dedupe requests within 60 seconds
  errorRetryCount: 3,
};

/**
 * Initial data from ISR/SSR for hydration
 */
export interface TreasuryHistoryPoint {
  epoch: number;
  treasuryAda: number;
}

interface TreasuryResponse {
  treasuryAda: number;
  epoch: number | null;
  history: TreasuryHistoryPoint[];
  yearlySpent: Record<string, number>;
}

export interface InitialGovernanceData {
  actions?: GovernanceAction[];
  overview?: OverviewSummary | null;
  nclData?: NCLDisplayData[];
  treasuryAda?: number | null;
}

/**
 * Hook for fetching governance actions with SWR caching
 * @param fallbackData - Initial data from getStaticProps for instant hydration
 */
export function useGovernanceActions(fallbackData?: GovernanceAction[]) {
  const dispatch = useAppDispatch();

  const { data, error, isLoading, mutate } = useSWR<GovernanceAction[]>(
    API_ENDPOINTS.proposals,
    fetcher,
    {
      ...swrConfig,
      fallbackData,
      revalidateOnMount: !fallbackData, // Skip initial fetch if we have fallback data
    }
  );

  // Transform data and sync to Redux before browser paint to avoid visible flash
  useIsomorphicLayoutEffect(() => {
    if (data) {
      const transformed = data.map(transformGovernanceAction);
      dispatch(setActions(transformed));
    }
  }, [data, dispatch]);

  // Memoize the transformed array — without this, every consumer re-runs
  // the lovelace→ADA transform on every render, even when the underlying
  // SWR data hasn't changed identity.
  const transformedActions = useMemo(
    () => (data ? data.map(transformGovernanceAction) : []),
    [data]
  );

  return {
    actions: transformedActions,
    isLoading: !fallbackData && isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

/**
 * Hook for fetching overview summary with SWR caching
 * @param fallbackData - Initial data from getStaticProps for instant hydration
 */
export function useOverviewSummary(fallbackData?: OverviewSummary | null) {
  const dispatch = useAppDispatch();

  const { data, error, isLoading, mutate } = useSWR<OverviewSummary>(
    API_ENDPOINTS.overview,
    fetcher,
    {
      ...swrConfig,
      fallbackData: fallbackData ?? undefined,
      revalidateOnMount: !fallbackData,
    }
  );

  // Sync to Redux before browser paint to avoid visible flash
  useIsomorphicLayoutEffect(() => {
    if (data) {
      dispatch(setOverview(data));
    }
  }, [data, dispatch]);

  return {
    overview: data ?? null,
    isLoading: !fallbackData && isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

/**
 * Hook for fetching NCL data with SWR caching
 * @param fallbackData - Initial data from getStaticProps for instant hydration
 */
export function useNCLData(fallbackData?: NCLDisplayData[]) {
  const dispatch = useAppDispatch();

  // Convert fallback to raw format for SWR (it will be transformed)
  const { data, error, isLoading, mutate } = useSWR<NCLYearData[]>(
    API_ENDPOINTS.ncl,
    fetcher,
    {
      ...swrConfig,
      dedupingInterval: 300000, // NCL data is very stable, 5 min deduping
      revalidateOnMount: !fallbackData,
    }
  );

  // Transform and sync to Redux before browser paint to avoid visible flash
  useIsomorphicLayoutEffect(() => {
    // Use fallback data if available and no fresh data yet
    if (fallbackData && !data) {
      dispatch(setNCLDataList(fallbackData));
    } else if (data) {
      const transformed = data.map(transformNCLData);
      dispatch(setNCLDataList(transformed));
    }
  }, [data, fallbackData, dispatch]);

  return {
    nclData: data ? data.map(transformNCLData) : (fallbackData ?? []),
    isLoading: !fallbackData && isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

/**
 * Hook for fetching treasury balance with SWR caching
 * @param fallbackData - Initial data from getStaticProps for instant hydration
 */
export function useTreasuryData(fallbackData?: number | null) {
  const dispatch = useAppDispatch();

  const { data, error, isLoading, mutate } = useSWR<TreasuryResponse>(
    API_ENDPOINTS.treasury,
    fetcher,
    {
      ...swrConfig,
      dedupingInterval: 300000, // Treasury data is stable, 5 min deduping
      revalidateOnMount: true, // Always fetch — ISR only provides the scalar, we need history
    }
  );

  useIsomorphicLayoutEffect(() => {
    if (fallbackData != null && !data) {
      dispatch(setTreasuryAda(fallbackData));
    } else if (data) {
      dispatch(setTreasuryAda(data.treasuryAda));
      dispatch(setTreasuryHistory(data.history ?? []));
      dispatch(setYearlySpent(data.yearlySpent ?? {}));
    }
  }, [data, fallbackData, dispatch]);

  return {
    treasuryAda: data?.treasuryAda ?? fallbackData ?? null,
    history: data?.history ?? [],
    isLoading: fallbackData == null && isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

/**
 * Combined hook that fetches all governance data
 * Use this in pages to ensure data is loaded with SWR caching
 * @param initialData - Pre-fetched data from getStaticProps for instant hydration
 */
export function useGovernanceDataLoader(initialData?: InitialGovernanceData) {
  const actions = useGovernanceActions(initialData?.actions);
  const overview = useOverviewSummary(initialData?.overview);
  const ncl = useNCLData(initialData?.nclData);
  const treasury = useTreasuryData(initialData?.treasuryAda);

  const hasInitialData = Boolean(initialData?.actions?.length);

  // Stable identity so consumers' useEffect deps don't fire on every render
  // (e.g. the periodic refresh interval in TreasuryPageLayout). Extracted
  // to locals so react-hooks/exhaustive-deps can verify the deps without
  // demanding the entire parent objects (which change every render).
  const actionsRefresh = actions.refresh;
  const overviewRefresh = overview.refresh;
  const nclRefresh = ncl.refresh;
  const treasuryRefresh = treasury.refresh;
  const refresh = useCallback(() => {
    actionsRefresh();
    overviewRefresh();
    nclRefresh();
    treasuryRefresh();
  }, [actionsRefresh, overviewRefresh, nclRefresh, treasuryRefresh]);

  return {
    isLoading: actions.isLoading || overview.isLoading || ncl.isLoading || treasury.isLoading,
    error: actions.error || overview.error || ncl.error || treasury.error,
    hasData: hasInitialData || actions.actions.length > 0,
    refresh,
  };
}

// =============================================================================
// Proposal Detail Hook
// =============================================================================

/**
 * Transform a vote record's lovelace values to ADA
 */
function transformVoteRecord(vote: VoteRecord): VoteRecord {
  const votingPowerAda =
    vote.votingPowerAda !== undefined
      ? vote.votingPowerAda
      : lovelaceToAdaNumber(vote.votingPower);

  return {
    voterType: vote.voterType,
    voterId: vote.voterId,
    voterName: vote.voterName,
    drepId: vote.voterId || vote.drepId,
    drepName: vote.voterName || vote.voterId || vote.drepName,
    vote: vote.vote,
    votingPower: vote.votingPower ?? "0",
    votingPowerAda,
    anchorUrl: vote.anchorUrl,
    anchorHash: vote.anchorHash,
    rationale: vote.rationale,
    votedAt: vote.votedAt,
    txHash: vote.txHash,
    isPendingConfirmation: vote.isPendingConfirmation === true || vote.votingPower == null,
  };
}

/**
 * Normalise references from the upstream API to a consistent shape.
 * Mirrors the logic in services/api.ts transformGovernanceActionDetail.
 */
function normaliseReferences(
  refs: unknown[] | undefined
): ProposalReferenceObject[] | undefined {
  if (!Array.isArray(refs)) return undefined;

  return (refs as Array<string | ProposalReferenceObject>)
    .map((ref) => {
      if (!ref) return null;
      if (typeof ref === "string") {
        const value = ref.trim();
        if (!value) return null;
        return { uri: value, label: value } as ProposalReferenceObject;
      }
      if (typeof ref === "object") {
        const raw = ref as ProposalReferenceObject;
        const uri =
          raw.uri ||
          (raw as Record<string, unknown>).url?.toString?.() ||
          (raw as Record<string, unknown>).href?.toString?.();
        const label =
          raw.label && typeof raw.label === "string"
            ? raw.label
            : typeof uri === "string"
              ? uri
              : undefined;
        const upstreamType = (raw as Record<string, unknown>)["@type"];
        const type =
          typeof raw.type === "string"
            ? raw.type
            : typeof upstreamType === "string"
              ? upstreamType
              : undefined;
        if (!uri && !label) return null;
        const normalised: ProposalReferenceObject = {
          ...raw,
          uri: typeof uri === "string" ? uri : undefined,
          label,
        };
        if (type) normalised.type = type;
        return normalised;
      }
      return null;
    })
    .filter((v): v is ProposalReferenceObject => v !== null);
}

/**
 * Transform a full governance action detail (base fields + votes)
 */
function transformGovernanceActionDetail(
  detail: GovernanceActionDetail
): GovernanceActionDetail {
  const base = transformGovernanceAction(detail);
  return {
    ...base,
    description: detail.description,
    rationale: detail.rationale,
    references: normaliseReferences(detail.references as unknown[]),
    votes: detail.votes?.map(transformVoteRecord) ?? [],
    ccVotes: detail.ccVotes?.map(transformVoteRecord) ?? [],
  };
}

/**
 * Hook for fetching governance action detail with SWR caching.
 * Supports ISR fallback data for instant hydration and client-side navigation.
 *
 * @param proposalId - The proposal hash/ID to fetch, or null to disable fetching
 * @param fallbackData - Pre-fetched data from getStaticProps for instant hydration
 */
export function useGovernanceActionDetail(
  proposalId: string | null | undefined,
  fallbackData?: GovernanceActionDetail | null
) {
  const dispatch = useAppDispatch();
  const swrKey = proposalId ? API_ENDPOINTS.proposalDetail(proposalId) : null;

  const { data, error, isLoading, mutate } = useSWR<GovernanceActionDetail>(
    swrKey,
    fetcher,
    {
      ...swrConfig,
      fallbackData: fallbackData ?? undefined,
      revalidateOnMount: true, // Always fetch fresh data — detail pages show live voting
    }
  );

  // When fallbackData changes (client-side navigation delivers new ISR data),
  // seed the SWR cache so the UI updates instantly without waiting for a fetch.
  const prevFallbackRef = useRef(fallbackData);
  useEffect(() => {
    if (fallbackData && fallbackData !== prevFallbackRef.current) {
      mutate(fallbackData, false);
      prevFallbackRef.current = fallbackData;
    }
  }, [fallbackData, mutate]);

  const transformed = useMemo(
    () => (data ? transformGovernanceActionDetail(data) : null),
    [data]
  );

  // Sync to Redux for backward compatibility with components reading selectedAction
  useIsomorphicLayoutEffect(() => {
    if (transformed) {
      dispatch(setSelectedAction(transformed));
    }
  }, [transformed, dispatch]);

  return {
    detail: transformed,
    isLoading: !fallbackData && isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

export function useProposalSurvey(
  proposalId: string | null | undefined,
  fallbackData?: ProposalSurveyResponse | null
) {
  const swrKey = proposalId ? API_ENDPOINTS.proposalSurvey(proposalId) : null;

  const { data, error, isLoading, mutate } = useSWR<ProposalSurveyResponse>(
    swrKey,
    fetcher,
    {
      ...swrConfig,
      fallbackData: fallbackData ?? undefined,
      revalidateOnMount: true,
    }
  );

  return {
    survey: normalizeProposalSurveyResponse(data) ?? null,
    isLoading: !fallbackData && isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

export function useProposalSurveyTally(
  proposalId: string | null | undefined,
  enabled = true,
  fallbackData?: ProposalSurveyTallyResponse | null
) {
  const swrKey =
    proposalId && enabled ? API_ENDPOINTS.proposalSurveyTally(proposalId) : null;

  const { data, error, isLoading, mutate } = useSWR<ProposalSurveyTallyResponse>(
    swrKey,
    fetcher,
    {
      ...swrConfig,
      fallbackData: fallbackData ?? undefined,
      revalidateOnMount: enabled,
    }
  );

  return {
    tally: data ?? null,
    isLoading: enabled && !fallbackData && isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}
