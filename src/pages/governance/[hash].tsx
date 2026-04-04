// src/pages/governance/[hash].tsx

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import type { GetStaticProps, GetStaticPaths } from "next";
import { useRouter } from "next/router";
import { useTranslations } from "next-intl";
import Head from "next/head";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VotingRecords } from "@/components/VotingRecords";
import { BubbleMap } from "@/components/BubbleMap";
import { useAppSelector } from "@/store/hooks";
import {
  useGovernanceActionDetail,
  // useProposalSurvey,
  // useProposalSurveyTally,
} from "@/hooks/useGovernanceData";
import { ArrowLeft } from "lucide-react";
import type {
  GovernanceActionDetail,
  VoterType,
  ProposalReferenceObject,
} from "@/types/governance";
import type { TooltipContentProps } from "recharts";
import type { Payload } from "recharts/types/component/DefaultTooltipContent";
import {
  exportToJSON,
  exportToMarkdown,
  exportToCSV,
  downloadFile,
  translateVotesForExport,
  type ExportLabels,
} from "@/lib/exportRationales";
import { downloadMetrics, type MetricsExportLabels } from "@/lib/exportMetrics";
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
} from "@/lib/voteBreakdownCalculator";
import { ProposalContent } from "@/components/ProposalContent";
import { useContentTranslation } from "@/hooks/useContentTranslation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { FadeIn } from "@/components/ui/fade-in";
import { GameLoader } from "@/components/ui/game-loader";
import { epochToTimestamp } from "@/lib/epochUtils";
import {
  VOTE_COLORS_LIGHT,
  VOTE_COLORS_DARK,
  VOTE_COLORS_NEURAL,
  type TimelinePoint,
} from "@/lib/voteColors";
import {
  isCcNotApplicable,
  isDrepNotApplicable,
  isSpoNotApplicable,
  convertIpfsToGateway,
} from "@/lib/governanceEligibilityOverrides";
import { VoteTrendTooltip } from "@/components/governance/VoteTrendTooltip";
import { LazyVoteOnProposal } from "@/components/governance/LazyVoteOnProposal";
// import { LinkedSurveyPanel } from "@/components/governance/LinkedSurveyPanel";
import { ProposalExpiryCard } from "@/components/governance/ProposalExpiryCard";
import { LiveVotingTab } from "@/components/governance/LiveVotingTab";
import { ProposalDetailsTab } from "@/components/governance/ProposalDetailsTab";
import { ThresholdsTab } from "@/components/governance/ThresholdsTab";
import { VoteTrendLineChart } from "@/components/governance/VoteTrendLineChart";

type RoleFilter = "All" | VoterType;
type ChartMode = "live" | "projected";


interface GovernanceDetailProps {
  initialDetail?: GovernanceActionDetail | null;
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/60", className)} />;
}

function ProposalSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 pt-8 pb-4 sm:px-4 sm:pt-10 md:px-6 md:pt-12">
        <SkeletonBlock className="h-5 w-32 mb-6" />
        <SkeletonBlock className="h-8 w-3/4 mb-3" />
        <SkeletonBlock className="h-4 w-1/2 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <SkeletonBlock className="h-48 w-full" />
            <SkeletonBlock className="h-32 w-full" />
          </div>
          <div className="space-y-4">
            <SkeletonBlock className="h-24 w-full" />
            <SkeletonBlock className="h-24 w-full" />
            <SkeletonBlock className="h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GovernanceDetail({ initialDetail }: GovernanceDetailProps) {
  const router = useRouter();

  if (router.isFallback) {
    return <ProposalSkeleton />;
  }

  return <GovernanceDetailContent initialDetail={initialDetail} />;
}

function GovernanceDetailContent({ initialDetail }: GovernanceDetailProps) {
  const router = useRouter();
  const { hash } = router.query;
  const { theme, activeTheme } = useTheme();
  const tTabs = useTranslations("tabs");
  const tVoting = useTranslations("voting");
  const tProposal = useTranslations("proposal");
  const tExport = useTranslations("export");
  const tMetricsExport = useTranslations("metricsExport");
  const isDark = theme === "dark";
  const isGame = activeTheme.id === "game";
  const isNeural = activeTheme.id === "neural";
  const voteColors = useMemo(
    () => isNeural ? VOTE_COLORS_NEURAL : (isDark || isGame ? VOTE_COLORS_DARK : VOTE_COLORS_LIGHT),
    [isDark, isGame, isNeural]
  );
  const proposalId = typeof hash === "string" ? hash : null;

  // SWR-based data loading with ISR fallback for instant hydration
  const { isLoading: swrLoading, error: swrError, refresh } =
    useGovernanceActionDetail(proposalId, initialDetail);
  // Hidden until surveys exist on-chain
  // const {
  //   survey: proposalSurvey,
  //   isLoading: isSurveyLoading,
  //   error: surveyError,
  // } = useProposalSurvey(proposalId);
  // const shouldFetchSurveyTally =
  //   !!proposalSurvey?.linked &&
  //   !!proposalSurvey.linkValidation.valid &&
  //   !!proposalSurvey.surveyDetailsValidation.valid;
  // const {
  //   tally: proposalSurveyTally,
  //   isLoading: isSurveyTallyLoading,
  //   error: surveyTallyError,
  // } = useProposalSurveyTally(proposalId, shouldFetchSurveyTally);

  // Redux still has the data (synced by the hook) for components that read from it
  const { selectedAction } = useAppSelector((state) => state.governance);

  // Derive vote transaction props from selectedAction hash ("txHash:certIndex" format)
  const [voteTxHash, voteCertIndexStr] = (selectedAction?.hash || "").split(/[:#]/);
  const voteCertIndex = parseInt(voteCertIndexStr, 10) || 0;

  // Alias for backward compatibility with the rest of the JSX
  const isLoadingDetail = swrLoading;
  const detailError = swrError;

  const [isExporting, setIsExporting] = useState(false);
  const [contentVisible, setContentVisible] = useState(!!initialDetail);
  const [isContentExpanded, setIsContentExpanded] = useState<boolean>(false);
  const [curveRoleFilter, setCurveRoleFilter] =
    useState<RoleFilter>("All");
  const [chartMode, setChartMode] = useState<ChartMode>("live");
  const [selectedTab, setSelectedTab] = useState<string>("live-voting");
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

  // Frontloaded votes pending chain confirmation (no votingPower from chain yet)
  const unconfirmedVoterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const v of allVotes) {
      if (v.isPendingConfirmation) {
        const id = v.voterId || v.drepId;
        if (id) ids.add(id);
      }
    }
    return ids;
  }, [allVotes]);

  // Background polling: refresh proposal data while unconfirmed votes exist
  useEffect(() => {
    if (unconfirmedVoterIds.size === 0) return;

    const interval = setInterval(() => {
      refresh();
    }, 30_000);

    return () => clearInterval(interval);
  }, [unconfirmedVoterIds.size, refresh]);

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

  const metricsLabels: MetricsExportLabels = useMemo(
    () => ({
      title: tMetricsExport("title"),
      type: tMetricsExport("type"),
      ccVotes: tMetricsExport("ccVotes"),
      drepVotes: tMetricsExport("drepVotes"),
      spoVotes: tMetricsExport("spoVotes"),
      totalVotes: tMetricsExport("totalVotes"),
      yesAda: tMetricsExport("yesAda"),
      noAda: tMetricsExport("noAda"),
      abstainAda: tMetricsExport("abstainAda"),
      totalAdaVoted: tMetricsExport("totalAdaVoted"),
      alwaysNoConfidence: tMetricsExport("alwaysNoConfidence"),
      notVotedAda: tMetricsExport("notVotedAda"),
    }),
    [tMetricsExport],
  );

  const handleMetricsExport = (format: "csv" | "json" | "markdown") => {
    if (!selectedAction) return;
    downloadMetrics(selectedAction, format, metricsLabels);
  };

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
    const firstTs = firstVote?.date?.getTime();
    const startTs = firstTs && !Number.isNaN(firstTs) ? firstTs - 1 : 0;

    const formatDate = (d: Date) =>
      d.toLocaleString(undefined, { month: "short", day: "numeric" });

    const timelinePoints: TimelinePoint[] = [{
      label: firstVote?.date ? formatDate(firstVote.date) : "Start",
      timestamp: startTs,
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

      const ts = vote.date?.getTime();
      const validTs = ts && !Number.isNaN(ts);

      timelinePoints.push({
        label: validTs ? formatDate(vote.date!) : `Vote ${index + 1}`,
        timestamp: validTs ? ts : startTs + index + 1,
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

  // Projected mode: expiry timestamp from epoch
  const expiryTimestamp = useMemo<number | null>(() => {
    if (!selectedAction?.expiryEpoch || selectedAction.expiryEpoch <= 0) return null;
    return epochToTimestamp(selectedAction.expiryEpoch);
  }, [selectedAction?.expiryEpoch]);

  // Compute one tick per calendar day for even spacing on the time axis
  const dailyTicks = useMemo(() => {
    if (voteTimelineData.length < 2) return [];
    const timestamps = voteTimelineData.map((d) => d.timestamp).filter(Boolean);
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    // Start at midnight of the first day
    const startDay = new Date(minTs);
    startDay.setHours(0, 0, 0, 0);
    const ticks: number[] = [];
    const d = new Date(startDay);
    // In projected mode, extend to expiry; in live mode, cap at now
    const endTs = chartMode === "projected" && expiryTimestamp
      ? expiryTimestamp
      : Math.min(maxTs, Date.now());
    while (d.getTime() <= endTs) {
      ticks.push(d.getTime());
      d.setDate(d.getDate() + 1);
    }
    return ticks;
  }, [voteTimelineData, chartMode, expiryTimestamp]);

  const formatTickDate = useCallback(
    (ts: number) =>
      new Date(ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
      }),
    []
  );

  // Show ADA amounts for DRep/SPO (and "All" which includes them)
  // Show vote counts for CC only
  const shouldShowPower = curveRoleFilter !== "CC";

  const renderVoteTrendTooltip = useCallback(
    (tooltipProps: TooltipContentProps<number, string>) => (
      <VoteTrendTooltip
        active={tooltipProps.active}
        payload={tooltipProps.payload as Payload<number, string>[] | undefined}
        showPower={shouldShowPower}
        colors={voteColors}
        isGame={isGame}
      />
    ),
    [shouldShowPower, voteColors, isGame]
  );

  const useDashedPowerLines =
    shouldShowPower && curveRoleFilter === "All";

  // Chart x-axis domain: extend to expiry in projected mode
  const chartDomain = useMemo<[number | string, number | string]>(() => {
    if (chartMode === "projected" && expiryTimestamp) {
      return ["dataMin", expiryTimestamp];
    }
    return ["dataMin", "dataMax"];
  }, [chartMode, expiryTimestamp]);

  // Projected mode: threshold reference line value (ADA or count for CC)
  const thresholdReferenceValue = useMemo<number | null>(() => {
    if (chartMode !== "projected" || !selectedAction) return null;

    if (curveRoleFilter === "CC") {
      const t = selectedAction.threshold?.ccThreshold;
      if (t == null) return null;
      const cc = selectedAction.cc;
      const total = (cc?.yesCount ?? 0) + (cc?.noCount ?? 0) + (cc?.notVotedCount ?? 0) || 7;
      return Math.ceil(t * total);
    }

    if (curveRoleFilter === "SPO") {
      const t = selectedAction.threshold?.spoThreshold;
      if (t == null) return null;
      const totalPower = Number(selectedAction.rawVotingPowerValues?.spo_total_vote_power ?? "0");
      const abstainPower = Number(selectedAction.rawVotingPowerValues?.spo_always_abstain_vote_power ?? "0");
      return (t * (totalPower - abstainPower)) / 1_000_000;
    }

    // DRep or "All" — use DRep threshold (primary stake-weighted metric)
    const t = selectedAction.threshold?.drepThreshold;
    if (t == null) return null;
    const totalPower = Number(selectedAction.rawVotingPowerValues?.drep_total_vote_power ?? "0");
    const abstainPower = Number(selectedAction.rawVotingPowerValues?.drep_always_abstain_vote_power ?? "0");
    return (t * (totalPower - abstainPower)) / 1_000_000;
  }, [chartMode, selectedAction, curveRoleFilter]);

  // Label for the threshold reference line
  const thresholdLabel = useMemo<string>(() => {
    if (!selectedAction?.threshold || chartMode !== "projected") return "";
    const role = curveRoleFilter === "CC" ? "CC" : curveRoleFilter === "SPO" ? "SPO" : "DRep";
    const pct = curveRoleFilter === "CC"
      ? selectedAction.threshold.ccThreshold
      : curveRoleFilter === "SPO"
        ? selectedAction.threshold.spoThreshold
        : selectedAction.threshold.drepThreshold;
    if (pct == null) return "";
    return tProposal("thresholdLabel", { role, pct: (pct * 100).toFixed(0) });
  }, [chartMode, curveRoleFilter, selectedAction?.threshold, tProposal]);

  // Y-axis domain: extend to include threshold in projected mode
  const yAxisDomain = useMemo<[number, number] | undefined>(() => {
    if (chartMode !== "projected" || thresholdReferenceValue == null) return undefined;
    // Add 10% headroom above the threshold so the line isn't flush with the top
    return [0, Math.ceil(thresholdReferenceValue * 1.1)];
  }, [chartMode, thresholdReferenceValue]);

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
            <Button variant="default" className={isGame ? "game-nav-btn mb-6" : "mb-6 bg-white text-black hover:bg-black hover:text-white shadow-elevation-2"}>
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
            <Button variant="default" className="mb-6 bg-white text-black hover:bg-black hover:text-white shadow-elevation-2">
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
            <Button variant="default" className="mb-6 bg-white text-black hover:bg-black hover:text-white shadow-elevation-2">
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
          className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8"
        >
          {/* Proposal Detail + Expiry Row */}
          <FadeIn show={contentVisible} delay={120} duration={500} distance={18}>
          <div className="mb-4 sm:mb-6 md:mb-8">
            {/* Proposal Detail + Expiry */}
          <Card className={cn(
            "p-3 sm:p-4 md:p-6 flex flex-col",
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

            {/* Expiry info section */}
            {selectedAction && (
              <div className="border-t border-border/50 pt-4 mb-4">
                <ProposalExpiryCard
                  action={selectedAction}
                  isInfoAction={isInfoAction}
                  submittedAt={submittedAt}
                />
              </div>
            )}

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
                        "flex w-full items-center justify-center px-3 py-1.5 cursor-pointer transition-all duration-normal",
                        isGame
                          ? "game-expand-btn rounded-lg"
                          : "rounded-lg border border-border/50 bg-card/50 hover:bg-white hover:shadow-lg hover:scale-101 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:hover:bg-[#0bd1a2]/10 dark:hover:shadow-none"
                      )}
                      onClick={() => setIsContentExpanded((prev) => !prev)}
                    >
                      <svg
                        className={cn(
                          "h-4 w-4 transition-transform duration-normal",
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

          </div>
          </FadeIn>

          {/* Main Grid: 2/3 Left, 1/3 Right */}
          <FadeIn show={contentVisible} delay={260} duration={500} distance={24}>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:gap-6 lg:grid-cols-3">
            {/* Left Column - Tabs for donuts, bubble map, curves, details */}
            <div className="space-y-4 sm:space-y-5 md:space-y-6 lg:col-span-2">
              <Card className={cn(
                "info-container p-3 sm:p-4 md:p-6 overflow-hidden dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none dark:rounded-none h-full flex flex-col",
                isGame && "game-voting-card"
              )}>
                <Tabs
                  value={selectedTab}
                  onValueChange={setSelectedTab}
                  className="w-full flex-1 flex flex-col"
                >
                  <div className="flex flex-col gap-3 sm:gap-4 flex-1">
                    <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <TabsList className="flex-1 flex-wrap justify-start gap-1.5 sm:gap-2 bg-transparent p-0 py-2 overflow-x-auto overflow-visible">
                        <TabsTrigger
                          value="live-voting"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-2xs sm:text-xs"
                              : "rounded-md border border-border bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-2xs sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-normal ease-in-out shadow-elevation-2 data-[state=active]:bg-black data-[state=active]:text-white hover:scale-101 hover:shadow-elevation-3 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon"
                          }
                        >
                          {tTabs("liveVoting")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="thresholds"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-2xs sm:text-xs"
                              : "rounded-md border border-border bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-2xs sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-normal ease-in-out shadow-elevation-2 data-[state=active]:bg-black data-[state=active]:text-white hover:scale-101 hover:shadow-elevation-3 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon"
                          }
                        >
                          {tTabs("thresholds")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="bubble-map"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-2xs sm:text-xs"
                              : "rounded-md border border-border bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-2xs sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-normal ease-in-out shadow-elevation-2 data-[state=active]:bg-black data-[state=active]:text-white hover:scale-101 hover:shadow-elevation-3 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon"
                          }
                        >
                          {tTabs("bubbleMap")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="curves"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-2xs sm:text-xs"
                              : "rounded-md border border-border bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-2xs sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-normal ease-in-out shadow-elevation-2 data-[state=active]:bg-black data-[state=active]:text-white hover:scale-101 hover:shadow-elevation-3 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon"
                          }
                        >
                          {tTabs("curves")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="details"
                          className={
                            isGame
                              ? "game-tab-btn data-[state=active]:game-tab-btn-active text-2xs sm:text-xs"
                              : "rounded-md border border-border bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-2xs sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-normal ease-in-out shadow-elevation-2 data-[state=active]:bg-black data-[state=active]:text-white hover:scale-101 hover:shadow-elevation-3 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon"
                          }
                        >
                          {tTabs("details")}
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <>
                        {/* Live voting donuts */}
                        <TabsContent value="live-voting" className="mt-0">
                          <LiveVotingTab
                            hasData={allVotes.length > 0 || hasAggregateVotingData}
                            isInfoAction={isInfoAction}
                            allowDRep={allowDRep}
                            hasDrepInfo={!!drepInfo}
                            drepDonutSegments={drepDonutSegments}
                            drepLegendSegments={drepLegendSegments}
                            drepExcludedBreakdown={drepExcludedBreakdown}
                            allowCC={allowCC}
                            hasCcInfo={!!ccInfo}
                            ccYesPercent={ccYesPercent}
                            ccNoPercent={ccNoPercent}
                            ccPendingPercentRecalc={ccPendingPercentRecalc}
                            ccYesCount={ccYesCount}
                            ccNoCount={ccNoCount}
                            ccPendingCount={ccPendingCount}
                            ccAbstainCount={ccAbstainStats.count ?? 0}
                            allowSPO={allowSPO}
                            hasSpoInfo={!!spoInfo}
                            spoDonutSegments={spoDonutSegments}
                            spoLegendSegments={spoLegendSegments}
                            spoExcludedBreakdown={spoExcludedBreakdown}
                          />
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
                            "p-4 sm:p-6 shadow-elevation-2 dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none dark:rounded-none",
                            isGame && "game-detail-card"
                          )}>
                            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                              <div className="shrink-0">
                                {isGame ? (
                                  <GameDropdown
                                    value={chartMode}
                                    onValueChange={(value) => setChartMode(value as ChartMode)}
                                    options={[
                                      { value: "live", label: tProposal("liveMode") },
                                      { value: "projected", label: tProposal("projectedMode") },
                                    ]}
                                    size="sm"
                                    className="w-[120px]"
                                  />
                                ) : (
                                  <Select
                                    value={chartMode}
                                    onValueChange={(value: string) => setChartMode(value as ChartMode)}
                                  >
                                    <SelectTrigger className="w-[120px] h-8 text-xs btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                                      <SelectItem value="live" className="text-xs cursor-pointer dark:focus:bg-[#0bd1a2]/20 dark:focus:text-[#0bd1a2]">
                                        {tProposal("liveMode")}
                                      </SelectItem>
                                      <SelectItem value="projected" className="text-xs cursor-pointer dark:focus:bg-[#0bd1a2]/20 dark:focus:text-[#0bd1a2]">
                                        {tProposal("projectedMode")}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </div>
                            {voteTimelineData.length > 0 ? (
                              <VoteTrendLineChart
                                data={voteTimelineData}
                                chartDomain={chartDomain}
                                dailyTicks={dailyTicks}
                                yAxisDomain={yAxisDomain}
                                voteColors={voteColors}
                                shouldShowPower={shouldShowPower}
                                useDashedPowerLines={useDashedPowerLines}
                                formatTickDate={formatTickDate}
                                renderTooltip={renderVoteTrendTooltip}
                                showLegend
                                height={320}
                                margin={{ top: 10, right: 40, left: 0, bottom: 0 }}
                                tickFontSize={12}
                                minTickGap={24}
                                thresholdReferenceValue={chartMode === "projected" ? thresholdReferenceValue : null}
                                thresholdLabel={thresholdLabel}
                                isGame={isGame}
                                isDark={isDark}
                              />
                            ) : (
                              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                                {tProposal("notEnoughData")}
                              </div>
                            )}
                          </Card>
                        </TabsContent>

                        {/* Details */}
                        <TabsContent value="details" className="mt-0">
                          <ProposalDetailsTab action={selectedAction} />
                        </TabsContent>

                        {/* Thresholds */}
                        {/* Thresholds */}
                        <TabsContent value="thresholds" className="mt-0">
                          <ThresholdsTab
                            action={selectedAction}
                            hasSpoVotes={hasSpoVotes}
                            ccYesCount={ccYesCount}
                            ccNoCount={ccNoCount}
                            ccPendingCount={ccPendingCount}
                            drepDonutSegments={drepDonutSegments}
                            spoDonutSegments={spoDonutSegments}
                          />
                        </TabsContent>
                      </>
                  </div>
                </Tabs>
              </Card>

              {/* Hidden until surveys exist on-chain
              {selectedAction && (
                <LinkedSurveyPanel
                  survey={proposalSurvey}
                  tally={proposalSurveyTally}
                  isSurveyLoading={isSurveyLoading}
                  isTallyLoading={isSurveyTallyLoading}
                  surveyError={surveyError}
                  tallyError={surveyTallyError}
                  isGame={isGame}
                />
              )}
              */}

            </div>

            {/* Right Column - Sidebar (voting summary) */}
            <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              {/* Voting Trend Chart */}
              {allVotes.length > 0 && (
                <Card className={cn("p-6", isGame && "game-detail-card")}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={cn("text-sm font-semibold", isGame && "text-white")}>{tProposal("votingTrend")}</h3>
                    <div className="flex items-center gap-1.5">
                      {isGame ? (
                        <GameDropdown
                          value={chartMode}
                          onValueChange={(value) => setChartMode(value as ChartMode)}
                          options={[
                            { value: "live", label: tProposal("liveMode") },
                            { value: "projected", label: tProposal("projectedMode") },
                          ]}
                          size="sm"
                          className="w-[100px]"
                        />
                      ) : (
                        <Select
                          value={chartMode}
                          onValueChange={(value: string) => setChartMode(value as ChartMode)}
                        >
                          <SelectTrigger className="w-[100px] h-7 text-2xs btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                            <SelectItem value="live" className="text-2xs cursor-pointer dark:focus:bg-[#0bd1a2]/20 dark:focus:text-[#0bd1a2]">
                              {tProposal("liveMode")}
                            </SelectItem>
                            <SelectItem value="projected" className="text-2xs cursor-pointer dark:focus:bg-[#0bd1a2]/20 dark:focus:text-[#0bd1a2]">
                              {tProposal("projectedMode")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {curveRoleOptions.length > 1 && (
                        isGame ? (
                          <GameDropdown
                            value={curveRoleFilter}
                            onValueChange={(value) => setCurveRoleFilter(value as RoleFilter)}
                            options={curveRoleOptions.map((role) => ({
                              value: role,
                              label: role === "All" ? "All Roles" : role,
                            }))}
                            size="sm"
                            className="w-[100px]"
                          />
                        ) : (
                          <Select
                            value={curveRoleFilter}
                            onValueChange={(value: string) => setCurveRoleFilter(value as RoleFilter)}
                          >
                            <SelectTrigger className="w-[100px] h-7 text-2xs btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-none dark:border dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2] dark:rounded-none">
                              {curveRoleOptions.map((role) => (
                                <SelectItem
                                  key={role}
                                  value={role}
                                  className="text-2xs cursor-pointer dark:focus:bg-[#0bd1a2]/20 dark:focus:text-[#0bd1a2]"
                                >
                                  {role === "All" ? tVoting("allRoles") : role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )
                      )}
                    </div>
                  </div>
                  {voteTimelineData.length > 0 ? (
                    <VoteTrendLineChart
                      data={voteTimelineData}
                      chartDomain={chartDomain}
                      dailyTicks={dailyTicks}
                      yAxisDomain={yAxisDomain}
                      voteColors={voteColors}
                      shouldShowPower={shouldShowPower}
                      formatTickDate={formatTickDate}
                      renderTooltip={renderVoteTrendTooltip}
                      height={200}
                      thresholdReferenceValue={chartMode === "projected" ? thresholdReferenceValue : null}
                      thresholdLabel={thresholdLabel}
                      isGame={isGame}
                      isDark={isDark}
                    />
                  ) : (
                    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                      {tProposal("notEnoughData")}
                    </div>
                  )}
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
                  onVoteSubmitted={refresh}
                />
              )}

            </div>
          </div>
          </FadeIn>

          {/* Voting Records Section - Combined DRep, SPO, and CC votes */}
          {allVotes.length > 0 && (
            <FadeIn delay={100} duration={500} distance={24}>
            <div className="mt-12">
              <VotingRecords
                votes={allVotes}
                proposalId={selectedAction.proposalId || selectedAction.hash}
                showDownload={allVotes.length > 0}
                isExporting={isExporting}
                onDownloadFormatChange={(value) => handleExport(value)}
                onMetricsExport={handleMetricsExport}
              />
            </div>
            </FadeIn>
          )}
        </div>
      </div>
    </>
  );
}

// Extracted components: VoteTrendTooltip, RoleLegend, ExcludedBreakdownDisplay, RolePlaceholder
export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: true,
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
