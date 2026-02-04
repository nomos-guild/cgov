import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GameDropdown } from "@/components/ui/game-dropdown";
import { VotingRationaleModal } from "@/components/VotingRationaleModal";
import type { VoteRecord } from "@/types/governance";
import { Search, ChevronDown, Copy, Check } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface VotingRecordsProps {
  votes: VoteRecord[];
  proposalId?: string;
  showDownload?: boolean;
  downloadFormat?: string;
  isExporting?: boolean;
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
  allLabel?: string;
  selectedLabel?: (count: number) => string;
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
  allLabel = "All",
  selectedLabel = (count) => `${count} selected`,
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
    const handleScroll = () => {
      onOpenChange(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, onOpenChange]);

  const handleToggle = (value: string) => {
    // If currently all items are selected or no items are selected (showing "All")
    // clicking any specific item should select only that item
    if (isAllSelected || selected.length === 0) {
      onSelectionChange([value]);
    }
    // If the clicked item is already selected, deselect it
    else if (selected.includes(value)) {
      onSelectionChange(selected.filter((v) => v !== value));
    }
    // Otherwise, add it to the selection
    else {
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
      : selectedLabel(selected.length);

  if (isGame) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => onOpenChange(!isOpen)}
          className="game-nav-btn flex h-10 w-full items-center justify-between px-3 py-2 text-sm"
          aria-expanded={isOpen}
        >
          <span className={cn("truncate", selected.length === 0 || isAllSelected ? "text-white/50" : "")}>
            {displayText}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
        {isOpen && (
          <div className="game-select-content absolute left-0 z-50 mt-1 min-w-[var(--radix-popover-trigger-width)] w-full">
            <button
              type="button"
              className="dropdown-item w-full text-left flex items-center gap-2"
              data-state={isAllSelected ? "checked" : "unchecked"}
              onClick={handleToggleAll}
            >
              {allLabel}
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
        <span className="truncate">
          {displayText}
        </span>
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform shrink-0", isOpen && "rotate-180")} />
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
            <span className="font-semibold dark:text-[#0bd1a2]">{allLabel}</span>
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
  isExporting,
  onDownloadFormatChange,
}: VotingRecordsProps) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const tCommon = useTranslations("common");
  const tFilters = useTranslations("filters");
  const tTable = useTranslations("table");
  const tVoting = useTranslations("voting");
  const tSort = useTranslations("sort");
  const tDownload = useTranslations("download");
  const tTranslation = useTranslations("translation");
  const tRationale = useTranslations("rationaleFilter");
  const translateVote = (vote: string) => {
    const map: Record<string, string> = { Yes: tVoting("yes"), No: tVoting("no"), Abstain: tVoting("abstain") };
    return map[vote] ?? vote;
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVotes, setSelectedVotes] = useState<string[]>([...VOTE_OPTIONS]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([...ROLE_OPTIONS]);
  const [timeSort, setTimeSort] = useState<string>("newest");
  const [powerSort, setPowerSort] = useState<string>("none");
  const [rationaleFilter, setRationaleFilter] = useState<string>("all");
  const [selectedVoteRecord, setSelectedVoteRecord] = useState<VoteRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    } else {
      setOpenDropdownId(null);
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

  const [copiedTxHash, setCopiedTxHash] = useState<string | null>(null);

  const handleCopyTxHash = useCallback((txHash: string) => {
    navigator.clipboard.writeText(txHash);
    setCopiedTxHash(txHash);
    setTimeout(() => setCopiedTxHash(null), 2000);
  }, []);

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
      <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4">
        {showDownload && (
          <div className={cn(
            "w-full sm:w-auto sm:min-w-[220px] p-2.5 sm:p-3 md:p-4",
            isGame
              ? "game-detail-card"
              : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
          )}>
            {isGame ? (
              <GameDropdown
                value={downloadFormat || ""}
                onValueChange={(value) => onDownloadFormatChange?.(value as "json" | "markdown" | "csv")}
                placeholder={isExporting ? tTranslation("translating") : tDownload("downloadRationales")}
                onOpenChange={(open) => handleDropdownOpenChange("download", open)}
                options={[
                  { value: "json", label: tDownload("json") },
                  { value: "markdown", label: tDownload("markdown") },
                  { value: "csv", label: tDownload("csv") },
                ]}
              />
            ) : (
              <Select
                value={downloadFormat || ""}
                disabled={isExporting}
                onValueChange={(value: string) =>
                  onDownloadFormatChange?.(value as "json" | "markdown" | "csv")
                }
                onOpenChange={(open) => handleDropdownOpenChange("download", open)}>
                <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2] [&>span]:truncate">
                  <SelectValue placeholder={isExporting ? tTranslation("translating") : tDownload("downloadRationales")} />
                </SelectTrigger>
                <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                  <SelectItem className={selectItemClass} value="json">{tDownload("json")}</SelectItem>
                  <SelectItem className={selectItemClass} value="markdown">{tDownload("markdown")}</SelectItem>
                  <SelectItem className={selectItemClass} value="csv">{tDownload("csv")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className={cn(
          "w-full sm:w-auto sm:w-[160px] p-2.5 sm:p-3 md:p-4",
          isGame
            ? "game-detail-card"
            : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
        )}>
          <div className="relative">
            <Search className={cn("absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 transform", isGame ? "text-white/50" : "text-muted-foreground")} />
            <Input
              placeholder={tCommon("search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("pl-8 sm:pl-10 h-8 sm:h-9 md:h-10 text-xs sm:text-sm", isGame ? "game-nav-input" : "filter-input")}
            />
          </div>
        </div>

        <div className={cn(
          "flex-1 min-w-0 p-2.5 sm:p-3 md:p-4",
          isGame
            ? "game-detail-card"
            : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
        )}>
          <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4">
            <div className="flex-1 min-w-[120px]">
              <MultiSelectDropdown
                label={tFilters("filterByVote")}
                options={VOTE_OPTIONS}
                selected={selectedVotes}
                onSelectionChange={setSelectedVotes}
                isOpen={openDropdownId === "vote"}
                onOpenChange={(open) => handleDropdownOpenChange("vote", open)}
                isGame={isGame}
                formatLabel={(v) => tVoting(v as "yes" | "no" | "abstain")}
                allLabel={tCommon("all")}
                selectedLabel={(count) => tCommon("selected", { count })}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <MultiSelectDropdown
                label={tFilters("filterByRole")}
                options={ROLE_OPTIONS}
                selected={selectedRoles}
                onSelectionChange={setSelectedRoles}
                isOpen={openDropdownId === "role"}
                onOpenChange={(open) => handleDropdownOpenChange("role", open)}
                isGame={isGame}
                allLabel={tCommon("all")}
                selectedLabel={(count) => tCommon("selected", { count })}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              {isGame ? (
                <GameDropdown
                  value={timeSort}
                  onValueChange={setTimeSort}
                  placeholder={tSort("sortByTime")}
                  onOpenChange={(open) => handleDropdownOpenChange("time", open)}
                  options={[
                    { value: "newest", label: tSort("newestFirst") },
                    { value: "oldest", label: tSort("oldestFirst") },
                  ]}
                />
              ) : (
                <Select value={timeSort} onValueChange={setTimeSort} onOpenChange={(open) => handleDropdownOpenChange("time", open)}>
                  <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2] [&>span]:truncate">
                    <SelectValue placeholder={tSort("sortByTime")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                    <SelectItem className={selectItemClass} value="newest">{tSort("newestFirst")}</SelectItem>
                    <SelectItem className={selectItemClass} value="oldest">{tSort("oldestFirst")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex-1 min-w-[140px]">
              {isGame ? (
                <GameDropdown
                  value={rationaleFilter}
                  onValueChange={setRationaleFilter}
                  placeholder={tFilters("filterByRationale")}
                  onOpenChange={(open) => handleDropdownOpenChange("rationale", open)}
                  options={[
                    { value: "all", label: tRationale("allRecords") },
                    { value: "with", label: tRationale("withRationale") },
                  ]}
                />
              ) : (
                <Select value={rationaleFilter} onValueChange={setRationaleFilter} onOpenChange={(open) => handleDropdownOpenChange("rationale", open)}>
                  <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2] [&>span]:truncate">
                    <SelectValue placeholder={tFilters("filterByRationale")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                    <SelectItem className={selectItemClass} value="all">{tRationale("allRecords")}</SelectItem>
                    <SelectItem className={selectItemClass} value="with">{tRationale("withRationale")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex-1 min-w-[150px]">
              {isGame ? (
                <GameDropdown
                  value={powerSort}
                  onValueChange={setPowerSort}
                  placeholder={tSort("sortByVotingPower")}
                  onOpenChange={(open) => handleDropdownOpenChange("power", open)}
                  options={[
                    { value: "none", label: tSort("votingPower") },
                    { value: "high", label: tSort("highestPower") },
                    { value: "low", label: tSort("lowestPower") },
                  ]}
                />
              ) : (
                <Select value={powerSort} onValueChange={setPowerSort} onOpenChange={(open) => handleDropdownOpenChange("power", open)}>
                  <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2] [&>span]:truncate">
                    <SelectValue placeholder={tSort("sortByVotingPower")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                    <SelectItem className={selectItemClass} value="none">{tSort("votingPower")}</SelectItem>
                    <SelectItem className={selectItemClass} value="high">{tSort("highestPower")}</SelectItem>
                    <SelectItem className={selectItemClass} value="low">{tSort("lowestPower")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile card layout */}
      <div
        className={cn(
          "sm:hidden space-y-2 min-h-[400px]",
        )}
      >
        {filteredVotes.length === 0 ? (
          <div className={cn(
            "py-12 text-center text-muted-foreground",
            isGame ? "game-detail-card" : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
          )}>
            {tVoting("noVotingRecordsFound")}
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
                        {translateVote(vote.vote)}
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
                        {tCommon("view")}
                      </Button>
                    ) : (
                      <span className={cn("text-[9px]", isGame ? "text-white/40" : "text-muted-foreground/60 dark:text-[#0bd1a2]/60")}>
                        {tVoting("noRationale")}
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
            {tCommon("showMoreVotes", { count: remainingVotes })}
          </Button>
        )}
      </div>

      {/* Desktop table layout */}
      <div
        className={cn(
          "hidden sm:block rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none voting-records-container min-h-[400px]",
          isGame && "game-detail-card"
        )}
      >
        <div className="voting-records-container">
          <div className={cn("inline-block min-w-full px-2 sm:px-4 md:px-6 lg:px-0 align-middle", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
            <Table className={isGame ? "game-voting-table" : ""}>
              <TableHeader>
                <TableRow className={cn("voting-records-header", isGame && "border-b border-white/10")}>
                  <TableHead className={cn("text-xs sm:text-sm", isGame ? "text-white/70" : "")}>{tTable("voter")}</TableHead>
                  {hasTransactionHashes && <TableHead className={cn("hidden md:table-cell text-xs sm:text-sm", isGame ? "text-white/70" : "")}>{tTable("transaction")}</TableHead>}
                  <TableHead className={cn("text-xs sm:text-sm", isGame ? "text-white/70" : "")}>{tTable("vote")}</TableHead>
                  <TableHead className={cn("text-xs sm:text-sm", isGame ? "text-white/70" : "")}>{tTable("votingPower")}</TableHead>
                  <TableHead className={cn("hidden md:table-cell text-xs sm:text-sm", isGame ? "text-white/70" : "")}>{tTable("votedAt")}</TableHead>
                  <TableHead className={cn("text-right text-xs sm:text-sm", isGame ? "text-white/70" : "")}>{tTable("rationale")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={hasTransactionHashes ? 6 : 5} className="py-12 text-center text-muted-foreground">
                      {tVoting("noVotingRecordsFound")}
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
                              <div className="flex items-center gap-2">
                                <code className={cn("font-mono text-[10px] sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                                  {vote.txHash.slice(0, 16)}...
                                </code>
                                <button
                                  onClick={() => handleCopyTxHash(vote.txHash!)}
                                  className={cn(
                                    "inline-flex items-center justify-center p-1 rounded transition-colors",
                                    isGame
                                      ? "hover:bg-white/10 text-white/50 hover:text-white"
                                      : "hover:bg-muted text-muted-foreground hover:text-foreground dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2]/10"
                                  )}
                                  aria-label="Copy transaction hash"
                                >
                                  {copiedTxHash === vote.txHash ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className={cn("text-[10px] sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="py-2 sm:py-3">
                          <Badge variant="outline" className={cn("text-[10px] sm:text-xs px-1.5 sm:px-2", isGame ? getGameVoteBadgeClasses(vote.vote) : getVoteBadgeClasses(vote.vote))}>
                            {translateVote(vote.vote)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 sm:py-3">
                          {vote.voterType !== "CC" ? (
                            <div className={cn("font-semibold text-xs sm:text-sm", isGame && "text-white")}>
                              {formatAda(vote.votingPowerAda || 0)} ADA
                            </div>
                          ) : (
                            <div className={cn("text-[10px] sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>{tVoting("oneMemberOneVote")}</div>
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
                              {tCommon("view")}
                            </Button>
                          ) : (
                            <span className={cn("text-[10px] sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                              {tVoting("noRationale")}
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
              {tCommon("showMoreVotes", { count: remainingVotes })}
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
