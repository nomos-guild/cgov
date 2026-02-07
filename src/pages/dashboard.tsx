import { useState } from "react";
import Head from "next/head";
import { useGovernanceDataLoader } from "@/hooks/useGovernanceData";
import { useDevelopmentDataLoader } from "@/hooks/useDevelopmentData";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  DashboardProvider,
  DashboardGrid,
  ChartVisibilityDropdown,
} from "@/components/dashboards/shared";
import { CHART_REGISTRY as GOV_REGISTRY } from "@/components/dashboards/governance/charts";
import { CHART_REGISTRY as DEV_ACTIVITY_REGISTRY } from "@/components/dashboards/development_activity/charts";
import { DevelopmentRangeSelector } from "@/components/dashboards/development_activity/DevelopmentRangeSelector";
import { DEFAULT_CHART_LAYOUTS } from "@/types/dashboard";

interface DataLoaderResult {
  isLoading: boolean;
  error: string | null;
  hasData: boolean;
  refresh: () => void;
}

function TabDashboardContent({ isLoading, error, hasData, refresh }: DataLoaderResult) {
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
                Loading dashboard data...
              </p>
            </div>
          </Card>
        )
      )}

      {(hasData || (!isLoading && !error)) && !showLoadingSpinner && (
        <DashboardGrid isLoading={isLoading} />
      )}
    </>
  );
}

function GovernanceTab() {
  const loader = useGovernanceDataLoader();
  return <TabDashboardContent {...loader} />;
}

function DevelopmentActivityTab() {
  const loader = useDevelopmentDataLoader();
  return <TabDashboardContent {...loader} />;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("governance");
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;
  const isGame = activeTheme.id === "game";

  const tabListClass = cn(
    isGame
      ? "bg-black/50 border border-white/10 text-white/60"
      : isDark
        ? "bg-[hsl(230,16%,12%)] border border-[#0bd1a2]/20 text-white/60"
        : "bg-white border border-gray-200 shadow-sm text-gray-500"
  );

  const tabTriggerClass = cn(
    isGame
      ? "data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--foreground))] data-[state=active]:shadow-none"
      : isDark
        ? "data-[state=active]:bg-[#0bd1a2]/10 data-[state=active]:text-[#0bd1a2] data-[state=active]:shadow-none"
        : "data-[state=active]:bg-gray-100 data-[state=active]:text-black data-[state=active]:shadow-sm"
  );

  return (
    <>
      <Head>
        <title>Dashboard - CGOV</title>
        <meta name="description" content="CGOV Dashboard - Governance & Development Activity" />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
            <div className="text-left">
              <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 md:mb-4 text-black dark:text-foreground">
                Dashboard
              </h1>
              <p className="landing-subtitle text-muted-foreground text-sm sm:text-base md:text-lg">
                Your customizable overview
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="relative mb-6 max-w-[1180px]">
            <TabsList className={tabListClass}>
              <TabsTrigger value="governance" className={tabTriggerClass}>Governance</TabsTrigger>
              <TabsTrigger value="development" className={tabTriggerClass}>Development Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="governance" className="mt-4">
              <DashboardProvider
                dashboardId="governance"
                chartRegistry={GOV_REGISTRY}
                defaultLayouts={DEFAULT_CHART_LAYOUTS}
              >
                <div className="absolute top-0 right-0 h-10 flex items-center">
                  <ChartVisibilityDropdown />
                </div>
                <GovernanceTab />
              </DashboardProvider>
            </TabsContent>

            <TabsContent value="development" className="mt-4">
              <DashboardProvider
                dashboardId="development_activity"
                chartRegistry={DEV_ACTIVITY_REGISTRY}
                defaultLayouts={DEFAULT_CHART_LAYOUTS}
              >
                <div className="absolute top-0 right-0 h-10 flex items-center gap-3">
                  <DevelopmentRangeSelector />
                  <ChartVisibilityDropdown />
                </div>
                <DevelopmentActivityTab />
              </DashboardProvider>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
