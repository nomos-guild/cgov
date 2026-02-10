// src/pages/governance/[hash].tsx

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  type ComponentType,
} from "react";
import type { GetStaticProps, GetStaticPaths } from "next";
import { useRouter } from "next/router";
import { useTranslations } from "next-intl";
import Head from "next/head";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoteProgress } from "@/components/ui/vote-progress";
import { Progress } from "@/components/ui/progress";
import { VotingRecords } from "@/components/VotingRecords";
import { BubbleMap } from "@/components/BubbleMap";
import { useAppSelector } from "@/store/hooks";
import { useGovernanceActionDetail } from "@/hooks/useGovernanceData";
import { ArrowLeft, Copy, Check, Info } from "lucide-react";
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
  translateVotesForExport,
  type ExportLabels,
} from "@/lib/exportRationales";
import {
  canRoleVoteOnAction,
  getEligibleRoles,
  getVoteDataPresence,
} from "@/lib/governanceVotingEligibility";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GameDropdown } from "@/components/ui/game-dropdown";
import {
  buildDonutSegments,
  buildLegendSegments,
  calculateExcludedBreakdown,
  getGovernanceActionTypeCode,
  SEGMENT_COLORS,
  type ExcludedBreakdown,
  type VoteSegment,
} from "@/lib/voteBreakdownCalculator";
import { ProposalContent } from "@/components/ProposalContent";
import { useContentTranslation } from "@/hooks/useContentTranslation";
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
 * Get current epoch number
 */
function getCurrentEpoch(): number {
  const now = Date.now();
  const epochsSinceShelley = Math.floor((now - SHELLEY_START_TIME) / EPOCH_DURATION_MS);
  return SHELLEY_START_EPOCH + epochsSinceShelley;
}

/**
 * Convert epoch number to timestamp
 */
function epochToTimestamp(epoch: number): number {
  const epochsSinceShelley = epoch - SHELLEY_START_EPOCH;
  return SHELLEY_START_TIME + (epochsSinceShelley * EPOCH_DURATION_MS);
}

/**
 * Convert IPFS URI to a gateway URL
 * Supports: ipfs://<cid>, ipfs:<cid>, <cid>
 */
function convertIpfsToGateway(uri: string): string {
  if (!uri) return uri;

  // Check if it's an IPFS URI
  const ipfsMatch = uri.match(/^(?:ipfs:\/\/|ipfs:)(.+)$/i);
  if (ipfsMatch) {
    const cid = ipfsMatch[1];
    return `https://ipfs.io/ipfs/${cid}`;
  }

  // Check if it's a raw CID (starts with Qm or b for CIDv0/v1)
  if (/^(Qm[a-zA-Z0-9]{44}|b[a-z2-7]{58})/.test(uri)) {
    return `https://ipfs.io/ipfs/${uri}`;
  }

  // Return original URI if not IPFS
  return uri;
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

  // If there are SPO votes in the votes array, SPOs can vote (security-critical parameter changes)
  const hasSpoVotes = action.votes?.some((v) => v.voterType === "SPO") ?? false;
  if (hasSpoVotes) {
    return false; // SPOs are applicable if they have votes
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
  label: string; // Unique identifier (includes index for duplicate dates)
  displayLabel: string; // Clean label for display (just the date)
  yesCount: number;
  noCount: number;
  abstainCount: number;
  yesPower: number;
  noPower: number;
  abstainPower: number;
};

type RoleFilter = "All" | VoterType;

interface VoteOnProposalProps {
  txHash: string;
  certIndex: number;
  proposalTitle: string;
  status: string;
  proposalId: string;
}

function LazyVoteOnProposal(props: VoteOnProposalProps) {
  const [Comp, setComp] = useState<ComponentType<VoteOnProposalProps> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(window.crypto && window.crypto.subtle)) return;
    import("@/components/governance/VoteOnProposal")
      .then((mod) => setComp(() => mod.VoteOnProposal))
      .catch(() => {});
  }, []);

  if (!Comp) return null;
  return <Comp {...props} />;
}

interface GovernanceDetailProps {
  initialDetail?: GovernanceActionDetail | null;
}

export default function GovernanceDetail({ initialDetail }: GovernanceDetailProps) {
  const router = useRouter();
  const { hash } = router.query;
  const { theme, activeTheme } = useTheme();
  const tExpiry = useTranslations("expiry");
  const tTabs = useTranslations("tabs");
  const tVoting = useTranslations("voting");
  const tProposal = useTranslations("proposal");
  const tExport = useTranslations("export");
  const isDark = theme === "dark";
  const isGame = activeTheme.id === "game";
  const voteColors = useMemo(
    () => (isDark || isGame ? VOTE_COLORS_DARK : VOTE_COLORS_LIGHT),
    [isDark, isGame]
  );
  const proposalId = typeof hash === "string" ? hash : null;

  // SWR-based data loading with ISR fallback for instant hydration
  const { isLoading: swrLoading, error: swrError, refresh } =
    useGovernanceActionDetail(proposalId, initialDetail);

  // Redux still has the data (synced by the hook) for components that read from it
  const { selectedAction } = useAppSelector((state) => state.governance);

  // Derive vote transaction props from selectedAction hash ("txHash:certIndex" format)
  const [voteTxHash, voteCertIndexStr] = (selectedAction?.hash || "").split(/[:#]/);
  const voteCertIndex = parseInt(voteCertIndexStr, 10) || 0;

  // Alias for backward compatibility with the rest of the JSX
  const isLoadingDetail = swrLoading;
  const detailError = swrError;

  const [downloadFormat, setDownloadFormat] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [contentVisible, setContentVisible] = useState(!!initialDetail);
  const [isContentExpanded, setIsContentExpanded] = useState<boolean>(false);
  const [isDrepExcludedExpanded, setIsDrepExcludedExpanded] = useState<boolean>(false);
  const [isSpoExcludedExpanded, setIsSpoExcludedExpanded] = useState<boolean>(false);
  const [isCcExcludedExpanded, setIsCcExcludedExpanded] = useState<boolean>(false);
  const [curveRoleFilter, setCurveRoleFilter] =
    useState<RoleFilter>("All");
  const [selectedTab, setSelectedTab] = useState<string>("live-voting");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

  // Fetch precise submission timestamp from Koios via txHash
  useEffect(() => {
    if (!voteTxHash || voteTxHash.length !== 64) return;
    setSubmittedAt(null);
    fetch(`/api/tx-timestamp?txHash=${voteTxHash}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.timestamp) setSubmittedAt(d.timestamp * 1000); // unix s → ms
      })
      .catch(() => {/* fall back to epoch-derived date */});
  }, [voteTxHash]);

  // Reset visibility on proposal change, fade in when data arrives
  const prevProposalId = useRef(proposalId);
  useEffect(() => {
    if (proposalId !== prevProposalId.current) {
      setContentVisible(false);
      prevProposalId.current = proposalId;
    }
  }, [proposalId]);

  useEffect(() => {
    if (selectedAction && !contentVisible) {
      const timeout = setTimeout(() => setContentVisible(true), 150);
      return () => clearTimeout(timeout);
    }
  }, [selectedAction, contentVisible]);

  const allVotes = useMemo(() => {
    if (!selectedAction) return [];
    return [
      ...(selectedAction.votes || []),
      ...(selectedAction.ccVotes || []),
    ];
  }, [selectedAction]);

  // Aggregate voting data (breakdowns, CC counts) may be available even when
  // individual vote records haven't been indexed yet. The Live Voting donuts
  // use aggregate data, so gate them on this rather than allVotes.length.
  const hasAggregateVotingData = useMemo(() => {
    if (!selectedAction) return false;
    return !!(
      selectedAction.drepBreakdown ||
      selectedAction.spoBreakdown ||
      selectedAction.cc
    );
  }, [selectedAction]);

  const exportLabels: ExportLabels = useMemo(
    () => ({
      noRationale: tExport("noRationale"),
      voteYes: tExport("voteYes"),
      voteNo: tExport("voteNo"),
      voteAbstain: tExport("voteAbstain"),
      headingVotingRationales: tExport("headingVotingRationales"),
      labelExported: tExport("labelExported"),
      labelTotalVotes: tExport("labelTotalVotes"),
      labelVote: tExport("labelVote"),
      labelVotingPower: tExport("labelVotingPower"),
      labelVotedAt: tExport("labelVotedAt"),
      labelRationaleLink: tExport("labelRationaleLink"),
      headingRationale: tExport("headingRationale"),
      csvProposal: tExport("csvProposal"),
      csvVoterType: tExport("csvVoterType"),
      csvVoterId: tExport("csvVoterId"),
      csvVoterName: tExport("csvVoterName"),
      csvVote: tExport("csvVote"),
      csvVotingPower: tExport("csvVotingPower"),
      csvVotedAt: tExport("csvVotedAt"),
      csvRationale: tExport("csvRationale"),
      csvAnchorUrl: tExport("csvAnchorUrl"),
    }),
    [tExport],
  );

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

  // Translation hooks for title and content
  const titleTranslation = useContentTranslation({
    originalText: selectedAction?.title || "",
  });

  const contentTranslation = useContentTranslation({
    originalText: contentPreview?.full || "",
  });

  const eligibleRoles = useMemo<VoterType[]>(() => {
    if (!selectedAction) return [];
    const voteData = getVoteDataPresence(selectedAction);
    return getEligibleRoles(selectedAction.type, selectedAction.threshold, voteData);
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

    // Start with a zero point so lines begin at 0 ADA
    const firstVote = votesWithDates[0];
    const firstLabel = firstVote?.date && !Number.isNaN(firstVote.date.getTime())
      ? firstVote.date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
        })
      : "Start";

    const timelinePoints: TimelinePoint[] = [{
      label: `${firstLabel}#start`,
      displayLabel: firstLabel,
      yesCount: 0,
      noCount: 0,
      abstainCount: 0,
      yesPower: 0,
      noPower: 0,
      abstainPower: 0,
    }];

    votesWithDates.forEach((vote, index) => {
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
            })
          : `Vote ${index + 1}`;

      timelinePoints.push({
        label: `${label}#${index}`, // Add unique index to ensure each point is distinct
        displayLabel: label, // Keep clean label for display
        yesCount,
        noCount,
        abstainCount,
        yesPower,
        noPower,
        abstainPower,
      });
    });

    return timelinePoints;
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
        isGame={isGame}
      />
    ),
    [shouldShowPower, voteColors, isGame]
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
  // Pass total DRep vote power to calculate notVoted if missing from backend
  const drepDonutSegments = useMemo(() => {
    if (!selectedAction?.drepBreakdown) return null;
    const drepTotalVotePower = selectedAction.rawVotingPowerValues?.drep_total_vote_power;
    return buildDonutSegments(selectedAction.drepBreakdown, actionTypeCode, true, drepTotalVotePower);
  }, [selectedAction?.drepBreakdown, selectedAction?.rawVotingPowerValues?.drep_total_vote_power, actionTypeCode]);

  // Calculate DRep legend segments (always includes all categories)
  const drepLegendSegments = useMemo(() => {
    if (!selectedAction?.drepBreakdown) return null;
    const drepTotalVotePower = selectedAction.rawVotingPowerValues?.drep_total_vote_power;
    return buildLegendSegments(selectedAction.drepBreakdown, actionTypeCode, true, drepTotalVotePower);
  }, [selectedAction?.drepBreakdown, selectedAction?.rawVotingPowerValues?.drep_total_vote_power, actionTypeCode]);

  // Calculate SPO donut segments from breakdown data (no inactive for SPO)
  // Pass total SPO vote power to calculate notVoted if missing from backend
  const spoDonutSegments = useMemo(() => {
    if (!selectedAction?.spoBreakdown) return null;
    const spoTotalVotePower = selectedAction.rawVotingPowerValues?.spo_total_vote_power;
    return buildDonutSegments(selectedAction.spoBreakdown, actionTypeCode, false, spoTotalVotePower);
  }, [selectedAction?.spoBreakdown, selectedAction?.rawVotingPowerValues?.spo_total_vote_power, actionTypeCode]);

  // Calculate SPO legend segments (always includes all categories)
  const spoLegendSegments = useMemo(() => {
    if (!selectedAction?.spoBreakdown) return null;
    const spoTotalVotePower = selectedAction.rawVotingPowerValues?.spo_total_vote_power;
    return buildLegendSegments(selectedAction.spoBreakdown, actionTypeCode, false, spoTotalVotePower);
  }, [selectedAction?.spoBreakdown, selectedAction?.rawVotingPowerValues?.spo_total_vote_power, actionTypeCode]);

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

  // Check if cached data matches the current route's hash
  // This prevents showing stale data from a different proposal during navigation
  const isDataForCurrentRoute = selectedAction &&
    (selectedAction.hash === hash || selectedAction.proposalId === hash);

  // Show loading state when:
  // 1. We're loading and have no data at all, OR
  // 2. We're loading and the cached data is for a different proposal
  const showLoadingState = isLoadingDetail && !isDataForCurrentRoute;

  // Only show error state if we don't have matching data for current route
  const showErrorState = detailError && !isDataForCurrentRoute;

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
                onClick={() => refresh()}
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

  // Not found state - only show if not loading and no matching data
  if (!isDataForCurrentRoute && !isLoadingDetail) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <Link href="/">
            <Button variant="default" className="mb-6 bg-white text-black hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tProposal("backToDashboard")}
            </Button>
          </Link>
          <Card className="p-12">
            <div className="text-center">
              <p className="text-muted-foreground">
                {tProposal("govActionNotFound")}
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // TypeScript guard: at this point selectedAction must exist (isDataForCurrentRoute was true)
  if (!selectedAction) {
    return null;
  }

  const actionVoteData = getVoteDataPresence(selectedAction);
  const allowDRep =
    canRoleVoteOnAction(selectedAction.type, "DRep", selectedAction.threshold, actionVoteData) &&
    !isDrepNotApplicable(selectedAction);
  const allowSPO =
    canRoleVoteOnAction(selectedAction.type, "SPO", selectedAction.threshold, actionVoteData) &&
    !isSpoNotApplicable(selectedAction);
  const allowCC =
    canRoleVoteOnAction(selectedAction.type, "CC", selectedAction.threshold, actionVoteData) &&
    !isCcNotApplicable(selectedAction);

  // Always wire through available vote info so donuts render
  // whenever on-chain data exists. Eligibility is still used
  // to drive placeholder messaging.
  const drepInfo = selectedAction.drep;
  const spoThreshold = selectedAction.threshold?.spoThreshold;
  // Show SPO info if threshold exists, SPO breakdown data is available, or if there are SPO votes
  const hasSpoVotes = selectedAction.votes?.some((v) => v.voterType === "SPO") ?? false;
  const spoInfo =
    (spoThreshold !== null && spoThreshold !== undefined) || hasSpoVotes || selectedAction.spoBreakdown
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

  // Recalculate CC percentages excluding abstain votes
  // The donut should only show Yes, No, and Not Voted
  const ccTotalVotesExcludingAbstain = ccYesCount + ccNoCount + ccPendingCount;
  const ccYesPercent = ccTotalVotesExcludingAbstain > 0
    ? (ccYesCount / ccTotalVotesExcludingAbstain) * 100
    : 0;
  const ccNoPercent = ccTotalVotesExcludingAbstain > 0
    ? (ccNoCount / ccTotalVotesExcludingAbstain) * 100
    : 0;
  const ccPendingPercentRecalc = ccTotalVotesExcludingAbstain > 0
    ? (ccPendingCount / ccTotalVotesExcludingAbstain) * 100
    : 100;

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

  const handleExport = async (format: "json" | "markdown" | "csv") => {
    const sanitizedTitle = selectedAction.title
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const timestamp = new Date().toISOString().split("T")[0];
    const locale = router.locale ?? "en";

    setIsExporting(true);

    try {
      // Translate rationale content for non-English locales
      const translatedVotes = await translateVotesForExport(allVotes, locale);

      let content: string;
      let filename: string;
      let mimeType: string;

      switch (format) {
        case "json":
          content = exportToJSON(translatedVotes, selectedAction.title, exportLabels);
          filename = `voting-rationales-${sanitizedTitle}-${timestamp}.json`;
          mimeType = "application/json";
          break;
        case "markdown":
          content = exportToMarkdown(translatedVotes, selectedAction.title, exportLabels, locale);
          filename = `voting-rationales-${sanitizedTitle}-${timestamp}.md`;
          mimeType = "text/markdown";
          break;
        case "csv":
          content = exportToCSV(translatedVotes, selectedAction.title, exportLabels);
          filename = `voting-rationales-${sanitizedTitle}-${timestamp}.csv`;
          mimeType = "text/csv";
          break;
      }

      downloadFile(content, filename, mimeType);
    } finally {
      setIsExporting(false);
      setTimeout(() => setDownloadFormat(""), 100);
    }
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
                {tProposal("shareOnX")}
              </Button>
            )}
          </div>

          {/* Proposal Detail + Expiry Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-4 sm:mb-6 md:mb-8">
            {/* Proposal Detail */}
          <Card className={cn(
            "lg:col-span-2 p-3 sm:p-4 md:p-6 flex flex-col",
            isGame && "game-proposal-header-card"
          )}>
            <div className="mb-2 sm:mb-3 flex items-center gap-2 sm:gap-3">
              <h1 className="proposal-detail-title text-xl font-bold sm:text-2xl md:text-3xl lg:text-4xl">
                {titleTranslation.isTranslating ? (
                  <span className="opacity-50">{selectedAction.title}</span>
                ) : (
                  titleTranslation.displayText
                )}
              </h1>
              {titleTranslation.isTranslating && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
              )}
            </div>
            {contentPreview && (
              <div className="border-t border-border/50 pt-4 flex-1 flex flex-col">
                <div
                  className={cn(
                    "transition-all duration-500 ease-in-out [scrollbar-gutter:stable] flex-1",
                    isContentExpanded
                      ? "max-h-[60vh] overflow-y-auto"
                      : "max-h-[14rem] overflow-hidden relative"
                  )}
                >
                  <div className="pr-2">
                    <div className="overflow-x-auto">
                      <ProposalContent
                        content={contentTranslation.displayText}
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
                              const originalUri = ref.uri || ref.label || "#";
                              const href = convertIpfsToGateway(originalUri);
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
                  {/* Fade overlay when collapsed */}
                  {!isContentExpanded && contentPreview.shouldTruncate && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                  )}
                </div>
                {/* Expand/Collapse Button at bottom */}
                {contentPreview.shouldTruncate && (
                  <div className="flex justify-center items-center pt-3 mt-auto">
                    <div
                      className={cn(
                        "flex w-full items-center justify-center px-3 py-1.5 cursor-pointer transition-all duration-300",
                        isGame
                          ? "game-expand-btn rounded-lg"
                          : "rounded-lg border border-border/50 bg-card/50 hover:bg-white hover:shadow-lg hover:scale-[1.02] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:hover:bg-[#0bd1a2]/10 dark:hover:shadow-none"
                      )}
                      onClick={() => setIsContentExpanded((prev) => !prev)}
                    >
                      <svg
                        className={cn(
                          "h-4 w-4 transition-transform duration-300",
                          isContentExpanded ? "rotate-180" : "",
                          isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Time Until Expiry Card */}
          {selectedAction && (() => {
            // Calculate expiry based on epoch, not days
            // Governance actions expire at the END of the expiryEpoch
            const now = Date.now();
            const currentEpoch = getCurrentEpoch();
            const submissionEpoch = selectedAction.submissionEpoch > 0
              ? selectedAction.submissionEpoch
              : currentEpoch;

            // Get expiry epoch (default to submission + 6 epochs if not set)
            // The "Valid Until Epoch" is expiryEpoch - 1, meaning voting ends at the end of that epoch
            const expiryEpoch = selectedAction.expiryEpoch > 0
              ? selectedAction.expiryEpoch
              : submissionEpoch + 6;

            // Calculate timestamps for the start and end of the voting period
            const submissionTimestamp = epochToTimestamp(submissionEpoch);
            // Voting ends at the END of (expiryEpoch - 1), which is the START of expiryEpoch
            const expiryTimestamp = epochToTimestamp(expiryEpoch);

            // Calculate time remaining until end of voting period
            const timeRemaining = Math.max(0, expiryTimestamp - now);
            const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));

            // Calculate progress based on epochs
            const totalEpochs = expiryEpoch - submissionEpoch;
            const epochsElapsed = currentEpoch - submissionEpoch;
            const progressPercent = totalEpochs > 0
              ? Math.min(100, Math.max(0, (epochsElapsed / totalEpochs) * 100))
              : 0;

            return (
              <Card className={cn("p-6", isGame && "game-detail-card")}>
                <div className="flex items-center justify-between mb-4">
                  <label className={cn(
                    "text-sm font-semibold",
                    isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                  )}>
                    {tExpiry("timeUntilExpiry")}
                  </label>
                  <div className={cn(
                    "text-base font-semibold",
                    isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                  )}>
                    {daysRemaining > 0 ? (
                      <>
                        {daysRemaining}{" "}
                        {daysRemaining === 1 ? tExpiry("day") : tExpiry("days")}
                      </>
                    ) : (
                      <span className={isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"}>
                        {tExpiry("expired")}
                      </span>
                    )}
                  </div>
                </div>
                <Progress
                  value={progressPercent}
                  className={cn(
                    "h-3",
                    isGame
                      ? "rounded-full bg-white/20"
                      : "rounded-full bg-secondary dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:rounded-none"
                  )}
                  indicatorClassName={isGame ? "bg-white/50" : "bg-black dark:bg-[#0bd1a2]"}
                />

                {/* Proposal Info + Epoch Details */}
                <div className="mt-4 pt-3 border-t border-border/50">
                    <table className="text-xs w-full">
                      <tbody>
                        <tr className={cn(
                          "border-b",
                          isGame ? "border-white/10" : "border-border/30"
                        )}>
                          <td className={cn(
                            "py-2 pr-4",
                            isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
                          )}>
                            {tProposal("govActionType")}
                          </td>
                          <td className={cn(
                            "py-2 font-semibold whitespace-nowrap",
                            isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                          )}>
                            {selectedAction.type}
                          </td>
                        </tr>
                        <tr className={cn(
                          "border-b",
                          isGame ? "border-white/10" : "border-border/30"
                        )}>
                          <td className={cn(
                            "py-2 pr-4",
                            isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
                          )}>
                            {tProposal("status")}
                          </td>
                          <td className={cn(
                            "py-2 font-semibold whitespace-nowrap",
                            isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                          )}>
                            {selectedAction.status}
                          </td>
                        </tr>
                        <tr className={cn(
                          "border-b",
                          isGame ? "border-white/10" : "border-border/30"
                        )}>
                          <td className={cn(
                            "py-2 pr-4",
                            isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
                          )}>
                            {tProposal("constitutionality")}
                          </td>
                          <td className={cn(
                            "py-2 font-semibold whitespace-nowrap",
                            isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                          )}>
                            {isInfoAction ? (
                              <div className="flex items-center gap-1.5">
                                <span className={isGame ? "text-white/60" : "text-muted-foreground dark:text-[#0bd1a2]/60"}>
                                  {tProposal("notApplicable")}
                                </span>
                                <div className="group relative">
                                  <Info
                                    className={cn(
                                      "h-3.5 w-3.5 cursor-help",
                                      isGame ? "text-white/50" : "text-muted-foreground/60 dark:text-[#0bd1a2]/60"
                                    )}
                                  />
                                  <div className="pointer-events-none absolute right-0 top-full z-50 mt-1 hidden w-48 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md group-hover:block">
                                    {tProposal("infoActionTooltip")}
                                  </div>
                                </div>
                              </div>
                            ) : selectedAction.constitutionality ? (
                              selectedAction.status === "Active" && selectedAction.constitutionality.toLowerCase() !== "constitutional"
                                ? tProposal("pending")
                                : selectedAction.constitutionality
                            ) : null}
                          </td>
                        </tr>
                        <tr className={cn(
                          "border-b",
                          isGame ? "border-white/10" : "border-border/30"
                        )}>
                          <td className={cn(
                            "py-2 pr-4",
                            isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
                          )}>
                            {tExpiry("submissionDate")}
                          </td>
                          <td className={cn(
                            "py-2 font-semibold whitespace-nowrap",
                            isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                          )}>
                            {new Date(submittedAt ?? submissionTimestamp).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric"
                            })}
                          </td>
                        </tr>
                        <tr className={cn(
                          "border-b",
                          isGame ? "border-white/10" : "border-border/30"
                        )}>
                          <td className={cn(
                            "py-2 pr-4",
                            isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
                          )}>
                            {tExpiry("epochBoundary")}
                          </td>
                          <td className={cn(
                            "py-2 font-semibold whitespace-nowrap",
                            isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                          )}>
                            {new Date(expiryTimestamp).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric"
                            })}
                          </td>
                        </tr>
                        <tr className={cn(
                          "border-b",
                          isGame ? "border-white/10" : "border-border/30"
                        )}>
                          <td className={cn(
                            "py-2 pr-4",
                            isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
                          )}>
                            {tExpiry("submissionEpoch")}
                          </td>
                          <td className={cn(
                            "py-2 font-semibold whitespace-nowrap",
                            isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                          )}>
                            {submissionEpoch}
                          </td>
                        </tr>
                        <tr>
                          <td className={cn(
                            "py-2 pr-4",
                            isGame ? "text-white/70" : "text-muted-foreground dark:text-[#0bd1a2]/80"
                          )}>
                            {tExpiry("validUntilEpoch")}
                          </td>
                          <td className={cn(
                            "py-2 font-semibold whitespace-nowrap",
                            isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                          )}>
                            {(selectedAction.expiryEpoch > 0 ? selectedAction.expiryEpoch : submissionEpoch + 6) - 1}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
              </Card>
            );
          })()}
          </div>

          {/* Main Grid: 2/3 Left, 1/3 Right */}
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:gap-6 lg:grid-cols-3">
            {/* Left Column - Tabs for donuts, bubble map, curves, details */}
            <div className="space-y-4 sm:space-y-5 md:space-y-6 lg:col-span-2">
              <Card className={cn(
                "info-container p-3 sm:p-4 md:p-6 overflow-hidden dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none dark:rounded-none",
                isGame && "game-voting-card"
              )}>
                <Tabs
                  value={selectedTab}
                  onValueChange={setSelectedTab}
                  className="w-full"
                >
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <TabsList className="flex-1 flex-wrap justify-start gap-1.5 sm:gap-2 bg-transparent p-0 py-2 overflow-x-auto overflow-visible">
                        <TabsTrigger
                          value="live-voting"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
                              : "rounded-md border border-white/8 bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-450 ease-in-out shadow-[0_12px_30px_rgba(15,23,42,0.25)] data-[state=active]:bg-black data-[state=active]:text-white hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon"
                          }
                        >
                          {tTabs("liveVoting")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="thresholds"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
                              : "rounded-md border border-white/8 bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-450 ease-in-out shadow-[0_12px_30px_rgba(15,23,42,0.25)] data-[state=active]:bg-black data-[state=active]:text-white hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon"
                          }
                        >
                          {tTabs("thresholds")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="bubble-map"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
                              : "rounded-md border border-white/8 bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-450 ease-in-out shadow-[0_12px_30px_rgba(15,23,42,0.25)] data-[state=active]:bg-black data-[state=active]:text-white hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon"
                          }
                        >
                          {tTabs("bubbleMap")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="curves"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
                              : "rounded-md border border-white/8 bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-450 ease-in-out shadow-[0_12px_30px_rgba(15,23,42,0.25)] data-[state=active]:bg-black data-[state=active]:text-white hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon"
                          }
                        >
                          {tTabs("curves")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="details"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-[10px] sm:text-xs"
                              : "rounded-md border border-white/8 bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-450 ease-in-out shadow-[0_12px_30px_rgba(15,23,42,0.25)] data-[state=active]:bg-black data-[state=active]:text-white hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon"
                          }
                        >
                          {tTabs("details")}
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <>
                        {/* Live voting donuts */}
                        <TabsContent value="live-voting" className="mt-0">
                          {(allVotes.length > 0 || hasAggregateVotingData) ? (
                            <div className="space-y-0 sm:space-y-4">
                              {/* Mobile: horizontal donut + legend. Desktop: horizontal row with vertical stacks */}
                              <div className={cn(
                                "flex flex-col -space-y-20 sm:space-y-0 sm:flex-row sm:flex-wrap xl:flex-nowrap sm:items-start sm:justify-start",
                                isGame ? "sm:gap-2 md:gap-3" : "sm:gap-4 md:gap-6"
                              )}>
                                {/* DRep */}
                                <div className="flex flex-row items-center gap-1 sm:flex-col sm:items-center sm:gap-3 my-0">
                                  {allowDRep ? (
                                    drepInfo ? (
                                      <>
                                        <VoteProgress
                                          title={tProposal("drepVotes")}
                                          segments={drepDonutSegments ?? undefined}
                                          valueUnit="ada"
                                          className="origin-left scale-[0.5] -mr-24 sm:mr-0 sm:origin-center sm:scale-90 md:scale-100 shrink-0"
                                          fixedWidth={240}
                                          showTooltip={false}
                                          animate={false}
                                          interactive={false}
                                          showYesPercent={!!drepDonutSegments}
                                        />
                                        <RoleLegend
                                          role="DRep"
                                          segments={drepLegendSegments}
                                          unit="ADA"
                                        />
                                        <ExcludedBreakdownDisplay
                                          role="DRep"
                                          breakdown={drepExcludedBreakdown}
                                          isInfoAction={isInfoAction}
                                          isExpanded={isDrepExcludedExpanded}
                                          setIsExpanded={setIsDrepExcludedExpanded}
                                        />
                                      </>
                                    ) : (
                                      <RolePlaceholder
                                        role="DRep"
                                        message={tProposal("noOnChainData")}
                                      />
                                    )
                                  ) : (
                                    <RolePlaceholder
                                      role="DRep"
                                      message={tProposal("notEligibleForAction")}
                                      notEligible
                                    />
                                  )}
                                </div>
                                {/* Vertical divider */}
                                {isGame && <div className="hidden sm:block w-0 self-stretch border-r border-white/20 mx-4" />}
                                {/* CC */}
                                <div className="flex flex-row items-center gap-1 sm:flex-col sm:items-center sm:gap-3 my-0">
                                  {allowCC ? (
                                    <>
                                      <VoteProgress
                                        title={tProposal("ccVotes")}
                                        yesPercent={ccYesPercent}
                                        noPercent={ccNoPercent}
                                        pendingPercent={ccPendingPercentRecalc}
                                        yesValue={ccYesCount}
                                        noValue={ccNoCount}
                                        pendingValue={ccPendingCount || 1}
                                        valueUnit="count"
                                        className="origin-left scale-[0.5] -mr-24 sm:mr-0 sm:origin-center sm:scale-90 md:scale-100 shrink-0"
                                        fixedWidth={240}
                                        showTooltip={false}
                                        animate={false}
                                        interactive={false}
                                        showYesPercent
                                      />
                                      <RoleLegend
                                        role="CC"
                                        yesLabel={`${ccYesCount}`}
                                        noLabel={`${ccNoCount}`}
                                        pendingLabel={ccInfo ? `${ccPendingCount}` : "100%"}
                                        unit="votes"
                                      />
                                      <ExcludedBreakdownDisplay
                                        role="CC"
                                        breakdown={{
                                          abstain: ccAbstainStats.count ?? 0,
                                        }}
                                        isInfoAction={isInfoAction}
                                        isExpanded={isCcExcludedExpanded}
                                        setIsExpanded={setIsCcExcludedExpanded}
                                      />
                                    </>
                                  ) : (
                                    <RolePlaceholder
                                      role="CC"
                                      message={tProposal("notEligibleForAction")}
                                      notEligible
                                    />
                                  )}
                                </div>
                                {/* Vertical divider */}
                                {isGame && <div className="hidden sm:block w-0 self-stretch border-r border-white/20 mx-4" />}
                                {/* SPO */}
                                <div className="flex flex-row items-center gap-1 sm:flex-col sm:items-center sm:gap-3 my-0">
                                  {allowSPO ? (
                                    spoInfo ? (
                                      <>
                                        <VoteProgress
                                          title={tProposal("spoVotes")}
                                          segments={spoDonutSegments ?? undefined}
                                          valueUnit="ada"
                                          className="origin-left scale-[0.5] -mr-24 sm:mr-0 sm:origin-center sm:scale-90 md:scale-100 shrink-0"
                                          fixedWidth={240}
                                          showTooltip={false}
                                          animate={false}
                                          interactive={false}
                                          showYesPercent={!!spoDonutSegments}
                                        />
                                        <RoleLegend
                                          role="SPO"
                                          segments={spoLegendSegments}
                                          unit="ADA"
                                        />
                                        <ExcludedBreakdownDisplay
                                          role="SPO"
                                          breakdown={spoExcludedBreakdown}
                                          isInfoAction={isInfoAction}
                                          isExpanded={isSpoExcludedExpanded}
                                          setIsExpanded={setIsSpoExcludedExpanded}
                                        />
                                      </>
                                    ) : (
                                      <RolePlaceholder
                                        role="SPO"
                                        message={tProposal("noOnChainData")}
                                      />
                                    )
                                  ) : (
                                    <RolePlaceholder
                                      role="SPO"
                                      message={tProposal("notEligibleForAction")}
                                      notEligible
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                              {tProposal("noVotingActivity")}
                            </div>
                          )}
                        </TabsContent>

                        {/* Bubble map */}
                        <TabsContent value="bubble-map" className="mt-0">
                          {allVotes.length > 0 ? (
                            <BubbleMap votes={allVotes} />
                          ) : (
                            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                              {tProposal("noVotingActivity")}
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
                                <h3 className={cn("text-lg font-semibold", isGame && "text-white")}>{tProposal("votingTrend")}</h3>
                                <p className={cn("text-sm", isGame ? "text-white/70" : "text-muted-foreground")}>
                                  {shouldShowPower
                                    ? tProposal("cumulativePower")
                                    : tProposal("cumulativeVotes")}{" "}
                                  · {" "}
                                  {curveRoleFilter === "All"
                                    ? tVoting("allRoles")
                                    : tProposal("roleOnly", { role: curveRoleFilter })}
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
                                        {role === "All" ? tVoting("allRoles") : role}
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
                                      right: 40,
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
                                      tickFormatter={(value) => {
                                        // Extract displayLabel from the data point
                                        const dataPoint = voteTimelineData.find(d => d.label === value);
                                        return dataPoint?.displayLabel || value;
                                      }}
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
                                    <Legend
                                      iconType="square"
                                    />
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
                                          name={tProposal("yesPower")}
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
                                          name={tProposal("noPower")}
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
                                          name={tProposal("abstainPower")}
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
                                          name={tProposal("yesVotes")}
                                          yAxisId="primary"
                                        />
                                        <Line
                                          type="monotone"
                                          dataKey="noCount"
                                          stroke={voteColors.no}
                                          strokeWidth={2}
                                          dot={false}
                                          name={tProposal("noVotes")}
                                          yAxisId="primary"
                                        />
                                        <Line
                                          type="monotone"
                                          dataKey="abstainCount"
                                          stroke={voteColors.abstain}
                                          strokeOpacity={0.9}
                                          strokeWidth={2}
                                          dot={false}
                                          name={tProposal("abstainVotes")}
                                          yAxisId="primary"
                                        />
                                      </>
                                    )}
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                                {tProposal("notEnoughData")}
                              </div>
                            )}
                          </Card>
                        </TabsContent>

                        {/* Details */}
                        <TabsContent value="details" className="mt-0">
                          <div className="space-y-4">
                            {/* Voting Participation Metrics */}
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
                                {tProposal("votingParticipation")}
                              </label>
                              <div className={cn(
                                "overflow-hidden",
                                isGame
                                  ? "rounded border border-white/30"
                                  : "rounded-lg border border-border/50 dark:border-[#0bd1a2]/50"
                              )}>
                                <table className="w-full">
                                  <tbody>
                                    {(() => {
                                      const votes = selectedAction.votes || [];
                                      const ccVotes = selectedAction.ccVotes || [];

                                      const drepVotes = votes.filter(v => v.voterType === "DRep" || (!v.voterType && v.drepId));
                                      const spoVotes = votes.filter(v => v.voterType === "SPO");

                                      const eligibleRoles = getEligibleRoles(selectedAction.type, selectedAction.threshold, actionVoteData);

                                      return (
                                        <>
                                          {eligibleRoles.includes("DRep") && (
                                            <tr className={cn(
                                              "border-b last:border-b-0",
                                              isGame
                                                ? "border-white/30"
                                                : "border-border/50 dark:border-[#0bd1a2]/50"
                                            )}>
                                              <td className={cn(
                                                "px-3 py-2.5 text-sm",
                                                isGame ? "text-white/80" : "text-muted-foreground dark:text-[#0bd1a2]/80"
                                              )}>
                                                {tVoting("dreps")}
                                              </td>
                                              <td className={cn(
                                                "px-3 py-2.5 text-sm font-semibold text-right",
                                                isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                                              )}>
                                                {drepVotes.length.toLocaleString()} {tProposal("voted")}
                                              </td>
                                            </tr>
                                          )}
                                          {eligibleRoles.includes("SPO") && (
                                            <tr className={cn(
                                              "border-b last:border-b-0",
                                              isGame
                                                ? "border-white/30"
                                                : "border-border/50 dark:border-[#0bd1a2]/50"
                                            )}>
                                              <td className={cn(
                                                "px-3 py-2.5 text-sm",
                                                isGame ? "text-white/80" : "text-muted-foreground dark:text-[#0bd1a2]/80"
                                              )}>
                                                {tVoting("spos")}
                                              </td>
                                              <td className={cn(
                                                "px-3 py-2.5 text-sm font-semibold text-right",
                                                isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                                              )}>
                                                {spoVotes.length.toLocaleString()} {tProposal("voted")}
                                              </td>
                                            </tr>
                                          )}
                                          {eligibleRoles.includes("CC") && (
                                            <tr className="last:border-b-0">
                                              <td className={cn(
                                                "px-3 py-2.5 text-sm",
                                                isGame ? "text-white/80" : "text-muted-foreground dark:text-[#0bd1a2]/80"
                                              )}>
                                                {tProposal("ccMembers")}
                                              </td>
                                              <td className={cn(
                                                "px-3 py-2.5 text-sm font-semibold text-right",
                                                isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                                              )}>
                                                {ccVotes.length.toLocaleString()} {tProposal("voted")}
                                              </td>
                                            </tr>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </tbody>
                                </table>
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
                                {tProposal("governanceActionId")}
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
                                {tProposal("legacyGovActionId")}
                              </label>
                              <div className="flex items-start gap-2">
                                <code className={cn(
                                  "flex-1 break-all px-2 py-1 font-mono text-xs sm:px-3 sm:text-sm",
                                  isGame
                                    ? "rounded bg-white/10 text-white/80"
                                    : "rounded bg-secondary text-muted-foreground dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                                )}>
                                  {selectedAction.hash?.replace(/:/g, '#')}
                                </code>
                                <button
                                  onClick={() =>
                                    handleCopy(
                                      selectedAction.hash?.replace(/:/g, '#') || "",
                                      "hash"
                                    )
                                  }
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center transition-colors",
                                    isGame
                                      ? "game-nav-btn !p-0 !min-w-0 !min-h-0"
                                      : "rounded-full bg-white text-black hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2] dark:hover:text-black dark:shadow-none"
                                  )}
                                  aria-label="Copy Legacy Governance Action ID"
                                >
                                  {copiedId === "hash" ? (
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
                                {tProposal("transactionHash")}
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

                        {/* Thresholds */}
                        <TabsContent value="thresholds" className="mt-0">
                          <div className={cn(
                            "p-4 sm:p-5 space-y-6",
                            isGame
                              ? "game-detail-card"
                              : "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
                          )}>
                            {/* Total Voting Power Section */}
                            <div className="space-y-3">
                              <h4 className={cn(
                                "text-sm font-semibold",
                                isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                              )}>
                                {tProposal("totalVotingPower")}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* DRep Total */}
                                {selectedAction.threshold?.drepThreshold !== null && selectedAction.threshold?.drepThreshold !== undefined && (
                                  <div className={cn(
                                    "p-3 rounded-lg",
                                    isGame ? "bg-white/10" : "bg-gray-100 dark:bg-gray-800"
                                  )}>
                                    <div className={cn(
                                      "text-xs",
                                      isGame ? "text-white/60" : "text-muted-foreground"
                                    )}>
                                      {tVoting("dreps")}
                                    </div>
                                    <div className={cn(
                                      "text-lg font-semibold",
                                      isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                                    )}>
                                      {selectedAction.rawVotingPowerValues?.drep_total_vote_power
                                        ? formatAdaValue(Number(selectedAction.rawVotingPowerValues.drep_total_vote_power) / 1_000_000)
                                        : "N/A"}
                                    </div>
                                  </div>
                                )}
                                {/* SPO Total */}
                                {((selectedAction.threshold?.spoThreshold !== null && selectedAction.threshold?.spoThreshold !== undefined) || hasSpoVotes) && (
                                  <div className={cn(
                                    "p-3 rounded-lg",
                                    isGame ? "bg-white/10" : "bg-gray-100 dark:bg-gray-800"
                                  )}>
                                    <div className={cn(
                                      "text-xs",
                                      isGame ? "text-white/60" : "text-muted-foreground"
                                    )}>
                                      {tVoting("spos")}
                                    </div>
                                    <div className={cn(
                                      "text-lg font-semibold",
                                      isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                                    )}>
                                      {selectedAction.rawVotingPowerValues?.spo_total_vote_power
                                        ? formatAdaValue(Number(selectedAction.rawVotingPowerValues.spo_total_vote_power) / 1_000_000)
                                        : "N/A"}
                                    </div>
                                  </div>
                                )}
                                {/* CC Total */}
                                {selectedAction.threshold?.ccThreshold !== null && selectedAction.threshold?.ccThreshold !== undefined && (() => {
                                  // CC total members: use sum of votes if available, otherwise default to 7
                                  const ccTotalMembers = (ccYesCount + ccNoCount + ccPendingCount) || 7;
                                  return (
                                    <div className={cn(
                                      "p-3 rounded-lg",
                                      isGame ? "bg-white/10" : "bg-gray-100 dark:bg-gray-800"
                                    )}>
                                      <div className={cn(
                                        "text-xs",
                                        isGame ? "text-white/60" : "text-muted-foreground"
                                      )}>
                                        {tProposal("ccMembers")}
                                      </div>
                                      <div className={cn(
                                        "text-lg font-semibold",
                                        isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                                      )}>
                                        {tProposal("members", { count: ccTotalMembers })}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Threshold Progress Section */}
                            <div className="space-y-4">
                              <h4 className={cn(
                                "text-sm font-semibold",
                                isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                              )}>
                                {tProposal("approvalProgress")}
                              </h4>

                              {/* DRep Threshold */}
                              {selectedAction.threshold?.drepThreshold !== null && selectedAction.threshold?.drepThreshold !== undefined && (() => {
                                const thresholdPercent = selectedAction.threshold.drepThreshold * 100;
                                // Use calculated percentage from breakdown segments
                                const currentPercent = drepDonutSegments?.find(s => s.type === "yes")?.percent ?? selectedAction.drepYesPercent ?? 0;

                                return (
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className={cn(
                                        "text-sm font-medium",
                                        isGame ? "text-white" : "text-foreground"
                                      )}>
                                        {tVoting("dreps")}
                                      </span>
                                      <span className={cn(
                                        "text-sm",
                                        isGame ? "text-white/70" : "text-muted-foreground"
                                      )}>
                                        {currentPercent.toFixed(1)}% / {thresholdPercent.toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="relative">
                                      <Progress
                                        value={Math.min(currentPercent, 100)}
                                        className={cn(
                                          "h-3",
                                          isGame ? "bg-white/20" : "bg-gray-200 dark:bg-gray-700"
                                        )}
                                        indicatorClassName={
                                          isGame
                                            ? "bg-gray-400"
                                            : "bg-black dark:bg-[#0bd1a2]"
                                        }
                                      />
                                      {/* Threshold marker */}
                                      <div
                                        className="absolute top-0 h-3 w-0.5 bg-black dark:bg-white"
                                        style={{ left: `${thresholdPercent}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* SPO Threshold */}
                              {((selectedAction.threshold?.spoThreshold !== null && selectedAction.threshold?.spoThreshold !== undefined) || hasSpoVotes) && (() => {
                                // Use 51% as default for security-critical parameter changes when SPOs can vote
                                const thresholdPercent = selectedAction.threshold?.spoThreshold != null
                                  ? selectedAction.threshold.spoThreshold * 100
                                  : 51; // Default SPO threshold for security-critical changes
                                // Use calculated percentage from breakdown segments
                                const currentPercent = spoDonutSegments?.find(s => s.type === "yes")?.percent ?? selectedAction.spoYesPercent ?? 0;

                                return (
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className={cn(
                                        "text-sm font-medium",
                                        isGame ? "text-white" : "text-foreground"
                                      )}>
                                        {tVoting("spos")}
                                      </span>
                                      <span className={cn(
                                        "text-sm",
                                        isGame ? "text-white/70" : "text-muted-foreground"
                                      )}>
                                        {currentPercent.toFixed(1)}% / {thresholdPercent.toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="relative">
                                      <Progress
                                        value={Math.min(currentPercent, 100)}
                                        className={cn(
                                          "h-3",
                                          isGame ? "bg-white/20" : "bg-gray-200 dark:bg-gray-700"
                                        )}
                                        indicatorClassName={
                                          isGame
                                            ? "bg-gray-400"
                                            : "bg-black dark:bg-[#0bd1a2]"
                                        }
                                      />
                                      {/* Threshold marker */}
                                      <div
                                        className="absolute top-0 h-3 w-0.5 bg-black dark:bg-white"
                                        style={{ left: `${thresholdPercent}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* CC Threshold */}
                              {selectedAction.threshold?.ccThreshold !== null && selectedAction.threshold?.ccThreshold !== undefined && (() => {
                                // Calculate CC progress: yes count / total members (default to 7 if no data)
                                const totalMembers = (ccYesCount + ccNoCount + ccPendingCount) || 7;
                                const currentPercent = (ccYesCount / totalMembers) * 100;
                                const thresholdPercent = selectedAction.threshold.ccThreshold * 100;

                                return (
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className={cn(
                                        "text-sm font-medium",
                                        isGame ? "text-white" : "text-foreground"
                                      )}>
                                        {tVoting("ccFull")}
                                      </span>
                                      <span className={cn(
                                        "text-sm",
                                        isGame ? "text-white/70" : "text-muted-foreground"
                                      )}>
                                        {currentPercent.toFixed(1)}% / {thresholdPercent.toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="relative">
                                      <Progress
                                        value={Math.min(currentPercent, 100)}
                                        className={cn(
                                          "h-3",
                                          isGame ? "bg-white/20" : "bg-gray-200 dark:bg-gray-700"
                                        )}
                                        indicatorClassName={
                                          isGame
                                            ? "bg-gray-400"
                                            : "bg-black dark:bg-[#0bd1a2]"
                                        }
                                      />
                                      {/* Threshold marker */}
                                      <div
                                        className="absolute top-0 h-3 w-0.5 bg-black dark:bg-white"
                                        style={{ left: `${thresholdPercent}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* No thresholds available message */}
                            {selectedAction.threshold?.drepThreshold === null &&
                             selectedAction.threshold?.spoThreshold === null &&
                             selectedAction.threshold?.ccThreshold === null && (
                              <p className={cn(
                                "text-sm",
                                isGame ? "text-white/70" : "text-muted-foreground"
                              )}>
                                {tProposal("noThresholdData")}
                              </p>
                            )}
                          </div>
                        </TabsContent>
                      </>
                  </div>
                </Tabs>
              </Card>

            </div>

            {/* Right Column - Sidebar (voting summary) */}
            <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              {/* Voting Trend Chart */}
              {voteTimelineData.length > 0 && (
                <Card className={cn("p-6", isGame && "game-detail-card")}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={cn("text-sm font-semibold", isGame && "text-white")}>{tProposal("votingTrend")}</h3>
                    {curveRoleOptions.length > 1 && (
                      isGame ? (
                        <GameDropdown
                          value={curveRoleFilter}
                          onValueChange={(value) => setCurveRoleFilter(value as RoleFilter)}
                          options={curveRoleOptions.map((role) => ({
                            value: role,
                            label: role === "All" ? "All Roles" : role,
                          }))}
                          className="w-[120px]"
                        />
                      ) : (
                        <Select
                          value={curveRoleFilter}
                          onValueChange={(value: string) => setCurveRoleFilter(value as RoleFilter)}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                            {curveRoleOptions.map((role) => (
                              <SelectItem
                                key={role}
                                value={role}
                                className="text-xs cursor-pointer dark:focus:bg-[#0bd1a2]/20 dark:focus:text-[#0bd1a2]"
                              >
                                {role === "All" ? tVoting("allRoles") : role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    )}
                  </div>
                  <div className="h-[200px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <LineChart
                        data={voteTimelineData}
                        margin={{ top: 5, right: 30, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          minTickGap={30}
                          tickFormatter={(value) => {
                            // Extract displayLabel from the data point
                            const dataPoint = voteTimelineData.find(d => d.label === value);
                            return dataPoint?.displayLabel || value;
                          }}
                        />
                        <YAxis
                          yAxisId="primary"
                          allowDecimals={false}
                          tick={{ fontSize: 10 }}
                          tickFormatter={
                            shouldShowPower
                              ? (value) => formatAdaValue(value).replace(" ₳", "")
                              : undefined
                          }
                        />
                        <RechartsTooltip content={renderVoteTrendTooltip} />
                        {shouldShowPower ? (
                          <>
                            <Line
                              type="monotone"
                              dataKey="yesPower"
                              stroke={voteColors.yes}
                              strokeWidth={2}
                              dot={false}
                              yAxisId="primary"
                            />
                            <Line
                              type="monotone"
                              dataKey="noPower"
                              stroke={voteColors.no}
                              strokeWidth={2}
                              dot={false}
                              yAxisId="primary"
                            />
                            <Line
                              type="monotone"
                              dataKey="abstainPower"
                              stroke={voteColors.abstain}
                              strokeOpacity={0.9}
                              strokeWidth={2}
                              dot={false}
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
                              yAxisId="primary"
                            />
                            <Line
                              type="monotone"
                              dataKey="noCount"
                              stroke={voteColors.no}
                              strokeWidth={2}
                              dot={false}
                              yAxisId="primary"
                            />
                            <Line
                              type="monotone"
                              dataKey="abstainCount"
                              stroke={voteColors.abstain}
                              strokeOpacity={0.9}
                              strokeWidth={2}
                              dot={false}
                              yAxisId="primary"
                            />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              {/* Cast Your Vote Card */}
              {selectedAction && voteTxHash && (
                <LazyVoteOnProposal
                  txHash={voteTxHash}
                  certIndex={voteCertIndex}
                  proposalTitle={selectedAction.title}
                  status={selectedAction.status}
                  proposalId={selectedAction.proposalId || selectedAction.hash}
                />
              )}

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
                isExporting={isExporting}
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
  showPower,
  colors,
  isGame,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: unknown;
    [key: string]: unknown;
  }>;
  showPower: boolean;
  colors: VoteColorSet;
  isGame: boolean;
}) {
  const tVoting = useTranslations("voting");
  const tProposal = useTranslations("proposal");

  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload as TimelinePoint | undefined;
  if (!point) {
    return null;
  }

  const rows = [
    {
      label: tVoting("yes"),
      value: showPower
        ? formatAdaValue(point.yesPower)
        : `${point.yesCount.toLocaleString()} ${tProposal("votes")}`,
        color: colors.yes,
      border: "transparent",
    },
    {
      label: tVoting("no"),
      value: showPower
        ? formatAdaValue(point.noPower)
        : `${point.noCount.toLocaleString()} ${tProposal("votes")}`,
        color: colors.no,
      border: "transparent",
    },
    {
      label: tVoting("abstain"),
      value: showPower
        ? formatAdaValue(point.abstainPower)
        : `${point.abstainCount.toLocaleString()} ${tProposal("votes")}`,
        color: colors.abstain,
      border: "rgba(148, 163, 184, 0.85)",
    },
  ];

  return (
    <div className={cn(
      "rounded-md bg-background/95 px-3 py-2 text-xs shadow-md",
      !isGame && "border"
    )}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {point.displayLabel}
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
  const tVoting = useTranslations("voting");
  const tProposal = useTranslations("proposal");

  // Translate segment type to localized label
  const segmentLabel = (type: string, fallback: string) => {
    const map: Record<string, string> = {
      yes: tVoting("yes"),
      no: tVoting("no"),
      abstain: tVoting("abstain"),
      notVoted: tVoting("notVoted"),
      alwaysNoConfidence: "ANC",
    };
    return map[type] ?? fallback;
  };

  // Use segments when provided (DRep/SPO), otherwise use legacy props (CC)
  const items = segments && segments.length > 0
    ? segments.map((seg) => ({
        label: segmentLabel(seg.type, seg.label),
        type: seg.type,
        value: formatAdaValue(seg.value),
        // For ANC with black color, don't apply opacity to keep it black
        color: seg.type === "alwaysNoConfidence" && seg.color === "#000000"
          ? seg.color
          : `${seg.color}73`, // Apply 45% opacity to match donut inactive state
        border: seg.type === "abstain" || seg.type === "notVoted" || seg.type === "excluded" || seg.type === "alwaysNoConfidence"
          ? "rgba(148, 163, 184, 0.85)"
          : "transparent",
      }))
    : [
        // CC legacy fallback - uses SEGMENT_COLORS with 45% opacity
        {
          label: tVoting("yes"),
          type: "yes",
          value: yesLabel ?? "0",
          color: `${SEGMENT_COLORS.yes}73`,
          border: "transparent",
        },
        {
          label: tVoting("no"),
          type: "no",
          value: noLabel ?? "0",
          color: `${SEGMENT_COLORS.no}73`,
          border: "transparent",
        },
        {
          label: tVoting("notVoted"),
          type: "notVoted",
          value: pendingLabel ?? (unit === "ADA" ? "0 ₳" : `0 ${tProposal("votes")}`),
          color: `${SEGMENT_COLORS.notVoted}73`,
          border: "rgba(148, 163, 184, 0.85)",
        },
      ];

  return (
    <div className={cn(
      "w-full max-w-none px-2 py-0 text-[10px] sm:text-xs",
      isGame
        ? "sm:w-[180px] border-none bg-transparent"
        : "sm:w-[240px] sm:px-3 sm:py-2 rounded-xl border border-border/60 bg-card/40 shadow-sm dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
    )}>
      <div className={cn(
        "mb-0.5 sm:mb-2 flex items-center justify-between text-[10px] sm:text-[11px] uppercase tracking-wide",
        isGame ? "text-white" : "text-muted-foreground dark:text-[#0bd1a2]"
      )}>
        <span className={cn("font-semibold", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>{role}</span>
        <span className={isGame ? "text-white" : "dark:text-[#0bd1a2]"}>{unit}</span>
      </div>
      <div className={cn("space-y-1.5", isGame && "space-y-1")}>
        {items.map((item) => (
          <div
            key={item.label}
            className={cn(
              "flex items-start justify-between",
              isGame ? "gap-1" : "gap-2"
            )}
          >
            <div className={cn(
              "flex items-start min-w-0 flex-1",
              isGame ? "gap-1.5" : "gap-2"
            )}>
              <span
                className="h-2.5 w-2.5 border shrink-0 mt-0.5"
                style={{
                  backgroundColor: item.color,
                  borderColor: item.border,
                }}
              />
              <div className="flex items-center gap-1">
                <span className={cn(
                  "font-semibold leading-tight",
                  isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                )}>
                  {item.label}
                </span>
                {item.type === "alwaysNoConfidence" && (
                  <div className="group relative inline-block">
                    <Info className={cn(
                      "h-3 w-3 cursor-help",
                      isGame ? "text-white/60" : "text-muted-foreground dark:text-[#0bd1a2]/60"
                    )} />
                    <div className={cn(
                      "absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-max max-w-[200px] rounded px-2 py-1 text-[10px] shadow-lg",
                      isGame
                        ? "bg-black/90 text-white border border-white/20"
                        : "bg-popover text-popover-foreground border border-border"
                    )}>
                      {tProposal("alwaysNoConfidence")}
                    </div>
                  </div>
                )}
              </div>
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
  isExpanded,
  setIsExpanded,
}: {
  role: "DRep" | "SPO" | "CC";
  breakdown: ExcludedBreakdown | { abstain: number } | null;
  isInfoAction?: boolean;
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
}) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const tVoting = useTranslations("voting");
  const tProposal = useTranslations("proposal");

  if (!breakdown) return null;

  // CC uses simple abstain count, DRep/SPO use full breakdown
  const isCC = role === "CC";
  const ccAbstain = isCC && "abstain" in breakdown ? breakdown.abstain : 0;
  const fullBreakdown = !isCC && "total" in breakdown ? breakdown : null;

  // For CC: always show the excluded section (even if 0)
  // For DRep/SPO: only show if there's actual excluded data
  if (!isCC && (!fullBreakdown || fullBreakdown.total === 0)) return null;

  const items = isCC
    ? [{ label: tVoting("abstain"), value: ccAbstain }]
    : [
        { label: tProposal("activeAbstain"), value: fullBreakdown!.activeAbstain },
        { label: tProposal("alwaysAbstain"), value: fullBreakdown!.alwaysAbstain },
        ...(fullBreakdown!.inactive !== undefined && role === "DRep"
          ? [{ label: tProposal("inactive"), value: fullBreakdown!.inactive }]
          : []),
      ];

  const totalValue = isCC ? ccAbstain : fullBreakdown!.total;

  return (
    <div className={cn(
      "hidden sm:block w-full max-w-[200px] sm:max-w-none text-xs mt-1 sm:mt-2",
      isGame
        ? "sm:w-[180px] border-none bg-transparent"
        : "sm:w-[240px] rounded-xl border border-dashed border-border/40 bg-card/20 dark:rounded-none dark:border-[#0bd1a2]/50 dark:bg-transparent"
    )}>
      {/* Header with total - always visible */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 cursor-pointer",
          isGame ? "text-white/60" : "text-muted-foreground/70 dark:text-[#0bd1a2]/70"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-[10px] uppercase tracking-wide">
          {isInfoAction ? tProposal("excluded") : tProposal("excludedFromRatification")}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-mono text-[10px]",
            isGame ? "text-white/60" : "text-muted-foreground/80 dark:text-[#0bd1a2]/70"
          )}>
            {isCC ? `${totalValue}` : formatAdaValue(totalValue)}
          </span>
          <svg
            className={cn(
              "h-3 w-3 transition-transform duration-300",
              isExpanded ? "rotate-180" : "",
              isGame ? "text-white/60" : "text-foreground dark:text-[#0bd1a2]"
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expandable breakdown details */}
      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out",
        isExpanded ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className={cn(
          "px-3 pb-2 border-t",
          isGame ? "border-white/10" : "border-border/20 dark:border-[#0bd1a2]/20",
          isGame && "space-y-0.5",
          !isGame && "space-y-1"
        )}>
          <div className="h-2" /> {/* Spacer */}
          {items.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center justify-between",
                isGame ? "gap-1" : "gap-3"
              )}
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
                {isCC ? `${item.value}` : formatAdaValue(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RolePlaceholder({ role, message, notEligible }: { role: string; message: string; notEligible?: boolean }) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const tVoting = useTranslations("voting");

  if (notEligible) {
    // Show empty donut with single gray slice and legend showing "Not eligible"
    return (
      <>
        <VoteProgress
          title={`${role} ${tVoting("notEligible")}`}
          titlePosition="top"
          centerText={tVoting("notEligible")}
          yesPercent={0}
          noPercent={0}
          abstainPercent={0}
          pendingPercent={100}
          pendingValue={1}
          className="origin-left scale-[0.5] -mr-24 sm:mr-0 sm:origin-center sm:scale-90 md:scale-100 shrink-0"
          fixedWidth={240}
          showTooltip={false}
          animate={false}
          interactive={false}
        />
        <div className={cn(
          "w-[240px] px-3 py-2 text-xs",
          isGame
            ? "border-none bg-transparent"
            : "rounded-xl border border-border/60 bg-card/40 shadow-sm dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
        )}>
          <div className={cn(
            "mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide",
            isGame ? "text-white" : "text-muted-foreground dark:text-[#0bd1a2]"
          )}>
            <span className={cn("font-semibold", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>{role}</span>
          </div>
          <div className="space-y-1.5">
            {([
              { label: tVoting("yes"), colorKey: "yes" as keyof typeof SEGMENT_COLORS, hasBorder: false },
              { label: tVoting("no"), colorKey: "no" as keyof typeof SEGMENT_COLORS, hasBorder: false },
              { label: tVoting("abstain"), colorKey: "abstain" as keyof typeof SEGMENT_COLORS, hasBorder: true },
              { label: tVoting("notVoted"), colorKey: "notVoted" as keyof typeof SEGMENT_COLORS, hasBorder: true },
            ]).map((item) => (
              <div
                key={item.colorKey}
                className="flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span
                    className="h-2.5 w-2.5 border shrink-0 mt-0.5"
                    style={{
                      backgroundColor: `${SEGMENT_COLORS[item.colorKey] || SEGMENT_COLORS.excluded}73`,
                      borderColor: item.hasBorder ? "rgba(148, 163, 184, 0.85)" : "transparent",
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
                  "font-mono text-[11px] shrink-0 text-right italic",
                  isGame ? "text-white/60" : "text-muted-foreground/60 dark:text-[#0bd1a2]/60"
                )}>
                  {tVoting("notEligible")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  // Default placeholder for "No on-chain data yet"
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

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps = async ({ params, locale }) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;
  const hash = typeof params?.hash === "string" ? params.hash : null;

  let initialDetail: GovernanceActionDetail | null = null;
  if (hash) {
    const { fetchGovernanceActionDetailServer } = await import("@/lib/serverFetch");
    initialDetail = await fetchGovernanceActionDetailServer(hash);
  }

  return {
    props: {
      messages,
      initialDetail,
    },
    revalidate: hash && !initialDetail ? 10 : 60,
  };
};
