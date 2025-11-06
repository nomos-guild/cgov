import { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { VotingRecords } from "@/components/VotingRecords";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSelectedAction } from "@/store/governanceSlice";
import { getActionByHash } from "@/data/mockData";
import { ArrowLeft } from "lucide-react";

function formatAda(ada: string | number): string {
  const num = typeof ada === "string" ? parseFloat(ada) : ada;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(num);
}

function getStatusColor(status: string): string {
  switch (status) {
    case "Active":
      return "bg-success/20 text-success border-success/30";
    case "Ratified":
    case "Approved":
      return "bg-primary/20 text-primary border-primary/30";
    case "Expired":
      return "bg-muted text-muted-foreground border-border";
    case "Not approved":
      return "bg-destructive/20 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
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
          <div className="mb-8">
            <div className="flex flex-wrap gap-3 mb-4">
              <Badge variant="outline" className={getStatusColor(selectedAction.status)}>
                {selectedAction.status}
              </Badge>
              <Badge variant="outline" className="border-border">
                {selectedAction.type}
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{selectedAction.title}</h1>
            <code className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded font-mono">
              {selectedAction.hash}
            </code>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-4">
              <span>Submission: Epoch {selectedAction.submissionEpoch}</span>
              <span>•</span>
              <span>Expiry: Epoch {selectedAction.expiryEpoch}</span>
            </div>
          </div>

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
                <h3 className="font-semibold mb-4">DRep Votes</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-success">Yes: {selectedAction.drepYesPercent.toFixed(1)}%</span>
                      <span className="text-sm text-muted-foreground">{formatAda(selectedAction.drepYesAda)} ₳</span>
                    </div>
                    <Progress value={selectedAction.drepYesPercent} className="h-3 bg-secondary" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-destructive">No: {selectedAction.drepNoPercent.toFixed(1)}%</span>
                      <span className="text-sm text-muted-foreground">{formatAda(selectedAction.drepNoAda)} ₳</span>
                    </div>
                    <Progress value={selectedAction.drepNoPercent} className="h-3 bg-secondary" />
                  </div>
                </div>
              </Card>

              {/* SPO Votes Card */}
              {selectedAction.spoYesPercent !== undefined && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">SPO Votes</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-success">Yes: {selectedAction.spoYesPercent.toFixed(1)}%</span>
                        <span className="text-sm text-muted-foreground">
                          {formatAda(selectedAction.spoYesAda || "0")} ₳
                        </span>
                      </div>
                      <Progress value={selectedAction.spoYesPercent} className="h-3 bg-secondary" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-destructive">
                          No: {selectedAction.spoNoPercent?.toFixed(1) || "0.0"}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatAda(selectedAction.spoNoAda || "0")} ₳
                        </span>
                      </div>
                      <Progress value={selectedAction.spoNoPercent || 0} className="h-3 bg-secondary" />
                    </div>
                  </div>
                </Card>
              )}

              {/* Vote Summary Card */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Vote Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Yes</span>
                    <span className="text-sm font-semibold text-success">{selectedAction.totalYes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total No</span>
                    <span className="text-sm font-semibold text-destructive">{selectedAction.totalNo}</span>
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
