import { useEffect } from "react";
import Head from "next/head";
import { GovernanceStats } from "@/components/GovernanceStats";
import { GovernanceTable } from "@/components/GovernanceTable";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  loadGovernanceActions,
  loadOverviewSummary,
  loadNCLData,
} from "@/store/governanceSlice";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";

export default function Home() {
  const dispatch = useAppDispatch();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const { isLoadingActions, actionsError, isLoadingOverview, overviewError } =
    useAppSelector((state) => state.governance);

  useEffect(() => {
    dispatch(loadGovernanceActions());
    dispatch(loadOverviewSummary());
    dispatch(loadNCLData());
  }, [dispatch]);

  const isLoading = isLoadingActions || isLoadingOverview;
  const error = actionsError || overviewError;

  return (
    <>
      <Head>
        <title>CGOV - Cardano Governance Platform</title>
        <meta
          name="description"
          content="Integrated Cardano on-chain platform"
        />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
          <div className="mb-4 sm:mb-6 md:mb-8 text-left">
            <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 md:mb-4 text-black dark:text-foreground">
              Cardano Governance
            </h1>
            <p className="landing-subtitle text-muted-foreground text-sm sm:text-base md:text-lg">
              Track and monitor on-chain governance actions
            </p>
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
                  onClick={() => {
                    dispatch(loadGovernanceActions());
                    dispatch(loadOverviewSummary());
                    dispatch(loadNCLData());
                  }}
                  className="mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Retry
                </button>
              </div>
            </Card>
          )}

          {/* Loading state */}
          {isLoading && !error && (
            isGame ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 md:py-24">
                <GameLoader />
              </div>
            ) : (
              <Card className="p-6 sm:p-8 md:p-12 mb-4 sm:mb-6">
                <div className="flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-b-2 border-primary mb-3 sm:mb-4"></div>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    Loading governance data...
                  </p>
                </div>
              </Card>
            )
          )}

          {/* Content */}
          {!isLoading && !error && (
            <>
              <GovernanceStats />
              <GovernanceTable />
            </>
          )}
        </div>
      </div>
    </>
  );
}
