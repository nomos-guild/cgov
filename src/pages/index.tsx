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

export default function Home() {
  const dispatch = useAppDispatch();
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
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 text-left">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-black dark:text-white">
              Cardano Governance
            </h1>
            <p className="text-muted-foreground text-lg">
              Track and monitor on-chain governance actions
            </p>
          </div>

          {/* Error state */}
          {error && (
            <Card className="p-6 mb-6 border-destructive bg-destructive/10">
              <div className="text-center">
                <p className="text-destructive font-medium mb-2">
                  Failed to load data
                </p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <button
                  onClick={() => {
                    dispatch(loadGovernanceActions());
                    dispatch(loadOverviewSummary());
                    dispatch(loadNCLData());
                  }}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Retry
                </button>
              </div>
            </Card>
          )}

          {/* Loading state */}
          {isLoading && !error && (
            <Card className="p-12 mb-6">
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-muted-foreground">
                  Loading governance data...
                </p>
              </div>
            </Card>
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
