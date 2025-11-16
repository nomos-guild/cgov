import { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoteProgress } from "@/components/ui/vote-progress";
import { VotingRecords } from "@/components/VotingRecords";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSelectedAction } from "@/store/governanceSlice";
import { getActionByProposalId } from "@/data/mockData";
import { ArrowLeft } from "lucide-react";
import type { GovernanceAction, GovernanceActionDetail } from "@/types/governance";

function getStatusColor(status: GovernanceAction["status"]): string {
  switch (status) {
    case "Active":
    case "Approved":
      return "text-primary border-primary/40 bg-primary/10";
    default:
      return "text-foreground/70 border-foreground/30 bg-transparent";
  }
}

export default function GovernanceDetail() {
  const router = useRouter();
  const { proposalId } = router.query;
  const dispatch = useAppDispatch();
  const actions = useAppSelector((state) => state.governance.actions);
  const selectedAction = useAppSelector((state) => state.governance.selectedAction);

  useEffect(() => {
    if (typeof proposalId !== "string") return;

    const pid = proposalId;
    const baseAction = actions.find((a) => a.proposalId === pid);

    type DbAction = {
      proposalId: string;
      txHash: string;
      title: string;
      type: string;
      status: string;
      submissionEpoch?: number;
      expiryEpoch?: number;
      constitutionality?: string | null;
      description?: string | null;
      rationale?: string | null;
      motivation?: string | null;
      references?: unknown;
      statistics?: Record<string, unknown> | null;
    };

    const toNum = (v: unknown): number | undefined => {
      if (v === null || v === undefined) return undefined;
      const n = typeof v === "string" ? Number(v) : (v as number);
      return Number.isFinite(n) ? (n as number) : undefined;
    };

    const hydrateDetailFromDb = (a: DbAction | undefined): GovernanceActionDetail | null => {
      if (!a) return null;
      const s = (a.statistics ?? {}) as Record<string, unknown>;
      const drepYesPercent = toNum(s.drepYesPercent) ?? 0;
      const drepNoPercent = toNum(s.drepNoPercent) ?? 0;
      const spoYesPercent = toNum(s.spoYesPercent);
      const spoNoPercent = toNum(s.spoNoPercent);
      const ccYesPercent = toNum(s.ccYesPercent);
      const ccNoPercent = toNum(s.ccNoPercent);

      const core: GovernanceAction = {
        proposalId: a.proposalId,
        txHash: a.txHash,
        title: a.title,
        type: a.type,
        status: a.status as GovernanceAction["status"],
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
      };

      return {
        ...core,
        description: a.description ?? undefined,
        rationale: a.rationale ?? undefined,
        motivation: a.motivation ?? undefined,
        references: Array.isArray(a.references) ? (a.references as string[]) : undefined,
        votes: undefined,
        ccVotes: undefined,
      };
    };

    // 1) If the action is already in Redux (loaded on the dashboard), use it as a fast
    //    initial value while we hydrate full details from the DB.
    if (baseAction && !selectedAction) {
      const detailFromState: GovernanceActionDetail = {
        ...baseAction,
        description: undefined,
        rationale: undefined,
        motivation: undefined,
        references: undefined,
        votes: undefined,
        ccVotes: undefined,
      };
      dispatch(setSelectedAction(detailFromState));
    }

    // 2) Fetch from the DB API and normalize to get full description/rationale, etc.
    let cancelled = false;

    async function loadFromDb() {
      try {
        const res = await fetch(`/api/db/actions?limit=5&search=${encodeURIComponent(pid)}`);
        if (!res.ok) throw new Error(`DB actions error: ${res.status}`);
        const payload = await res.json();
        const items = Array.isArray(payload?.data) ? (payload.data as DbAction[]) : [];
        const exact = items.find((a) => a.proposalId === pid) ?? items[0];
        const detail = hydrateDetailFromDb(exact);
        if (!cancelled && detail) {
          dispatch(setSelectedAction(detail));
          return;
        }
      } catch {
        // fall back to mock data in development if DB lookup fails
        const mock = getActionByProposalId(pid);
        if (!cancelled) {
          dispatch(setSelectedAction(mock ?? null));
        }
      }
    }

    loadFromDb();

    return () => {
      cancelled = true;
    };
  }, [proposalId, actions, dispatch]);

  if (!selectedAction) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <div className="text-center">
            <p className="text-muted-foreground">Loading governance action...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{selectedAction.title} - Cardano Governance</title>
        <meta name="description" content={selectedAction.description || selectedAction.title} />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Back Button */}
          <Link href="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>

          {/* Header Section */}
          <Card className="mb-8">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h1 className="text-3xl md:text-4xl font-bold flex-1">{selectedAction.title}</h1>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className={getStatusColor(selectedAction.status)}>
                    {selectedAction.status}
                  </Badge>
                  <Badge variant="outline" className="border-border">
                    {selectedAction.type}
                  </Badge>
                </div>
              </div>
              <div className="border-t border-border/50 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded font-mono">
                    {selectedAction.proposalId}
                  </code>
                  <span className="text-muted-foreground">•</span>
                  <code className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded font-mono">
                    {selectedAction.txHash}
                  </code>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-4">
                  <span>Submission: Epoch {selectedAction.submissionEpoch}</span>
                  <span>•</span>
                  <span>Expiry: Epoch {selectedAction.expiryEpoch}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Main Grid: 2/3 Left, 1/3 Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description Card */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Description</h2>
                <div className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {selectedAction.description || "No description provided."}
                </div>
              </Card>

              {/* Rationale Card */}
              {selectedAction.rationale && (
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Rationale</h2>
                  <div className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {selectedAction.rationale}
                  </div>
                </Card>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Constitutionality */}
              <Card className="p-6">
                <h3 className="font-semibold mb-2">Constitutionality</h3>
                <p className="text-sm text-muted-foreground">{selectedAction.constitutionality}</p>
              </Card>

              {/* DRep Votes */}
              <Card className="p-6">
                <VoteProgress
                  title="DRep Votes"
                  yesPercent={selectedAction.drepYesPercent}
                  noPercent={selectedAction.drepNoPercent}
                  yesAda={selectedAction.drepYesAda}
                  noAda={selectedAction.drepNoAda}
                />
              </Card>

              {/* CC Votes */}
              {selectedAction.ccYesPercent !== undefined && (
                <Card className="p-6">
                  <VoteProgress
                    title="CC"
                    yesPercent={selectedAction.ccYesPercent}
                    noPercent={selectedAction.ccNoPercent || 0}
                  />
                </Card>
              )}

              {/* SPO Votes */}
              {selectedAction.spoYesPercent !== undefined && (
                <Card className="p-6">
                  <VoteProgress
                    title="SPO Votes"
                    yesPercent={selectedAction.spoYesPercent}
                    noPercent={selectedAction.spoNoPercent || 0}
                    yesAda={selectedAction.spoYesAda || "0"}
                    noAda={selectedAction.spoNoAda || "0"}
                  />
                </Card>
              )}

              {/* Vote Summary */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Vote Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Yes</span>
                    <span className="text-sm font-semibold">{selectedAction.totalYes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total No</span>
                    <span className="text-sm font-semibold">{selectedAction.totalNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Abstain</span>
                    <span className="text-sm font-semibold">{selectedAction.totalAbstain}</span>
                  </div>
                  <div className="pt-2 border-t border-border mt-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-semibold">Total Votes</span>
                      <span className="text-sm font-bold">
                        {selectedAction.totalYes + selectedAction.totalNo + selectedAction.totalAbstain}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Voting Records Section */}
          {selectedAction.votes && selectedAction.votes.length > 0 && (
            <div className="mt-12">
              <VotingRecords votes={selectedAction.votes} />
            </div>
          )}

          {/* CC Voting Records */}
          {selectedAction.ccVotes && selectedAction.ccVotes.length > 0 && (
            <div className="mt-12">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">CC Votes</h2>
                <div className="space-y-2">
                  {selectedAction.ccVotes.map((v, i) => (
                    <div key={`${v.voterId}-${i}`} className="flex items-center justify-between py-2 border-b last:border-b-0 border-border/50">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{v.voterName || v.voterId}</span>
                        <span className="text-xs text-muted-foreground font-mono">{v.voterId}</span>
                      </div>
                      <span className={`text-sm ${v.vote === "Yes" ? "text-foreground" : "text-foreground/60"}`}>{v.vote}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


