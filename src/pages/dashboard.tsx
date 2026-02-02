import { useRef } from "react";
import Head from "next/head";
import { useGovernanceDataLoader } from "@/hooks/useGovernanceData";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import {
  DashboardProvider,
  DashboardGrid,
  DashboardSidePanel,
  DashboardMarginHandles,
  useDashboard,
} from "@/components/dashboards/shared";
import { ChartColorsProvider } from "@/components/dashboards/shared/ChartColorsContext";

function DashboardContent() {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const { config, mounted } = useDashboard();
  const gridAreaRef = useRef<HTMLDivElement>(null);

  // SWR-based data loading with caching and deduplication
  const { isLoading, error, hasData, refresh } = useGovernanceDataLoader();
  const showLoadingSpinner = isLoading && !hasData && !error;

  // Calculate padding based on margins (minimum padding for header area)
  const minPadding = 24; // Minimum padding in pixels
  const leftPadding = Math.max(minPadding, config.pageMargins.left);
  const rightPadding = Math.max(minPadding, config.pageMargins.right);

  return (
    <>
      <Head>
        <title>Dashboard - CGOV</title>
        <meta name="description" content="CGOV Dashboard - Governance Overview" />
      </Head>
      <div className="min-h-screen bg-background">
        {/* Margin handles - only show when mounted to avoid hydration mismatch */}
        {mounted && <DashboardMarginHandles containerRef={gridAreaRef} />}

        {/* Full-width container with dynamic padding */}
        <div
          className="py-4 sm:py-6 md:py-8 transition-[padding] duration-75"
          style={{
            paddingLeft: leftPadding,
            paddingRight: rightPadding,
          }}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
            <div className="text-left">
              <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 md:mb-4 text-black dark:text-foreground">
                Dashboard
              </h1>
              <p className="landing-subtitle text-muted-foreground text-sm sm:text-base md:text-lg">
                Your customizable governance overview
              </p>
            </div>
            <DashboardSidePanel />
          </div>

          {/* Error state */}
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
                    Loading dashboard data...
                  </p>
                </div>
              </Card>
            )
          )}

          {/* Dashboard Grid */}
          {(hasData || (!isLoading && !error)) && !showLoadingSpinner && (
            <div ref={gridAreaRef}>
              <DashboardGrid isLoading={isLoading} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  return (
    <DashboardProvider>
      <ChartColorsProvider>
        <DashboardContent />
      </ChartColorsProvider>
    </DashboardProvider>
  );
}
