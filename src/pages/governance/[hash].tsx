// src/pages/governance/[hash].tsx

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoteProgress } from "@/components/ui/vote-progress";
import { Progress } from "@/components/ui/progress";
import { VotingRecords } from "@/components/VotingRecords";
import { BubbleMap } from "@/components/BubbleMap";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadGovernanceActionDetail } from "@/store/governanceSlice";
import { ArrowLeft, Copy, Check } from "lucide-react";
import type {
  GovernanceActionDetail,
  VoterType,
  ProposalReferenceObject,
} from "@/types/governance";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import type { TooltipProps } from "recharts";
import {
  exportToJSON,
  exportToMarkdown,
  exportToCSV,
  downloadFile,
} from "@/lib/exportRationales";
import {
  canRoleVoteOnAction,
  getEligibleRoles,
} from "@/lib/governanceVotingEligibility";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  buildDonutSegments,
  calculateExcludedBreakdown,
  getGovernanceActionTypeCode,
  SEGMENT_COLORS,
  type ExcludedBreakdown,
  type VoteSegment,
} from "@/lib/voteBreakdownCalculator";
import { ProposalContent } from "@/components/ProposalContent";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { GameLoader } from "@/components/ui/game-loader";

/**
 * Cardano epoch reference: Epoch 208 started on July 29, 2020 at 21:44:51 UTC (Shelley era start)
 * Each epoch is exactly 5 days (432,000 seconds)
 */
const SHELLEY_START_EPOCH = 208;
const SHELLEY_START_TIME = new Date("2020-07-29T21:44:51Z").getTime();
const EPOCH_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds

/**
 * Convert a Cardano epoch number to a Date object (start of that epoch)
 */
function epochToDate(epoch: number): Date {
  const epochsSinceShelley = epoch - SHELLEY_START_EPOCH;
  const timeMs = SHELLEY_START_TIME + epochsSinceShelley * EPOCH_DURATION_MS;
  return new Date(timeMs);
}

/**
 * Format a date as DD/MM/YYYY
 */
function formatDateUTC(date: Date): string {
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format time as HH:MM UTC
 */
function formatTimeUTC(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes} UTC`;
}

/**
 * Get current epoch number
 */
function getCurrentEpoch(): number {
  const now = Date.now();
  const epochsSinceShelley = Math.floor((now - SHELLEY_START_TIME) / EPOCH_DURATION_MS);
  return SHELLEY_START_EPOCH + epochsSinceShelley;
}

/**
 * Legacy governance actions with special voting rules
 */
const LEGACY_NON_APPLICABLE_DREP_ACTIONS = [
  "gov_action1k2jertppnnndejjcglszfqq4yzw8evzrd2nt66rr6rqlz54xp0zsq05ecsn",
  "gov_action1286ft23r7jem825s4l0y5rn8sgam0tz2ce04l7a38qmnhp3l9a6qqn850dw",
  "gov_action1pvv5wmjqhwa4u85vu9f4ydmzu2mgt8n7et967ph2urhx53r70xusqnmm525",
];

const LEGACY_NON_APPLICABLE_SPO_ACTIONS = [
  "gov_action1k2jertppnnndejjcglszfqq4yzw8evzrd2nt66rr6rqlz54xp0zsq05ecsn",
  "gov_action1286ft23r7jem825s4l0y5rn8sgam0tz2ce04l7a38qmnhp3l9a6qqn850dw",
];

const LEGACY_NON_APPLICABLE_CC_ACTIONS: string[] = [];

/**
 * Governance action types where CC doesn't vote (threshold is null)
 */
const CC_NOT_APPLICABLE_TYPES = ["No Confidence", "Update Committee"];

/**
 * Governance action types where SPO doesn't vote (threshold is null)
 */
const SPO_NOT_APPLICABLE_TYPES = [
  "New Constitution",
  "Protocol Parameter Change",
  "Treasury Withdrawals",
];

function isLegacyAction(hash: string): boolean {
  const legacyActions = [
    ...LEGACY_NON_APPLICABLE_DREP_ACTIONS,
    ...LEGACY_NON_APPLICABLE_SPO_ACTIONS,
    ...LEGACY_NON_APPLICABLE_CC_ACTIONS,
  ];
  return legacyActions.some(
    (actionId) => hash === actionId || hash.includes(actionId)
  );
}

function isCcNotApplicable(action: GovernanceActionDetail): boolean {
  if (
    LEGACY_NON_APPLICABLE_CC_ACTIONS.some(
      (actionId) => action.hash === actionId || action.hash.includes(actionId)
    )
  ) {
    return true;
  }
  // Prefer explicit threshold from backend when available:
  // if ccThreshold is null, CC is not eligible to vote;
  // if it is a number, CC is eligible regardless of type.
  if (!isLegacyAction(action.hash) && action.threshold) {
    if (action.threshold.ccThreshold === null) {
      return true;
    }
    if (typeof action.threshold.ccThreshold === "number") {
      return false;
    }
  }
  if (!isLegacyAction(action.hash)) {
    return CC_NOT_APPLICABLE_TYPES.includes(action.type);
  }
  return false;
}

function isDrepNotApplicable(action: GovernanceActionDetail): boolean {
  if (
    LEGACY_NON_APPLICABLE_DREP_ACTIONS.some(
      (actionId) => action.hash === actionId || action.hash.includes(actionId)
    )
  ) {
    return true;
  }
  return false;
}

function isSpoNotApplicable(action: GovernanceActionDetail): boolean {
  if (
    LEGACY_NON_APPLICABLE_SPO_ACTIONS.some(
      (actionId) => action.hash === actionId || action.hash.includes(actionId)
    )
  ) {
    return true;
  }
  // For non-legacy actions, prefer explicit threshold from backend:
  // if spoThreshold is null, SPOs are not eligible to vote.
  if (!isLegacyAction(action.hash) && action.threshold) {
    if (action.threshold.spoThreshold === null) {
      return true;
    }
  }
  if (!isLegacyAction(action.hash)) {
    return SPO_NOT_APPLICABLE_TYPES.includes(action.type);
  }
  return false;
}

const formatAdaValue = (value: number) => {
  if (!value || Number.isNaN(value)) return "0 ₳";
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B ₳`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ₳`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k ₳`;
  }
  return `${value.toLocaleString()} ₳`;
};

const VOTE_COLORS_LIGHT = {
  yes: "#0B8C30",
  no: "#8C200B",
  abstain: "#000000",
  pending: "#94A3B8",
};

const VOTE_COLORS_DARK = {
  yes: "#0B8C30",
  no: "#8C200B",
  abstain: "#ffffff",
  pending: "#94A3B8",
};

type TimelinePoint = {
  label: string;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  yesPower: number;
  noPower: number;
  abstainPower: number;
};

type RoleFilter = "All" | VoterType;

export default function GovernanceDetail() {
  const router = useRouter();
  const { hash } = router.query;
  const dispatch = useAppDispatch();
  const { theme, activeTheme } = useTheme();
  const isDark = theme === "dark";
  const isGame = activeTheme.id === "game";
  const voteColors = useMemo(
    () => (isDark || isGame ? VOTE_COLORS_DARK : VOTE_COLORS_LIGHT),
    [isDark, isGame]
  );
  const { selectedAction, isLoadingDetail, detailError } = useAppSelector(
    (state) => state.governance
  );

  const [downloadFormat, setDownloadFormat] = useState<string>("");
  const [contentVisible, setContentVisible] = useState(false);
  const [isContentExpanded, setIsContentExpanded] = useState<boolean>(false);
  const [curveRoleFilter, setCurveRoleFilter] =
    useState<RoleFilter>("All");
  const [selectedTab, setSelectedTab] = useState<string>("live-voting");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof hash === "string") {
      dispatch(loadGovernanceActionDetail(hash));
    }
  }, [hash, dispatch]);

  useEffect(() => {
    if (selectedAction) {
      setContentVisible(false);
      const timeout = setTimeout(() => setContentVisible(true), 150);
      return () => clearTimeout(timeout);
    }
  }, [selectedAction]);

  const allVotes = useMemo(() => {
    if (!selectedAction) return [];
    return [
      ...(selectedAction.votes || []),
      ...(selectedAction.ccVotes || []),
    ];
  }, [selectedAction]);

  const contentPreview = useMemo(() => {
    if (!selectedAction) return null;

    // Use exact data from API - no modifications
    const description = selectedAction.description || "";
    const rationale = selectedAction.rationale || "";

    // Combine description and rationale exactly as they come from API
    const fullContent = [description, rationale]
      .filter(Boolean)
      .join("\n\n");

    // Get references from API metadata (if available)
    const apiReferences: ProposalReferenceObject[] =
      selectedAction.references || [];

    // Extract URLs from the actual content text (when present)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlsFromContent = fullContent
      ? fullContent.match(urlRegex) || []
      : [];

    // Build a map keyed by URI to avoid duplicates when combining API
    // references with URLs we detect in the content body.
    const referenceMap = new Map<string, ProposalReferenceObject>();

    for (const ref of apiReferences) {
      if (!ref) continue;
      const uri =
        (typeof ref.uri === "string" && ref.uri) ||
        (typeof ref.label === "string" && ref.label);
      if (!uri) continue;

      const key = uri;
      if (!referenceMap.has(key)) {
        referenceMap.set(key, {
          uri,
          label: ref.label || uri,
          type: ref.type,
        });
      }
    }

    for (const url of urlsFromContent) {
      const trimmed = url.trim();
      if (!trimmed) continue;
      if (!referenceMap.has(trimmed)) {
        referenceMap.set(trimmed, {
          uri: trimmed,
          label: trimmed,
        });
      }
    }

    const allReferences = Array.from(referenceMap.values());

    // If we have neither content nor references, don't render a preview section.
    if (!fullContent && allReferences.length === 0) {
      return null;
    }

    const maxPreviewLength = 200;
    const shouldTruncate =
      !!fullContent && fullContent.length > maxPreviewLength;

    return {
      full: fullContent, // Exact content from API, unmodified
      preview: fullContent
        ? shouldTruncate
          ? fullContent.substring(0, maxPreviewLength) + "..."
          : fullContent
        : "",
      shouldTruncate,
      hasDescription: !!description,
      hasRationale: !!rationale,
      references: allReferences, // Combined: API references + URLs from content
    };
  }, [selectedAction]);

  const eligibleRoles = useMemo<VoterType[]>(() => {
    if (!selectedAction) return [];
    return getEligibleRoles(selectedAction.type);
  }, [selectedAction]);

  const curveRoleOptions = useMemo<RoleFilter[]>(
    () => ["All", ...eligibleRoles],
    [eligibleRoles]
  );

  useEffect(() => {
    if (!curveRoleOptions.includes(curveRoleFilter)) {
      setCurveRoleFilter("All");
    }
  }, [curveRoleOptions, curveRoleFilter]);

  const voteTimelineData = useMemo<TimelinePoint[]>(() => {
    const roleFilteredVotes =
      curveRoleFilter === "All"
        ? allVotes
        : allVotes.filter((vote) => vote.voterType === curveRoleFilter);

    if (!roleFilteredVotes.length) return [];
    const votesWithDates = roleFilteredVotes
      .map((vote, index) => ({
        ...vote,
        date: vote.votedAt ? new Date(vote.votedAt) : null,
        fallbackIndex: index,
      }))
      .sort((a, b) => {
        if (a.date && b.date) return a.date.getTime() - b.date.getTime();
        if (a.date) return -1;
        if (b.date) return 1;
        return a.fallbackIndex - b.fallbackIndex;
      });

    let yesCount = 0;
    let noCount = 0;
    let abstainCount = 0;
    let yesPower = 0;
    let noPower = 0;
    let abstainPower = 0;

    return votesWithDates.map((vote, index) => {
      const power = vote.votingPowerAda || 0;

      switch (vote.vote) {
        case "Yes":
          yesCount += 1;
          yesPower += power;
          break;
        case "No":
          noCount += 1;
          noPower += power;
          break;
        default:
          abstainCount += 1;
          abstainPower += power;
          break;
      }

      const label =
        vote.date && !Number.isNaN(vote.date.getTime())
          ? vote.date.toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : `Vote ${index + 1}`;

      return {
        label,
        yesCount,
        noCount,
        abstainCount,
        yesPower,
        noPower,
        abstainPower,
      };
    });
  }, [allVotes, curveRoleFilter]);

  // Show ADA amounts for DRep/SPO (and "All" which includes them)
  // Show vote counts for CC only
  const shouldShowPower = curveRoleFilter !== "CC";

  const renderVoteTrendTooltip = useCallback(
    (tooltipProps: TooltipProps<number, string>) => (
      <VoteTrendTooltip
        {...tooltipProps}
        showPower={shouldShowPower}
        colors={voteColors}
      />
    ),
    [shouldShowPower, voteColors]
  );

  const useDashedPowerLines =
    shouldShowPower && curveRoleFilter === "All";

  const ccAbstainStats = useMemo(() => {
    // For CC, always rely on the summary tallies rather than ccVotes,
    // since ccVotes can be partial while the summary reflects the
    // full on-chain result.
    if (!selectedAction) {
      return { percent: 0, count: 0, yesCount: 0, noCount: 0 };
    }

    const ccSummary = selectedAction.cc;

    const abstainPercent =
      ccSummary?.abstainPercent ?? selectedAction.ccAbstainPercent ?? 0;
    const abstainCount =
      ccSummary?.abstainCount ?? selectedAction.ccAbstainCount ?? 0;

    const yesCount =
      ccSummary?.yesCount ?? selectedAction.ccYesCount ?? 0;
    const noCount =
      ccSummary?.noCount ?? selectedAction.ccNoCount ?? 0;

    return {
      percent: abstainPercent,
      count: abstainCount,
      yesCount,
      noCount,
    };
  }, [selectedAction]);

  // Determine governance action type code for vote grouping logic
  const actionTypeCode = useMemo(
    () => getGovernanceActionTypeCode(selectedAction?.governanceActionType || selectedAction?.type),
    [selectedAction?.governanceActionType, selectedAction?.type]
  );

  // Check if this is an Info Action (no ratification concept)
  const isInfoAction = useMemo(
    () => selectedAction?.type === "Info Action" || selectedAction?.type === "InfoAction",
    [selectedAction?.type]
  );

  // Calculate DRep donut segments from breakdown data
  const drepDonutSegments = useMemo(() => {
    if (!selectedAction?.drepBreakdown) return null;
    return buildDonutSegments(selectedAction.drepBreakdown, actionTypeCode, true);
  }, [selectedAction?.drepBreakdown, actionTypeCode]);

  // Calculate SPO donut segments from breakdown data (no inactive for SPO)
  const spoDonutSegments = useMemo(() => {
    if (!selectedAction?.spoBreakdown) return null;
    return buildDonutSegments(selectedAction.spoBreakdown, actionTypeCode, false);
  }, [selectedAction?.spoBreakdown, actionTypeCode]);

  // Calculate DRep excluded breakdown (for separate display)
  const drepExcludedBreakdown = useMemo(() => {
    if (!selectedAction?.drepBreakdown) return null;
    return calculateExcludedBreakdown(selectedAction.drepBreakdown, true);
  }, [selectedAction?.drepBreakdown]);

  // Calculate SPO excluded breakdown (for separate display - no inactive)
  const spoExcludedBreakdown = useMemo(() => {
    if (!selectedAction?.spoBreakdown) return null;
    return calculateExcludedBreakdown(selectedAction.spoBreakdown, false);
  }, [selectedAction?.spoBreakdown]);

  // Only show loading state for initial load (when we don't have data yet)
  // This prevents unmounting VoteOnProposal during polling re-fetches
  const showLoadingState = isLoadingDetail && !selectedAction;

  // Only show error state if we don't have existing data
  // This prevents unmounting VoteOnProposal if an API call fails during polling
  const showErrorState = detailError && !selectedAction;

  // Loading state - only shown on initial load
  if (showLoadingState) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <Link href="/">
            <Button variant="default" className={isGame ? "game-nav-btn mb-6" : "mb-6 bg-white text-black hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)]"}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          {isGame ? (
            <div className="flex flex-col items-center justify-center py-24">
              <GameLoader />
            </div>
          ) : (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center">
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
                <p className="text-muted-foreground">
                  Loading governance action...
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Error state - only shown if we don't have existing data
  if (showErrorState) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <Link href="/">
            <Button variant="default" className="mb-6 bg-white text-black hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Card className="border-destructive bg-destructive/10 p-6">
            <div className="text-center">
              <p className="mb-2 font-medium text-destructive">
                Failed to load governance action
              </p>
              <p className="text-sm text-muted-foreground">{detailError}</p>
              <button
                onClick={() => {
                  if (typeof hash === "string") {
                    dispatch(loadGovernanceActionDetail(hash));
                  }
                }}
                className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Not found state
  if (!selectedAction) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <Link href="/">
            <Button variant="default" className="mb-6 bg-white text-black hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Card className="p-12">
            <div className="text-center">
              <p className="text-muted-foreground">
                Governance action not found
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const allowDRep =
    canRoleVoteOnAction(selectedAction.type, "DRep") &&
    !isDrepNotApplicable(selectedAction);
  const allowSPO =
    canRoleVoteOnAction(selectedAction.type, "SPO") &&
    !isSpoNotApplicable(selectedAction);
  const allowCC =
    canRoleVoteOnAction(selectedAction.type, "CC") &&
    !isCcNotApplicable(selectedAction);

  // Always wire through available vote info so donuts render
  // whenever on-chain data exists. Eligibility is still used
  // to drive placeholder messaging.
  const drepInfo = selectedAction.drep;
  const spoThreshold = selectedAction.threshold?.spoThreshold;
  const spoInfo =
    spoThreshold !== null && spoThreshold !== undefined
      ? selectedAction.spo
      : undefined;
  const ccThreshold = selectedAction.threshold?.ccThreshold;
  const ccInfo =
    ccThreshold !== null && ccThreshold !== undefined
      ? selectedAction.cc
      : undefined;

  const ccYesCount = ccAbstainStats.yesCount ?? ccInfo?.yesCount ?? 0;
  const ccNoCount = ccAbstainStats.noCount ?? ccInfo?.noCount ?? 0;

  // CC pending votes (still uses legacy props - no breakdown data from API)
  const ccPendingCount = ccInfo?.notVotedCount ?? 0;
  const ccPendingPercent = ccInfo?.notVotedPercent ?? 0;

  const handleTwitterShare = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/governance/${selectedAction.hash}`
        : "";
    const text = `Check out this Cardano governance proposal: ${selectedAction.title}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const handleExport = (format: "json" | "markdown" | "csv") => {
    const sanitizedTitle = selectedAction.title
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
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

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <>
      <Head>
        <title>{selectedAction.title} - Cardano Governance</title>
        <meta
          name="description"
          content={selectedAction.description || selectedAction.title}
        />
      </Head>
      <div className="min-h-screen bg-background">
        <div
          className={`container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 transition-opacity duration-300 ${contentVisible ? "opacity-100" : "opacity-0"}`}
        >
          {/* Top actions */}
          <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-3">
            <Link href="/">
              <Button
                variant="default"
                size="icon"
                className={
                  isGame
                    ? "game-nav-btn"
                    : "bg-white text-black shadow-[0_12px_30px_rgba(15,23,42,0.25)] h-8 w-8 sm:h-10 sm:w-10 transform-gpu transition-transform transition-shadow duration-450 ease-in-out hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] hover:bg-white hover:text-black btn-neon"
                }
                aria-label="Back to Dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            {contentPreview?.shouldTruncate && (
              <Button
                variant="default"
                className={
                  isGame
                    ? "game-nav-btn w-[110px] sm:w-[130px] text-xs sm:text-sm"
                    : "bg-white text-black shadow-[0_12px_30px_rgba(15,23,42,0.25)] h-8 sm:h-10 w-[110px] sm:w-[130px] text-xs sm:text-sm transform-gpu transition-transform transition-shadow duration-450 ease-in-out hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] hover:bg-white hover:text-black btn-neon"
                }
                onClick={() => setIsContentExpanded((prev) => !prev)}
              >
                {isContentExpanded ? "Hide Proposal" : "Read Proposal"}
              </Button>
            )}
            {allVotes.length > 0 && (
              <Button
                variant="default"
                className={
                  isGame
                    ? "game-nav-btn text-xs sm:text-sm"
                    : "bg-white text-black shadow-[0_12px_30px_rgba(15,23,42,0.25)] h-8 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm transform-gpu transition-transform transition-shadow duration-450 ease-in-out hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] hover:bg-white hover:text-black btn-neon"
                }
                onClick={handleTwitterShare}
              >
                Share on X
              </Button>
            )}
          </div>

          {/* Header Section */}
          <Card className={cn(
            "mb-4 sm:mb-6 md:mb-8 p-3 sm:p-4 md:p-6",
            isGame && "game-proposal-header-card"
          )}>
            <div className="mb-2 sm:mb-3 flex items-center gap-2 sm:gap-3">
              <h1 className="proposal-detail-title text-xl font-bold sm:text-2xl md:text-3xl lg:text-4xl">
                {selectedAction.title}
              </h1>
            </div>
            {contentPreview && (
              <div className="border-t border-border/50 pt-4">
                <div
                  className={cn(
                    "transition-all duration-500 ease-in-out overflow-hidden",
                    isContentExpanded
                      ? "max-h-[60vh] overflow-y-auto"
                      : "max-h-24"
                  )}
                >
                  <div className="pr-2">
                    <div className="overflow-x-auto">
                      <ProposalContent
                        content={contentPreview.full}
                        className="proposal-detail-content text-sm sm:text-base px-1 pr-4"
                        headingLevels={[1, 2, 3, 4]}
                      />
                    </div>
                    {contentPreview.references &&
                      contentPreview.references.length > 0 && (
                        <div className="mt-4 border-t border-border/50 pt-4">
                          <h4 className="mb-3 text-sm font-semibold text-foreground">
                            References
                          </h4>
                          <div className="space-y-2 proposal-detail-content">
                            {contentPreview.references.map((ref, index) => {
                              const href = ref.uri || ref.label || "#";
                              const label = ref.label || ref.uri || href;
                              return (
                                <a
                                  key={index}
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block break-all text-sm text-primary hover:underline"
                                >
                                  {label}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
                {/* Fade overlay when collapsed */}
                {!isContentExpanded && contentPreview.shouldTruncate && (
                  <div className="relative h-8 -mt-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                )}
              </div>
            )}
          </Card>

          {/* Main Grid: 2/3 Left, 1/3 Right */}
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:gap-6 lg:grid-cols-3">
            {/* Left Column - Tabs for donuts, bubble map, curves, details */}
            <div className="space-y-4 sm:space-y-5 md:space-y-6 lg:col-span-2">
              <Card className={cn(
                "info-container p-3 sm:p-4 md:p-6 dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none dark:rounded-none",
                isGame && "game-voting-card"
              )}>
                <Tabs
                  value={selectedTab}
                  onValueChange={setSelectedTab}
                  className="w-full"
                >
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <TabsList className="flex-1 flex-wrap justify-start gap-1.5 sm:gap-2 bg-transparent p-0 overflow-x-auto">
                        <TabsTrigger
                          value="live-voting"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
                              : "rounded-full border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background hover:text-foreground dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2] dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap"
                          }
                        >
                          Live Voting
                        </TabsTrigger>
                        <TabsTrigger
                          value="bubble-map"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
                              : "rounded-full border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background hover:text-foreground dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2] dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap"
                          }
                        >
                          Bubble Map
                        </TabsTrigger>
                        <TabsTrigger
                          value="curves"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
                              : "rounded-full border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background hover:text-foreground dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2] dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap"
                          }
                        >
                          Curves
                        </TabsTrigger>
                        <TabsTrigger
                          value="details"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
                              : "rounded-full border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background hover:text-foreground dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2] dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap"
                          }
                        >
                          Details
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <>
                        {/* Live voting donuts */}
                        <TabsContent value="live-voting" className="mt-0">
                          {allVotes.length > 0 ? (
                            <div className="space-y-3 sm:space-y-4">
                              {/* Mobile: vertical stack with legend on right. Desktop: horizontal row with legend below */}
                              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-start sm:gap-4 md:gap-6">
                                {/* DRep */}
                                <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-center sm:gap-3">
                                  {allowDRep ? (
                                    drepInfo ? (
                                      <>
                                        <VoteProgress
                                          title="DRep Votes"
                                          segments={drepDonutSegments ?? undefined}
                                          valueUnit="ada"
                                          className="origin-center scale-[0.85] sm:scale-90 md:scale-100"
                                          showTooltip={false}
                                          interactive={false}
                                          showYesPercent={!!drepDonutSegments}
                                        />
                                        <RoleLegend
                                          role="DRep"
                                          segments={drepDonutSegments}
                                          unit="ADA"
                                        />
                                        <ExcludedBreakdownDisplay
                                          role="DRep"
                                          breakdown={drepExcludedBreakdown}
                                          isInfoAction={isInfoAction}
                                        />
                                      </>
                                    ) : (
                                      <RolePlaceholder
                                        role="DRep"
                                        message="No on-chain data yet"
                                      />
                                    )
                                  ) : (
                                    <RolePlaceholder
                                      role="DRep"
                                      message="Not eligible for this action"
                                    />
                                  )}
                                </div>
                                {/* CC */}
                                <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-center sm:gap-3">
                                  {allowCC ? (
                                    ccInfo ? (
                                      <>
                                        <VoteProgress
                                          title="CC"
                                          yesPercent={ccInfo.yesPercent}
                                          noPercent={ccInfo.noPercent || 0}
                                          pendingPercent={ccPendingPercent}
                                          yesValue={ccYesCount}
                                          noValue={ccNoCount}
                                          pendingValue={ccPendingCount}
                                          valueUnit="count"
                                          className="origin-center scale-[0.85] sm:scale-90 md:scale-100"
                                          showTooltip={false}
                                          interactive={false}
                                          showYesPercent
                                        />
                                        <RoleLegend
                                          role="CC"
                                          yesLabel={`${ccYesCount}`}
                                          noLabel={`${ccNoCount}`}
                                          pendingLabel={`${ccPendingCount}`}
                                          unit="votes"
                                        />
                                        <CCExcludedDisplay
                                          abstainCount={ccAbstainStats.count ?? 0}
                                          isInfoAction={isInfoAction}
                                        />
                                      </>
                                    ) : (
                                      <RolePlaceholder
                                        role="CC"
                                        message="No on-chain data yet"
                                      />
                                    )
                                  ) : (
                                    <RolePlaceholder
                                      role="CC"
                                      message="Not eligible for this action"
                                    />
                                  )}
                                </div>
                                {/* SPO */}
                                <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-center sm:gap-3">
                                  {allowSPO ? (
                                    spoInfo ? (
                                      <>
                                        <VoteProgress
                                          title="SPO Votes"
                                          segments={spoDonutSegments ?? undefined}
                                          valueUnit="ada"
                                          className="origin-center scale-[0.85] sm:scale-90 md:scale-100"
                                          showTooltip={false}
                                          interactive={false}
                                          showYesPercent={!!spoDonutSegments}
                                        />
                                        <RoleLegend
                                          role="SPO"
                                          segments={spoDonutSegments}
                                          unit="ADA"
                                        />
                                        <ExcludedBreakdownDisplay
                                          role="SPO"
                                          breakdown={spoExcludedBreakdown}
                                          isInfoAction={isInfoAction}
                                        />
                                      </>
                                    ) : (
                                      <RolePlaceholder
                                        role="SPO"
                                        message="No on-chain data yet"
                                      />
                                    )
                                  ) : (
                                    <RolePlaceholder
                                      role="SPO"
                                      message="Not eligible for this action"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                              No voting activity yet.
                            </div>
                          )}
                        </TabsContent>

                        {/* Bubble map */}
                        <TabsContent value="bubble-map" className="mt-0">
                          {allVotes.length > 0 ? (
                            <BubbleMap votes={allVotes} />
                          ) : (
                            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                              No voting activity yet.
                            </div>
                          )}
                        </TabsContent>

                        {/* Curves */}
                        <TabsContent value="curves" className="mt-0">
                          <Card className={cn(
                            "p-4 sm:p-6 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none dark:rounded-none",
                            isGame && "game-detail-card"
                          )}>
                            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="space-y-1">
                                <h3 className={cn("text-lg font-semibold", isGame && "text-white")}>Voting trend</h3>
                                <p className={cn("text-sm", isGame ? "text-white/70" : "text-muted-foreground")}>
                                  {shouldShowPower
                                    ? "Cumulative voting power (ADA)"
                                    : "Cumulative yes / no / abstain votes"}{" "}
                                  · {" "}
                                  {curveRoleFilter === "All"
                                    ? "All roles"
                                    : `${curveRoleFilter} only`}
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {curveRoleOptions.map((role) => {
                                    const isActive = curveRoleFilter === role;
                                    return (
                                      <button
                                        key={role}
                                        type="button"
                                        onClick={() => setCurveRoleFilter(role)}
                                        className={cn(
                                          isGame
                                            ? isActive
                                              ? "game-tab-btn-active-inline"
                                              : "game-tab-btn-inline"
                                            : `rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2] ${
                                                isActive
                                                  ? "border-foreground bg-foreground text-background dark:bg-[#0bd1a2] dark:text-black"
                                                  : "border-border text-muted-foreground hover:text-foreground dark:hover:bg-[#0bd1a2] dark:hover:text-black"
                                              }`
                                        )}
                                      >
                                        {role === "All" ? "All Roles" : role}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            {voteTimelineData.length > 0 ? (
                              <div className="h-[320px] w-full min-w-0">
                                <ResponsiveContainer
                                  width="100%"
                                  height="100%"
                                  minWidth={0}
                                  minHeight={0}
                                >
                                  <LineChart
                                    data={voteTimelineData}
                                    margin={{
                                      top: 10,
                                      right: 24,
                                      left: 0,
                                      bottom: 0,
                                    }}
                                  >
                                    <CartesianGrid
                                      strokeDasharray="3 3"
                                      className="stroke-border/60"
                                    />
                                    <XAxis
                                      dataKey="label"
                                      tick={{ fontSize: 12 }}
                                      minTickGap={24}
                                    />
                                    <YAxis
                                      yAxisId="primary"
                                      allowDecimals={false}
                                      tick={{ fontSize: 12 }}
                                      tickFormatter={
                                        shouldShowPower
                                          ? (value) =>
                                              formatAdaValue(value).replace(
                                                " ₳",
                                                ""
                                              )
                                          : undefined
                                      }
                                    />
                                    <RechartsTooltip
                                      content={renderVoteTrendTooltip}
                                    />
                                    <Legend />
                                    {shouldShowPower ? (
                                      <>
                                        <Line
                                          type="monotone"
                                          dataKey="yesPower"
                                          stroke={voteColors.yes}
                                          strokeWidth={2}
                                          strokeDasharray={
                                            useDashedPowerLines ? "5 4" : undefined
                                          }
                                          dot={false}
                                          name="Yes Power"
                                          yAxisId="primary"
                                        />
                                        <Line
                                          type="monotone"
                                          dataKey="noPower"
                                          stroke={voteColors.no}
                                          strokeWidth={2}
                                          strokeDasharray={
                                            useDashedPowerLines ? "5 4" : undefined
                                          }
                                          dot={false}
                                          name="No Power"
                                          yAxisId="primary"
                                        />
                                        <Line
                                          type="monotone"
                                          dataKey="abstainPower"
                                          stroke={voteColors.abstain}
                                          strokeOpacity={0.9}
                                          strokeWidth={2}
                                          strokeDasharray={
                                            useDashedPowerLines ? "5 4" : undefined
                                          }
                                          dot={false}
                                          name="Abstain Power"
                                          yAxisId="primary"
                                        />
                                      </>
                                    ) : (
                                      <>
                                        <Line
                                          type="monotone"
                                          dataKey="yesCount"
                                          stroke={voteColors.yes}
                                          strokeWidth={2}
                                          dot={false}
                                          name="Yes Votes"
                                          yAxisId="primary"
                                        />
                                        <Line
                                          type="monotone"
                                          dataKey="noCount"
                                          stroke={voteColors.no}
                                          strokeWidth={2}
                                          dot={false}
                                          name="No Votes"
                                          yAxisId="primary"
                                        />
                                        <Line
                                          type="monotone"
                                          dataKey="abstainCount"
                                          stroke={voteColors.abstain}
                                          strokeOpacity={0.9}
                                          strokeWidth={2}
                                          dot={false}
                                          name="Abstain Votes"
                                          yAxisId="primary"
                                        />
                                      </>
                                    )}
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                                Not enough voting data yet.
                              </div>
                            )}
                          </Card>
                        </TabsContent>

                        {/* Details */}
                        <TabsContent value="details" className="mt-0">
                          <div className="space-y-4">
                            {/* Time Until Expiry */}
                            {selectedAction && (() => {
                              const currentEpoch = getCurrentEpoch();
                              // Use actual epoch values, fallback to current epoch if missing
                              const submissionEpoch = selectedAction.submissionEpoch > 0 
                                ? selectedAction.submissionEpoch 
                                : currentEpoch;
                              const expiryEpoch = selectedAction.expiryEpoch > 0
                                ? selectedAction.expiryEpoch
                                : submissionEpoch + 6;
                              const epochsRemaining = Math.max(
                                0,
                                expiryEpoch - currentEpoch
                              );
                              const daysRemaining = epochsRemaining * 5;
                              const totalEpochs = expiryEpoch - submissionEpoch;
                              const epochsPassed = Math.min(
                                totalEpochs,
                                Math.max(0, currentEpoch - submissionEpoch)
                              );
                              const progressPercent = totalEpochs > 0
                                ? (epochsPassed / totalEpochs) * 100
                                : 0;

                              const submissionDate = epochToDate(submissionEpoch);
                              const expiryDate = epochToDate(expiryEpoch);

                              return (
                                <div className={cn(
                                  "p-4 sm:p-5",
                                  isGame
                                    ? "game-detail-card"
                                    : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
                                )}>
                                  <label className={cn(
                                    "mb-3 block text-sm font-semibold sm:text-base",
                                    isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                                  )}>
                                    Time Until Expiry
                                  </label>
                                  <div className={cn(
                                    "mb-4 text-base font-semibold sm:text-lg",
                                    isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                                  )}>
                                    {epochsRemaining > 0 ? (
                                      <>
                                        {daysRemaining}{" "}
                                        {daysRemaining === 1 ? "day" : "days"}{" "}
                                        remaining
                                      </>
                                    ) : (
                                      <span className={isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"}>
                                        Expired
                                      </span>
                                    )}
                                  </div>
                                  <Progress
                                    value={progressPercent}
                                    className={cn(
                                      "mb-4 h-3",
                                      isGame
                                        ? "rounded-full bg-white/20"
                                        : "rounded-full bg-secondary dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:rounded-none"
                                    )}
                                    indicatorClassName={isGame ? "bg-white/50" : "bg-black dark:bg-[#0bd1a2]"}
                                  />
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className={cn(
                                        "text-xs",
                                        isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]"
                                      )}>
                                        <th className="text-left py-1 font-medium"></th>
                                        <th className="text-left py-1 font-medium">Epoch</th>
                                        <th className="text-left py-1 font-medium">Date</th>
                                        <th className="text-left py-1 font-medium">Time</th>
                                      </tr>
                                    </thead>
                                    <tbody className={cn(
                                      "text-xs sm:text-sm font-semibold",
                                      isGame ? "text-white" : "dark:text-[#0bd1a2]"
                                    )}>
                                      <tr>
                                        <td className={cn("py-1.5", isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]")}>Submission</td>
                                        <td className="py-1.5">{submissionEpoch}</td>
                                        <td className="py-1.5">{formatDateUTC(submissionDate)}</td>
                                        <td className="py-1.5">{formatTimeUTC(submissionDate)}</td>
                                      </tr>
                                      <tr>
                                        <td className={cn("py-1.5", isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]")}>Expiry</td>
                                        <td className="py-1.5">{expiryEpoch}</td>
                                        <td className="py-1.5">{formatDateUTC(expiryDate)}</td>
                                        <td className="py-1.5">{formatTimeUTC(expiryDate)}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()}
                            <div className={cn(
                              "p-4 sm:p-5",
                              isGame
                                ? "game-detail-card"
                                : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
                            )}>
                              <label className={cn(
                                "mb-3 block text-sm font-semibold sm:text-base",
                                isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                              )}>
                                Governance Action ID
                              </label>
                              <div className="flex items-start gap-2">
                                <code className={cn(
                                  "flex-1 break-all px-2 py-1 font-mono text-xs sm:px-3 sm:text-sm",
                                  isGame
                                    ? "rounded bg-white/10 text-white/80"
                                    : "rounded bg-secondary text-muted-foreground dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                                )}>
                                  {selectedAction.proposalId}
                                </code>
                                <button
                                  onClick={() =>
                                    handleCopy(
                                      selectedAction.proposalId || "",
                                      "proposalId"
                                    )
                                  }
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center transition-colors",
                                    isGame
                                      ? "game-nav-btn !p-0 !min-w-0 !min-h-0"
                                      : "rounded-full bg-white text-black hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2] dark:hover:text-black dark:shadow-none"
                                  )}
                                  aria-label="Copy Governance Action ID"
                                >
                                  {copiedId === "proposalId" ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className={cn(
                              "p-4 sm:p-5",
                              isGame
                                ? "game-detail-card"
                                : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
                            )}>
                              <label className={cn(
                                "mb-3 block text-sm font-semibold sm:text-base",
                                isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                              )}>
                                Transaction Hash
                              </label>
                              <div className="flex items-start gap-2">
                                <code className={cn(
                                  "flex-1 break-all px-2 py-1 font-mono text-xs sm:px-3 sm:text-sm",
                                  isGame
                                    ? "rounded bg-white/10 text-white/80"
                                    : "rounded bg-secondary text-muted-foreground dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                                )}>
                                  {selectedAction.txHash}
                                </code>
                                <button
                                  onClick={() =>
                                    handleCopy(
                                      selectedAction.txHash || "",
                                      "txHash"
                                    )
                                  }
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center transition-colors",
                                    isGame
                                      ? "game-nav-btn !p-0 !min-w-0 !min-h-0"
                                      : "rounded-full bg-white text-black hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2] dark:hover:text-black dark:shadow-none"
                                  )}
                                  aria-label="Copy Transaction Hash"
                                >
                                  {copiedId === "txHash" ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </>
                  </div>
                </Tabs>
              </Card>
            </div>

            {/* Right Column - Sidebar (voting summary) */}
            <div className="space-y-6">
              {/* Vote Summary Card */}
              <Card className={cn("p-6", isGame && "game-detail-card")}>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className={isGame ? "text-white/70" : "text-muted-foreground"}>Gov action type</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-[6px] bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide leading-none",
                        isGame 
                          ? "border-white/30 text-white" 
                          : "border-foreground/20 dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                      )}
                    >
                      {selectedAction.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={isGame ? "text-white/70" : "text-muted-foreground"}>Status</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-[6px] bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide leading-none",
                        isGame 
                          ? "border-white/30 text-white" 
                          : "border-foreground/20 dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                      )}
                    >
                      {selectedAction.status}
                    </Badge>
                  </div>
                  {selectedAction.constitutionality && (
                    <div className="flex items-center justify-between">
                      <span className={isGame ? "text-white/70" : "text-muted-foreground"}>Constitutionality</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-[6px] bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide leading-none",
                          isGame 
                            ? "border-white/30 text-white" 
                            : "border-foreground/20 dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                        )}
                      >
                        {selectedAction.constitutionality}
                      </Badge>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* Voting Records Section - Combined DRep, SPO, and CC votes */}
          {allVotes.length > 0 && (
            <div className="mt-12">
              <VotingRecords
                votes={allVotes}
                proposalId={selectedAction.proposalId || selectedAction.hash}
                showDownload={allVotes.length > 0}
                downloadFormat={downloadFormat}
                onDownloadFormatChange={(value) => handleExport(value)}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function VoteTrendTooltip({
  active,
  payload,
  label,
  showPower,
  colors,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: unknown;
    [key: string]: unknown;
  }>;
  label?: string;
  showPower: boolean;
  colors: VoteColorSet;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload as TimelinePoint | undefined;
  if (!point) {
    return null;
  }

  const rows = [
    {
      label: "Yes",
      value: showPower
        ? formatAdaValue(point.yesPower)
        : `${point.yesCount.toLocaleString()} votes`,
        color: colors.yes,
      border: "transparent",
    },
    {
      label: "No",
      value: showPower
        ? formatAdaValue(point.noPower)
        : `${point.noCount.toLocaleString()} votes`,
        color: colors.no,
      border: "transparent",
    },
    {
      label: "Abstain",
      value: showPower
        ? formatAdaValue(point.abstainPower)
        : `${point.abstainCount.toLocaleString()} votes`,
        color: colors.abstain,
      border: "rgba(148, 163, 184, 0.85)",
    },
  ];

  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-md">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full border"
                style={{ backgroundColor: row.color, borderColor: row.border }}
              />
              <span className="font-semibold text-foreground">
                {row.label}
              </span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type VoteColorSet = typeof VOTE_COLORS_LIGHT;

function RoleLegend({
  role,
  segments,
  yesLabel,
  noLabel,
  pendingLabel,
  unit,
}: {
  role: string;
  segments?: VoteSegment[] | null;
  // Legacy props for CC only (no breakdown data from API)
  yesLabel?: string;
  noLabel?: string;
  pendingLabel?: string;
  unit: string;
}) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  // Use segments when provided (DRep/SPO), otherwise use legacy props (CC)
  const items = segments && segments.length > 0
    ? segments.map((seg) => ({
        label: seg.label,
        value: formatAdaValue(seg.value),
        color: `${seg.color}73`, // Apply 45% opacity to match donut inactive state
        border: seg.type === "abstain" || seg.type === "notVoted" || seg.type === "excluded"
          ? "rgba(148, 163, 184, 0.85)"
          : "transparent",
      }))
    : [
        // CC legacy fallback - uses SEGMENT_COLORS with 45% opacity
        // Abstain is excluded from legend (shown separately)
        {
          label: "Yes",
          value: yesLabel ?? "0",
          color: `${SEGMENT_COLORS.yes}73`,
          border: "transparent",
        },
        {
          label: "No",
          value: noLabel ?? "0",
          color: `${SEGMENT_COLORS.no}73`,
          border: "transparent",
        },
        {
          label: "Not Voted",
          value: pendingLabel ?? (unit === "ADA" ? "0 ₳" : "0 votes"),
          color: `${SEGMENT_COLORS.notVoted}73`,
          border: "rgba(148, 163, 184, 0.85)",
        },
      ];

  return (
    <div className={cn(
      "w-full max-w-[200px] px-3 py-2 text-xs",
      isGame
        ? "border-none bg-transparent"
        : "rounded-xl border border-border/60 bg-card/40 shadow-sm dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
    )}>
      <div className={cn(
        "mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide",
        isGame ? "text-white" : "text-muted-foreground dark:text-[#0bd1a2]"
      )}>
        <span className={cn("font-semibold", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>{role}</span>
        <span className={isGame ? "text-white" : "dark:text-[#0bd1a2]"}>{unit}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start justify-between gap-2"
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span
                className="h-2.5 w-2.5 border shrink-0 mt-0.5"
                style={{
                  backgroundColor: item.color,
                  borderColor: item.border,
                }}
              />
              <span className={cn(
                "font-semibold leading-tight",
                isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
              )}>
                {item.label}
              </span>
            </div>
            <span className={cn(
              "font-mono text-[11px] shrink-0 text-right",
              isGame ? "text-white/80" : "text-muted-foreground dark:text-[#0bd1a2]"
            )}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExcludedBreakdownDisplay({
  role,
  breakdown,
  isInfoAction = false,
}: {
  role: "DRep" | "SPO";
  breakdown: ExcludedBreakdown | null;
  isInfoAction?: boolean;
}) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  if (!breakdown || breakdown.total === 0) return null;

  const items = [
    { label: "Active Abstain", value: breakdown.activeAbstain },
    { label: "Always Abstain", value: breakdown.alwaysAbstain },
    ...(breakdown.inactive !== undefined && role === "DRep"
      ? [{ label: "Inactive", value: breakdown.inactive }]
      : []),
  ];

  return (
    <div className={cn(
      "w-full max-w-[200px] px-3 py-2 text-xs mt-2",
      isGame
        ? "border-none bg-transparent"
        : "rounded-xl border border-dashed border-border/40 bg-card/20 dark:rounded-none dark:border-[#0bd1a2]/50 dark:bg-transparent"
    )}>
      <div className={cn(
        "mb-2 text-[10px] uppercase tracking-wide",
        isGame ? "text-white/60" : "text-muted-foreground/70 dark:text-[#0bd1a2]/70"
      )}>
        {isInfoAction ? "Excluded" : "Excluded from ratification"}
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3"
          >
            <span className={cn(
              "text-[10px]",
              isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
            )}>
              {item.label}
            </span>
            <span className={cn(
              "font-mono text-[10px]",
              isGame ? "text-white/60" : "text-muted-foreground/80 dark:text-[#0bd1a2]/70"
            )}>
              {formatAdaValue(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CCExcludedDisplay({
  abstainCount,
  isInfoAction = false,
}: {
  abstainCount: number;
  isInfoAction?: boolean;
}) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  if (abstainCount === 0) return null;

  return (
    <div className={cn(
      "w-full max-w-[200px] px-3 py-2 text-xs mt-2",
      isGame
        ? "border-none bg-transparent"
        : "rounded-xl border border-dashed border-border/40 bg-card/20 dark:rounded-none dark:border-[#0bd1a2]/50 dark:bg-transparent"
    )}>
      <div className={cn(
        "mb-2 text-[10px] uppercase tracking-wide",
        isGame ? "text-white/60" : "text-muted-foreground/70 dark:text-[#0bd1a2]/70"
      )}>
        {isInfoAction ? "Excluded" : "Excluded from ratification"}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className={cn(
          "text-[10px]",
          isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
        )}>
          Abstain
        </span>
        <span className={cn(
          "font-mono text-[10px]",
          isGame ? "text-white/60" : "text-muted-foreground/80 dark:text-[#0bd1a2]/70"
        )}>
          {abstainCount}
        </span>
      </div>
    </div>
  );
}

function RolePlaceholder({ role, message }: { role: string; message: string }) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  return (
    <div className={cn(
      "flex h-full min-h-[180px] w-full max-w-[220px] flex-col items-center justify-center px-4 py-6 text-center text-xs text-muted-foreground",
      isGame
        ? "border-none bg-transparent"
        : "rounded-xl border border-dashed border-border/60 bg-card/30 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none"
    )}>
      <span className={cn(
        "mb-1 font-semibold",
        isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
      )}>{role}</span>
      <span className={isGame ? "text-white/70" : "dark:text-[#0bd1a2]"}>{message}</span>
    </div>
  );
}
