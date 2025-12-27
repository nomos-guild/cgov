import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GameDropdown } from "@/components/ui/game-dropdown";
import { VotingRationaleModal } from "@/components/VotingRationaleModal";
import type { VoteRecord } from "@/types/governance";
import { Search } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

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
  if (vote === "Yes") {
    return "text-foreground border-foreground/40 bg-foreground/5 dark:text-[#0bd1a2] dark:border-[#0bd1a2] dark:bg-transparent";
  }
  if (vote === "No") {
    return "text-foreground border-foreground/40 bg-destructive/10 dark:text-[#8C200B] dark:border-[#8C200B] dark:bg-transparent";
  }
  return "text-foreground/60 border-foreground/20 bg-transparent dark:text-[#0bd1a2] dark:border-[#0bd1a2] dark:bg-transparent";
}

function getGameVoteBadgeClasses(vote: VoteRecord["vote"]): string {
  if (vote === "Yes") {
    return "text-green-400 border-green-400/50 bg-transparent";
  }
  if (vote === "No") {
    return "text-red-400 border-red-400/50 bg-transparent";
  }
  return "text-white/70 border-white/30 bg-transparent";
}

function formatVoterDisplayName(vote: VoteRecord): string {
  const name = vote.voterName?.trim();
  const id = vote.voterId || vote.drepId;
  return name && name.length > 0 ? name : id || "Unknown voter";
}

const selectItemClass =
  "rounded-none data-[highlighted]:bg-black/10 data-[highlighted]:text-foreground data-[state=checked]:bg-black data-[state=checked]:text-white dark:data-[highlighted]:bg-[#0bd1a2]/15 dark:data-[highlighted]:text-[#0bd1a2] dark:data-[state=checked]:bg-[#0bd1a2] dark:data-[state=checked]:text-black";

export function VotingRecords({
  votes,
  showDownload,
  downloadFormat,
  onDownloadFormatChange,
}: VotingRecordsProps) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const [searchQuery, setSearchQuery] = useState("");
  const [voteFilter, setVoteFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [timeSort, setTimeSort] = useState<string>("newest");
  const [powerSort, setPowerSort] = useState<string>("none");
  const [rationaleFilter, setRationaleFilter] = useState<string>("all");
  const [selectedVote, setSelectedVote] = useState<VoteRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState(0);

  const handleDropdownOpenChange = (open: boolean) => {
    setOpenDropdowns((prev) => (open ? prev + 1 : Math.max(0, prev - 1)));
  };

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

  const handleOpenRationale = (vote: VoteRecord) => {
    setSelectedVote(vote);
    setIsModalOpen(true);
  };

  // Check if any votes have transaction hashes
  const hasTransactionHashes = useMemo(() => {
    return votes.some((vote) => vote.txHash && vote.txHash.trim().length > 0);
  }, [votes]);

  const filteredVotes = useMemo(() => {
    let filtered = votes.filter((vote) => {
      const matchesSearch =
        searchQuery === "" ||
        (vote.voterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vote.voterId || "").toLowerCase().includes(searchQuery.toLowerCase());

      const hasRationale =
        Boolean(vote.rationale && vote.rationale.trim().length > 0);

      const matchesVote = voteFilter === "all" || vote.vote.toLowerCase() === voteFilter;
      const matchesRole = roleFilter === "all" || vote.voterType === roleFilter;
      const matchesRationale =
        rationaleFilter === "all" || (rationaleFilter === "with" && hasRationale);

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
      <div className={cn(
        "p-3 sm:p-4",
        isGame 
          ? "game-detail-card" 
          : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
      )}>
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="relative">
            <Search className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform", isGame ? "text-white/50" : "text-muted-foreground")} />
            <Input
              placeholder="Search by voter name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("pl-10", isGame ? "game-nav-input" : "filter-input")}
            />
          </div>
          {isGame ? (
            <GameDropdown
              value={voteFilter}
              onValueChange={setVoteFilter}
              placeholder="Filter by vote"
              onOpenChange={handleDropdownOpenChange}
              options={[
                { value: "all", label: "All Votes" },
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "abstain", label: "Abstain" },
              ]}
            />
          ) : (
            <Select value={voteFilter} onValueChange={setVoteFilter}>
              <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                <SelectValue placeholder="Filter by vote" />
              </SelectTrigger>
              <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                <SelectItem className={selectItemClass} value="all">All Votes</SelectItem>
                <SelectItem className={selectItemClass} value="yes">Yes</SelectItem>
                <SelectItem className={selectItemClass} value="no">No</SelectItem>
                <SelectItem className={selectItemClass} value="abstain">Abstain</SelectItem>
              </SelectContent>
            </Select>
          )}
          {isGame ? (
            <GameDropdown
              value={roleFilter}
              onValueChange={setRoleFilter}
              placeholder="Filter by role"
              onOpenChange={handleDropdownOpenChange}
              options={[
                { value: "all", label: "All Roles" },
                { value: "DRep", label: "DRep" },
                { value: "SPO", label: "SPO" },
                { value: "CC", label: "CC" },
              ]}
            />
          ) : (
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                <SelectItem className={selectItemClass} value="all">All Roles</SelectItem>
                <SelectItem className={selectItemClass} value="DRep">DRep</SelectItem>
                <SelectItem className={selectItemClass} value="SPO">SPO</SelectItem>
                <SelectItem className={selectItemClass} value="CC">CC</SelectItem>
              </SelectContent>
            </Select>
          )}
          {isGame ? (
            <GameDropdown
              value={timeSort}
              onValueChange={setTimeSort}
              placeholder="Sort by time"
              onOpenChange={handleDropdownOpenChange}
              options={[
                { value: "newest", label: "Newest First" },
                { value: "oldest", label: "Oldest First" },
              ]}
            />
          ) : (
            <Select value={timeSort} onValueChange={setTimeSort}>
              <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                <SelectValue placeholder="Sort by time" />
              </SelectTrigger>
              <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                <SelectItem className={selectItemClass} value="newest">Newest First</SelectItem>
                <SelectItem className={selectItemClass} value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          )}
          {isGame ? (
            <GameDropdown
              value={rationaleFilter}
              onValueChange={setRationaleFilter}
              placeholder="Filter by rationale"
              onOpenChange={handleDropdownOpenChange}
              options={[
                { value: "all", label: "All records" },
                { value: "with", label: "Only votes with rationale" },
              ]}
            />
          ) : (
            <Select value={rationaleFilter} onValueChange={setRationaleFilter}>
              <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                <SelectValue placeholder="Filter by rationale" />
              </SelectTrigger>
              <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                <SelectItem className={selectItemClass} value="all">All records</SelectItem>
                <SelectItem className={selectItemClass} value="with">Only votes with rationale</SelectItem>
              </SelectContent>
            </Select>
          )}
          {isGame ? (
            <GameDropdown
              value={powerSort}
              onValueChange={setPowerSort}
              placeholder="Sort by voting power"
              onOpenChange={handleDropdownOpenChange}
              options={[
                { value: "none", label: "No Sort" },
                { value: "high", label: "Highest Voting Power" },
                { value: "low", label: "Lowest Voting Power" },
              ]}
            />
          ) : (
            <Select value={powerSort} onValueChange={setPowerSort}>
              <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                <SelectValue placeholder="Sort by voting power" />
              </SelectTrigger>
              <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                <SelectItem className={selectItemClass} value="none">No Sort</SelectItem>
                <SelectItem className={selectItemClass} value="high">Highest Voting Power</SelectItem>
                <SelectItem className={selectItemClass} value="low">Lowest Voting Power</SelectItem>
              </SelectContent>
            </Select>
          )}
          {showDownload ? (
            isGame ? (
              <GameDropdown
                value={downloadFormat || ""}
                onValueChange={(value) => onDownloadFormatChange?.(value as "json" | "markdown" | "csv")}
                placeholder="Download rationales"
                onOpenChange={handleDropdownOpenChange}
                options={[
                  { value: "json", label: "Download as JSON" },
                  { value: "markdown", label: "Download as Markdown" },
                  { value: "csv", label: "Download as CSV" },
                ]}
              />
            ) : (
              <Select
                value={downloadFormat || ""}
                onValueChange={(value: string) =>
                  onDownloadFormatChange?.(value as "json" | "markdown" | "csv")
                }>
                <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                  <SelectValue placeholder="Download rationales" />
                </SelectTrigger>
                <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                  <SelectItem className={selectItemClass} value="json">Download as JSON</SelectItem>
                  <SelectItem className={selectItemClass} value="markdown">Download as Markdown</SelectItem>
                  <SelectItem className={selectItemClass} value="csv">Download as CSV</SelectItem>
                </SelectContent>
              </Select>
            )
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>
      </div>

      <div 
        className={cn(
          "rounded-2xl border border-white/8 bg-[#faf9f6] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none transition-[margin-top] duration-300 ease-in-out",
          isGame && "game-detail-card"
        )}
        style={isGame && openDropdowns > 0 ? { marginTop: '280px' } : undefined}
      >
        <div className="-mx-4 overflow-x-auto sm:-mx-6 md:mx-0">
          <div className={cn("inline-block min-w-full px-4 align-middle sm:px-6 md:px-0", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
            <Table className={isGame ? "game-voting-table" : ""}>
              <TableHeader>
                <TableRow className={cn("voting-records-header", isGame && "border-b border-white/10")}>
                  <TableHead className={isGame ? "text-white/70" : ""}>Voter</TableHead>
                  {hasTransactionHashes && <TableHead className={isGame ? "text-white/70" : ""}>Transaction</TableHead>}
                  <TableHead className={isGame ? "text-white/70" : ""}>Vote</TableHead>
                  <TableHead className={isGame ? "text-white/70" : ""}>Voting Power</TableHead>
                  <TableHead className={isGame ? "text-white/70" : ""}>Voted At</TableHead>
                  <TableHead className={cn("text-right", isGame ? "text-white/70" : "")}>Rationale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={hasTransactionHashes ? 6 : 5} className="py-12 text-center text-muted-foreground">
                      No voting records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVotes.map((vote, index) => {
                    const voteId = getVoteId(vote);
                    const hasRationale = Boolean(
                      vote.rationale && vote.rationale.trim().length > 0
                    );
                    const isFirstRow = index === 0;
                    const voteLower = vote.vote.toLowerCase();
                    const isNoVote = voteLower === "no";
                    return (
                  <TableRow
                    key={voteId}
                    className={cn(
                      "voting-record-row hover:bg-transparent transition-transform duration-300 ease-out transform-gpu hover:scale-[1.01]",
                      isFirstRow && "first-row",
                      isNoVote && "vote-no-row",
                      isGame && "border-b border-white/10"
                    )}
                  >
                        <TableCell>
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <span className={cn("font-semibold", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
                                {formatVoterDisplayName(vote)}
                              </span>
                                <Badge variant="outline" className={isGame ? "border-white/30 bg-transparent px-1.5 py-0 text-xs text-white/70" : "border-foreground/20 bg-transparent px-1.5 py-0 text-xs dark:text-[#0bd1a2] dark:border-[#0bd1a2] dark:bg-transparent"}>
                                {vote.voterType}
                              </Badge>
                            </div>
                            <div className={cn("font-mono text-xs break-all", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                              {vote.voterId || vote.drepId || "—"}
                            </div>
                          </div>
                        </TableCell>
                        {hasTransactionHashes && (
                          <TableCell>
                            {vote.txHash ? (
                              <code className={cn("font-mono text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                                {vote.txHash.slice(0, 16)}...
                              </code>
                            ) : (
                              <span className={cn("text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant="outline" className={isGame ? getGameVoteBadgeClasses(vote.vote) : getVoteBadgeClasses(vote.vote)}>
                            {vote.vote}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {vote.voterType !== "CC" ? (
                            <div className={cn("font-semibold", isGame && "text-white")}>
                              {formatAda(vote.votingPowerAda || 0)} ADA
                            </div>
                          ) : (
                            <div className={cn("text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>One member, one vote</div>
                          )}
                        </TableCell>
                        <TableCell className={cn("text-sm", isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                          {vote.votedAt ? new Date(vote.votedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasRationale ? (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleOpenRationale(vote)}
                              className={isGame ? "game-nav-btn" : "bg-white text-black hover:bg-black hover:text-white transition-colors shadow-[0_12px_30px_rgba(15,23,42,0.25)] btn-neon"}
                            >
                              View
                            </Button>
                          ) : (
                            <span className={cn("text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                              No rationale
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
      <VotingRationaleModal 
        vote={selectedVote} 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen}
      />
    </div>
  );
}
