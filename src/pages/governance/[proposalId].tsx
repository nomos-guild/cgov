import { useEffect, useState, useMemo, useCallback } from "react";
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
import { setSelectedAction } from "@/store/governanceSlice";
import { useGovernanceApi } from "@/contexts/GovernanceApiContext";
import { Twitter, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
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
import { exportToJSON, exportToMarkdown, exportToCSV, downloadFile } from "@/lib/exportRationales";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { GovernanceAction, VoterType } from "@/types/governance";
import { parseNumeric, deriveCcAbstainCount } from "@/lib/voteMath";
import { canRoleVoteOnAction, getEligibleRoles } from "@/lib/governanceVotingEligibility";

function getStatusColor(status: GovernanceAction["status"]): string {
  switch (status) {
    case "Active":
    case "Approved":
      return "text-primary border-primary/40 bg-primary/10";
    default:
      return "text-foreground/70 border-foreground/30 bg-transparent";
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

export default function GovernanceDetail() {
  const router = useRouter();
  const { proposalId } = router.query;
  const dispatch = useAppDispatch();
  const selectedAction = useAppSelector((state) => state.governance.selectedAction);

  const [downloadFormat, setDownloadFormat] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [contentVisible, setContentVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string | null>("live-voting");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);
  const api = useGovernanceApi();

  useEffect(() => {
    const loadProposal = async () => {
      if (!router.isReady || typeof proposalId !== "string") {
        return;
      }
      
      try {
        setLoading(true);
        setContentVisible(false);
        const action = await api.getProposalById(proposalId);
        if (action) {
          dispatch(setSelectedAction(action));
          // Small delay for smooth transition
          await new Promise((resolve) => setTimeout(resolve, 150));
          setContentVisible(true);
        }
      } catch (error) {
        console.error("Error loading proposal:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProposal();
  }, [router.isReady, proposalId, dispatch, api]);

  const allVotes = useMemo(() => {
    if (!selectedAction) return [];
    return [...(selectedAction.votes || []), ...(selectedAction.ccVotes || [])];
  }, [selectedAction]);

  const descriptionPreview = useMemo(() => {
    if (!selectedAction?.description) return null;
    const description = selectedAction.description;
    const maxPreviewLength = 150;
    const shouldTruncate = description.length > maxPreviewLength;
    return {
      full: description,
      preview: shouldTruncate ? description.substring(0, maxPreviewLength) + "..." : description,
      shouldTruncate,
    };
  }, [selectedAction?.description]);

  const drepAbstainStats = useMemo(() => {
    const drepVotes = allVotes.filter((v) => v.voterType === "DRep");
    const totalPower = drepVotes.reduce((sum, v) => sum + (v.votingPowerAda || 0), 0);
    if (totalPower <= 0) {
      return { percent: 0, power: 0 };
    }
    const abstainPower = drepVotes
      .filter((v) => v.vote === "Abstain")
      .reduce((sum, v) => sum + (v.votingPowerAda || 0), 0);
    return {
      percent: (abstainPower / totalPower) * 100,
      power: abstainPower,
    };
  }, [allVotes]);

  const spoAbstainStats = useMemo(() => {
    const spoVotes = allVotes.filter((v) => v.voterType === "SPO");
    const totalPower = spoVotes.reduce((sum, v) => sum + (v.votingPowerAda || 0), 0);
    if (totalPower <= 0) {
      return { percent: 0, power: 0 };
    }
    const abstainPower = spoVotes
      .filter((v) => v.vote === "Abstain")
      .reduce((sum, v) => sum + (v.votingPowerAda || 0), 0);
    return {
      percent: (abstainPower / totalPower) * 100,
      power: abstainPower,
    };
  }, [allVotes]);

  const ccAbstainStats = useMemo(() => {
    const ccVotes = allVotes.filter((v) => v.voterType === "CC");

    if (ccVotes.length === 0) {
      const yesCount = selectedAction?.cc?.yesCount ?? 0;
      const noCount = selectedAction?.cc?.noCount ?? 0;
      const percent = selectedAction?.cc?.abstainPercent ?? 0;
      const derivedAbstain =
        deriveCcAbstainCount(
          yesCount,
          noCount,
          selectedAction?.cc?.yesPercent,
          selectedAction?.cc?.noPercent,
          percent
        ) ?? 0;

      return { percent, count: derivedAbstain, yesCount, noCount };
    }

    const yesCount = ccVotes.filter((v) => v.vote === "Yes").length;
    const noCount = ccVotes.filter((v) => v.vote === "No").length;
    const abstainCount = ccVotes.filter((v) => v.vote === "Abstain").length;

    return {
      percent: (abstainCount / ccVotes.length) * 100,
      count: abstainCount,
      yesCount,
      noCount,
    };
  }, [allVotes, selectedAction?.cc]);

  type RoleFilter = "All" | VoterType;

  const eligibleRoles = useMemo<VoterType[]>(() => {
    if (!selectedAction) return [];
    return getEligibleRoles(selectedAction.type);
  }, [selectedAction]);

  const [curveRoleFilter, setCurveRoleFilter] = useState<RoleFilter>("All");
  const curveRoleOptions = useMemo<RoleFilter[]>(() => ["All", ...eligibleRoles], [eligibleRoles]);

  useEffect(() => {
    if (!curveRoleOptions.includes(curveRoleFilter)) {
      setCurveRoleFilter("All");
    }
  }, [curveRoleOptions, curveRoleFilter]);

  const voteTimelineData = useMemo<TimelinePoint[]>(() => {
    const roleFilteredVotes =
      curveRoleFilter === "All" ? allVotes : allVotes.filter((vote) => vote.voterType === curveRoleFilter);

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

  const shouldShowPower = curveRoleFilter === "DRep" || curveRoleFilter === "SPO";
  const renderVoteTrendTooltip = useCallback(
    (tooltipProps: TooltipProps<number, string>) => (
      <VoteTrendTooltip {...tooltipProps} showPower={shouldShowPower} />
    ),
    [shouldShowPower]
  );
  const useDashedPowerLines = shouldShowPower && curveRoleFilter !== "DRep";

  if (!router.isReady || loading || !selectedAction) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <div className="text-center animate-fade-in">
            <p className="text-muted-foreground">
              {loading ? "Loading governance action..." : "Governance action not found"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const allowDRep = canRoleVoteOnAction(selectedAction.type, "DRep");
  const allowSPO = canRoleVoteOnAction(selectedAction.type, "SPO");
  const allowCC = canRoleVoteOnAction(selectedAction.type, "CC");

  const drepInfo = allowDRep ? selectedAction.drep : undefined;
  const spoInfo = allowSPO ? selectedAction.spo : undefined;
  const ccInfo = allowCC ? selectedAction.cc : undefined;

  const drepYesAda = parseNumeric(drepInfo?.yesAda);
  const drepNoAda = parseNumeric(drepInfo?.noAda);
  const spoYesAda = parseNumeric(spoInfo?.yesAda);
  const spoNoAda = parseNumeric(spoInfo?.noAda);
  const ccYesCount = ccAbstainStats.yesCount ?? ccInfo?.yesCount ?? 0;
  const ccNoCount = ccAbstainStats.noCount ?? ccInfo?.noCount ?? 0;

  const handleTwitterShare = () => {
    const url = typeof window !== "undefined" 
      ? `${window.location.origin}/governance/${selectedAction.id}`
      : "";
    const text = `Check out this Cardano governance proposal: ${selectedAction.title}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const handleExport = (format: "json" | "markdown" | "csv") => {
    const sanitizedTitle = selectedAction.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
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
        <meta name="description" content={selectedAction.description || selectedAction.title} />
      </Head>
      <div className="min-h-screen bg-background">
        <div className={`container mx-auto px-4 sm:px-6 py-6 sm:py-8 transition-opacity duration-300 ${contentVisible ? "opacity-100" : "opacity-0"}`}>

          {/* Header Section */}
          <Card className={`mb-6 sm:mb-8 animate-slide-in-bottom`}>
            <div className="p-4 sm:p-6">
              <div className="mb-4">
                <div className="border-t border-border/50 pt-4 mb-4">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">{selectedAction.title}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    {allVotes.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTwitterShare}
                        className="flex items-center gap-2 whitespace-nowrap"
                      >
                        <Twitter className="h-4 w-4" />
                        <span className="hidden sm:inline">Share on X</span>
                        <span className="sm:hidden">Share</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {descriptionPreview && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="text-sm sm:text-base text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {isDescriptionExpanded ? descriptionPreview.full : descriptionPreview.preview}
                  </div>
                  {descriptionPreview.shouldTruncate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="mt-3"
                    >
                      {isDescriptionExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Show More
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>

          <div className={`mb-6 sm:mb-8 transition-opacity duration-300 delay-75 ${contentVisible ? "opacity-100" : "opacity-0"}`}>
            <Tabs value={selectedTab || undefined} onValueChange={setSelectedTab} className="w-full">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                    {selectedTab ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>

                {selectedTab && (
                  <>
                    <TabsContent value="live-voting" className="mt-0">
                      {allVotes.length > 0 ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-2 justify-center">
                            <Badge variant="outline" className={getStatusColor(selectedAction.status)}>
                              {selectedAction.status}
                            </Badge>
                            <Badge variant="outline" className="border-border">
                              {selectedAction.type}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-start gap-4 sm:gap-6" style={{ overflow: "visible" }}>
                          <div className="flex flex-col items-center gap-3">
                            {allowDRep ? (
                              drepInfo ? (
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
                                    className="scale-90 md:scale-100 origin-center"
                                  />
                                  <RoleLegend
                                    role="DRep"
                                    yesLabel={formatAdaValue(drepYesAda || 0)}
                                    noLabel={formatAdaValue(drepNoAda || 0)}
                                    abstainLabel={formatAdaValue(drepAbstainStats.power)}
                                    unit="ADA"
                                  />
                                </>
                              ) : (
                                <RolePlaceholder role="DRep" message="No on-chain data yet" />
                              )
                            ) : (
                              <RolePlaceholder role="DRep" message="Not eligible for this action" />
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-3">
                            {allowCC ? (
                              ccInfo ? (
                                <>
                                  <VoteProgress
                                    title="CC"
                                    yesPercent={ccInfo.yesPercent}
                                    noPercent={ccInfo.noPercent || 0}
                                    abstainPercent={ccInfo.abstainPercent ?? ccAbstainStats.percent}
                                    yesValue={ccYesCount}
                                    noValue={ccNoCount}
                                    abstainValue={ccAbstainStats.count}
                                    valueUnit="count"
                                    className="scale-90 md:scale-100 origin-center"
                                  />
                                  <RoleLegend
                                    role="CC"
                                    yesLabel={`${ccYesCount}`}
                                    noLabel={`${ccNoCount}`}
                                    abstainLabel={`${ccAbstainStats.count ?? 0}`}
                                    unit="votes"
                                  />
                                </>
                              ) : (
                                <RolePlaceholder role="CC" message="No on-chain data yet" />
                              )
                            ) : (
                              <RolePlaceholder role="CC" message="Not eligible for this action" />
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-3">
                            {allowSPO ? (
                              spoInfo ? (
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
                                    className="scale-90 md:scale-100 origin-center"
                                  />
                                  <RoleLegend
                                    role="SPO"
                                    yesLabel={formatAdaValue(spoYesAda || 0)}
                                    noLabel={formatAdaValue(spoNoAda || 0)}
                                    abstainLabel={formatAdaValue(spoAbstainStats.power)}
                                    unit="ADA"
                                  />
                                </>
                              ) : (
                                <RolePlaceholder role="SPO" message="No on-chain data yet" />
                              )
                            ) : (
                              <RolePlaceholder role="SPO" message="Not eligible for this action" />
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
                    <TabsContent value="bubble-map" className="mt-0">
                      <BubbleMap votes={allVotes} />
                    </TabsContent>
                    <TabsContent value="curves" className="mt-0">
                      <Card className="p-4 sm:p-6">
                        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <h3 className="text-lg font-semibold">Voting trend</h3>
                            <p className="text-sm text-muted-foreground">
                              {shouldShowPower
                                ? "Cumulative voting power (ADA)"
                                : "Cumulative yes / no / abstain votes"}{" "}
                              · {curveRoleFilter === "All" ? "All roles" : `${curveRoleFilter} only`}
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
                                        ? "bg-foreground text-background border-foreground"
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
                              Updated {voteTimelineData[voteTimelineData.length - 1].label}
                            </div>
                          )}
                        </div>
                        {voteTimelineData.length > 0 ? (
                          <div className="h-[320px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={voteTimelineData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                                <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={24} />
                                <YAxis
                                  yAxisId="primary"
                                  allowDecimals={false}
                                  tick={{ fontSize: 12 }}
                                  tickFormatter={
                                    shouldShowPower
                                      ? (value) => formatAdaValue(value).replace(" ₳", "")
                                      : undefined
                                  }
                                />
                                <RechartsTooltip content={renderVoteTrendTooltip} />
                                <Legend />
                                {shouldShowPower ? (
                                  <>
                                    <Line
                                      type="monotone"
                                      dataKey="yesPower"
                                      stroke={VOTE_COLORS.yes}
                                      strokeWidth={2}
                                      strokeDasharray={useDashedPowerLines ? "5 4" : undefined}
                                      dot={false}
                                      name="Yes Power"
                                      yAxisId="primary"
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="noPower"
                                      stroke={VOTE_COLORS.no}
                                      strokeWidth={2}
                                      strokeDasharray={useDashedPowerLines ? "5 4" : undefined}
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
                                      strokeDasharray={useDashedPowerLines ? "5 4" : undefined}
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
                    <TabsContent value="details" className="mt-0">
                      <div className="space-y-4">
                        {/* Time Until Expiry */}
                        {selectedAction && (() => {
                          const submissionEpoch = selectedAction.submissionEpoch;
                          const expiryEpoch = selectedAction.expiryEpoch || submissionEpoch + 6;
                          // Estimate current epoch (in real app, fetch from API)
                          // Using a mock current epoch for now - submissionEpoch + some days
                          const mockCurrentEpoch = submissionEpoch + 2; // Example: 2 epochs passed
                          const epochsRemaining = Math.max(0, expiryEpoch - mockCurrentEpoch);
                          const daysRemaining = epochsRemaining * 5; // 5 days per epoch
                          const totalEpochs = 6;
                          const epochsPassed = Math.min(totalEpochs, totalEpochs - epochsRemaining);
                          const progressPercent = (epochsPassed / totalEpochs) * 100;

                          return (
                            <>
                              <div>
                                <label className="text-xs sm:text-sm text-muted-foreground mb-2 block">Time Until Expiry</label>
                                <div className="text-xs sm:text-sm text-foreground mb-3">
                                  {epochsRemaining > 0 ? (
                                    <>
                                      {epochsRemaining} {epochsRemaining === 1 ? "epoch" : "epochs"} ({daysRemaining} {daysRemaining === 1 ? "day" : "days"}) remaining
                                    </>
                                  ) : (
                                    <span className="text-destructive">Expired</span>
                                  )}
                                </div>
                                <Progress 
                                  value={progressPercent} 
                                  className="h-2 mb-3"
                                  variant={epochsRemaining === 0 ? "no" : epochsRemaining <= 2 ? "no" : "default"}
                                />
                                <div className="grid grid-cols-3 gap-4 text-center text-xs">
                                  <div>
                                    <div className="text-muted-foreground mb-1">Submission</div>
                                    <div className="font-semibold">Epoch {submissionEpoch}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground mb-1">Current</div>
                                    <div className="font-semibold">Epoch {mockCurrentEpoch}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground mb-1">Expiry</div>
                                    <div className="font-semibold">Epoch {expiryEpoch}</div>
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                        {/* Vote Metric */}
                        <div>
                          <label className="text-xs sm:text-sm text-muted-foreground mb-2 block">Vote</label>
                          <div className="flex flex-col gap-1">
                            <div className="text-xs sm:text-sm text-foreground">Yes</div>
                            <div className="text-xs sm:text-sm text-foreground">No</div>
                            <div className="text-xs sm:text-sm text-foreground">Abstain</div>
                          </div>
                        </div>
                          <div>
                            <label className="text-xs sm:text-sm text-muted-foreground mb-2 block">Governance Action ID</label>
                            <code className="text-xs sm:text-sm text-muted-foreground bg-secondary px-2 sm:px-3 py-1 rounded font-mono break-all block">
                              {selectedAction.id}
                            </code>
                          </div>
                        <div>
                          <label className="text-xs sm:text-sm text-muted-foreground mb-2 block">Transaction Hash</label>
                          <code className="text-xs sm:text-sm text-muted-foreground bg-secondary px-2 sm:px-3 py-1 rounded font-mono break-all block">
                            {selectedAction.txHash}
                          </code>
                        </div>
                      </div>
                    </TabsContent>
                  </>
                )}
              </div>
            </Tabs>
          </div>

          {/* Voting Records Table */}
          {allVotes.length > 0 && (
            <div className={`mb-6 transition-opacity duration-300 delay-150 ${contentVisible ? "opacity-100" : "opacity-0"}`} style={{ overflow: "visible" }}>
              <VotingRecords
                votes={allVotes}
                proposalId={selectedAction.id}
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
      value: showPower ? formatAdaValue(point.yesPower) : `${point.yesCount.toLocaleString()} votes`,
      color: VOTE_COLORS.yes,
      border: "transparent",
    },
    {
      label: "No",
      value: showPower ? formatAdaValue(point.noPower) : `${point.noCount.toLocaleString()} votes`,
      color: VOTE_COLORS.no,
      border: "transparent",
    },
    {
      label: "Abstain",
      value: showPower ? formatAdaValue(point.abstainPower) : `${point.abstainCount.toLocaleString()} votes`,
      color: VOTE_COLORS.abstain,
      border: "rgba(148, 163, 184, 0.85)",
    },
  ];

  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-md">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full border"
                style={{ backgroundColor: row.color, borderColor: row.border }}
              />
              <span className="font-semibold text-foreground">{row.label}</span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">{row.value}</div>
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
    { label: "Yes", value: yesLabel, color: VOTE_COLORS.yes, border: "transparent" },
    { label: "No", value: noLabel, color: VOTE_COLORS.no, border: "transparent" },
    { label: "Abstain", value: abstainLabel, color: VOTE_COLORS.abstain, border: "rgba(148, 163, 184, 0.85)" },
  ];

  return (
    <div className="w-full max-w-[200px] rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs shadow-sm">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="font-semibold">{role}</span>
        <span>{unit}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full border"
                style={{ backgroundColor: item.color, borderColor: item.border }}
              />
              <span className="font-semibold text-foreground">{item.label}</span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">{item.value}</span>
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


