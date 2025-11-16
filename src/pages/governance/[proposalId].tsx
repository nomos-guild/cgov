import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoteProgress } from "@/components/ui/vote-progress";
import { VotingRecords } from "@/components/VotingRecords";
import { BubbleMap } from "@/components/BubbleMap";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSelectedAction } from "@/store/governanceSlice";
import { useGovernanceApi } from "@/contexts/GovernanceApiContext";
import { ArrowLeft, Twitter } from "lucide-react";
import { exportToJSON, exportToMarkdown, exportToCSV, downloadFile } from "@/lib/exportRationales";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

  const [downloadFormat, setDownloadFormat] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const api = useGovernanceApi();

  useEffect(() => {
    const loadProposal = async () => {
      if (typeof proposalId === "string") {
        try {
          setLoading(true);
          const action = await api.getProposalById(proposalId);
          if (action) {
            dispatch(setSelectedAction(action));
          }
        } catch (error) {
          console.error("Error loading proposal:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadProposal();
  }, [proposalId, dispatch, api]);

  if (loading || !selectedAction) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <div className="text-center">
            <p className="text-muted-foreground">
              {loading ? "Loading governance action..." : "Governance action not found"}
            </p>
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

  const handleTwitterShare = () => {
    const url = typeof window !== "undefined" 
      ? `${window.location.origin}/governance/${selectedAction.id}`
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
              <div className="mb-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">{selectedAction.title}</h1>
                <div className="flex flex-wrap items-center gap-2">
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
              {selectedAction.description && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="text-sm sm:text-base text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {selectedAction.description}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* New Section */}
          <Card className="mb-6 sm:mb-8">
            <div className="p-4 sm:p-6">
              <Tabs defaultValue="bubble-map" className="w-full">
                <TabsList>
                  <TabsTrigger value="bubble-map">Bubble Map</TabsTrigger>
                  <TabsTrigger value="statistics">Statistics</TabsTrigger>
                  <TabsTrigger value="curves">Curves</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>
                <TabsContent value="bubble-map">
                  <BubbleMap votes={allVotes} />
                </TabsContent>
                <TabsContent value="statistics">
                  {/* Statistics content */}
                </TabsContent>
                <TabsContent value="curves">
                  {/* Curves content */}
                </TabsContent>
                <TabsContent value="details">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs sm:text-sm text-muted-foreground mb-2 block">Governance Action ID</label>
                      <code className="text-xs sm:text-sm text-muted-foreground bg-secondary px-2 sm:px-3 py-1 rounded font-mono break-all block">
                        {selectedAction.id}
                      </code>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-muted-foreground mb-2 block">Transaction Hash</label>
                      <code className="text-xs sm:text-sm text-muted-foreground bg-secondary px-2 sm:px-3 py-1 rounded font-mono break-all block">
                        {selectedAction.txHash}
                      </code>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-muted-foreground mb-2 block">Submission Epoch</label>
                      <div className="text-xs sm:text-sm text-foreground">Epoch {selectedAction.submissionEpoch}</div>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-muted-foreground mb-2 block">Expiry Epoch</label>
                      <div className="text-xs sm:text-sm text-foreground">Epoch {selectedAction.expiryEpoch}</div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </Card>

          {/* Voting Records Table */}
          {allVotes.length > 0 && (
            <div className="mb-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {selectedAction.drep && (
                  <VoteProgress
                    title="DRep Votes"
                    yesPercent={selectedAction.drep.yesPercent}
                    noPercent={selectedAction.drep.noPercent}
                    yesAda={selectedAction.drep.yesAda}
                    noAda={selectedAction.drep.noAda}
                  />
                )}
                {selectedAction.cc && (
                  <VoteProgress
                    title="CC"
                    yesPercent={selectedAction.cc.yesPercent}
                    noPercent={selectedAction.cc.noPercent}
                  />
                )}
                {selectedAction.spo && (
                  <VoteProgress
                    title="SPO Votes"
                    yesPercent={selectedAction.spo.yesPercent}
                    noPercent={selectedAction.spo.noPercent}
                    yesAda={selectedAction.spo.yesAda || "0"}
                    noAda={selectedAction.spo.noAda || "0"}
                  />
                )}
              </div>
              <VotingRecords votes={allVotes} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}


