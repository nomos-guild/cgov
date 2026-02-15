import type { GetStaticProps } from "next";
import Head from "next/head";
import { useTranslations } from "next-intl";
import { useGovernanceDataLoader } from "@/hooks/useGovernanceData";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import {
  DashboardProvider,
  DashboardGrid,
  DashboardSidePanel,
} from "@/components/dashboards/shared";
import { ChartColorsProvider } from "@/components/dashboards/shared/ChartColorsContext";
import { CHART_REGISTRY } from "@/components/dashboards/governance/charts";
import { DEFAULT_CHART_LAYOUTS } from "@/types/dashboard";

type IntlMessages = typeof import("@/messages/en.json");

interface GovernanceDashboardPageProps {
  messages: IntlMessages;
}

function GovernanceDashboardContent() {
  const { isLoading, error, hasData, refresh } = useGovernanceDataLoader();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const showLoadingSpinner = isLoading && !hasData && !error;

  return (
    <>
      {error && (
        <Card className="p-4 sm:p-6 mb-4 sm:mb-6 border-destructive bg-destructive/10">
          <div className="text-center">
            <p className="text-destructive font-medium mb-2 text-sm sm:text-base">
              Failed to load data
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">{error}</p>
            <button
              onClick={refresh}
              className="mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      )}

      {showLoadingSpinner &&
        (isGame ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 md:py-24">
            <GameLoader />
          </div>
        ) : (
          <Card className="p-6 sm:p-8 md:p-12 mb-4 sm:mb-6">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-b-2 border-primary mb-3 sm:mb-4"></div>
              <p className="text-muted-foreground text-sm sm:text-base">
                Loading dashboard data...
              </p>
            </div>
          </Card>
        ))}

      {(hasData || (!isLoading && !error)) && !showLoadingSpinner && (
        <DashboardGrid isLoading={isLoading} />
      )}
    </>
  );
}

function GovernanceDashboardPage() {
  const t = useTranslations();

  return (
    <>
      <Head>
        <title>{t("meta.governanceDashboardTitle")}</title>
        <meta
          name="description"
          content={t("meta.governanceDashboardDescription")}
        />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
          <DashboardProvider
            dashboardId="governance"
            chartRegistry={CHART_REGISTRY}
            defaultLayouts={DEFAULT_CHART_LAYOUTS}
          >
            <ChartColorsProvider>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
                <div className="text-left">
                  <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 md:mb-4 text-black dark:text-foreground">
                    {t("dashboard.governanceTitle")}
                  </h1>
                  <p className="landing-subtitle text-muted-foreground text-sm sm:text-base md:text-lg">
                    {t("dashboard.governanceSubtitle")}
                  </p>
                </div>
                <DashboardSidePanel />
              </div>

              <GovernanceDashboardContent />
            </ChartColorsProvider>
          </DashboardProvider>
        </div>
      </div>
    </>
  );
}

export default function GovernanceDashboard() {
  return <GovernanceDashboardPage />;
}

export const getStaticProps: GetStaticProps<GovernanceDashboardPageProps> =
  async ({ locale }) => {
    const messages = (await import(`@/messages/${locale ?? "en"}.json`))
      .default;

    return {
      props: {
        messages,
      },
    };
  };
