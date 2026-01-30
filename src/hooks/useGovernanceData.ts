/**
 * SWR-based data fetching hooks for governance data
 *
 * These hooks provide client-side caching with stale-while-revalidate pattern.
 * They sync data to Redux for compatibility with existing components.
 */

import useSWR from "swr";
import { useEffect } from "react";
import { API_ENDPOINTS } from "@/config/api";
import type {
  GovernanceAction,
  OverviewSummary,
  NCLDisplayData,
  NCLYearData,
} from "@/types/governance";
import { useAppDispatch } from "@/store/hooks";
import {
  setActions,
  setOverview,
  setNCLDataList,
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
function transformNCLData(data: NCLYearData): NCLDisplayData {
  const currentAda = lovelaceToAdaNumber(data.currentValue);
  const targetAda = lovelaceToAdaNumber(data.targetValue);
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
 * Hook for fetching governance actions with SWR caching
 */
export function useGovernanceActions() {
  const dispatch = useAppDispatch();

  const { data, error, isLoading, mutate } = useSWR<GovernanceAction[]>(
    API_ENDPOINTS.proposals,
    fetcher,
    swrConfig
  );

  // Transform data and sync to Redux
  useEffect(() => {
    if (data) {
      const transformed = data.map(transformGovernanceAction);
      dispatch(setActions(transformed));
    }
  }, [data, dispatch]);

  return {
    actions: data ? data.map(transformGovernanceAction) : [],
    isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

/**
 * Hook for fetching overview summary with SWR caching
 */
export function useOverviewSummary() {
  const dispatch = useAppDispatch();

  const { data, error, isLoading, mutate } = useSWR<OverviewSummary>(
    API_ENDPOINTS.overview,
    fetcher,
    swrConfig
  );

  // Sync to Redux
  useEffect(() => {
    if (data) {
      dispatch(setOverview(data));
    }
  }, [data, dispatch]);

  return {
    overview: data ?? null,
    isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

/**
 * Hook for fetching NCL data with SWR caching
 */
export function useNCLData() {
  const dispatch = useAppDispatch();

  const { data, error, isLoading, mutate } = useSWR<NCLYearData[]>(
    API_ENDPOINTS.ncl,
    fetcher,
    {
      ...swrConfig,
      dedupingInterval: 300000, // NCL data is very stable, 5 min deduping
    }
  );

  // Transform and sync to Redux
  useEffect(() => {
    if (data) {
      const transformed = data.map(transformNCLData);
      dispatch(setNCLDataList(transformed));
    }
  }, [data, dispatch]);

  return {
    nclData: data ? data.map(transformNCLData) : [],
    isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}

/**
 * Combined hook that fetches all governance data
 * Use this in pages to ensure data is loaded with SWR caching
 */
export function useGovernanceDataLoader() {
  const actions = useGovernanceActions();
  const overview = useOverviewSummary();
  const ncl = useNCLData();

  return {
    isLoading: actions.isLoading || overview.isLoading || ncl.isLoading,
    error: actions.error || overview.error || ncl.error,
    hasData: actions.actions.length > 0,
    refresh: () => {
      actions.refresh();
      overview.refresh();
      ncl.refresh();
    },
  };
}
