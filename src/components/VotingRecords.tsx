import { useState, useMemo } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { VoteRecord } from "@/types/governance";
import { Search } from "lucide-react";

interface VotingRecordsProps {
  votes: VoteRecord[];
  proposalId?: string;
  showDownload?: boolean;
  downloadFormat?: string;
  onDownloadFormatChange?: (format: "json" | "markdown" | "csv") => void;
}

function formatAda(ada: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(ada);
}

function getVoteBadgeClasses(vote: VoteRecord["vote"]): string {
  return vote === "Yes"
    ? "text-foreground border-foreground/40 bg-foreground/5"
    : "text-foreground/60 border-foreground/20 bg-transparent";
}

export function VotingRecords({
  votes,
  proposalId,
  showDownload,
  downloadFormat,
  onDownloadFormatChange,
}: VotingRecordsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [voteFilter, setVoteFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [timeSort, setTimeSort] = useState<string>("newest");
  const [powerSort, setPowerSort] = useState<string>("none");
  const [rationaleFilter, setRationaleFilter] = useState<string>("all");

  const voteIdMap = useMemo(() => {
    const map = new Map<VoteRecord, number>();
    votes.forEach((vote, index) => {
      map.set(vote, index);
    });
    return map;
  }, [votes]);

  const getVoteId = (vote: VoteRecord): string => {
    const index = voteIdMap.get(vote);
    return index !== undefined ? index.toString() : "0";
  };

  const getRationaleUrl = (vote: VoteRecord): string => {
    const voteId = getVoteId(vote);
    return proposalId ? `/governance/${proposalId}/rationale/${voteId}` : "#";
  };

  const filteredVotes = useMemo(() => {
    let filtered = votes.filter((vote) => {
      const matchesSearch =
        searchQuery === "" ||
        (vote.voterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        vote.voterId.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesVote = voteFilter === "all" || vote.vote.toLowerCase() === voteFilter;
      const matchesRole = roleFilter === "all" || vote.voterType === roleFilter;
      const matchesRationale =
        rationaleFilter === "all" || (rationaleFilter === "with" && Boolean(vote.anchorUrl));

      return matchesSearch && matchesVote && matchesRole && matchesRationale;
    });

    const getDateTimestamp = (dateString?: string): number => {
      if (!dateString) return 0;
      const timestamp = new Date(dateString).getTime();
      return Number.isNaN(timestamp) ? 0 : timestamp;
    };

    const sortByTime = (list: VoteRecord[]) => {
      return [...list].sort((a, b) => {
        const dateA = getDateTimestamp(a.votedAt);
        const dateB = getDateTimestamp(b.votedAt);
        return timeSort === "newest" ? dateB - dateA : dateA - dateB;
      });
    };

    if (powerSort === "high" || powerSort === "low") {
      const ccMembers = filtered.filter((v) => v.voterType === "CC");
      const nonCCMembers = filtered.filter((v) => v.voterType !== "CC");

      const sortedNonCC = [...nonCCMembers].sort((a, b) => {
        const powerA = a.votingPowerAda || 0;
        const powerB = b.votingPowerAda || 0;
        if (powerA !== powerB) {
          return powerSort === "high" ? powerB - powerA : powerA - powerB;
        }
        const dateA = getDateTimestamp(a.votedAt);
        const dateB = getDateTimestamp(b.votedAt);
        return timeSort === "newest" ? dateB - dateA : dateA - dateB;
      });

      const sortedCC = sortByTime(ccMembers);
      filtered = [...sortedNonCC, ...sortedCC];
    } else {
      filtered = sortByTime(filtered);
    }

    return filtered;
  }, [votes, searchQuery, voteFilter, roleFilter, rationaleFilter, timeSort, powerSort]);

  return (
    <div className="space-y-6">
      <div />

      <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-3 sm:p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-6">
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
          <Select value={timeSort} onValueChange={setTimeSort}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
          <Select value={rationaleFilter} onValueChange={setRationaleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by rationale" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All records</SelectItem>
              <SelectItem value="with">Only votes with rationale</SelectItem>
            </SelectContent>
          </Select>
          <Select value={powerSort} onValueChange={setPowerSort}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by voting power" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Sort</SelectItem>
              <SelectItem value="high">Highest Voting Power</SelectItem>
              <SelectItem value="low">Lowest Voting Power</SelectItem>
            </SelectContent>
          </Select>
          {showDownload ? (
            <Select
              value={downloadFormat || ""}
              onValueChange={(value) =>
                onDownloadFormatChange?.(value as "json" | "markdown" | "csv")
              }>
              <SelectTrigger>
                <SelectValue placeholder="Download rationales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">Download as JSON</SelectItem>
                <SelectItem value="markdown">Download as Markdown</SelectItem>
                <SelectItem value="csv">Download as CSV</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-[#faf9f6] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
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
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      No voting records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVotes.map((vote) => {
                    const voteId = getVoteId(vote);
                    return (
                      <TableRow key={voteId} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-semibold">{vote.voterName || vote.voterId}</span>
                              <Badge variant="outline" className="border-foreground/20 bg-transparent px-1.5 py-0 text-xs">
                                {vote.voterType}
                              </Badge>
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {vote.voterId.slice(0, 20)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getVoteBadgeClasses(vote.vote)}>
                            {vote.vote}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {vote.voterType !== "CC" ? (
                            <div className="font-semibold">
                              {formatAda(vote.votingPowerAda || 0)} ADA
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">One member, one vote</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {vote.votedAt ? new Date(vote.votedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {vote.anchorUrl && vote.voterType !== "CC" ? (
                            <Link href={getRationaleUrl(vote)}>
                              <Button size="sm" variant="outline">
                                View
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {vote.voterType === "CC" ? "Not applicable" : "No rationale"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
