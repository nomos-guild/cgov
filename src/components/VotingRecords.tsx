import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VoteRecord } from "@/types/governance";
import { Search, ExternalLink, FileText } from "lucide-react";

interface VotingRecordsProps {
  votes: VoteRecord[];
}

function formatAda(ada: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(ada);
}

function getVoteBadgeClasses(vote: VoteRecord["vote"]): string {
  switch (vote) {
    case "Yes":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30";
    case "No":
      return "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30";
    case "Abstain":
      return "bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export function VotingRecords({ votes }: VotingRecordsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [voteFilter, setVoteFilter] = useState<string>("all");

  const filteredVotes = votes.filter((vote) => {
    const matchesSearch =
      searchQuery === "" ||
      vote.drepName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vote.drepId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesVote = voteFilter === "all" || vote.vote.toLowerCase() === voteFilter;

    return matchesSearch && matchesVote;
  });

  const voteStats = {
    total: votes.length,
    yes: votes.filter((v) => v.vote === "Yes").length,
    no: votes.filter((v) => v.vote === "No").length,
    abstain: votes.filter((v) => v.vote === "Abstain").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Voting Records</h2>
        <p className="text-muted-foreground">Individual DRep votes and their rationale</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{voteStats.total}</div>
          <div className="text-sm text-muted-foreground">Total Votes</div>
        </Card>
        <Card className="p-4 border-success/30">
          <div className="text-2xl font-bold text-success">{voteStats.yes}</div>
          <div className="text-sm text-muted-foreground">Yes Votes</div>
        </Card>
        <Card className="p-4 border-destructive/30">
          <div className="text-2xl font-bold text-destructive">{voteStats.no}</div>
          <div className="text-sm text-muted-foreground">No Votes</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{voteStats.abstain}</div>
          <div className="text-sm text-muted-foreground">Abstain</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by DRep name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={voteFilter} onValueChange={setVoteFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by vote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Votes</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="abstain">Abstain</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Voting Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DRep</TableHead>
                <TableHead>Vote</TableHead>
                <TableHead>Voting Power</TableHead>
                <TableHead>Voted At</TableHead>
                <TableHead className="text-right">Rationale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No voting records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVotes.map((vote, index) => (
                  <TableRow key={`${vote.drepId}-${index}`} className="hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <div className="font-semibold">{vote.drepName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{vote.drepId.slice(0, 20)}...</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getVoteBadgeClasses(vote.vote)}>
                        {vote.vote}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-semibold">{formatAda(vote.votingPowerAda)}</div>
                        <div className="text-xs text-muted-foreground">{vote.votingPower} ADA</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(vote.votedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {vote.anchorUrl ? (
                        <div className="flex items-center justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <FileText className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh]">
                              <DialogHeader>
                                <DialogTitle>Voting Rationale - {vote.drepName}</DialogTitle>
                                <DialogDescription>
                                  View the detailed reasoning for this vote
                                </DialogDescription>
                              </DialogHeader>
                              <ScrollArea className="h-[500px] w-full rounded-md border p-4">
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between mb-4">
                                    <Badge variant="outline" className={getVoteBadgeClasses(vote.vote)}>
                                      {vote.vote}
                                    </Badge>
                                    <a
                                      href={vote.anchorUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline text-sm flex items-center gap-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Open on IPFS
                                    </a>
                                  </div>
                                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {getMockRationale(vote.drepName, vote.vote)}
                                  </div>
                                </div>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                          <a
                            href={vote.anchorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No rationale</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

// Mock rationale function - in real app, this would fetch from IPFS
function getMockRationale(drepName: string, vote: string): string {
  if (drepName === "SIPO") {
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
    Yes: `After careful consideration, ${drepName} votes YES on this proposal.

We believe this initiative aligns with Cardano's long-term vision and will contribute positively to the ecosystem's growth. The proposal demonstrates:

• Clear objectives and measurable outcomes
• Responsible use of treasury funds
• Strong community support and engagement
• Alignment with Cardano's governance principles

We support this action and look forward to seeing its positive impact on the ecosystem.`,
    No: `${drepName} votes NO on this proposal.

While we appreciate the effort behind this submission, we have concerns about:

• The current structure and implementation plan
• Potential risks to the treasury and ecosystem
• Lack of sufficient detail in certain areas
• Questions about long-term sustainability

We encourage the proposers to address these concerns and potentially resubmit with improvements.`,
    Abstain: `${drepName} chooses to ABSTAIN on this proposal.

This decision reflects our position that while the proposal has merit, we require additional information or time for proper evaluation:

• Further community discussion needed
• Awaiting clarification on specific technical details
• Observing how governance precedent develops
• Maintaining neutrality on this particular matter

We remain engaged and will continue monitoring the proposal's progress.`,
  };

  return templates[vote as keyof typeof templates] || "No rationale provided.";
}
