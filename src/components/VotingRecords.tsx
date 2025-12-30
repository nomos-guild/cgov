import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GameDropdown } from "@/components/ui/game-dropdown";
import { VotingRationaleModal } from "@/components/VotingRationaleModal";
import type { VoteRecord } from "@/types/governance";
import { Search, ChevronDown } from "lucide-react";
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

const VOTE_OPTIONS = ["yes", "no", "abstain"] as const;
const ROLE_OPTIONS = ["DRep", "SPO", "CC"] as const;

interface MultiSelectDropdownProps {
  label: string;
  options: readonly string[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isGame?: boolean;
  formatLabel?: (value: string) => string;
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onSelectionChange,
  isOpen,
  onOpenChange,
  isGame,
  formatLabel = (v) => v,
}: MultiSelectDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAllSelected = selected.length === options.length;

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onOpenChange]);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter((v) => v !== value));
    } else {
      onSelectionChange([...selected, value]);
    }
  };

  const handleToggleAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...options]);
    }
  };

  const displayText = isAllSelected || selected.length === 0
    ? label
    : selected.length === 1
      ? formatLabel(selected[0])
      : `${selected.length} selected`;

  if (isGame) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => onOpenChange(!isOpen)}
          className="game-nav-btn flex h-10 w-full items-center justify-between px-3 py-2 text-sm"
          aria-expanded={isOpen}
        >
          <span className={selected.length === 0 || isAllSelected ? "text-white/50" : ""}>
            {displayText}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
        {isOpen && (
          <div className="game-select-content absolute left-0 z-50 mt-1 min-w-[var(--radix-popover-trigger-width)] w-full">
            <button
              type="button"
              className="dropdown-item w-full text-left flex items-center gap-2"
              data-state={isAllSelected ? "checked" : "unchecked"}
              onClick={handleToggleAll}
            >
              All
              <span className="game-switch-indicator" />
            </button>
            {options.map((option) => (
              <button
                key={option}
                type="button"
                className="dropdown-item w-full text-left flex items-center gap-2"
                data-state={selected.includes(option) ? "checked" : "unchecked"}
                onClick={() => handleToggle(option)}
              >
                {formatLabel(option)}
                <span className="game-switch-indicator" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className="btn-neon flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-0 ring-offset-0 focus:outline-none focus:border-black dark:focus:border-[#0bd1a2]"
      >
        <span className={selected.length === 0 || isAllSelected ? "text-muted-foreground" : ""}>
          {displayText}
        </span>
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-full min-w-[180px] rounded-md border border-input bg-[#faf9f6] p-1 shadow-md dark:border-[#0bd1a2] dark:bg-black">
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-black/10 dark:hover:bg-[#0bd1a2]/10">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleAll}
              className="h-4 w-4 accent-foreground dark:accent-[#0bd1a2]"
            />
            <span className="font-semibold dark:text-[#0bd1a2]">All</span>
          </label>
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-black/10 dark:hover:bg-[#0bd1a2]/10"
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => handleToggle(option)}
                className="h-4 w-4 accent-foreground dark:accent-[#0bd1a2]"
              />
              <span className="dark:text-[#0bd1a2]">{formatLabel(option)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function VotingRecords({
  votes,
  showDownload,
  downloadFormat,
  onDownloadFormatChange,
}: VotingRecordsProps) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVotes, setSelectedVotes] = useState<string[]>([...VOTE_OPTIONS]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([...ROLE_OPTIONS]);
  const [timeSort, setTimeSort] = useState<string>("newest");
  const [powerSort, setPowerSort] = useState<string>("none");
  const [rationaleFilter, setRationaleFilter] = useState<string>("all");
  const [selectedVoteRecord, setSelectedVoteRecord] = useState<VoteRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnyDropdownOpen, setIsAnyDropdownOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showAllVotes, setShowAllVotes] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const INITIAL_VOTES_LIMIT = 20;

  const handleDropdownOpenChange = useCallback((id: string, open: boolean) => {
    if (open) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setOpenDropdownId(id);
      setIsAnyDropdownOpen(true);
    } else {
      setOpenDropdownId(null);
      closeTimeoutRef.current = setTimeout(() => {
        setIsAnyDropdownOpen(false);
      }, 100);
    }
  }, []);

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
    setSelectedVoteRecord(vote);
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

      const matchesVote = selectedVotes.length === 0 || selectedVotes.includes(vote.vote.toLowerCase());
      const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(vote.voterType || "");
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
  }, [votes, searchQuery, selectedVotes, selectedRoles, rationaleFilter, timeSort, powerSort]);

  const displayedVotes = useMemo(() => {
    if (showAllVotes) return filteredVotes;
    return filteredVotes.slice(0, INITIAL_VOTES_LIMIT);
  }, [filteredVotes, showAllVotes, INITIAL_VOTES_LIMIT]);

  const hasMoreVotes = filteredVotes.length > INITIAL_VOTES_LIMIT;
  const remainingVotes = filteredVotes.length - INITIAL_VOTES_LIMIT;

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className={cn(
        "p-2.5 sm:p-3 md:p-4",
        isGame 
          ? "game-detail-card" 
          : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
      )}>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className={cn("absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 transform", isGame ? "text-white/50" : "text-muted-foreground")} />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("pl-8 sm:pl-10 h-8 sm:h-9 md:h-10 text-xs sm:text-sm", isGame ? "game-nav-input" : "filter-input")}
            />
          </div>
          <MultiSelectDropdown
            label="Filter by vote"
            options={VOTE_OPTIONS}
            selected={selectedVotes}
            onSelectionChange={setSelectedVotes}
            isOpen={openDropdownId === "vote"}
            onOpenChange={(open) => handleDropdownOpenChange("vote", open)}
            isGame={isGame}
            formatLabel={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
          />
          <MultiSelectDropdown
            label="Filter by role"
            options={ROLE_OPTIONS}
            selected={selectedRoles}
            onSelectionChange={setSelectedRoles}
            isOpen={openDropdownId === "role"}
            onOpenChange={(open) => handleDropdownOpenChange("role", open)}
            isGame={isGame}
          />
          {isGame ? (
            <GameDropdown
              value={timeSort}
              onValueChange={setTimeSort}
              placeholder="Sort by time"
              onOpenChange={(open) => handleDropdownOpenChange("time", open)}
              options={[
                { value: "newest", label: "Newest First" },
                { value: "oldest", label: "Oldest First" },
              ]}
            />
          ) : (
            <Select value={timeSort} onValueChange={setTimeSort} onOpenChange={(open) => handleDropdownOpenChange("time", open)}>
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
              onOpenChange={(open) => handleDropdownOpenChange("rationale", open)}
              options={[
                { value: "all", label: "All records" },
                { value: "with", label: "With rationale" },
              ]}
            />
          ) : (
            <Select value={rationaleFilter} onValueChange={setRationaleFilter} onOpenChange={(open) => handleDropdownOpenChange("rationale", open)}>
              <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                <SelectValue placeholder="Filter by rationale" />
              </SelectTrigger>
              <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                <SelectItem className={selectItemClass} value="all">All records</SelectItem>
                <SelectItem className={selectItemClass} value="with">With rationale</SelectItem>
              </SelectContent>
            </Select>
          )}
          {isGame ? (
            <GameDropdown
              value={powerSort}
              onValueChange={setPowerSort}
              placeholder="Sort by voting power"
              onOpenChange={(open) => handleDropdownOpenChange("power", open)}
              options={[
                { value: "none", label: "Voting Power" },
                { value: "high", label: "Highest Power" },
                { value: "low", label: "Lowest Power" },
              ]}
            />
          ) : (
            <Select value={powerSort} onValueChange={setPowerSort} onOpenChange={(open) => handleDropdownOpenChange("power", open)}>
              <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                <SelectValue placeholder="Sort by voting power" />
              </SelectTrigger>
              <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                <SelectItem className={selectItemClass} value="none">Voting Power</SelectItem>
                <SelectItem className={selectItemClass} value="high">Highest Power</SelectItem>
                <SelectItem className={selectItemClass} value="low">Lowest Power</SelectItem>
              </SelectContent>
            </Select>
          )}
          {showDownload ? (
            isGame ? (
              <GameDropdown
                value={downloadFormat || ""}
                onValueChange={(value) => onDownloadFormatChange?.(value as "json" | "markdown" | "csv")}
                placeholder="Download rationales"
                onOpenChange={(open) => handleDropdownOpenChange("download", open)}
                options={[
                  { value: "json", label: "JSON" },
                  { value: "markdown", label: "Markdown" },
                  { value: "csv", label: "CSV" },
                ]}
              />
            ) : (
              <Select
                value={downloadFormat || ""}
                onValueChange={(value: string) =>
                  onDownloadFormatChange?.(value as "json" | "markdown" | "csv")
                }
                onOpenChange={(open) => handleDropdownOpenChange("download", open)}>
                <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                  <SelectValue placeholder="Download rationales" />
                </SelectTrigger>
                <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                  <SelectItem className={selectItemClass} value="json">JSON</SelectItem>
                  <SelectItem className={selectItemClass} value="markdown">Markdown</SelectItem>
                  <SelectItem className={selectItemClass} value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            )
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>
      </div>

      {/* Mobile card layout */}
      <div 
        className={cn(
          "sm:hidden space-y-2 transition-[margin-top] duration-300 ease-in-out",
        )}
        style={isGame && isAnyDropdownOpen ? { marginTop: '280px' } : undefined}
      >
        {filteredVotes.length === 0 ? (
          <div className={cn(
            "py-12 text-center text-muted-foreground",
            isGame ? "game-detail-card" : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
          )}>
            No voting records found
          </div>
        ) : (
          displayedVotes.map((vote) => {
            const voteId = getVoteId(vote);
            const hasRationale = Boolean(vote.rationale && vote.rationale.trim().length > 0);
            return (
              <div
                key={voteId}
                className={cn(
                  "p-3 transition-transform duration-300 ease-out transform-gpu active:scale-[0.99]",
                  isGame 
                    ? "game-detail-card" 
                    : "rounded-xl border border-white/8 bg-[#faf9f6] shadow-[0_8px_20px_rgba(15,23,42,0.15)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px] shrink-0", isGame ? "border-white/30 bg-transparent text-white/70" : "border-foreground/20 bg-transparent dark:text-[#0bd1a2] dark:border-[#0bd1a2] dark:bg-transparent")}>
                        {vote.voterType}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 shrink-0", isGame ? getGameVoteBadgeClasses(vote.vote) : getVoteBadgeClasses(vote.vote))}>
                        {vote.vote}
                      </Badge>
                      {vote.voterType !== "CC" && (
                        <span className={cn("text-[10px] font-medium shrink-0", isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                          {formatAda(vote.votingPowerAda || 0)} ADA
                        </span>
                      )}
                    </div>
                    <div className={cn("font-semibold text-xs truncate", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
                      {formatVoterDisplayName(vote)}
                    </div>
                    <div className={cn("font-mono text-[9px] truncate", isGame ? "text-white/40" : "text-muted-foreground/70 dark:text-[#0bd1a2]/70")}>
                      {vote.voterId || vote.drepId || "—"}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {hasRationale ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleOpenRationale(vote)}
                        className={cn("h-7 px-2 text-[10px]", isGame ? "game-nav-btn" : "bg-white text-black hover:bg-black hover:text-white transition-colors shadow-[0_8px_16px_rgba(15,23,42,0.2)] btn-neon")}
                      >
                        View
                      </Button>
                    ) : (
                      <span className={cn("text-[9px]", isGame ? "text-white/40" : "text-muted-foreground/60 dark:text-[#0bd1a2]/60")}>
                        No rationale
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {hasMoreVotes && !showAllVotes && filteredVotes.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setShowAllVotes(true)}
            className={cn(
              "w-full mt-3",
              isGame 
                ? "game-nav-btn" 
                : "bg-white text-black hover:bg-black hover:text-white transition-colors shadow-[0_8px_16px_rgba(15,23,42,0.2)] btn-neon"
            )}
          >
            Show {remainingVotes} more votes
          </Button>
        )}
      </div>

      {/* Desktop table layout */}
      <div 
        className={cn(
          "hidden sm:block rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none transition-[margin-top] duration-300 ease-in-out voting-records-container",
          isGame && "game-detail-card"
        )}
        style={isGame && isAnyDropdownOpen ? { marginTop: '280px' } : undefined}
      >
        <div className="voting-records-container">
          <div className={cn("inline-block min-w-full px-2 sm:px-4 md:px-6 lg:px-0 align-middle", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
            <Table className={isGame ? "game-voting-table" : ""}>
              <TableHeader>
                <TableRow className={cn("voting-records-header", isGame && "border-b border-white/10")}>
                  <TableHead className={cn("text-xs sm:text-sm", isGame ? "text-white/70" : "")}>Voter</TableHead>
                  {hasTransactionHashes && <TableHead className={cn("hidden md:table-cell text-xs sm:text-sm", isGame ? "text-white/70" : "")}>Transaction</TableHead>}
                  <TableHead className={cn("text-xs sm:text-sm", isGame ? "text-white/70" : "")}>Vote</TableHead>
                  <TableHead className={cn("text-xs sm:text-sm", isGame ? "text-white/70" : "")}>Voting Power</TableHead>
                  <TableHead className={cn("hidden md:table-cell text-xs sm:text-sm", isGame ? "text-white/70" : "")}>Voted At</TableHead>
                  <TableHead className={cn("text-right text-xs sm:text-sm", isGame ? "text-white/70" : "")}>Rationale</TableHead>
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
                  displayedVotes.map((vote, index) => {
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
                        <TableCell className="py-2 sm:py-3">
                          <div>
                            <div className="mb-0.5 sm:mb-1 flex flex-wrap items-center gap-1 sm:gap-2">
                              <span className={cn("font-semibold text-xs sm:text-sm", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
                                {formatVoterDisplayName(vote)}
                              </span>
                              <Badge variant="outline" className={cn("px-1 sm:px-1.5 py-0 text-[10px] sm:text-xs", isGame ? "border-white/30 bg-transparent text-white/70" : "border-foreground/20 bg-transparent dark:text-[#0bd1a2] dark:border-[#0bd1a2] dark:bg-transparent")}>
                                {vote.voterType}
                              </Badge>
                            </div>
                            <div className={cn("font-mono text-[10px] sm:text-xs break-all line-clamp-1", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                              {vote.voterId || vote.drepId || "—"}
                            </div>
                          </div>
                        </TableCell>
                        {hasTransactionHashes && (
                          <TableCell className="hidden md:table-cell py-2 sm:py-3">
                            {vote.txHash ? (
                              <code className={cn("font-mono text-[10px] sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                                {vote.txHash.slice(0, 16)}...
                              </code>
                            ) : (
                              <span className={cn("text-[10px] sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="py-2 sm:py-3">
                          <Badge variant="outline" className={cn("text-[10px] sm:text-xs px-1.5 sm:px-2", isGame ? getGameVoteBadgeClasses(vote.vote) : getVoteBadgeClasses(vote.vote))}>
                            {vote.vote}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 sm:py-3">
                          {vote.voterType !== "CC" ? (
                            <div className={cn("font-semibold text-xs sm:text-sm", isGame && "text-white")}>
                              {formatAda(vote.votingPowerAda || 0)} ADA
                            </div>
                          ) : (
                            <div className={cn("text-[10px] sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>One member, one vote</div>
                          )}
                        </TableCell>
                        <TableCell className={cn("hidden md:table-cell py-2 sm:py-3 text-xs sm:text-sm", isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                          {vote.votedAt ? new Date(vote.votedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right py-2 sm:py-3">
                          {hasRationale ? (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleOpenRationale(vote)}
                              className={cn("h-7 sm:h-8 px-2 sm:px-3 text-xs", isGame ? "game-nav-btn" : "bg-white text-black hover:bg-black hover:text-white transition-colors shadow-[0_12px_30px_rgba(15,23,42,0.25)] btn-neon")}
                            >
                              View
                            </Button>
                          ) : (
                            <span className={cn("text-[10px] sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
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
        {hasMoreVotes && !showAllVotes && filteredVotes.length > 0 && (
          <div className="p-4">
            <Button
              variant="outline"
              onClick={() => setShowAllVotes(true)}
              className={cn(
                "w-full",
                isGame 
                  ? "game-nav-btn" 
                  : "bg-white text-black hover:bg-black hover:text-white transition-colors shadow-[0_8px_16px_rgba(15,23,42,0.2)] btn-neon"
              )}
            >
              Show {remainingVotes} more votes
            </Button>
          </div>
        )}
      </div>
      <VotingRationaleModal 
        vote={selectedVoteRecord} 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen}
      />
    </div>
  );
}
