import { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { Vote } from "@/types/governance";
import { Search, ExternalLink, FileText } from "lucide-react";

interface VotingRecordsProps {
  votes: Vote[];
}

function formatAda(ada: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(ada);
}

function getVoteBadgeClasses(vote: Vote["vote"]): string {
  return vote === "Yes"
    ? "text-foreground border-foreground/40 bg-foreground/5"
    : "text-foreground/60 border-foreground/20 bg-transparent";
}

export function VotingRecords({ votes }: VotingRecordsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [voteFilter, setVoteFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const filteredVotes = votes.filter((vote) => {
    const matchesSearch =
      searchQuery === "" ||
      (vote.voterName || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      vote.voterId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesVote =
      voteFilter === "all" || vote.vote.toLowerCase() === voteFilter;

    const matchesRole = roleFilter === "all" || vote.voterType === roleFilter;

    return matchesSearch && matchesVote && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div></div>

      {/* Filters */}
      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              placeholder="Search by voter name or ID..."
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
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="DRep">DRep</SelectItem>
              <SelectItem value="SPO">SPO</SelectItem>
              <SelectItem value="CC">CC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Voting Table */}
      <Card className="overflow-hidden">
        <div className="-mx-4 overflow-x-auto sm:-mx-6 md:mx-0">
          <div className="inline-block min-w-full px-4 align-middle sm:px-6 md:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voter</TableHead>
                  <TableHead>Vote</TableHead>
                  <TableHead>Voting Power</TableHead>
                  <TableHead>Voted At</TableHead>
                  <TableHead className="text-right">Rationale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVotes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No voting records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVotes.map((vote, index) => (
                    <TableRow
                      key={`${vote.voterId}-${index}`}
                      className="hover:bg-muted/50"
                    >
                      <TableCell>
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-semibold">
                              {vote.voterName || vote.voterId}
                            </span>
                            <Badge
                              variant="outline"
                              className="border-foreground/20 bg-transparent px-1.5 py-0 text-xs"
                            >
                              {vote.voterType}
                            </Badge>
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {vote.voterId.slice(0, 20)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getVoteBadgeClasses(vote.vote)}
                        >
                          {vote.vote}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          {vote.voterType !== "CC" ? (
                            <>
                              <div className="font-semibold">
                                {formatAda(vote.votingPowerAda || 0)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {vote.votingPower || "0"} ADA
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              One member, one vote
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(vote.votedAt!).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {vote.anchorUrl && vote.voterType !== "CC" ? (
                          <div className="flex items-center justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <FileText className="mr-1 h-4 w-4" />
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-h-[80vh] max-w-3xl">
                                <DialogHeader>
                                  <DialogTitle>
                                    Voting Rationale -{" "}
                                    {vote.voterName || vote.voterId}
                                  </DialogTitle>
                                  <DialogDescription>
                                    View the detailed reasoning for this vote
                                  </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="h-[500px] w-full rounded-md border p-4">
                                  <div className="space-y-4">
                                    <div className="mb-4 flex items-center justify-between">
                                      <Badge
                                        variant="outline"
                                        className={getVoteBadgeClasses(
                                          vote.vote
                                        )}
                                      >
                                        {vote.vote}
                                      </Badge>
                                      <a
                                        href={vote.anchorUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-sm text-foreground hover:underline"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        Open on IPFS
                                      </a>
                                    </div>
                                    <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                                      {getMockRationale(
                                        vote.voterName || vote.voterId,
                                        vote.vote
                                      )}
                                    </div>
                                  </div>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                            <a
                              href={vote.anchorUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {vote.voterType === "CC"
                              ? "Not applicable"
                              : "No rationale"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
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
