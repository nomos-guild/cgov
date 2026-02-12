import { useState, useMemo } from "react";
import { Info } from "lucide-react";
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import Head from "next/head";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import { useDRepStats, useAllDReps } from "@/hooks/useDRepData";
import type { DRepStatsApiResponse } from "@/hooks/useDRepData";
import { DRepSunburstChart } from "@/components/dreps/DRepSunburstChart";
import { cn } from "@/lib/utils";
import {
  fetchDRepStatsServer,
  fetchAllDRepsServer,
  type DRepServerItem,
} from "@/lib/serverFetch";
import type { DRepSummary } from "@/types/drep";

type IntlMessages = typeof import("@/messages/en.json");

interface InitialDRepData {
  drepStats: DRepStatsApiResponse | null;
  allDreps: DRepServerItem[];
}

interface DRepDashboardPageProps {
  messages: IntlMessages;
  initialData: InitialDRepData;
}

/**
 * Format large numbers with appropriate suffix (K, M, B)
 */
function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format number with commas
 */
function formatNumber(value: number): string {
  return value.toLocaleString();
}

/**
 * Transform raw server DRep items to DRepSummary (same transform as useDRepData)
 */
function transformServerDreps(items: DRepServerItem[]): DRepSummary[] {
  return items.map((d) => ({
    drepId: d.drepId,
    name: d.name,
    iconUrl: d.iconUrl,
    votingPower: d.votingPower,
    votingPowerAda: parseFloat(d.votingPowerAda) || 0,
    totalVotesCast: d.totalVotesCast,
    delegatorCount: d.delegatorCount ?? null,
  }));
}

export default function DRepDashboard({ initialData }: InferGetStaticPropsType<typeof getStaticProps>) {
  const t = useTranslations("drep");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light";
  const [selectedTab, setSelectedTab] = useState("drep-table");

  // Transform ISR DRep data once for hooks
  const initialDreps = useMemo(
    () => initialData?.allDreps?.length ? transformServerDreps(initialData.allDreps) : undefined,
    [initialData?.allDreps]
  );

  const { stats, isLoading } = useDRepStats(initialData?.drepStats ?? undefined);
  const { dreps } = useAllDReps({}, initialDreps);

  const totalDelegators = useMemo(
    () => dreps.reduce((sum, d) => sum + (d.delegatorCount ?? 0), 0),
    [dreps]
  );

  const activeDRepCount = useMemo(
    () => dreps.filter((d) => d.votingPowerAda > 0 && d.totalVotesCast > 0).length,
    [dreps]
  );

  const showLoadingSpinner = isLoading && !stats;

  // Tab button styling
  const tabButtonClass = isGame
    ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
    : "rounded-full border border-white/8 bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-450 ease-in-out shadow-[0_12px_30px_rgba(15,23,42,0.25)] data-[state=active]:bg-black data-[state=active]:text-white hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon";

  return (
    <>
      <Head>
        <title>{t("pageTitle")}</title>
        <meta name="description" content={t("pageDescription")} />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 pt-8 pb-28 sm:px-4 sm:pt-10 sm:pb-36 md:px-6 md:pt-12 md:pb-44">
          {/* Header */}
          <div className="mb-6 sm:mb-8 md:mb-10 text-left">
            <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black dark:text-foreground">
              {t("title")}
            </h1>
          </div>

          {/* Loading state */}
          {showLoadingSpinner && (
            isGame ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 md:py-24">
                <GameLoader />
              </div>
            ) : (
              <Card className="p-6 sm:p-8 md:p-12 mb-4 sm:mb-6">
                <div className="flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-b-2 border-primary mb-3 sm:mb-4"></div>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    {t("loadingData")}
                  </p>
                </div>
              </Card>
            )
          )}

          {/* Content - show even if stats fail, DRep list uses a separate endpoint */}
          {!showLoadingSpinner && (
            <>
              {/* Stats Cards */}
              <div className={cn(
                "grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6",
                isGame && "game-drep-stats"
              )}>
                {([
                  { label: t("totalDReps"), value: dreps.length ? formatNumber(activeDRepCount) : "--", tooltip: t("activeDRepsTooltip") },
                  { label: t("totalDelegators"), value: dreps.length ? formatNumber(totalDelegators) : "--" },
                  { label: t("totalDelegatedAda"), value: stats ? `${formatCompactNumber(stats.totalDelegatedAda)} ADA` : "--" },
                  { label: t("totalVotesCast"), value: stats ? formatNumber(stats.totalVotesCast) : "--" },
                ] as { label: string; value: string; tooltip?: string }[]).map(({ label, value, tooltip }) => (
                  <div
                    key={label}
                    className={
                      isLight
                        ? "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
                        : isGame
                        ? "rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.35)]"
                        : "rounded-none border border-[#0bd1a2] bg-transparent p-4 shadow-none"
                    }
                  >
                    <p className={`text-sm ${isGame ? "text-white/70" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]"}`}>
                      {label}
                      {tooltip && (
                        <span className="relative ml-1 inline-block align-middle group">
                          <Info className={cn("inline h-3.5 w-3.5 cursor-help", isGame ? "text-white/50" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60")} />
                          <span className={cn(
                            "pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 rounded px-2.5 py-1.5 text-xs font-normal leading-snug opacity-0 transition-opacity group-hover:opacity-100 z-50",
                            isGame ? "bg-black/90 text-white border border-white/20" : isLight ? "bg-foreground text-background shadow-lg" : "bg-black text-[#0bd1a2] border border-[#0bd1a2]"
                          )}>
                            {tooltip}
                          </span>
                        </span>
                      )}
                    </p>
                    <p className={`text-2xl font-bold ${isGame ? "text-white" : isLight ? "" : "text-[#0bd1a2]"}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Tabbed Chart Section */}
              <Tabs
                value={selectedTab}
                onValueChange={setSelectedTab}
                className="w-full"
              >
                <div className={
                  isLight
                    ? "rounded-2xl border border-white/8 bg-[#faf9f6] px-4 sm:px-6 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.25)] mb-4"
                    : isGame
                    ? "game-drep-content rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] px-4 sm:px-6 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)] mb-4"
                    : "rounded-none border border-[#0bd1a2] bg-transparent px-4 sm:px-6 py-3 shadow-none mb-4"
                }>
                  <TabsList className="flex-1 flex-wrap items-center justify-start gap-1.5 sm:gap-2 bg-transparent p-0 overflow-x-auto overflow-visible">
                    <TabsTrigger value="drep-table" className={tabButtonClass}>
                      {t("tabDRepList")}
                    </TabsTrigger>
                    <TabsTrigger value="drep-list" className={tabButtonClass}>
                      {t("tabDRep")}
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className={tabButtonClass}>
                      {t("tabAnalytics")}
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* DRep Chart Tab — forceMount to keep hooks alive across tab switches */}
                <TabsContent value="drep-list" className="mt-0 data-[state=inactive]:hidden" forceMount>
                  <DRepSunburstChart initialDreps={initialDreps} view="chart" />
                </TabsContent>

                {/* DRep List Tab — forceMount to keep hooks alive across tab switches */}
                <TabsContent value="drep-table" className="mt-0 data-[state=inactive]:hidden" forceMount>
                  <DRepSunburstChart initialDreps={initialDreps} view="list" />
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="mt-0">
                  <div className={
                    isLight
                      ? "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-6 shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
                      : isGame
                      ? "game-drep-content rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] p-4 sm:p-6 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
                      : "rounded-none border border-[#0bd1a2] bg-transparent p-4 sm:p-6 shadow-none"
                  }>
                    <div className={`text-center py-12 ${isGame ? "text-white/60" : "text-muted-foreground"}`}>
                      {t("analyticsSoon")}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Incremental Static Regeneration (ISR)
 * Pre-fetches DRep stats + list at build time, revalidates every 60 seconds.
 * Users get instant HTML with data already embedded.
 */
export const getStaticProps: GetStaticProps<DRepDashboardPageProps> = async ({ locale }) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  try {
    const [drepStats, allDreps] = await Promise.all([
      fetchDRepStatsServer(),
      fetchAllDRepsServer(),
    ]);

    return {
      props: {
        messages,
        initialData: { drepStats, allDreps },
      },
      revalidate: 60,
    };
  } catch (error) {
    console.error("Failed to fetch DRep data for ISR:", error);
    return {
      props: {
        messages,
        initialData: { drepStats: null, allDreps: [] },
      },
      revalidate: 30,
    };
  }
};
