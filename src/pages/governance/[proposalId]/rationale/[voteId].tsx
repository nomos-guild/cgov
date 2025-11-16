import { useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSelectedAction } from "@/store/governanceSlice";
import { getActionByProposalId } from "@/data/mockData";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { VoteRecord } from "@/types/governance";

function getVoteBadgeClasses(vote: VoteRecord["vote"]): string {
  return vote === "Yes"
    ? "text-foreground border-foreground/40 bg-foreground/5"
    : "text-foreground/60 border-foreground/20 bg-transparent";
}

// Mock rationale function - in real app, this would fetch from IPFS
function getMockRationale(voterName: string, vote: string): string {
  if (voterName === "SIPO") {
    return `SIPO has chosen to ${vote} on this proposal.

Our decision reflects both recognition of the proposal's innovation and concern for its structural implications on fairness, governance precedent, and long-term ecosystem balance.

On the Loan-Based Treasury Model
SIPO deeply appreciates the innovation behind this proposal—the introduction of a repayable, interest-bearing treasury loan.
This marks a significant step toward treating Cardano's treasury not merely as a grant pool, but as a public revolving fund—a self-sustaining capital engine for ecosystem growth.

Such a model introduces accountability and enables the treasury to recycle its funds through investment, repayment, and reinvestment, strengthening Cardano's financial autonomy and maturity as a decentralized system.

Why SIPO ${vote}s
SIPO supports the spirit and direction of this proposal:
• Introducing a repayable, audited, legally binding treasury mechanism;
• Enhancing visibility and liquidity for Cardano Native Tokens;
• And promoting sustainable financial governance.

We believe this pilot can become an educational milestone—demonstrating how a decentralized treasury can evolve from "funding" to responsible capital management, if built with transparency and replicability in mind.`;
  }

  const templates = {
    Yes: `After careful consideration, ${voterName} votes YES on this proposal.

We believe this initiative aligns with Cardano's long-term vision and will contribute positively to the ecosystem's growth. The proposal demonstrates:

• Clear objectives and measurable outcomes
• Responsible use of treasury funds
• Strong community support and engagement
• Alignment with Cardano's governance principles

We support this action and look forward to seeing its positive impact on the ecosystem.`,
    No: `${voterName} votes NO on this proposal.

While we appreciate the effort behind this submission, we have concerns about:

• The current structure and implementation plan
• Potential risks to the treasury and ecosystem
• Lack of sufficient detail in certain areas
• Questions about long-term sustainability

We encourage the proposers to address these concerns and potentially resubmit with improvements.`,
    Abstain: `${voterName} chooses to ABSTAIN on this proposal.

This decision reflects our position that while the proposal has merit, we require additional information or time for proper evaluation:

• Further community discussion needed
• Awaiting clarification on specific technical details
• Observing how governance precedent develops
• Maintaining neutrality on this particular matter

We remain engaged and will continue monitoring the proposal's progress.`,
  };

  return templates[vote as keyof typeof templates] || "No rationale provided.";
}

export default function VotingRationale() {
  const router = useRouter();
  const { proposalId, voteId } = router.query;
  const dispatch = useAppDispatch();
  const selectedAction = useAppSelector((state) => state.governance.selectedAction);

  useEffect(() => {
    if (!router.isReady) return;
    
    if (typeof proposalId === "string") {
      const action = getActionByProposalId(proposalId);
      if (action) {
        dispatch(setSelectedAction(action));
      }
    }
  }, [router.isReady, proposalId, dispatch]);

  const allVotes = useMemo(() => {
    if (!selectedAction) return [];
    return [
      ...(selectedAction.votes || []),
      ...(selectedAction.ccVotes || []),
    ];
  }, [selectedAction]);

  const vote = useMemo(() => {
    if (!router.isReady || !voteId || typeof voteId !== "string" || allVotes.length === 0) {
      return null;
    }

    // voteId is just the index as a string
    const index = parseInt(voteId, 10);
    
    if (isNaN(index) || index < 0 || index >= allVotes.length) {
      return null;
    }

    return allVotes[index];
  }, [router.isReady, voteId, allVotes]);

  // Show loading while router or proposal data is being fetched
  if (!router.isReady || !selectedAction) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <div className="text-center">
            <p className="text-muted-foreground">Loading voting rationale...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show not found only after data is loaded
  if (allVotes.length > 0 && !vote) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Voting rationale not found</p>
            <Link href={typeof proposalId === "string" ? `/governance/${proposalId}` : "/"}>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Proposal
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Still loading votes
  if (!vote) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <div className="text-center">
            <p className="text-muted-foreground">Loading voting rationale...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Voting Rationale - {vote.voterName || vote.voterId} - Cardano Governance</title>
        <meta name="description" content={`Voting rationale for ${vote.voterName || vote.voterId}`} />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Link href={typeof proposalId === "string" ? `/governance/${proposalId}` : "/"}>
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Proposal
            </Button>
          </Link>

          <Card className="mb-6 sm:mb-8">
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="text-xl sm:text-2xl font-bold">
                  Voting Rationale
                </h1>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className={getVoteBadgeClasses(vote.vote)}>
                    {vote.vote}
                  </Badge>
                  <Badge variant="outline" className="border-border">
                    {vote.voterType}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Voter</div>
                  <div className="font-semibold truncate">{vote.voterName || vote.voterId}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{vote.voterId}</div>
                </div>
                {vote.voterType !== "CC" && vote.votingPowerAda && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Voting Power</div>
                    <div className="font-medium">{vote.votingPowerAda.toLocaleString()} ADA</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Voted At</div>
                  <div className="font-medium">
                    {vote.votedAt ? new Date(vote.votedAt).toLocaleDateString() : "Unknown"}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="mb-6 sm:mb-8">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Rationale</h2>
                {vote.anchorUrl && (
                  <a
                    href={vote.anchorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:underline text-sm flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open on IPFS
                  </a>
                )}
              </div>
              <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {getMockRationale(vote.voterName || vote.voterId, vote.vote)}
                </div>
              </ScrollArea>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

