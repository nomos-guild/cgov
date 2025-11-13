import { useEffect } from "react";
import Head from "next/head";
import { GovernanceStats } from "@/components/GovernanceStats";
import { GovernanceTable } from "@/components/GovernanceTable";
import { useAppDispatch } from "@/store/hooks";
import { setActions } from "@/store/governanceSlice";
import { mockGovernanceActions } from "@/data/mockData";
import type { GovernanceAction } from "@/types/governance";

export default function Home() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function loadData() {
      try {
        // Trigger background sync (server enforces cooldown)
        await fetch("/api/governance/sync").catch(() => undefined);

        // Fetch actions from DB
        const res = await fetch("/api/db/actions?limit=200");
        if (!res.ok) throw new Error(`DB actions error: ${res.status}`);
        const payload = await res.json();
        const items = Array.isArray(payload?.data) ? payload.data : [];

        const toNum = (v: unknown): number | undefined => {
          if (v === null || v === undefined) return undefined;
          const n = typeof v === "string" ? Number(v) : (v as number);
          return Number.isFinite(n) ? (n as number) : undefined;
        };

        type DbAction = {
          proposalId: string;
          txHash: string;
          title: string;
          type: string;
          status: string;
          submissionEpoch?: number;
          expiryEpoch?: number;
          constitutionality?: string;
          statistics?: Record<string, unknown>;
        };

        const normalized: GovernanceAction[] = items.map((a: DbAction) => {
          const s = a?.statistics ?? {};
          const drepYesPercent = toNum(s.drepYesPercent) ?? 0;
          const drepNoPercent = toNum(s.drepNoPercent) ?? 0;
          const spoYesPercent = toNum(s.spoYesPercent);
          const spoNoPercent = toNum(s.spoNoPercent);
          const ccYesPercent = toNum(s.ccYesPercent);
          const ccNoPercent = toNum(s.ccNoPercent);
          return {
            proposalId: a.proposalId,
            txHash: a.txHash,
            title: a.title,
            type: a.type,
            status: a.status,
            constitutionality: a.constitutionality ?? "Constitutional",
            drepYesPercent,
            drepNoPercent,
            drepYesAda: (s.drepYesAda ?? "0").toString(),
            drepNoAda: (s.drepNoAda ?? "0").toString(),
            spoYesPercent,
            spoNoPercent,
            spoYesAda: s.spoYesAda ? String(s.spoYesAda) : undefined,
            spoNoAda: s.spoNoAda ? String(s.spoNoAda) : undefined,
            ccYesPercent,
            ccNoPercent,
            ccYesCount: typeof s.ccYesCount === "number" ? s.ccYesCount : undefined,
            ccNoCount: typeof s.ccNoCount === "number" ? s.ccNoCount : undefined,
            totalYes: typeof s.totalYes === "number" ? s.totalYes : 0,
            totalNo: typeof s.totalNo === "number" ? s.totalNo : 0,
            totalAbstain: typeof s.totalAbstain === "number" ? s.totalAbstain : 0,
            submissionEpoch: a.submissionEpoch ?? 0,
            expiryEpoch: a.expiryEpoch ?? a.submissionEpoch ?? 0,
          } as GovernanceAction;
        });

        if (normalized.length > 0) {
          dispatch(setActions(normalized));
        } else {
          // Fallback to mock if DB is empty
          dispatch(setActions(mockGovernanceActions));
        }
      } catch {
        // Fallback to mock if anything fails
        dispatch(setActions(mockGovernanceActions));
      }
    }
    loadData();
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
