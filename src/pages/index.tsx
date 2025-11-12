import { useEffect } from "react";
import Head from "next/head";
import { GovernanceStats } from "@/components/GovernanceStats";
import { GovernanceTable } from "@/components/GovernanceTable";
import { useAppDispatch } from "@/store/hooks";
import { setActions } from "@/store/governanceSlice";
import { mockGovernanceActions } from "@/data/mockData";

export default function Home() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setActions(mockGovernanceActions));
  }, [dispatch]);

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
          <div className="mb-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Cardano Governance
            </h1>
            <p className="text-muted-foreground text-lg">
              Track and monitor on-chain governance actions
            </p>
          </div>
          <GovernanceStats />
          <GovernanceTable />
        </div>
      </div>
    </>
  );
}
