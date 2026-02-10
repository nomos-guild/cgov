import { useState } from "react";
import type { GetStaticProps } from "next";
import Head from "next/head";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import { useDRepStats } from "@/hooks/useDRepData";
import { DRepSunburstChart } from "@/components/dreps/DRepSunburstChart";
import { cn } from "@/lib/utils";

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
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const [selectedTab, setSelectedTab] = useState("drep-list");

  const { stats, isLoading } = useDRepStats();

  const showLoadingSpinner = isLoading && !stats;

  // Tab button styling
  const tabButtonClass = isGame
    ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
    : "px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

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

          {/* Content - show even if stats fail, DRep list uses a separate endpoint */}
          {!showLoadingSpinner && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 game-drep-stats">
                <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
                  <p className="text-sm text-muted-foreground dark:text-[#0bd1a2]">Total DReps</p>
                  <p className="text-2xl font-bold dark:text-[#0bd1a2]">
                    {stats ? formatNumber(stats.totalDReps) : "--"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
                  <p className="text-sm text-muted-foreground dark:text-[#0bd1a2]">Total Delegated ADA</p>
                  <p className="text-2xl font-bold dark:text-[#0bd1a2]">
                    {stats ? `${formatCompactNumber(stats.totalDelegatedAda)} ADA` : "--"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
                  <p className="text-sm text-muted-foreground dark:text-[#0bd1a2]">Total Votes Cast</p>
                  <p className="text-2xl font-bold dark:text-[#0bd1a2]">
                    {stats ? formatNumber(stats.totalVotesCast) : "--"}
                  </p>
                </div>
              </div>

              {/* Tabbed Chart Section */}
              <Tabs
                value={selectedTab}
                onValueChange={setSelectedTab}
                className="w-full"
              >
                <div className={cn(
                  "rounded-2xl border border-white/8 bg-[#faf9f6] px-4 sm:px-6 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none mb-4",
                  isGame && "game-drep-content"
                )}>
                  <TabsList className="flex-1 flex-wrap items-center justify-start gap-1.5 sm:gap-2 bg-transparent p-0 overflow-x-auto overflow-visible">
                    <TabsTrigger value="drep-list" className={tabButtonClass}>
                      DRep
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className={tabButtonClass}>
                      Analytics
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* DRep List Tab */}
                <TabsContent value="drep-list" className="mt-0">
                  <DRepSunburstChart />
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="mt-0">
                  <div className={cn(
                    "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-6 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none",
                    isGame && "game-drep-content"
                  )}>
                    <div className="text-center py-12 text-muted-foreground">
                      Analytics coming soon...
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

export const getStaticProps: GetStaticProps<DRepDashboardPageProps> = async ({ locale }) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  return {
    props: {
      messages,
    },
  };
};
