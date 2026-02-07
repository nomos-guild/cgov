import useSWR from "swr";
import { useEffect } from "react";
import { API_ENDPOINTS } from "@/config/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setOverview,
  setActivity,
  setRepos,
  setContributors,
  setHealth,
  setStars,
  setLanguages,
  setNetwork,
  setRecent,
} from "@/store/developmentSlice";
import type {
  DevelopmentOverview,
  DevelopmentActivity,
  DevelopmentRepos,
  DevelopmentContributors,
  DevelopmentHealth,
  DevelopmentStars,
  DevelopmentLanguages,
  NetworkGraphData,
  DevelopmentRecent,
} from "@/types/development";

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

const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60000,
  errorRetryCount: 3,
};

function useDevOverview(range: string) {
  const dispatch = useAppDispatch();
  const { data, error, isLoading, mutate } = useSWR<DevelopmentOverview>(
    API_ENDPOINTS.devOverview(range),
    fetcher,
    swrConfig
  );

  useEffect(() => {
    if (data) dispatch(setOverview(data));
  }, [data, dispatch]);

  return { data: data ?? null, isLoading, error: error?.message ?? null, refresh: mutate };
}

function useDevActivity(range: string) {
  const dispatch = useAppDispatch();
  const { data, error, isLoading, mutate } = useSWR<DevelopmentActivity>(
    API_ENDPOINTS.devActivity(range),
    fetcher,
    swrConfig
  );

  useEffect(() => {
    if (data) dispatch(setActivity(data));
  }, [data, dispatch]);

  return { data: data ?? null, isLoading, error: error?.message ?? null, refresh: mutate };
}

function useDevRepos(range: string) {
  const dispatch = useAppDispatch();
  const { data, error, isLoading, mutate } = useSWR<DevelopmentRepos>(
    API_ENDPOINTS.devRepos(range),
    fetcher,
    swrConfig
  );

  useEffect(() => {
    if (data) dispatch(setRepos(data));
  }, [data, dispatch]);

  return { data: data ?? null, isLoading, error: error?.message ?? null, refresh: mutate };
}

function useDevContributors(range: string) {
  const dispatch = useAppDispatch();
  const { data, error, isLoading, mutate } = useSWR<DevelopmentContributors>(
    API_ENDPOINTS.devContributors(range),
    fetcher,
    swrConfig
  );

  useEffect(() => {
    if (data) dispatch(setContributors(data));
  }, [data, dispatch]);

  return { data: data ?? null, isLoading, error: error?.message ?? null, refresh: mutate };
}

function useDevHealth(range: string) {
  const dispatch = useAppDispatch();
  const { data, error, isLoading, mutate } = useSWR<DevelopmentHealth>(
    API_ENDPOINTS.devHealth(range),
    fetcher,
    swrConfig
  );

  useEffect(() => {
    if (data) dispatch(setHealth(data));
  }, [data, dispatch]);

  return { data: data ?? null, isLoading, error: error?.message ?? null, refresh: mutate };
}

function useDevStars(range: string) {
  const dispatch = useAppDispatch();
  const { data, error, isLoading, mutate } = useSWR<DevelopmentStars>(
    API_ENDPOINTS.devStars(range),
    fetcher,
    swrConfig
  );

  useEffect(() => {
    if (data) dispatch(setStars(data));
  }, [data, dispatch]);

  return { data: data ?? null, isLoading, error: error?.message ?? null, refresh: mutate };
}

function useDevLanguages() {
  const dispatch = useAppDispatch();
  const { data, error, isLoading, mutate } = useSWR<DevelopmentLanguages>(
    API_ENDPOINTS.devLanguages,
    fetcher,
    { ...swrConfig, dedupingInterval: 300000 }
  );

  useEffect(() => {
    if (data) dispatch(setLanguages(data));
  }, [data, dispatch]);

  return { data: data ?? null, isLoading, error: error?.message ?? null, refresh: mutate };
}

function useDevNetwork() {
  const dispatch = useAppDispatch();
  const { data, error, isLoading, mutate } = useSWR<NetworkGraphData>(
    API_ENDPOINTS.devNetwork,
    fetcher,
    { ...swrConfig, dedupingInterval: 300000 }
  );

  useEffect(() => {
    if (data) dispatch(setNetwork(data));
  }, [data, dispatch]);

  return { data: data ?? null, isLoading, error: error?.message ?? null, refresh: mutate };
}

function useDevRecent() {
  const dispatch = useAppDispatch();
  const { data, error, isLoading, mutate } = useSWR<DevelopmentRecent>(
    API_ENDPOINTS.devRecent,
    fetcher,
    swrConfig
  );

  useEffect(() => {
    if (data) dispatch(setRecent(data));
  }, [data, dispatch]);

  return { data: data ?? null, isLoading, error: error?.message ?? null, refresh: mutate };
}

export function useDevelopmentDataLoader() {
  const range = useAppSelector((state) => state.development.selectedRange);

  const overview = useDevOverview(range);
  const activity = useDevActivity(range);
  const repos = useDevRepos(range);
  const contributors = useDevContributors(range);
  const health = useDevHealth(range);
  const stars = useDevStars(range);
  const languages = useDevLanguages();
  const network = useDevNetwork();
  const recent = useDevRecent();

  return {
    isLoading:
      overview.isLoading || activity.isLoading || repos.isLoading ||
      contributors.isLoading || health.isLoading || stars.isLoading ||
      languages.isLoading || network.isLoading || recent.isLoading,
    error:
      overview.error || activity.error || repos.error ||
      contributors.error || health.error || stars.error ||
      languages.error || network.error || recent.error,
    hasData: overview.data !== null,
    refresh: () => {
      overview.refresh();
      activity.refresh();
      repos.refresh();
      contributors.refresh();
      health.refresh();
      stars.refresh();
      languages.refresh();
      network.refresh();
      recent.refresh();
    },
  };
}
