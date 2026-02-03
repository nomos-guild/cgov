import type { GetStaticProps } from "next";
import Head from "next/head";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import { useDRepStats } from "@/hooks/useDRepData";

type IntlMessages = typeof import("@/messages/en.json");

interface DRepDashboardPageProps {
  messages: IntlMessages;
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

export default function DRepDashboard() {
  const t = useTranslations();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  const { stats, isLoading, error, refresh } = useDRepStats();

  const hasData = stats !== null;
  const showLoadingSpinner = isLoading && !hasData && !error;

  return (
    <>
      <Head>
        <title>DRep Dashboard - CGOV</title>
        <meta name="description" content="Explore Cardano Delegated Representatives (DReps) - voting power, participation, and voting history" />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 pt-8 pb-4 sm:px-4 sm:pt-10 sm:pb-6 md:px-6 md:pt-12 md:pb-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8 md:mb-10 text-left">
            <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black dark:text-foreground">
              DRep Dashboard
            </h1>
            <p className="mt-2 text-muted-foreground text-sm sm:text-base md:text-lg">
              Explore Delegated Representatives and their voting activity
            </p>
          </div>

          {/* Error state */}
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
                    Loading DRep data...
                  </p>
                </div>
              </Card>
            )
          )}

          {/* Content */}
          {(hasData || (!isLoading && !error)) && !showLoadingSpinner && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Total DReps</p>
                  <p className="text-2xl font-bold">
                    {stats ? formatNumber(stats.totalDReps) : "--"}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Total Delegated ADA</p>
                  <p className="text-2xl font-bold">
                    {stats ? `${formatCompactNumber(stats.totalDelegatedAda)} ADA` : "--"}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Total Votes Cast</p>
                  <p className="text-2xl font-bold">
                    {stats ? formatNumber(stats.totalVotesCast) : "--"}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Active DReps</p>
                  <p className="text-2xl font-bold">
                    {stats ? formatNumber(stats.activeDReps) : "--"}
                  </p>
                </Card>
              </div>

              {/* DRep Table - Placeholder */}
              <Card className="p-4 sm:p-6">
                <div className="text-center py-12 text-muted-foreground">
                  DRep table coming soon...
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<DRepDashboardPageProps> = async ({ locale }) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  return {
    props: {
      messages,
    },
  };
};
