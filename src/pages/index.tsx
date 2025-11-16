import { useEffect, useState } from "react";
import Head from "next/head";
import { GovernanceStats } from "@/components/GovernanceStats";
import { GovernanceTable } from "@/components/GovernanceTable";
import { useAppDispatch } from "@/store/hooks";
import { setActions } from "@/store/governanceSlice";
import { useGovernanceApi } from "@/contexts/GovernanceApiContext";

export default function Home() {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const api = useGovernanceApi();

  useEffect(() => {
    const loadProposals = async () => {
      try {
        setLoading(true);
        const proposals = await api.getProposals();
        dispatch(setActions(proposals));
      } catch (error) {
        console.error("Error loading proposals:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProposals();
  }, [dispatch, api]);

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
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="mb-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Cardano Governance
            </h1>
            <p className="text-muted-foreground text-lg">
              Track and monitor on-chain governance actions
            </p>
          </div>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading proposals...</p>
            </div>
          ) : (
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
