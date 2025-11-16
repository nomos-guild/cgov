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
        // Small delay to ensure smooth transition
        await new Promise((resolve) => setTimeout(resolve, 100));
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
        <meta name="description" content="Integrated Cardano on-chain platform" />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {loading ? (
            <div className="py-12 text-center animate-fade-in">
              <p className="text-muted-foreground">Loading proposals...</p>
            </div>
          ) : (
            <div className="space-y-8 lg:space-y-10 animate-slide-in-bottom">
              <section className="w-full">
                <div className="w-full max-w-2xl">
                  <GovernanceStats />
                </div>
              </section>
              <section>
                <GovernanceTable />
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
