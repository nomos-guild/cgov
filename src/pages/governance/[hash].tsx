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
import { ArrowLeft, Twitter, ChevronDown, ChevronRight } from "lucide-react";
import type { GovernanceActionDetail, VoterType } from "@/types/governance";
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

function getStatusColor(status: string): string {
  switch (status) {
    case "Active":
      return "bg-success/20 text-success border-success/30";
    case "Ratified":
    case "Enacted":
      return "bg-primary/20 text-primary border-primary/30";
    case "Expired":
    case "Closed":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const formatAdaValue = (value: number) => {
  if (!value || Number.isNaN(value)) return "0 ₳";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ₳`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k ₳`;
  }
  return `${value.toLocaleString()} ₳`;
};

const VOTE_COLORS = {
  yes: "#0d9488",
  no: "#5b21b6",
  abstain: "#000000",
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
  const { selectedAction, isLoadingDetail, detailError } = useAppSelector(
    (state) => state.governance
  );

  const [downloadFormat, setDownloadFormat] = useState<string>("");
  const [contentVisible, setContentVisible] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] =
    useState<boolean>(false);
  const [curveRoleFilter, setCurveRoleFilter] =
    useState<RoleFilter>("All");
  const [selectedTab, setSelectedTab] = useState<string | null>("live-voting");
  const [isRationaleExpanded, setIsRationaleExpanded] =
    useState<boolean>(false);

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

  const descriptionPreview = useMemo(() => {
    if (!selectedAction?.description) return null;
    const description = selectedAction.description;
    const maxPreviewLength = 200;
    const shouldTruncate = description.length > maxPreviewLength;
    return {
      full: description,
      preview: shouldTruncate
        ? description.substring(0, maxPreviewLength) + "..."
        : description,
      shouldTruncate,
    };
  }, [selectedAction?.description]);

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

  const shouldShowPower =
    curveRoleFilter === "DRep" || curveRoleFilter === "SPO";

  const renderVoteTrendTooltip = useCallback(
    (tooltipProps: TooltipProps<number, string>) => (
      <VoteTrendTooltip {...tooltipProps} showPower={shouldShowPower} />
    ),
    [shouldShowPower]
  );

  const useDashedPowerLines =
    shouldShowPower && curveRoleFilter !== "DRep";

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
            <Button variant="ghost" className="mb-6">
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
            <Button variant="ghost" className="mb-6">
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
            <Button variant="ghost" className="mb-6">
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
          {/* Back Button */}
          <Link href="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>

          {/* Header Section */}
          <Card className="mb-8 p-4 sm:p-6">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <Badge
                variant="outline"
                className={getStatusColor(selectedAction.status)}
              >
                {selectedAction.status}
              </Badge>
              <Badge variant="outline" className="border-border">
                {selectedAction.type}
              </Badge>
              {allVotes.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTwitterShare}
                  className="ml-auto flex items-center gap-2 whitespace-nowrap"
                >
                  <Twitter className="h-4 w-4" />
                  <span className="hidden sm:inline">Share on X</span>
                  <span className="sm:hidden">Share</span>
                </Button>
              )}
            </div>
            <h1 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">
              {selectedAction.title}
            </h1>
            <code className="mb-3 inline-block rounded bg-secondary px-3 py-1 font-mono text-xs text-muted-foreground sm:text-sm">
              {selectedAction.proposalId || selectedAction.hash}
            </code>
            <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground sm:text-sm">
              <span>Submission: Epoch {selectedAction.submissionEpoch}</span>
              <span>•</span>
              <span>Expiry: Epoch {selectedAction.expiryEpoch}</span>
            </div>
            {descriptionPreview && (
              <div className="border-t border-border/50 pt-4">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 sm:text-base">
                  {isDescriptionExpanded
                    ? descriptionPreview.full
                    : descriptionPreview.preview}
                </div>
                {descriptionPreview.shouldTruncate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setIsDescriptionExpanded(!isDescriptionExpanded)
                    }
                    className="mt-3"
                  >
                    {isDescriptionExpanded ? "Show Less" : "Show More"}
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Main Grid: 2/3 Left, 1/3 Right */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column - Tabs for donuts, bubble map, curves, details */}
            <div className="space-y-6 lg:col-span-2">
              <Card className="p-4 sm:p-6">
                <Tabs
                  value={selectedTab || undefined}
                  onValueChange={setSelectedTab}
                  className="w-full"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <TabsList className="flex-1 flex-wrap justify-start gap-1 bg-transparent p-0">
                        <TabsTrigger value="live-voting">Live Voting</TabsTrigger>
                        <TabsTrigger value="bubble-map">Bubble Map</TabsTrigger>
                        <TabsTrigger value="curves">Curves</TabsTrigger>
                        <TabsTrigger value="details">Details</TabsTrigger>
                      </TabsList>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedTab) {
                            setSelectedTab(null);
                          } else {
                            setSelectedTab("live-voting");
                          }
                        }}
                        className="flex-shrink-0"
                      >
                        {selectedTab ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {selectedTab && (
                      <>
                        {/* Live voting donuts */}
                        <TabsContent value="live-voting" className="mt-0">
                          {allVotes.length > 0 ? (
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={getStatusColor(selectedAction.status)}
                                >
                                  {selectedAction.status}
                                </Badge>
                                <Badge variant="outline" className="border-border">
                                  {selectedAction.type}
                                </Badge>
                              </div>
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
                                      />
                                      <RoleLegend
                                        role="DRep"
                                        yesLabel={formatAdaValue(drepYesAda || 0)}
                                        noLabel={formatAdaValue(drepNoAda || 0)}
                                        abstainLabel={formatAdaValue(
                                          drepAbstainStats.power
                                        )}
                                        unit="ADA"
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
                                      />
                                      <RoleLegend
                                        role="CC"
                                        yesLabel={`${ccYesCount}`}
                                        noLabel={`${ccNoCount}`}
                                        abstainLabel={`${ccAbstainStats.count ?? 0}`}
                                        unit="votes"
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
                                      />
                                      <RoleLegend
                                        role="SPO"
                                        yesLabel={formatAdaValue(spoYesAda || 0)}
                                        noLabel={formatAdaValue(spoNoAda || 0)}
                                        abstainLabel={formatAdaValue(
                                          spoAbstainStats.power
                                        )}
                                        unit="ADA"
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
                          <Card className="p-4 sm:p-6">
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
                                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
                                          isActive
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-border text-muted-foreground hover:text-foreground"
                                        }`}
                                      >
                                        {role === "All" ? "All Roles" : role}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              {voteTimelineData.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  Updated{" "}
                                  {
                                    voteTimelineData[voteTimelineData.length - 1]
                                      .label
                                  }
                                </div>
                              )}
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
                                          stroke={VOTE_COLORS.yes}
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
                                          stroke={VOTE_COLORS.no}
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
                                          stroke={VOTE_COLORS.abstain}
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
                                          stroke={VOTE_COLORS.yes}
                                          strokeWidth={2}
                                          dot={false}
                                          name="Yes Votes"
                                          yAxisId="primary"
                                        />
                                        <Line
                                          type="monotone"
                                          dataKey="noCount"
                                          stroke={VOTE_COLORS.no}
                                          strokeWidth={2}
                                          dot={false}
                                          name="No Votes"
                                          yAxisId="primary"
                                        />
                                        <Line
                                          type="monotone"
                                          dataKey="abstainCount"
                                          stroke={VOTE_COLORS.abstain}
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
                                <div>
                                  <label className="mb-2 block text-xs text-muted-foreground sm:text-sm">
                                    Time Until Expiry
                                  </label>
                                  <div className="mb-3 text-xs text-foreground sm:text-sm">
                                    {epochsRemaining > 0 ? (
                                      <>
                                        {epochsRemaining}{" "}
                                        {epochsRemaining === 1
                                          ? "epoch"
                                          : "epochs"}{" "}
                                        ({daysRemaining}{" "}
                                        {daysRemaining === 1 ? "day" : "days"})
                                        remaining
                                      </>
                                    ) : (
                                      <span className="text-destructive">
                                        Expired
                                      </span>
                                    )}
                                  </div>
                                  <Progress
                                    value={progressPercent}
                                    className="mb-3 h-2"
                                  />
                                  <div className="grid grid-cols-3 gap-4 text-center text-xs">
                                    <div>
                                      <div className="mb-1 text-muted-foreground">
                                        Submission
                                      </div>
                                      <div className="font-semibold">
                                        Epoch {submissionEpoch}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="mb-1 text-muted-foreground">
                                        Current
                                      </div>
                                      <div className="font-semibold">
                                        Epoch {mockCurrentEpoch}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="mb-1 text-muted-foreground">
                                        Expiry
                                      </div>
                                      <div className="font-semibold">
                                        Epoch {expiryEpoch}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            <div>
                              <label className="mb-2 block text-xs text-muted-foreground sm:text-sm">
                                Governance Action ID
                              </label>
                              <code className="block break-all rounded bg-secondary px-2 py-1 font-mono text-xs text-muted-foreground sm:px-3 sm:text-sm">
                                {selectedAction.hash}
                              </code>
                            </div>
                            <div>
                              <label className="mb-2 block text-xs text-muted-foreground sm:text-sm">
                                Transaction Hash
                              </label>
                              <code className="block break-all rounded bg-secondary px-2 py-1 font-mono text-xs text-muted-foreground sm:px-3 sm:text-sm">
                                {selectedAction.txHash}
                              </code>
                            </div>
                          </div>
                        </TabsContent>
                      </>
                    )}
                  </div>
                </Tabs>
              </Card>

              {/* Rationale Card (outside tabs, same column) */}
              {selectedAction.rationale && (
                <Card className="p-6">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold">Rationale</h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setIsRationaleExpanded((prevExpanded) => !prevExpanded)
                      }
                    >
                      {isRationaleExpanded ? "Hide Rationale" : "Show Rationale"}
                    </Button>
                  </div>
                  {isRationaleExpanded && (
                    <div className="mt-2 whitespace-pre-wrap leading-relaxed text-foreground/90">
                      {selectedAction.rationale}
                    </div>
                  )}
                </Card>
              )}
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

              {/* Constitutionality Card */}
              <Card className="p-6">
                <h3 className="mb-2 font-semibold">Constitutionality</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedAction.constitutionality}
                </p>
              </Card>

              {/* DRep Votes Card */}
              <Card
                className={`p-6 ${
                  !allowDRep ? "opacity-30 blur-[1px]" : ""
                }`}
              >
                <h3 className="mb-4 font-semibold">DRep Votes</h3>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex justify-between">
                      <span className="text-sm text-success">
                        Yes: {selectedAction.drepYesPercent.toFixed(1)}%
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {selectedAction.drepYesAda} ₳
                      </span>
                    </div>
                    <Progress
                      value={selectedAction.drepYesPercent}
                      className="h-3 bg-secondary"
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between">
                      <span className="text-sm text-destructive">
                        No: {selectedAction.drepNoPercent.toFixed(1)}%
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {selectedAction.drepNoAda} ₳
                      </span>
                    </div>
                    <Progress
                      value={selectedAction.drepNoPercent}
                      className="h-3 bg-secondary"
                    />
                  </div>
                </div>
              </Card>

              {/* SPO Votes Card */}
              {selectedAction.spoYesPercent !== undefined && (
                <Card
                  className={`p-6 ${
                    !allowSPO ? "opacity-30 blur-[1px]" : ""
                  }`}
                >
                  <h3 className="mb-4 font-semibold">SPO Votes</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex justify-between">
                        <span className="text-sm text-success">
                          Yes: {selectedAction.spoYesPercent.toFixed(1)}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {selectedAction.spoYesAda || "0"} ₳
                        </span>
                      </div>
                      <Progress
                        value={selectedAction.spoYesPercent}
                        className="h-3 bg-secondary"
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between">
                        <span className="text-sm text-destructive">
                          No:{" "}
                          {selectedAction.spoNoPercent?.toFixed(1) || "0.0"}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {selectedAction.spoNoAda || "0"} ₳
                        </span>
                      </div>
                      <Progress
                        value={selectedAction.spoNoPercent || 0}
                        className="h-3 bg-secondary"
                      />
                    </div>
                  </div>
                </Card>
              )}

              {/* CC Votes Card */}
              {selectedAction.ccYesPercent !== undefined && (
                <Card
                  className={`p-6 ${
                    !allowCC ? "opacity-30 blur-[1px]" : ""
                  }`}
                >
                  <h3 className="mb-4 font-semibold">
                    Constitutional Committee Votes
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex justify-between">
                        <span className="text-sm text-success">
                          Yes: {selectedAction.ccYesPercent.toFixed(1)}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {selectedAction.ccYesCount || 0} votes
                        </span>
                      </div>
                      <Progress
                        value={selectedAction.ccYesPercent}
                        className="h-3 bg-secondary"
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between">
                        <span className="text-sm text-destructive">
                          No:{" "}
                          {selectedAction.ccNoPercent?.toFixed(1) || "0.0"}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {selectedAction.ccNoCount || 0} votes
                        </span>
                      </div>
                      <Progress
                        value={selectedAction.ccNoPercent || 0}
                        className="h-3 bg-secondary"
                      />
                    </div>
                  </div>
                </Card>
              )}

              {/* Vote Summary Card */}
              <Card className="p-6">
                <h3 className="mb-4 font-semibold">Vote Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total Yes
                    </span>
                    <span className="text-sm font-semibold text-success">
                      {selectedAction.totalYes}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total No
                    </span>
                    <span className="text-sm font-semibold text-destructive">
                      {selectedAction.totalNo}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total Abstain
                    </span>
                    <span className="text-sm font-semibold">
                      {selectedAction.totalAbstain}
                    </span>
                  </div>
                  <div className="mt-2 border-t border-border pt-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-semibold">
                        Total Votes
                      </span>
                      <span className="text-sm font-bold">
                        {selectedAction.totalYes +
                          selectedAction.totalNo +
                          selectedAction.totalAbstain}
                      </span>
                    </div>
                  </div>
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
}: {
  active?: boolean;
  payload?: Array<{
    payload?: unknown;
    [key: string]: unknown;
  }>;
  label?: string;
  showPower: boolean;
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
      color: VOTE_COLORS.yes,
      border: "transparent",
    },
    {
      label: "No",
      value: showPower
        ? formatAdaValue(point.noPower)
        : `${point.noCount.toLocaleString()} votes`,
      color: VOTE_COLORS.no,
      border: "transparent",
    },
    {
      label: "Abstain",
      value: showPower
        ? formatAdaValue(point.abstainPower)
        : `${point.abstainCount.toLocaleString()} votes`,
      color: VOTE_COLORS.abstain,
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

function RoleLegend({
  role,
  yesLabel,
  noLabel,
  abstainLabel,
  unit,
}: {
  role: string;
  yesLabel: string;
  noLabel: string;
  abstainLabel: string;
  unit: string;
}) {
  const items = [
    {
      label: "Yes",
      value: yesLabel,
      color: VOTE_COLORS.yes,
      border: "transparent",
    },
    {
      label: "No",
      value: noLabel,
      color: VOTE_COLORS.no,
      border: "transparent",
    },
    {
      label: "Abstain",
      value: abstainLabel,
      color: VOTE_COLORS.abstain,
      border: "rgba(148, 163, 184, 0.85)",
    },
  ];

  return (
    <div className="w-full max-w-[200px] rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs shadow-sm">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="font-semibold">{role}</span>
        <span>{unit}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full border"
                style={{
                  backgroundColor: item.color,
                  borderColor: item.border,
                }}
              />
              <span className="font-semibold text-foreground">
                {item.label}
              </span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
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
    <div className="flex h-full min-h-[180px] w-full max-w-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 px-4 py-6 text-center text-xs text-muted-foreground">
      <span className="mb-1 font-semibold text-foreground">{role}</span>
      <span>{message}</span>
    </div>
  );
}
