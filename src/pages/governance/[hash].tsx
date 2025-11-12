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
import { getActionByHash } from "@/data/mockData";
import { ArrowLeft } from "lucide-react";
import type { GovernanceAction } from "@/types/governance";

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
  const { hash } = router.query;
  const dispatch = useAppDispatch();
  const selectedAction = useAppSelector((state) => state.governance.selectedAction);

  useEffect(() => {
    if (typeof hash === "string") {
      const action = getActionByHash(hash);
      if (action) {
        dispatch(setSelectedAction(action));
      }
    }
  }, [hash, dispatch]);

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
                <code className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded font-mono">
                  {selectedAction.hash}
                </code>
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
              {/* Constitutionality Card */}
              <Card className="p-6">
                <h3 className="font-semibold mb-2">Constitutionality</h3>
                <p className="text-sm text-muted-foreground">{selectedAction.constitutionality}</p>
              </Card>

              {/* DRep Votes Card */}
              <Card className="p-6">
                <VoteProgress
                  title="DRep Votes"
                  yesPercent={selectedAction.drepYesPercent}
                  noPercent={selectedAction.drepNoPercent}
                  yesAda={selectedAction.drepYesAda}
                  noAda={selectedAction.drepNoAda}
                />
              </Card>

              {/* SPO Votes Card */}
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

              {/* Vote Summary Card */}
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
        </div>
      </div>
    </>
  );
}
