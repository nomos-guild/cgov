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
import { VoteOnProposal } from "@/components/governance";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadGovernanceActionDetail } from "@/store/governanceSlice";
import { ArrowLeft, Twitter, Copy, Check } from "lucide-react";
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
import { parseNumeric, deriveAbstainValue } from "@/lib/voteMath";
import { ProposalContent } from "@/components/ProposalContent";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

/**
 * Parse proposal hash (txHash:certIndex format) into separate components
 * The API returns hash in format "txHash:certIndex"
 */
function parseProposalHash(hash: string): {
  txHash: string;
  certIndex: number;
} | null {
  if (!hash) return null;

  // Handle txHash:certIndex format (API format)
  if (hash.includes(":")) {
    const [txHash, certIndexStr] = hash.split(":");
    const certIndex = parseInt(certIndexStr, 10);
    if (txHash && !isNaN(certIndex)) {
      return { txHash, certIndex };
    }
  }

  // Handle txHash#certIndex format (alternative format)
  if (hash.includes("#")) {
    const [txHash, certIndexStr] = hash.split("#");
    const certIndex = parseInt(certIndexStr, 10);
    if (txHash && !isNaN(certIndex)) {
      return { txHash, certIndex };
    }
  }

  return null;
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
};

const VOTE_COLORS_DARK = {
  yes: "#0B8C30",
  no: "#8C200B",
  abstain: "#ffffff",
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
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const voteColors = useMemo(
    () => (isDark ? VOTE_COLORS_DARK : VOTE_COLORS_LIGHT),
    [isDark]
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

  const drepAbstainStats = useMemo(() => {
    const drepVotes = allVotes.filter((v) => v.voterType === "DRep");
    const totalPower = drepVotes.reduce(
      (sum, v) => sum + (v.votingPowerAda || 0),
      0
    );

    // Prefer actual vote data when available
    if (totalPower > 0) {
      const abstainPower = drepVotes
        .filter((v) => v.vote === "Abstain")
        .reduce((sum, v) => sum + (v.votingPowerAda || 0), 0);

      if (abstainPower > 0) {
        return {
          percent: (abstainPower / totalPower) * 100,
          power: abstainPower,
        };
      }
    }

    // Fallback to aggregated tallies from selectedAction
    const percent = selectedAction?.drepAbstainPercent ?? 0;
    const yesAda = parseNumeric(selectedAction?.drepYesAda);
    const noAda = parseNumeric(selectedAction?.drepNoAda);
    const derivedPower =
      deriveAbstainValue(
        yesAda,
        selectedAction?.drepYesPercent,
        noAda,
        selectedAction?.drepNoPercent,
        percent
      ) ?? 0;

    return { percent, power: derivedPower };
  }, [allVotes, selectedAction]);

  const spoAbstainStats = useMemo(() => {
    const spoVotes = allVotes.filter((v) => v.voterType === "SPO");
    const totalPower = spoVotes.reduce(
      (sum, v) => sum + (v.votingPowerAda || 0),
      0
    );

    // Prefer actual vote data when available
    if (totalPower > 0) {
      const abstainPower = spoVotes
        .filter((v) => v.vote === "Abstain")
        .reduce((sum, v) => sum + (v.votingPowerAda || 0), 0);

      if (abstainPower > 0) {
        return {
          percent: (abstainPower / totalPower) * 100,
          power: abstainPower,
        };
      }
    }

    // Fallback to aggregated tallies from selectedAction
    const percent = selectedAction?.spoAbstainPercent ?? 0;
    const yesAda = parseNumeric(selectedAction?.spoYesAda);
    const noAda = parseNumeric(selectedAction?.spoNoAda);
    const derivedPower =
      deriveAbstainValue(
        yesAda,
        selectedAction?.spoYesPercent,
        noAda,
        selectedAction?.spoNoPercent,
        percent
      ) ?? 0;

    return { percent, power: derivedPower };
  }, [allVotes, selectedAction]);

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

  // Parse proposal hash outside JSX to avoid IIFE causing component remount
  const parsedProposalHash = selectedAction?.hash
    ? parseProposalHash(selectedAction.hash)
    : null;

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
            <Button variant="default" className="mb-6 bg-white text-black hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
              <p className="text-muted-foreground">
                Loading governance action...
              </p>
            </div>
          </Card>
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

  const drepYesAda = parseNumeric(drepInfo?.yesAda);
  const drepNoAda = parseNumeric(drepInfo?.noAda);
  const spoYesAda = parseNumeric(spoInfo?.yesAda);
  const spoNoAda = parseNumeric(spoInfo?.noAda);
  const ccYesCount = ccAbstainStats.yesCount ?? ccInfo?.yesCount ?? 0;
  const ccNoCount = ccAbstainStats.noCount ?? ccInfo?.noCount ?? 0;

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
          className={`container mx-auto px-4 py-8 transition-opacity duration-300 sm:px-6 sm:py-8 ${contentVisible ? "opacity-100" : "opacity-0"}`}
        >
          {/* Top actions */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Link href="/">
              <Button
                variant="default"
                className="bg-white text-black shadow-[0_12px_30px_rgba(15,23,42,0.25)] h-10 px-4 transform-gpu transition-transform transition-shadow duration-450 ease-in-out hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] hover:bg-white hover:text-black btn-neon"
              >
                Back to Dashboard
              </Button>
            </Link>
            {contentPreview?.shouldTruncate && (
              <Button
                variant="default"
                className="bg-white text-black shadow-[0_12px_30px_rgba(15,23,42,0.25)] h-10 px-4 transform-gpu transition-transform transition-shadow duration-450 ease-in-out hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] hover:bg-white hover:text-black btn-neon"
                onClick={() => setIsContentExpanded((prev) => !prev)}
              >
                {isContentExpanded ? "Hide Proposal" : "Read Proposal"}
              </Button>
            )}
            {allVotes.length > 0 && (
              <Button
                variant="default"
                className="bg-white text-black shadow-[0_12px_30px_rgba(15,23,42,0.25)] h-10 px-4 flex items-center gap-2 transform-gpu transition-transform transition-shadow duration-450 ease-in-out hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] hover:bg-white hover:text-black btn-neon"
                onClick={handleTwitterShare}
              >
                <Twitter className="h-4 w-4" />
                <span className="hidden sm:inline">Share on X</span>
                <span className="sm:hidden">Share</span>
              </Button>
            )}
          </div>

          {/* Header Section */}
          <Card className="mb-8 p-4 sm:p-6">
            <div className="mb-3 flex items-center gap-3">
              <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">
                {selectedAction.title}
              </h1>
            </div>
            {contentPreview && (
              <div className="border-t border-border/50 pt-4">
                {contentPreview.preview && !isContentExpanded && (
                  <ProposalContent
                    content={contentPreview.preview}
                    className="text-sm sm:text-base"
                  />
                )}
                {contentPreview.full && (
                  <div
                    className={cn(
                      "mt-4 overflow-hidden transition-all duration-500 ease-in-out",
                      isContentExpanded
                        ? "max-h-[4000px] opacity-100 translate-y-0"
                        : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
                    )}
                  >
                    <div className="space-y-4 pt-2">
                      <div className="overflow-x-auto">
                        <ProposalContent
                          content={contentPreview.full}
                          className="px-1 pr-6"
                          headingLevels={[1, 2, 3, 4]}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {contentPreview.references &&
                  contentPreview.references.length > 0 && (
                    <div className="mt-4 border-t border-border/50 pt-4">
                      <h4 className="mb-3 text-sm font-semibold text-foreground">
                        References
                      </h4>
                      <div className="space-y-2">
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
            )}
          </Card>

          {/* Main Grid: 2/3 Left, 1/3 Right */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column - Tabs for donuts, bubble map, curves, details */}
            <div className="space-y-6 lg:col-span-2">
              <Card className="info-container p-4 sm:p-6 dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none dark:rounded-none">
                <Tabs
                  value={selectedTab}
                  onValueChange={setSelectedTab}
                  className="w-full"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <TabsList className="flex-1 flex-wrap justify-start gap-2 bg-transparent p-0">
                        <TabsTrigger
                          value="live-voting"
                          className="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background hover:text-foreground dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2] dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black"
                        >
                          Live Voting
                        </TabsTrigger>
                        <TabsTrigger
                          value="bubble-map"
                          className="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background hover:text-foreground dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2] dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black"
                        >
                          Bubble Map
                        </TabsTrigger>
                        <TabsTrigger
                          value="curves"
                          className="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background hover:text-foreground dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2] dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black"
                        >
                          Curves
                        </TabsTrigger>
                        <TabsTrigger
                          value="details"
                          className="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background hover:text-foreground dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2] dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black"
                        >
                          Details
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <>
                        {/* Live voting donuts */}
                        <TabsContent value="live-voting" className="mt-0">
                          {allVotes.length > 0 ? (
                            <div className="space-y-4">
                              <div
                                className="flex flex-wrap items-start gap-4 sm:gap-6"
                                style={{ overflow: "visible" }}
                              >
                                <div className="flex flex-col items-center gap-3">
                                  {drepInfo ? (
                                    <>
                                      <VoteProgress
                                        title="DRep Votes"
                                        yesPercent={drepInfo.yesPercent}
                                        noPercent={drepInfo.noPercent}
                                        abstainPercent={drepAbstainStats.percent}
                                        yesValue={drepYesAda}
                                        noValue={drepNoAda}
                                        abstainValue={drepAbstainStats.power}
                                        valueUnit="ada"
                                        className="origin-center scale-90 md:scale-100"
                                        showTooltip={false}
                                        interactive={false}
                                      />
                                      <RoleLegend
                                        role="DRep"
                                        yesLabel={formatAdaValue(drepYesAda || 0)}
                                        noLabel={formatAdaValue(drepNoAda || 0)}
                                        abstainLabel={formatAdaValue(
                                          drepAbstainStats.power
                                        )}
                                        unit="ADA"
                                        colors={voteColors}
                                      />
                                    </>
                                  ) : allowDRep ? (
                                    <RolePlaceholder
                                      role="DRep"
                                      message="No on-chain data yet"
                                    />
                                  ) : (
                                    <RolePlaceholder
                                      role="DRep"
                                      message="Not eligible for this action"
                                    />
                                  )}
                                </div>
                                <div className="flex flex-col items-center gap-3">
                                  {ccInfo ? (
                                    <>
                                      <VoteProgress
                                        title="CC"
                                        yesPercent={ccInfo.yesPercent}
                                        noPercent={ccInfo.noPercent || 0}
                                        abstainPercent={
                                          ccInfo.abstainPercent ??
                                          ccAbstainStats.percent
                                        }
                                        yesValue={ccYesCount}
                                        noValue={ccNoCount}
                                        abstainValue={ccAbstainStats.count}
                                        valueUnit="count"
                                        className="origin-center scale-90 md:scale-100"
                                        showTooltip={false}
                                        interactive={false}
                                      />
                                      <RoleLegend
                                        role="CC"
                                        yesLabel={`${ccYesCount}`}
                                        noLabel={`${ccNoCount}`}
                                        abstainLabel={`${ccAbstainStats.count ?? 0}`}
                                        unit="votes"
                                        colors={voteColors}
                                      />
                                    </>
                                  ) : allowCC ? (
                                    <RolePlaceholder
                                      role="CC"
                                      message="No on-chain data yet"
                                    />
                                  ) : (
                                    <RolePlaceholder
                                      role="CC"
                                      message="Not eligible for this action"
                                    />
                                  )}
                                </div>
                                <div className="flex flex-col items-center gap-3">
                                  {spoInfo ? (
                                    <>
                                      <VoteProgress
                                        title="SPO Votes"
                                        yesPercent={spoInfo.yesPercent}
                                        noPercent={spoInfo.noPercent || 0}
                                        abstainPercent={spoAbstainStats.percent}
                                        yesValue={spoYesAda}
                                        noValue={spoNoAda}
                                        abstainValue={spoAbstainStats.power}
                                        valueUnit="ada"
                                        className="origin-center scale-90 md:scale-100"
                                        showTooltip={false}
                                        interactive={false}
                                      />
                                      <RoleLegend
                                        role="SPO"
                                        yesLabel={formatAdaValue(spoYesAda || 0)}
                                        noLabel={formatAdaValue(spoNoAda || 0)}
                                        abstainLabel={formatAdaValue(
                                          spoAbstainStats.power
                                        )}
                                        unit="ADA"
                                        colors={voteColors}
                                      />
                                    </>
                                  ) : allowSPO ? (
                                    <RolePlaceholder
                                      role="SPO"
                                      message="No on-chain data yet"
                                    />
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
                          <Card className="p-4 sm:p-6 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none dark:rounded-none">
                            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="space-y-1">
                                <h3 className="text-lg font-semibold">Voting trend</h3>
                                <p className="text-sm text-muted-foreground">
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
                                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2] ${
                                          isActive
                                            ? "border-foreground bg-foreground text-background dark:bg-[#0bd1a2] dark:text-black"
                                            : "border-border text-muted-foreground hover:text-foreground dark:hover:bg-[#0bd1a2] dark:hover:text-black"
                                        }`}
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
                              const submissionEpoch = selectedAction.submissionEpoch;
                              const expiryEpoch =
                                selectedAction.expiryEpoch || submissionEpoch + 6;
                              const mockCurrentEpoch = submissionEpoch + 2;
                              const epochsRemaining = Math.max(
                                0,
                                expiryEpoch - mockCurrentEpoch
                              );
                              const daysRemaining = epochsRemaining * 5;
                              const totalEpochs = 6;
                              const epochsPassed = Math.min(
                                totalEpochs,
                                totalEpochs - epochsRemaining
                              );
                              const progressPercent =
                                (epochsPassed / totalEpochs) * 100;

                              return (
                                <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-5 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
                                  <label className="mb-3 block text-sm font-semibold text-foreground sm:text-base dark:text-[#0bd1a2]">
                                    Time Until Expiry
                                  </label>
                                  <div className="mb-4 text-base font-semibold text-foreground sm:text-lg dark:text-[#0bd1a2]">
                                    {epochsRemaining > 0 ? (
                                      <>
                                        {epochsRemaining}{" "}
                                        {epochsRemaining === 1
                                          ? "epoch"
                                          : "epochs"}{" "}
                                        <span className="text-muted-foreground font-normal dark:text-[#0bd1a2]">
                                          ({daysRemaining}{" "}
                                          {daysRemaining === 1 ? "day" : "days"})
                                        </span>{" "}
                                        remaining
                                      </>
                                    ) : (
                                      <span className="text-destructive dark:text-[#0bd1a2]">
                                        Expired
                                      </span>
                                    )}
                                  </div>
                                  <Progress
                                    value={progressPercent}
                                    className="mb-4 h-3 rounded-full bg-secondary dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:rounded-none"
                                    indicatorClassName="bg-[#0bd1a2]"
                                  />
                                  <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                      <div className="mb-1 text-xs text-muted-foreground sm:text-sm dark:text-[#0bd1a2]">
                                        Submission
                                      </div>
                                      <div className="text-sm font-semibold sm:text-base dark:text-[#0bd1a2]">
                                        Epoch {submissionEpoch}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="mb-1 text-xs text-muted-foreground sm:text-sm dark:text-[#0bd1a2]">
                                        Current
                                      </div>
                                      <div className="text-sm font-semibold sm:text-base dark:text-[#0bd1a2]">
                                        Epoch {mockCurrentEpoch}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="mb-1 text-xs text-muted-foreground sm:text-sm dark:text-[#0bd1a2]">
                                        Expiry
                                      </div>
                                      <div className="text-sm font-semibold sm:text-base dark:text-[#0bd1a2]">
                                        Epoch {expiryEpoch}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-5 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
                              <label className="mb-3 block text-sm font-semibold text-foreground sm:text-base dark:text-[#0bd1a2]">
                                Governance Action ID
                              </label>
                              <div className="flex items-start gap-2">
                                <code className="flex-1 break-all rounded bg-secondary px-2 py-1 font-mono text-xs text-muted-foreground sm:px-3 sm:text-sm dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:text-[#0bd1a2]">
                                  {selectedAction.proposalId}
                                </code>
                                <button
                                  onClick={() =>
                                    handleCopy(
                                      selectedAction.proposalId || "",
                                      "proposalId"
                                    )
                                  }
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2] dark:hover:text-black dark:shadow-none"
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
                            <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-5 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
                              <label className="mb-3 block text-sm font-semibold text-foreground sm:text-base dark:text-[#0bd1a2]">
                                Transaction Hash
                              </label>
                              <div className="flex items-start gap-2">
                                <code className="flex-1 break-all rounded bg-secondary px-2 py-1 font-mono text-xs text-muted-foreground sm:px-3 sm:text-sm dark:bg-transparent dark:border dark:border-[#0bd1a2] dark:text-[#0bd1a2]">
                                  {selectedAction.txHash}
                                </code>
                                <button
                                  onClick={() =>
                                    handleCopy(
                                      selectedAction.txHash || "",
                                      "txHash"
                                    )
                                  }
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2] dark:hover:text-black dark:shadow-none"
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

            {/* Right Column - Sidebar (voting summary and voting widget) */}
            <div className="space-y-6">
              {/* Vote on Proposal Card */}
              {parsedProposalHash && (
                <VoteOnProposal
                  txHash={parsedProposalHash.txHash}
                  certIndex={parsedProposalHash.certIndex}
                  proposalTitle={selectedAction.title}
                  status={selectedAction.status}
                  proposalId={selectedAction.hash}
                />
              )}

              {/* Vote Summary Card */}
              <Card className="p-6">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Gov action type</span>
                    <Badge
                      variant="outline"
                  className="rounded-[6px] border-foreground/20 bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide leading-none dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                    >
                      {selectedAction.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant="outline"
                  className="rounded-[6px] border-foreground/20 bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide leading-none dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                    >
                      {selectedAction.status}
                    </Badge>
                  </div>
                  {selectedAction.constitutionality && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Constitutionality</span>
                      <Badge
                        variant="outline"
                    className="rounded-[6px] border-foreground/20 bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide leading-none dark:rounded-none dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
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
  yesLabel,
  noLabel,
  abstainLabel,
  unit,
  colors,
}: {
  role: string;
  yesLabel: string;
  noLabel: string;
  abstainLabel: string;
  unit: string;
  colors: VoteColorSet;
}) {
  const items = [
    {
      label: "Yes",
      value: yesLabel,
      color: colors.yes,
      border: "transparent",
    },
    {
      label: "No",
      value: noLabel,
      color: colors.no,
      border: "transparent",
    },
    {
      label: "Abstain",
      value: abstainLabel,
      color: colors.abstain,
      border: "rgba(148, 163, 184, 0.85)",
    },
  ];

  return (
    <div className="w-full max-w-[200px] rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs shadow-sm dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground dark:text-[#0bd1a2]">
        <span className="font-semibold dark:text-[#0bd1a2]">{role}</span>
        <span className="dark:text-[#0bd1a2]">{unit}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 border"
                style={{
                  backgroundColor: item.color,
                  borderColor: item.border,
                }}
              />
              <span className="font-semibold text-foreground dark:text-[#0bd1a2]">
                {item.label}
              </span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground dark:text-[#0bd1a2]">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RolePlaceholder({ role, message }: { role: string; message: string }) {
  return (
    <div className="flex h-full min-h-[180px] w-full max-w-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 px-4 py-6 text-center text-xs text-muted-foreground dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none">
      <span className="mb-1 font-semibold text-foreground dark:text-[#0bd1a2]">{role}</span>
      <span className="dark:text-[#0bd1a2]">{message}</span>
    </div>
  );
}
