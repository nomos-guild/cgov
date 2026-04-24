import { useEffect } from "react";
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import dynamic from "next/dynamic";
import Head from "next/head";
import { useTranslations } from "next-intl";
import { GovernanceStats } from "@/components/GovernanceStats";
import { useGovernanceDataLoader, type InitialGovernanceData } from "@/hooks/useGovernanceData";
import { fetchAllGovernanceData } from "@/lib/serverFetch";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import { FadeIn } from "@/components/ui/fade-in";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";

// Lazy-load the Sankey to keep d3-sankey + chart layout code out of the
// initial bundle — matches the pattern used for other heavy charts in
// dashboards/{governance,development_activity}/charts/index.tsx.
const TreasuryFlowSankey = dynamic(
  () =>
    import("@/components/treasury/TreasuryFlowSankey").then(
      (mod) => mod.TreasuryFlowSankey
    ),
  { loading: () => <ChartSkeleton />, ssr: false }
);

// Keep the treasury chart in sync with the chain — refetch every 2 minutes
// so new Enacted/Ratified/Expired/Closed Treasury Withdrawals surface without
// a manual reload. SWR dedupes across hooks so this is cheap.
const TREASURY_REFRESH_MS = 120_000;

type IntlMessages = typeof import("@/messages/en.json");

interface TreasuryProps {
  initialData: InitialGovernanceData;
  messages: IntlMessages;
}

export default function Treasury({ initialData }: InferGetStaticPropsType<typeof getStaticProps>) {
  const t = useTranslations();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  const { isLoading, error, hasData, refresh } = useGovernanceDataLoader(initialData);
  const showLoadingSpinner = isLoading && !hasData && !error;

  useEffect(() => {
    const id = window.setInterval(refresh, TREASURY_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <>
      <Head>
        <title>{t("meta.homeTitle")}</title>
        <meta name="description" content={t("meta.homeDescription")} />
      </Head>
      <div className="min-h-screen bg-background overflow-visible">
        <div className="container mx-auto px-3 pt-8 pb-4 sm:px-4 sm:pt-10 sm:pb-6 md:px-6 md:pt-12 md:pb-8 overflow-visible">
          <FadeIn delay={0} duration={400} distance={12}>
            <div className="mb-6 sm:mb-8 md:mb-10 text-left">
              <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black dark:text-foreground">
                {t("landing.treasuryTitle")}
              </h1>
            </div>
          </FadeIn>

          {error && (
            <Card className="p-4 sm:p-6 mb-4 sm:mb-6 border-destructive bg-destructive/10">
              <div className="text-center">
                <p className="text-destructive font-medium mb-2 text-sm sm:text-base">
                  {t("errors.failedToLoadData")}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">{error}</p>
                <button
                  onClick={refresh}
                  className="mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  {t("common.retry")}
                </button>
              </div>
            </Card>
          )}

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
                    {t("errors.loadingGovernanceData")}
                  </p>
                </div>
              </Card>
            )
          )}

          {(hasData || (!isLoading && !error)) && !showLoadingSpinner && (
            <>
              <FadeIn delay={120} duration={500} distance={18} className="relative z-20">
                <GovernanceStats />
              </FadeIn>
              <FadeIn delay={220} duration={500} distance={18} className="mt-4 sm:mt-6">
                <TreasuryFlowSankey />
              </FadeIn>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<TreasuryProps> = async ({ locale }) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  try {
    const { actions, overview, nclData, treasuryAda } = await fetchAllGovernanceData();

    return {
      props: {
        messages,
        initialData: { actions, overview, nclData, treasuryAda },
      },
      revalidate: 60,
    };
  } catch (error) {
    console.error("Failed to fetch data for treasury ISR:", error);
    return {
      props: {
        messages,
        initialData: { actions: [], overview: null, nclData: [] },
      },
      revalidate: 30,
    };
  }
};
