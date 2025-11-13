import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoteProgress } from "@/components/ui/vote-progress";
import { VotingRecords } from "@/components/VotingRecords";
import { VotingSummary } from "@/components/VotingSummary";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSelectedAction } from "@/store/governanceSlice";
import { getActionByProposalId } from "@/data/mockData";
import { ArrowLeft, Twitter } from "lucide-react";
import { exportToJSON, exportToMarkdown, exportToCSV, downloadFile } from "@/lib/exportRationales";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const { proposalId } = router.query;
  const dispatch = useAppDispatch();
  const selectedAction = useAppSelector((state) => state.governance.selectedAction);

  useEffect(() => {
    if (typeof proposalId === "string") {
      const action = getActionByProposalId(proposalId);
      if (action) {
        dispatch(setSelectedAction(action));
      }
    }
  }, [proposalId, dispatch]);

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

  // Combine all votes (DRep, SPO, and CC) into a single array for filtering
  const allVotes = [
    ...(selectedAction.votes || []),
    ...(selectedAction.ccVotes || []),
  ];

  const [downloadFormat, setDownloadFormat] = useState<string>("");

  const handleTwitterShare = () => {
    const url = typeof window !== "undefined" 
      ? `${window.location.origin}/governance/${selectedAction.proposalId}`
      : "";
    const text = `Check out this Cardano governance proposal: ${selectedAction.title}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const handleExport = (format: "json" | "markdown" | "csv") => {
    const sanitizedTitle = selectedAction.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const timestamp = new Date().toISOString().split("T")[0];
    
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case "json":
        content = exportToJSON(allVotes, selectedAction.title);
        filename = `voting-rationales-${sanitizedTitle}-${timestamp}.json`;
        mimeType = "application/json";
        break;
      case "markdown":
        content = exportToMarkdown(allVotes, selectedAction.title);
        filename = `voting-rationales-${sanitizedTitle}-${timestamp}.md`;
        mimeType = "text/markdown";
        break;
      case "csv":
        content = exportToCSV(allVotes, selectedAction.title);
        filename = `voting-rationales-${sanitizedTitle}-${timestamp}.csv`;
        mimeType = "text/csv";
        break;
    }

    downloadFile(content, filename, mimeType);
    setTimeout(() => setDownloadFormat(""), 100);
  };

  return (
    <>
      <Head>
        <title>{selectedAction.title} - Cardano Governance</title>
        <meta name="description" content={selectedAction.description || selectedAction.title} />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Back Button */}
          <Link href="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>

          {/* Header Section */}
          <Card className="mb-6 sm:mb-8">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold flex-1 min-w-0">{selectedAction.title}</h1>
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  {allVotes.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTwitterShare}
                        className="flex items-center gap-2 whitespace-nowrap"
                      >
                        <Twitter className="h-4 w-4" />
                        <span className="hidden sm:inline">Share on X</span>
                        <span className="sm:hidden">Share</span>
                      </Button>
                      <Select value={downloadFormat} onValueChange={(value) => handleExport(value as "json" | "markdown" | "csv")}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                          <SelectValue placeholder="Download rationales" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="json">Download as JSON</SelectItem>
                          <SelectItem value="markdown">Download as Markdown</SelectItem>
                          <SelectItem value="csv">Download as CSV</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}
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
                  <code className="text-xs sm:text-sm text-muted-foreground bg-secondary px-2 sm:px-3 py-1 rounded font-mono break-all">
                    {selectedAction.proposalId}
                  </code>
                  <span className="text-muted-foreground hidden sm:inline">•</span>
                  <code className="text-xs sm:text-sm text-muted-foreground bg-secondary px-2 sm:px-3 py-1 rounded font-mono break-all">
                    {selectedAction.txHash}
                  </code>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-4">
                  <span>Submission: Epoch {selectedAction.submissionEpoch}</span>
                  <span className="hidden sm:inline">•</span>
                  <span>Expiry: Epoch {selectedAction.expiryEpoch}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Voting Bars - Horizontal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6">
            {/* DRep Votes */}
            <Card className="p-4 sm:p-6">
              <VoteProgress
                title="DRep Votes"
                yesPercent={selectedAction.drepYesPercent}
                noPercent={selectedAction.drepNoPercent}
                yesAda={selectedAction.drepYesAda}
                noAda={selectedAction.drepNoAda}
              />
            </Card>

            {/* CC Votes */}
            {selectedAction.ccYesPercent !== undefined ? (
              <Card className="p-4 sm:p-6">
                <VoteProgress
                  title="CC"
                  yesPercent={selectedAction.ccYesPercent}
                  noPercent={selectedAction.ccNoPercent || 0}
                />
              </Card>
            ) : null}

            {/* SPO Votes */}
            {selectedAction.spoYesPercent !== undefined ? (
              <Card className="p-4 sm:p-6">
                <VoteProgress
                  title="SPO Votes"
                  yesPercent={selectedAction.spoYesPercent}
                  noPercent={selectedAction.spoNoPercent || 0}
                  yesAda={selectedAction.spoYesAda || "0"}
                  noAda={selectedAction.spoNoAda || "0"}
                />
              </Card>
            ) : null}
          </div>

          {/* Voting Summary Section */}
          {allVotes.length > 0 && (
            <VotingSummary votes={allVotes} proposalTitle={selectedAction.title} />
          )}

          {/* Description - Full Width */}
          <Card className="p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Description</h2>
            <div className="text-sm sm:text-base text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {selectedAction.description || "No description provided."}
            </div>
          </Card>

          {/* Voting Records Table */}
          {allVotes.length > 0 && (
            <div className="mb-6">
              <VotingRecords votes={allVotes} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}


