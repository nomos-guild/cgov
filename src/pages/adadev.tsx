import type { GetStaticProps } from "next";
import Head from "next/head";
import { useTranslations } from "next-intl";
import { useDevelopmentDataLoader } from "@/hooks/useDevelopmentData";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import {
  DashboardProvider,
  DashboardGrid,
  DashboardSidePanel,
} from "@/components/dashboards/shared";
import { ChartColorsProvider } from "@/components/dashboards/shared/ChartColorsContext";
import { CHART_REGISTRY } from "@/components/dashboards/development_activity/charts";
import { DevelopmentRangeSelector } from "@/components/dashboards/development_activity/DevelopmentRangeSelector";
import { DEFAULT_CHART_LAYOUTS } from "@/types/dashboard";

type IntlMessages = typeof import("@/messages/en.json");

interface DashboardPageProps {
  messages: IntlMessages;
}

function DevelopmentDashboardContent() {
  const { isLoading, error, hasData, refresh } = useDevelopmentDataLoader();
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

function DashboardPage() {
  const t = useTranslations();

  return (
    <>
      <Head>
        <title>{t("meta.dashboardTitle")}</title>
        <meta name="description" content={t("meta.dashboardDescription")} />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
          <DashboardProvider
            dashboardId="development_activity"
            chartRegistry={CHART_REGISTRY}
            defaultLayouts={DEFAULT_CHART_LAYOUTS}
          >
            <ChartColorsProvider>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
                <div className="text-left">
                  <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black dark:text-foreground">
                    {t("dashboard.devActivityTitle")}
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Developed and maintained by{" "}
                    <a
                      href="https://adadev.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      ADADEV.io
                    </a>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <DevelopmentRangeSelector />
                  <DashboardSidePanel />
                </div>
              </div>

              <DevelopmentDashboardContent />
            </ChartColorsProvider>
          </DashboardProvider>
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  return <DashboardPage />;
}

export const getStaticProps: GetStaticProps<DashboardPageProps> = async ({
  locale,
}) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  return {
    props: {
      messages,
    },
  };
};
