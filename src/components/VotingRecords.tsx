import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useWallet } from "@meshsdk/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GameDropdown } from "@/components/ui/game-dropdown";
import { VotingRationaleModal } from "@/components/VotingRationaleModal";
import type { VoteRecord } from "@/types/governance";
import { useAllDReps } from "@/hooks/useDRepData";
import { toCip129DRepId } from "@/lib/drepFormatters";
import useSWR from "swr";
import { Search, ChevronDown, ChevronRight, Copy, Check, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface VotingRecordsProps {
  votes: VoteRecord[];
  proposalId?: string;
  showDownload?: boolean;
  isExporting?: boolean;
  onDownloadFormatChange?: (format: "json" | "markdown" | "csv") => void;
  onMetricsExport?: (format: "csv" | "json" | "markdown") => void;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(ada));
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

/** Fallback names for CC members whose names are missing in the backend DB */
const CC_MEMBER_NAMES: Record<string, string> = {
  "cc_hot1qdc65ke6jfq2q25fcn3g89tea30tvrzpptc2tw6g8cdc7pqtmus0y": "Ace Alliance",
  "cc_hot1qdjx6xe6e9zk3fpzk6rakmz84n0cf8ckwjvz4e8e5j2tuscr7ckq4": "Tingvard",
  "cc_hot1qf5tkz6zwcpplq3kgpt2486d8za943vmymqkdjl249qgw3s2y5r9y": "Phil_uplc",
  "cc_hot1qwz0aw5583t56fvcg96ulqjhjk0xkwsuvs2rmp0xflhkh4g5e22ce": "Cardano Curia",
};

function resolveCCName(id: string, name?: string | null): string {
  if (name && name.trim().length > 0) return name;
  return CC_MEMBER_NAMES[id] || id;
}

function formatVoterDisplayName(vote: VoteRecord): string {
  const name = vote.voterName?.trim();
  const id = vote.voterId || vote.drepId;
  if (name && name.length > 0) return name;
  // Try CC fallback for CC voters
  if (id && CC_MEMBER_NAMES[id]) return CC_MEMBER_NAMES[id];
  return id || "Unknown voter";
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
        <div className="absolute left-0 z-50 mt-1 w-full min-w-[180px] rounded-md border border-input bg-card p-1 shadow-md dark:border-[#0bd1a2] dark:bg-black">
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
  isExporting,
  onDownloadFormatChange,
  onMetricsExport,
}: VotingRecordsProps) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const { connected, wallet } = useWallet();
  const [connectedDrepId, setConnectedDrepId] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !wallet) {
      setConnectedDrepId(null);
      return;
    }
    wallet.getDRep().then((dRep) => {
      if (dRep?.dRepIDCip105) {
        setConnectedDrepId(toCip129DRepId(dRep.dRepIDCip105));
      }
    }).catch(() => setConnectedDrepId(null));
  }, [connected, wallet]);

  const tCommon = useTranslations("common");
  const tFilters = useTranslations("filters");
  const tTable = useTranslations("table");
  const tVoting = useTranslations("voting");
  const tSort = useTranslations("sort");
  const tDownload = useTranslations("download");
  const tRationale = useTranslations("rationaleFilter");
  const translateVote = (vote: string) => {
    const map: Record<string, string> = { Yes: tVoting("yes"), No: tVoting("no"), Abstain: tVoting("abstain") };
    return map[vote] ?? vote;
  };
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [downloadSubMenu, setDownloadSubMenu] = useState<"rationales" | "metrics" | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
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
  const [participationMode, setParticipationMode] = useState<"voted" | "not-voted">("voted");
  const [highlightedVoterId, setHighlightedVoterId] = useState<string | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handledVoterParamRef = useRef<string | null>(null);

  const router = useRouter();
  const voterParam = typeof router.query.voter === "string" ? router.query.voter : null;

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

  const handleParticipationChange = useCallback((mode: "voted" | "not-voted") => {
    setParticipationMode(mode);
    setShowAllVotes(false);
  }, []);

  // Close download menu on outside click
  useEffect(() => {
    if (!downloadMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
        setDownloadSubMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [downloadMenuOpen]);

  const voteIdMap = useMemo(() => {
    const map = new Map<VoteRecord, number>();
    votes.forEach((vote, index) => {
      map.set(vote, index);
    });
    return map;
  }, [votes]);

  // Map each superseded vote → info about the replacement vote.
  // A voter can submit multiple vote transactions for the same proposal;
  // only the latest counts on-chain, so older records are stale.
  const staleness = useMemo(() => {
    const byVoter = new Map<string, VoteRecord[]>();
    for (const v of votes) {
      const id = v.voterId || v.drepId;
      if (!id) continue;
      const list = byVoter.get(id);
      if (list) list.push(v);
      else byVoter.set(id, [v]);
    }
    const result = new Map<
      VoteRecord,
      { supersededByVote: VoteRecord["vote"]; supersededByVotedAt?: string }
    >();
    for (const records of byVoter.values()) {
      if (records.length < 2) continue;
      const sorted = [...records].sort((a, b) => {
        const at = a.votedAt ? new Date(a.votedAt).getTime() : 0;
        const bt = b.votedAt ? new Date(b.votedAt).getTime() : 0;
        return at - bt;
      });
      const latest = sorted[sorted.length - 1];
      for (const r of sorted) {
        if (r !== latest) {
          result.set(r, {
            supersededByVote: latest.vote,
            supersededByVotedAt: latest.votedAt,
          });
        }
      }
    }
    return result;
  }, [votes]);

  const getVoteId = (vote: VoteRecord): string => {
    const index = voteIdMap.get(vote);
    return index !== undefined ? index.toString() : "0";
  };

  const handleOpenRationale = (vote: VoteRecord) => {
    setSelectedVoteRecord(vote);
    setIsModalOpen(true);
  };

  // Deep-link: `?voter=<voterId|drepId>` highlights the matching row, opens the
  // rationale modal, and scrolls the row into view. `handledVoterParamRef`
  // guards against re-firing when `votes` refreshes.
  useEffect(() => {
    if (!voterParam) {
      handledVoterParamRef.current = null;
      return;
    }
    if (handledVoterParamRef.current === voterParam) return;
    if (votes.length === 0) return;

    const matches = votes.filter((v) => (v.voterId || v.drepId) === voterParam);
    if (matches.length === 0) return;

    const target = [...matches].sort((a, b) => {
      const at = a.votedAt ? new Date(a.votedAt).getTime() : 0;
      const bt = b.votedAt ? new Date(b.votedAt).getTime() : 0;
      return bt - at;
    })[0];

    setParticipationMode("voted");
    setShowAllVotes(true);
    setHighlightedVoterId(voterParam);
    setSelectedVoteRecord(target);
    setIsModalOpen(true);
    handledVoterParamRef.current = voterParam;

    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(`voter-row-${voterParam}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => clearTimeout(scrollTimer);
  }, [voterParam, votes]);

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

    // Pin connected wallet's vote to the top
    if (connectedDrepId) {
      const myIndex = filtered.findIndex(
        (v) => (v.voterId || v.drepId) === connectedDrepId
      );
      if (myIndex > 0) {
        const [myVote] = filtered.splice(myIndex, 1);
        filtered.unshift(myVote);
      }
    }

    return filtered;
  }, [votes, searchQuery, selectedVotes, selectedRoles, rationaleFilter, timeSort, powerSort, connectedDrepId]);

  const displayedVotes = useMemo(() => {
    if (showAllVotes) return filteredVotes;
    return filteredVotes.slice(0, INITIAL_VOTES_LIMIT);
  }, [filteredVotes, showAllVotes, INITIAL_VOTES_LIMIT]);

  const hasMoreVotes = filteredVotes.length > INITIAL_VOTES_LIMIT;
  const remainingVotes = filteredVotes.length - INITIAL_VOTES_LIMIT;

  // Not-voted: DReps + CC members
  const { dreps: allDreps, isLoading: drepsLoading } = useAllDReps();
  const { data: ccData, isLoading: ccLoading } = useSWR<{
    members: { ccId: string; memberName: string | null; isEligible: boolean | null }[];
    eligibleCcIds: string[] | null;
  }>(
    "/api/analytics/cc-participation",
    (url: string) => fetch(url).then((r) => r.json())
  );

  const votedIds = useMemo(() => {
    return new Set(
      votes.map((v) => v.voterId || v.drepId).filter(Boolean)
    );
  }, [votes]);

  interface NotVotedItem {
    id: string;
    name: string | null;
    role: "DRep" | "CC";
    votingPowerAda?: number;
  }

  const notVotedItems = useMemo(() => {
    if (participationMode !== "not-voted") return [];

    const items: NotVotedItem[] = [];

    // DReps that haven't voted
    if (selectedRoles.includes("DRep") && allDreps.length > 0) {
      for (const d of allDreps) {
        if (!votedIds.has(d.drepId)) {
          items.push({ id: d.drepId, name: d.name, role: "DRep", votingPowerAda: d.votingPowerAda });
        }
      }
    }

    // CC members that haven't voted (only eligible members)
    if (selectedRoles.includes("CC") && ccData?.members) {
      const eligibleSet = ccData.eligibleCcIds ? new Set(ccData.eligibleCcIds) : null;
      for (const m of ccData.members) {
        // Filter to eligible members: use eligibleCcIds list if available, else fall back to isEligible flag
        const isEligible = eligibleSet ? eligibleSet.has(m.ccId) : m.isEligible !== false;
        if (isEligible && !votedIds.has(m.ccId)) {
          items.push({ id: m.ccId, name: resolveCCName(m.ccId, m.memberName), role: "CC" });
        }
      }
    }

    // Search filter
    let result = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) =>
        (item.name || "").toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
      );
    }

    // Sort: CC members first (no voting power), then DReps by power
    if (powerSort === "high" || powerSort === "low") {
      result = [...result].sort((a, b) => {
        // CC always grouped separately (no voting power to sort)
        if (a.role === "CC" && b.role !== "CC") return 1;
        if (a.role !== "CC" && b.role === "CC") return -1;
        const pa = a.votingPowerAda || 0;
        const pb = b.votingPowerAda || 0;
        return powerSort === "high" ? pb - pa : pa - pb;
      });
    }

    return result;
  }, [participationMode, allDreps, ccData, votedIds, searchQuery, powerSort, selectedRoles]);

  const notVotedLoading = drepsLoading || ccLoading;

  const displayedNotVoted = useMemo(() => {
    if (showAllVotes) return notVotedItems;
    return notVotedItems.slice(0, INITIAL_VOTES_LIMIT);
  }, [notVotedItems, showAllVotes, INITIAL_VOTES_LIMIT]);

  const hasMoreNotVoted = notVotedItems.length > INITIAL_VOTES_LIMIT;
  const remainingNotVoted = notVotedItems.length - INITIAL_VOTES_LIMIT;

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4">
        {showDownload && (
          <div ref={downloadMenuRef} className={cn(
            "relative w-full sm:w-auto p-2.5 sm:p-3 md:p-4",
            isGame
              ? "game-detail-card"
              : "rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
          )}>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => {
                setDownloadMenuOpen((prev) => !prev);
                setDownloadSubMenu(null);
              }}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-full border transition-colors",
                isExporting && "opacity-50 cursor-not-allowed",
                isGame
                  ? "border-white/20 bg-black/50 text-white/80 hover:bg-white/10"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-[#0bd1a2]/40 dark:bg-transparent dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2]/10"
              )}
              title={tDownload("downloadRationales")}
            >
              {isExporting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>

            {downloadMenuOpen && (
              <div className={cn(
                "absolute top-full left-0 mt-2 z-50 min-w-[200px] py-1 shadow-lg",
                isGame
                  ? "bg-black/90 border border-white/20 text-white"
                  : "bg-white border border-gray-200 dark:bg-black dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
              )}>
                {/* Rationales option */}
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors",
                    isGame
                      ? "hover:bg-white/10"
                      : "hover:bg-gray-100 dark:hover:bg-[#0bd1a2]/10",
                    downloadSubMenu === "rationales" && (isGame ? "bg-white/10" : "bg-gray-100 dark:bg-[#0bd1a2]/10")
                  )}
                  onClick={() => setDownloadSubMenu(downloadSubMenu === "rationales" ? null : "rationales")}
                >
                  <span>{tDownload("downloadRationales")}</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-2 flex-shrink-0" />
                </button>

                {downloadSubMenu === "rationales" && (
                  <div className={cn(
                    "ml-2 border-l",
                    isGame ? "border-white/20" : "border-gray-200 dark:border-[#0bd1a2]/30"
                  )}>
                    {(["json", "markdown", "csv"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        className={cn(
                          "w-full px-4 py-1.5 text-sm text-left transition-colors",
                          isGame
                            ? "hover:bg-white/10"
                            : "hover:bg-gray-100 dark:hover:bg-[#0bd1a2]/10"
                        )}
                        onClick={() => {
                          onDownloadFormatChange?.(fmt);
                          setDownloadMenuOpen(false);
                          setDownloadSubMenu(null);
                        }}
                      >
                        {tDownload(fmt)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Metrics option */}
                {onMetricsExport && (
                  <>
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors",
                        isGame
                          ? "hover:bg-white/10"
                          : "hover:bg-gray-100 dark:hover:bg-[#0bd1a2]/10",
                        downloadSubMenu === "metrics" && (isGame ? "bg-white/10" : "bg-gray-100 dark:bg-[#0bd1a2]/10")
                      )}
                      onClick={() => setDownloadSubMenu(downloadSubMenu === "metrics" ? null : "metrics")}
                    >
                      <span>{tDownload("downloadMetrics")}</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-2 flex-shrink-0" />
                    </button>

                    {downloadSubMenu === "metrics" && (
                      <div className={cn(
                        "ml-2 border-l",
                        isGame ? "border-white/20" : "border-gray-200 dark:border-[#0bd1a2]/30"
                      )}>
                        {(["json", "markdown", "csv"] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            className={cn(
                              "w-full px-4 py-1.5 text-sm text-left transition-colors",
                              isGame
                                ? "hover:bg-white/10"
                                : "hover:bg-gray-100 dark:hover:bg-[#0bd1a2]/10"
                            )}
                            onClick={() => {
                              onMetricsExport(fmt);
                              setDownloadMenuOpen(false);
                              setDownloadSubMenu(null);
                            }}
                          >
                            {tDownload(fmt)}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className={cn(
          "flex-1 min-w-0 p-2.5 sm:p-3 md:p-4",
          isGame
            ? "game-detail-card"
            : "rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
        )}>
          <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4">
            <div className="flex-1 min-w-[120px]">
              {isGame ? (
                <GameDropdown
                  value={participationMode}
                  onValueChange={(v) => handleParticipationChange(v as "voted" | "not-voted")}
                  placeholder={tFilters("voted")}
                  onOpenChange={(open) => handleDropdownOpenChange("participation", open)}
                  options={[
                    { value: "voted", label: tFilters("voted") },
                    { value: "not-voted", label: tFilters("notVoted") },
                  ]}
                />
              ) : (
                <Select value={participationMode} onValueChange={(v) => handleParticipationChange(v as "voted" | "not-voted")} onOpenChange={(open) => handleDropdownOpenChange("participation", open)}>
                  <SelectTrigger className="btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2] [&>span]:truncate">
                    <SelectValue placeholder={tFilters("voted")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                    <SelectItem className={selectItemClass} value="voted">{tFilters("voted")}</SelectItem>
                    <SelectItem className={selectItemClass} value="not-voted">{tFilters("notVoted")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
            {participationMode === "voted" && (
              <>
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
              </>
            )}
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

      {/* Search row */}
      <div className={cn(
        "p-2.5 sm:p-3 md:p-4",
        isGame
          ? "game-detail-card"
          : "rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
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

      {participationMode === "voted" ? (
      <>
      {/* Mobile card layout */}
      <div
        className={cn(
          "sm:hidden space-y-2 min-h-[400px]",
        )}
      >
        {filteredVotes.length === 0 ? (
          <div className={cn(
            "py-12 text-center text-muted-foreground",
            isGame ? "game-detail-card" : "rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
          )}>
            {tVoting("noVotingRecordsFound")}
          </div>
        ) : (
          displayedVotes.map((vote) => {
            const voteId = getVoteId(vote);
            const hasRationale = Boolean(vote.rationale && vote.rationale.trim().length > 0);
            const voterKey = vote.voterId || vote.drepId || "";
            const isMyVoteMobile = connectedDrepId != null && voterKey === connectedDrepId;
            const isUnconfirmedMobile = !!vote.isPendingConfirmation;
            const staleInfo = staleness.get(vote);
            const isStale = !!staleInfo;
            const isHighlighted = highlightedVoterId != null && voterKey === highlightedVoterId;
            return (
              <div
                key={voteId}
                id={voterKey ? `voter-row-${voterKey}` : undefined}
                className={cn(
                  "p-3 transition-transform duration-normal ease-out transform-gpu active:scale-[0.99]",
                  isGame
                    ? "game-detail-card"
                    : "rounded-xl border border-border bg-card shadow-elevation-1 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none",
                  isMyVoteMobile && (isGame
                    ? "ring-1 ring-white/30"
                    : "ring-1 ring-primary/30 bg-primary/5 dark:ring-[#0bd1a2]/30 dark:bg-[#0bd1a2]/5"),
                  isHighlighted && "ring-2 ring-amber-400 dark:ring-amber-300 shadow-lg",
                  isUnconfirmedMobile && "animate-pulse",
                  isStale && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <Badge variant="outline" className={cn("px-1.5 py-0 text-2xs shrink-0", isGame ? "border-white/30 bg-transparent text-white/70" : "border-foreground/20 bg-transparent dark:text-[#0bd1a2] dark:border-[#0bd1a2] dark:bg-transparent")}>
                        {vote.voterType}
                      </Badge>
                      <Badge variant="outline" className={cn("text-2xs px-1.5 shrink-0", isStale && "line-through", isGame ? getGameVoteBadgeClasses(vote.vote) : getVoteBadgeClasses(vote.vote))}>
                        {translateVote(vote.vote)}
                      </Badge>
                      {isStale && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-1.5 py-0 text-2xs shrink-0",
                            isGame
                              ? "border-white/30 bg-transparent text-white/70"
                              : "border-foreground/20 bg-transparent text-muted-foreground dark:text-[#0bd1a2] dark:border-[#0bd1a2] dark:bg-transparent"
                          )}
                          title={tVoting("supersededTooltip", { vote: translateVote(staleInfo!.supersededByVote) })}
                        >
                          {tVoting("superseded")} → {translateVote(staleInfo!.supersededByVote)}
                        </Badge>
                      )}
                      {vote.voterType !== "CC" && (
                        <span className={cn("text-2xs font-medium shrink-0", isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                          {isUnconfirmedMobile
                            ? tVoting("pending")
                            : `${formatAda(vote.votingPowerAda || 0)} ADA`}
                        </span>
                      )}
                    </div>
                    {vote.voterType === "DRep" && (vote.voterId || vote.drepId) ? (
                      <Link
                        href={`/drep/${encodeURIComponent(vote.voterId || vote.drepId!)}`}
                        className={cn("inline-flex items-center h-7 w-[140px] px-2 text-2xs font-semibold truncate transition-colors", isGame ? "game-nav-btn" : "rounded-md bg-white text-black shadow-elevation-1 transform-gpu transition-transform transition-shadow duration-normal ease-in-out hover:scale-101 hover:shadow-elevation-2 btn-neon")}
                      >
                        <span className="truncate">{formatVoterDisplayName(vote)}</span>
                      </Link>
                    ) : (
                      <div className={cn("font-semibold text-xs truncate max-w-[140px]", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
                        {formatVoterDisplayName(vote)}
                      </div>
                    )}
                    <div className={cn("font-mono text-3xs truncate", isGame ? "text-white/40" : "text-muted-foreground/70 dark:text-[#0bd1a2]/70")}>
                      {vote.voterId || vote.drepId || "—"}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {hasRationale ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleOpenRationale(vote)}
                        className={cn("h-7 px-2 text-2xs", isGame ? "game-nav-btn" : "bg-white text-black hover:bg-black hover:text-white transition-colors shadow-elevation-1 btn-neon")}
                      >
                        {tCommon("view")}
                      </Button>
                    ) : (
                      <span className={cn("text-3xs", isGame ? "text-white/40" : "text-muted-foreground/60 dark:text-[#0bd1a2]/60")}>
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
                : "bg-white text-black hover:bg-black hover:text-white transition-colors shadow-elevation-1 btn-neon"
            )}
          >
            {tCommon("showMoreVotes", { count: remainingVotes })}
          </Button>
        )}
      </div>

      {/* Desktop table layout */}
      <div
        className={cn(
          "hidden sm:block rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none voting-records-container min-h-[400px]",
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
                    const voterKey = vote.voterId || vote.drepId || "";
                    const isFirstRow = index === 0;
                    const voteLower = vote.vote.toLowerCase();
                    const isNoVote = voteLower === "no";
                    const isMyVote = connectedDrepId != null && voterKey === connectedDrepId;
                    const isUnconfirmed = !!vote.isPendingConfirmation;
                    const staleInfo = staleness.get(vote);
                    const isStale = !!staleInfo;
                    const isHighlighted = highlightedVoterId != null && voterKey === highlightedVoterId;
                    return (
                  <TableRow
                    key={voteId}
                    id={voterKey ? `voter-row-${voterKey}` : undefined}
                    className={cn(
                      "voting-record-row hover:bg-transparent transition-transform duration-normal ease-out transform-gpu hover:scale-101",
                      isFirstRow && "first-row",
                      isNoVote && "vote-no-row",
                      isGame && "border-b border-white/10",
                      isMyVote && (isGame
                        ? "bg-white/5 border-l-2 border-l-white/40"
                        : "bg-primary/5 border-l-2 border-l-primary dark:bg-[#0bd1a2]/5 dark:border-l-[#0bd1a2]"),
                      isHighlighted && "bg-amber-100/40 ring-2 ring-amber-400 dark:bg-amber-300/10 dark:ring-amber-300",
                      isUnconfirmed && "opacity-75",
                      isStale && "opacity-60"
                    )}
                  >
                        <TableCell className="py-2 sm:py-3">
                          <div>
                            <div className="mb-0.5 sm:mb-1 flex flex-wrap items-center gap-1 sm:gap-2">
                              {vote.voterType === "DRep" && (vote.voterId || vote.drepId) ? (
                                <Link
                                  href={`/drep/${encodeURIComponent(vote.voterId || vote.drepId!)}`}
                                  className={cn("inline-flex items-center h-7 sm:h-8 w-[180px] px-2 sm:px-3 text-xs font-semibold truncate transition-colors", isGame ? "game-nav-btn" : "rounded-md bg-white text-black shadow-elevation-1 transform-gpu transition-transform transition-shadow duration-normal ease-in-out hover:scale-101 hover:shadow-elevation-2 btn-neon")}
                                >
                                  <span className="truncate">{formatVoterDisplayName(vote)}</span>
                                </Link>
                              ) : (
                                <span className={cn("font-semibold text-xs sm:text-sm truncate max-w-[180px] inline-block", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
                                  {formatVoterDisplayName(vote)}
                                </span>
                              )}
                              <Badge variant="outline" className={cn("px-1 sm:px-1.5 py-0 text-2xs sm:text-xs", isGame ? "border-white/30 bg-transparent text-white/70" : "border-foreground/20 bg-transparent dark:text-[#0bd1a2] dark:border-[#0bd1a2] dark:bg-transparent")}>
                                {vote.voterType}
                              </Badge>
                            </div>
                            <div className={cn("font-mono text-2xs sm:text-xs break-all line-clamp-1", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                              {vote.voterId || vote.drepId || "—"}
                            </div>
                          </div>
                        </TableCell>
                        {hasTransactionHashes && (
                          <TableCell className="hidden md:table-cell py-2 sm:py-3">
                            {vote.txHash ? (
                              <div className="flex items-center gap-2">
                                <code className={cn("font-mono text-2xs sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
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
                              <span className={cn("text-2xs sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="py-2 sm:py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={cn("text-2xs sm:text-xs px-1.5 sm:px-2", isStale && "line-through", isGame ? getGameVoteBadgeClasses(vote.vote) : getVoteBadgeClasses(vote.vote))}>
                              {translateVote(vote.vote)}
                            </Badge>
                            {isStale && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "px-1.5 py-0 text-2xs",
                                  isGame
                                    ? "border-white/30 bg-transparent text-white/70"
                                    : "border-foreground/20 bg-transparent text-muted-foreground dark:text-[#0bd1a2] dark:border-[#0bd1a2] dark:bg-transparent"
                                )}
                                title={tVoting("supersededTooltip", { vote: translateVote(staleInfo!.supersededByVote) })}
                              >
                                {tVoting("superseded")} → {translateVote(staleInfo!.supersededByVote)}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 sm:py-3">
                          {vote.voterType !== "CC" ? (
                            isUnconfirmed ? (
                              <div className={cn("flex items-center gap-1.5 text-2xs sm:text-xs italic", isGame ? "text-white/40" : "text-muted-foreground")}>
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                                {tVoting("pending")}
                              </div>
                            ) : (
                              <div className={cn("font-semibold text-xs sm:text-sm", isGame && "text-white")}>
                                {formatAda(vote.votingPowerAda || 0)} ADA
                              </div>
                            )
                          ) : (
                            <div className={cn("text-2xs sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>{tVoting("oneMemberOneVote")}</div>
                          )}
                        </TableCell>
                        <TableCell className={cn("hidden md:table-cell py-2 sm:py-3 text-xs sm:text-sm", isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                          {isUnconfirmed ? (
                            <span className={cn("flex items-center gap-1.5 italic text-2xs sm:text-xs", isGame ? "text-white/40" : "text-muted-foreground")}>
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                              {tVoting("pending")}
                            </span>
                          ) : (
                            vote.votedAt ? new Date(vote.votedAt).toLocaleDateString() : "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right py-2 sm:py-3">
                          {hasRationale ? (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleOpenRationale(vote)}
                              className={cn("h-7 sm:h-8 px-2 sm:px-3 text-xs", isGame ? "game-nav-btn" : "bg-white text-black hover:bg-black hover:text-white transition-colors shadow-elevation-2 btn-neon")}
                            >
                              {tCommon("view")}
                            </Button>
                          ) : (
                            <span className={cn("text-2xs sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
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
                  : "bg-white text-black hover:bg-black hover:text-white transition-colors shadow-elevation-1 btn-neon"
              )}
            >
              {tCommon("showMoreVotes", { count: remainingVotes })}
            </Button>
          </div>
        )}
      </div>
      </>
      ) : (
      <>
      {/* Not-voted mobile card layout */}
      <div className={cn("sm:hidden space-y-2 min-h-[400px]")}>
        {notVotedLoading ? (
          <div className={cn(
            "py-12 text-center text-muted-foreground",
            isGame ? "game-detail-card" : "rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
          )}>
            {tCommon("loading")}
          </div>
        ) : notVotedItems.length === 0 ? (
          <div className={cn(
            "py-12 text-center text-muted-foreground",
            isGame ? "game-detail-card" : "rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
          )}>
            {tVoting("noVotingRecordsFound")}
          </div>
        ) : (
          displayedNotVoted.map((item) => (
            <div
              key={item.id}
              className={cn(
                "p-3 transition-transform duration-normal ease-out transform-gpu active:scale-[0.99]",
                isGame
                  ? "game-detail-card"
                  : "rounded-xl border border-border bg-card shadow-elevation-1 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant="outline" className={cn("px-1.5 py-0 text-2xs shrink-0", isGame ? "border-white/30 bg-transparent text-white/70" : "border-foreground/20 bg-transparent dark:text-[#0bd1a2] dark:border-[#0bd1a2] dark:bg-transparent")}>
                      {item.role}
                    </Badge>
                    {item.role !== "CC" && (
                      <span className={cn("text-2xs font-medium shrink-0", isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                        {formatAda(item.votingPowerAda || 0)} ADA
                      </span>
                    )}
                  </div>
                  {item.role === "DRep" ? (
                    <Link
                      href={`/drep/${encodeURIComponent(item.id)}`}
                      className={cn("inline-flex items-center h-7 w-[140px] px-2 text-2xs font-semibold truncate transition-colors", isGame ? "game-nav-btn" : "rounded-md bg-white text-black shadow-elevation-1 transform-gpu transition-transform transition-shadow duration-normal ease-in-out hover:scale-101 hover:shadow-elevation-2 btn-neon")}
                    >
                      <span className="truncate">{item.name || item.id}</span>
                    </Link>
                  ) : (
                    <div className={cn("font-semibold text-xs truncate max-w-[140px]", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
                      {item.name || item.id}
                    </div>
                  )}
                  <div className={cn("font-mono text-3xs truncate", isGame ? "text-white/40" : "text-muted-foreground/70 dark:text-[#0bd1a2]/70")}>
                    {item.id}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        {hasMoreNotVoted && !showAllVotes && notVotedItems.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setShowAllVotes(true)}
            className={cn(
              "w-full mt-3",
              isGame
                ? "game-nav-btn"
                : "bg-white text-black hover:bg-black hover:text-white transition-colors shadow-elevation-1 btn-neon"
            )}
          >
            {tCommon("showMoreVotes", { count: remainingNotVoted })}
          </Button>
        )}
      </div>

      {/* Not-voted desktop table layout */}
      <div
        className={cn(
          "hidden sm:block rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none voting-records-container min-h-[400px]",
          isGame && "game-detail-card"
        )}
      >
        <div className="voting-records-container">
          <div className={cn("inline-block min-w-full px-2 sm:px-4 md:px-6 lg:px-0 align-middle", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
            <Table className={isGame ? "game-voting-table" : ""}>
              <TableHeader>
                <TableRow className={cn("voting-records-header", isGame && "border-b border-white/10")}>
                  <TableHead className={cn("text-xs sm:text-sm", isGame ? "text-white/70" : "")}>{tTable("voter")}</TableHead>
                  <TableHead className={cn("text-xs sm:text-sm", isGame ? "text-white/70" : "")}>{tTable("votingPower")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notVotedLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-12 text-center text-muted-foreground">
                      {tCommon("loading")}
                    </TableCell>
                  </TableRow>
                ) : notVotedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-12 text-center text-muted-foreground">
                      {tVoting("noVotingRecordsFound")}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedNotVoted.map((item) => (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "voting-record-row hover:bg-transparent transition-transform duration-normal ease-out transform-gpu hover:scale-101",
                        isGame && "border-b border-white/10"
                      )}
                    >
                      <TableCell className="py-2 sm:py-3">
                        <div>
                          <div className="mb-0.5 sm:mb-1 flex flex-wrap items-center gap-1 sm:gap-2">
                            {item.role === "DRep" ? (
                              <Link
                                href={`/drep/${encodeURIComponent(item.id)}`}
                                className={cn("inline-flex items-center h-7 sm:h-8 w-[180px] px-2 sm:px-3 text-xs font-semibold truncate transition-colors", isGame ? "game-nav-btn" : "rounded-md bg-white text-black shadow-elevation-1 transform-gpu transition-transform transition-shadow duration-normal ease-in-out hover:scale-101 hover:shadow-elevation-2 btn-neon")}
                              >
                                <span className="truncate">{item.name || item.id}</span>
                              </Link>
                            ) : (
                              <span className={cn("font-semibold text-xs sm:text-sm truncate max-w-[180px] inline-block", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
                                {item.name || item.id}
                              </span>
                            )}
                            <Badge variant="outline" className={cn("px-1 sm:px-1.5 py-0 text-2xs sm:text-xs", isGame ? "border-white/30 bg-transparent text-white/70" : "border-foreground/20 bg-transparent dark:text-[#0bd1a2] dark:border-[#0bd1a2] dark:bg-transparent")}>
                              {item.role}
                            </Badge>
                          </div>
                          <div className={cn("font-mono text-2xs sm:text-xs break-all line-clamp-1", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>
                            {item.id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 sm:py-3">
                        {item.role !== "CC" ? (
                          <div className={cn("font-semibold text-xs sm:text-sm", isGame && "text-white")}>
                            {formatAda(item.votingPowerAda || 0)} ADA
                          </div>
                        ) : (
                          <div className={cn("text-2xs sm:text-xs", isGame ? "text-white/50" : "text-muted-foreground dark:text-[#0bd1a2]")}>{tVoting("oneMemberOneVote")}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        {hasMoreNotVoted && !showAllVotes && notVotedItems.length > 0 && (
          <div className="p-4">
            <Button
              variant="outline"
              onClick={() => setShowAllVotes(true)}
              className={cn(
                "w-full",
                isGame
                  ? "game-nav-btn"
                  : "bg-white text-black hover:bg-black hover:text-white transition-colors shadow-elevation-1 btn-neon"
              )}
            >
              {tCommon("showMoreVotes", { count: remainingNotVoted })}
            </Button>
          </div>
        )}
      </div>
      </>
      )}
      <VotingRationaleModal
        vote={selectedVoteRecord}
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open && voterParam) {
            const rest = { ...router.query };
            delete rest.voter;
            router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
          }
        }}
      />
    </div>
  );
}
