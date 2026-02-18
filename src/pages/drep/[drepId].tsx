import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import type { GetStaticProps, GetStaticPaths } from "next";
import Head from "next/head";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import {
  useDRepDetail, useAllDRepVotes, useDRepHistory,
  type DRepDetailApiResponse, type DRepHistoryApiResponse,
} from "@/hooks/useDRepData";
import { DRepDelegationChart } from "@/components/dreps/DRepDelegationChart";
import { cn } from "@/lib/utils";
import { VotingRationaleModal } from "@/components/VotingRationaleModal";
import { useGovernanceActions } from "@/hooks/useGovernanceData";
import type { GovernanceAction } from "@/types/governance";
import type { VoteRecord } from "@/types/governance";
import type { DRepVoteRecord } from "@/types/drep";
import {
  fetchDRepDetailServer,
  fetchDRepHistoryServer,
} from "@/lib/serverFetch";

type IntlMessages = typeof import("@/messages/en.json");

interface DRepProfilePageProps {
  messages: IntlMessages;
  initialDrep: DRepDetailApiResponse | null;
  initialVotes: DRepVoteRecord[];
  initialHistory: DRepHistoryApiResponse | null;
}

/**
 * Format large numbers with appropriate suffix (K, M, B)
 */
function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format number with commas
 */
function formatNumber(value: number | null | undefined): string {
  if (value == null) return "--";
  return value.toLocaleString();
}

/**
 * Truncate DRep ID for display
 */
function truncateId(id: string, startChars = 12, endChars = 8): string {
  if (id.length <= startChars + endChars + 3) return id;
  return `${id.slice(0, startChars)}...${id.slice(-endChars)}`;
}

/**
 * Format date for display using the active locale
 */
function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get vote badge color
 */
function getVoteBadgeClass(vote: "Yes" | "No" | "Abstain", isGame: boolean, isLight: boolean): string {
  if (isGame) {
    switch (vote) {
      case "Yes":
        return "bg-[#00ff66]/15 text-[#00ff66] border border-[#00ff66]/25";
      case "No":
        return "bg-[#ff3333]/15 text-[#ff3333] border border-[#ff3333]/25";
      case "Abstain":
        return "bg-white/10 text-white/60 border border-white/15";
    }
  }
  if (!isLight) {
    switch (vote) {
      case "Yes":
        return "bg-[#0bd1a2]/15 text-[#0bd1a2] border border-[#0bd1a2]/25";
      case "No":
        return "bg-red-900/30 text-red-400 border border-red-400/25";
      case "Abstain":
        return "bg-[#0bd1a2]/5 text-[#0bd1a2]/60 border border-[#0bd1a2]/15";
    }
  }
  switch (vote) {
    case "Yes":
      return "text-foreground border border-foreground/40 bg-foreground/5";
    case "No":
      return "text-foreground border border-foreground/40 bg-destructive/10";
    case "Abstain":
      return "text-foreground/60 border border-foreground/20 bg-transparent";
  }
}

// Vote breakdown chart colors — game theme matches DRep dashboard donut (dark fills, subtle borders)
const VOTE_COLORS = {
  game: {
    yes: "rgba(20, 20, 20, 0.7)",
    no: "rgba(40, 40, 40, 0.7)",
    abstain: "rgba(55, 55, 55, 0.7)",
  },
  // Light theme - graduated greys
  light: {
    yes: "#ffffff",       // white
    abstain: "#e2e8f0",   // slate-200 (same grey)
    no: "#94a3b8",        // slate-400 (darker grey)
  },
  // Nerd/dark theme - teal monochrome
  dark: {
    yes: "rgba(11, 209, 162, 0.6)",
    no: "rgba(11, 209, 162, 0.25)",
    abstain: "rgba(11, 209, 162, 0.1)",
  },
};

interface VoteBreakdownChartProps {
  yes: number;
  no: number;
  abstain: number;
  isGame: boolean;
  isLight: boolean;
  labels: { yes: string; no: string; abstain: string; empty: string };
}

function VoteBreakdownChart({ yes, no, abstain, isGame, isLight, labels }: VoteBreakdownChartProps) {
  const total = yes + no + abstain;
  const colors = isGame ? VOTE_COLORS.game : isLight ? VOTE_COLORS.light : VOTE_COLORS.dark;

  if (total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        {labels.empty}
      </div>
    );
  }

  const data = [
    { name: labels.yes, value: yes, color: colors.yes },
    { name: labels.no, value: no, color: colors.no },
    { name: labels.abstain, value: abstain, color: colors.abstain },
  ].filter((d) => d.value > 0);

  return (
    <div className="overflow-visible [&_.recharts-wrapper]:!overflow-visible">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart style={{ overflow: "visible" }}>
            {isLight && (
              <defs>
                <filter id="pieShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.25" />
                </filter>
              </defs>
            )}
            <Pie
              isAnimationActive={false}
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              cornerRadius={isLight ? 0 : 2}
              paddingAngle={isGame ? 2 : 3}
              dataKey="value"
              stroke="none"
              style={isLight ? { filter: "url(#pieShadow)" } : undefined}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  fillOpacity={isGame ? 0.85 : 1}
                  stroke={isLight ? "rgba(15, 23, 42, 0.15)" : isGame ? `rgba(255,255,255,${0.6 + index * 0.1})` : "rgba(11, 209, 162, 0.5)"}
                  strokeWidth={isLight ? 2 : 2}
                />
              ))}
            </Pie>
            <Tooltip
              isAnimationActive={false}
              animationDuration={0}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const item = payload[0].payload;
                const percent = ((item.value / total) * 100).toFixed(1);
                return (
                  <div className={cn(
                    "rounded-lg p-2 text-sm",
                    isGame
                      ? "game-tooltip-card rounded-sm px-3 py-2 text-xs"
                      : isLight
                      ? "bg-white text-gray-900 border border-gray-200 shadow-[0_4px_12px_rgba(15,23,42,0.15)]"
                      : "bg-[rgba(8,8,8,0.95)] border border-[#0bd1a2]/30 rounded-sm px-3 py-2 text-xs"
                  )}>
                    <p className={cn("font-medium", isGame ? "text-white" : !isLight && "text-[#0bd1a2]")}>{item.name}: {item.value}</p>
                    <p className={cn("text-xs opacity-70", isGame ? "text-white/70" : !isLight && "text-[#0bd1a2]/70")}>{percent}%</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        {data.map((item) => {
          const isWhite = isLight && item.color === "#ffffff";
          return (
            <div key={item.name} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{
                  backgroundColor: item.color,
                  border: isWhite ? "1.5px solid rgba(15, 23, 42, 0.3)" : isGame ? "1px solid rgba(255,255,255,0.25)" : !isLight ? "1px solid rgba(11, 209, 162, 0.5)" : undefined,
                  boxShadow: isLight ? "0 1px 3px rgba(15,23,42,0.2)" : undefined,
                }}
              />
              <span className={isGame ? "text-white/70" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/70"}>
                {item.name}: {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Engagement chart colors — game theme matches DRep dashboard donut
const ENGAGEMENT_COLORS = {
  game: {
    voted: "rgba(20, 20, 20, 0.7)",
    notVoted: "rgba(55, 55, 55, 0.7)",
  },
  light: {
    voted: "#ffffff",
    notVoted: "#e2e8f0",  // slate-200 gray
  },
  dark: {
    voted: "rgba(11, 209, 162, 0.6)",
    notVoted: "rgba(11, 209, 162, 0.15)",
  },
};

interface EngagementChartProps {
  votedCount: number;
  notVotedCount: number;
  isGame: boolean;
  isLight: boolean;
  labels: { voted: string; notVoted: string; empty: string };
}

function EngagementChart({ votedCount, notVotedCount, isGame, isLight, labels }: EngagementChartProps) {
  const voted = votedCount;
  const notVoted = notVotedCount;
  const total = voted + notVoted;

  const colors = isGame ? ENGAGEMENT_COLORS.game : isLight ? ENGAGEMENT_COLORS.light : ENGAGEMENT_COLORS.dark;

  if (total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        {labels.empty}
      </div>
    );
  }

  const data = [
    { name: labels.voted, value: voted, color: colors.voted },
    { name: labels.notVoted, value: notVoted, color: colors.notVoted },
  ].filter((d) => d.value > 0);

  return (
    <div className="overflow-visible [&_.recharts-wrapper]:!overflow-visible">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart style={{ overflow: "visible" }}>
            {isLight && (
              <defs>
                <filter id="engagementShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.25" />
                </filter>
              </defs>
            )}
            <Pie
              isAnimationActive={false}
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              cornerRadius={isLight ? 0 : 2}
              paddingAngle={isGame ? 2 : 3}
              dataKey="value"
              stroke="none"
              style={isLight ? { filter: "url(#engagementShadow)" } : undefined}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  fillOpacity={isGame ? 0.85 : 1}
                  stroke={isLight ? "rgba(15, 23, 42, 0.15)" : isGame ? `rgba(255,255,255,${0.6 + index * 0.1})` : "rgba(11, 209, 162, 0.5)"}
                  strokeWidth={isLight ? 2 : 2}
                />
              ))}
            </Pie>
            <Tooltip
              isAnimationActive={false}
              animationDuration={0}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const item = payload[0].payload;
                const percent = ((item.value / total) * 100).toFixed(1);
                return (
                  <div className={cn(
                    "rounded-lg p-2 text-sm",
                    isGame
                      ? "game-tooltip-card rounded-sm px-3 py-2 text-xs"
                      : isLight
                      ? "bg-white text-gray-900 border border-gray-200 shadow-[0_4px_12px_rgba(15,23,42,0.15)]"
                      : "bg-[rgba(8,8,8,0.95)] border border-[#0bd1a2]/30 rounded-sm px-3 py-2 text-xs"
                  )}>
                    <p className={cn("font-medium", isGame ? "text-white" : !isLight && "text-[#0bd1a2]")}>{item.name}: {item.value}</p>
                    <p className={cn("text-xs opacity-70", isGame ? "text-white/70" : !isLight && "text-[#0bd1a2]/70")}>{percent}%</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        {data.map((item) => {
          const isWhite = isLight && item.color === "#ffffff";
          return (
            <div key={item.name} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{
                  backgroundColor: item.color,
                  border: isWhite ? "1.5px solid rgba(15, 23, 42, 0.3)" : isGame ? "1px solid rgba(255,255,255,0.25)" : !isLight ? "1px solid rgba(11, 209, 162, 0.5)" : undefined,
                  boxShadow: isLight ? "0 1px 3px rgba(15,23,42,0.2)" : undefined,
                }}
              />
              <span className={isGame ? "text-white/70" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/70"}>
                {item.name}: {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Rationale chart colors — game theme matches DRep dashboard donut
const RATIONALE_COLORS = {
  game: {
    withRationale: "rgba(20, 20, 20, 0.7)",
    withoutRationale: "rgba(55, 55, 55, 0.7)",
  },
  light: {
    withRationale: "#ffffff",
    withoutRationale: "#e2e8f0", // slate-200 gray
  },
  dark: {
    withRationale: "rgba(11, 209, 162, 0.6)",
    withoutRationale: "rgba(11, 209, 162, 0.15)",
  },
};

interface RationaleChartProps {
  rationalesProvided: number;
  totalVotesCast: number;
  isGame: boolean;
  isLight: boolean;
  labels: { withRationale: string; without: string; empty: string };
}

function RationaleChart({ rationalesProvided, totalVotesCast, isGame, isLight, labels }: RationaleChartProps) {
  const withRationale = rationalesProvided;
  const withoutRationale = totalVotesCast - rationalesProvided;
  const total = totalVotesCast;

  const colors = isGame ? RATIONALE_COLORS.game : isLight ? RATIONALE_COLORS.light : RATIONALE_COLORS.dark;

  if (total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        {labels.empty}
      </div>
    );
  }

  const data = [
    { name: labels.withRationale, value: withRationale, color: colors.withRationale },
    { name: labels.without, value: withoutRationale, color: colors.withoutRationale },
  ].filter((d) => d.value > 0);

  return (
    <div className="overflow-visible [&_.recharts-wrapper]:!overflow-visible">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart style={{ overflow: "visible" }}>
            {isLight && (
              <defs>
                <filter id="rationaleShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.25" />
                </filter>
              </defs>
            )}
            <Pie
              isAnimationActive={false}
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              cornerRadius={isLight ? 0 : 2}
              paddingAngle={isGame ? 2 : 3}
              dataKey="value"
              stroke="none"
              style={isLight ? { filter: "url(#rationaleShadow)" } : undefined}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  fillOpacity={isGame ? 0.85 : 1}
                  stroke={isLight ? "rgba(15, 23, 42, 0.15)" : isGame ? `rgba(255,255,255,${0.6 + index * 0.1})` : "rgba(11, 209, 162, 0.5)"}
                  strokeWidth={isLight ? 2 : 2}
                />
              ))}
            </Pie>
            <Tooltip
              isAnimationActive={false}
              animationDuration={0}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const item = payload[0].payload;
                const percent = ((item.value / total) * 100).toFixed(1);
                return (
                  <div className={cn(
                    "rounded-lg p-2 text-sm",
                    isGame
                      ? "game-tooltip-card rounded-sm px-3 py-2 text-xs"
                      : isLight
                      ? "bg-white text-gray-900 border border-gray-200 shadow-[0_4px_12px_rgba(15,23,42,0.15)]"
                      : "bg-[rgba(8,8,8,0.95)] border border-[#0bd1a2]/30 rounded-sm px-3 py-2 text-xs"
                  )}>
                    <p className={cn("font-medium", isGame ? "text-white" : !isLight && "text-[#0bd1a2]")}>{item.name}: {item.value}</p>
                    <p className={cn("text-xs opacity-70", isGame ? "text-white/70" : !isLight && "text-[#0bd1a2]/70")}>{percent}%</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        {data.map((item) => {
          const isWhite = isLight && item.color === "#ffffff";
          return (
            <div key={item.name} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{
                  backgroundColor: item.color,
                  border: isWhite ? "1.5px solid rgba(15, 23, 42, 0.3)" : isGame ? "1px solid rgba(255,255,255,0.25)" : !isLight ? "1px solid rgba(11, 209, 162, 0.5)" : undefined,
                  boxShadow: isLight ? "0 1px 3px rgba(15,23,42,0.2)" : undefined,
                }}
              />
              <span className={isGame ? "text-white/70" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/70"}>
                {item.name}: {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/** Convert a DRepVoteRecord to the VoteRecord shape the rationale modal expects */
function toVoteRecord(vote: DRepVoteRecord, drepId: string, drepName: string): VoteRecord {
  return {
    voterType: "DRep",
    voterId: drepId,
    voterName: drepName,
    drepId,
    drepName,
    vote: vote.vote,
    votingPower: vote.votingPower ?? "0",
    votingPowerAda: vote.votingPowerAda,
    anchorUrl: vote.anchorUrl ?? undefined,
    rationale: vote.rationale ?? undefined,
    votedAt: vote.votedAt ?? "",
    txHash: vote.txHash,
  };
}

/** Display item that works for both voted and not-voted proposals */
interface VotingDisplayItem {
  proposalId: string;
  proposalTitle: string;
  proposalType: string | null;
  vote: "Yes" | "No" | "Abstain" | null;
  votedAt: string | null;
  txHash: string;
  rationale: string | null;
  anchorUrl: string | null;
  votingPower: string | null;
  votingPowerAda: number;
  /** Previous vote (only set for vote-change items) */
  previousVote?: "Yes" | "No" | "Abstain";
  previousVotedAt?: string | null;
}

type VoteFilter = "voted" | "not_voted" | "all" | "changed";

interface VotingHistoryTableProps {
  items: VotingDisplayItem[];
  drepId: string;
  drepName: string;
  isGame: boolean;
  isLight: boolean;
  isLoading: boolean;
  locale: string;
  labels: {
    empty: string;
    proposal: string;
    type: string;
    vote: string;
    votingPower: string;
    date: string;
    rationale: string;
    view: string;
    unknown: string;
    yes: string;
    no: string;
    abstain: string;
    notVoted: string;
  };
}

function VotingHistoryTable({ items, drepId, drepName, isGame, isLight, isLoading, locale, labels }: VotingHistoryTableProps) {
  const [selectedVote, setSelectedVote] = useState<VoteRecord | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {labels.empty}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={cn(
              "border-b text-left",
              isGame ? "border-white/10 text-white/60" : isLight ? "border-gray-200 text-muted-foreground" : "border-[#0bd1a2]/30 text-[#0bd1a2]/60"
            )}>
              <th className="py-3 px-2 font-medium">{labels.proposal}</th>
              <th className="py-3 px-2 font-medium hidden sm:table-cell">{labels.type}</th>
              <th className="py-3 px-2 font-medium">{labels.vote}</th>
              <th className="py-3 px-2 font-medium">{labels.date}</th>
              <th className="py-3 px-2 font-medium hidden sm:table-cell">{labels.rationale}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const hasRationale = item.rationale != null && item.rationale.trim().length > 0;
              const isNotVoted = item.vote === null;
              const hasVoteChange = !!item.previousVote;
              return (
                <tr
                  key={`${item.proposalId}-${item.txHash}`}
                  className={cn(
                    "border-b transition-colors",
                    isGame
                      ? "border-white/5 hover:bg-white/5"
                      : isLight
                      ? "border-gray-100 hover:bg-gray-50"
                      : "border-[#0bd1a2]/10 hover:bg-[#0bd1a2]/5"
                  )}
                >
                  <td className="py-3 px-2">
                    <Link
                      href={`/governance/${encodeURIComponent(item.proposalId)}`}
                      className={cn(
                        "hover:underline font-medium",
                        isGame ? "text-white" : isLight ? "text-primary" : "text-[#0bd1a2]"
                      )}
                    >
                      {item.proposalTitle || truncateId(item.proposalId)}
                    </Link>
                  </td>
                  <td className="py-3 px-2 hidden sm:table-cell">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      isGame ? "bg-white/10 text-white/70" : isLight ? "bg-gray-100 text-muted-foreground" : "bg-[#0bd1a2]/10 text-[#0bd1a2]/70"
                    )}>
                      {item.proposalType || labels.unknown}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    {isNotVoted ? (
                      <span className={cn(
                        "text-xs px-2 py-1 font-medium",
                        isGame ? "rounded-full text-white/30" : isLight ? "rounded-full text-muted-foreground/50" : "rounded-none text-[#0bd1a2]/30"
                      )}>
                        --
                      </span>
                    ) : hasVoteChange ? (
                      <span className="inline-flex items-center gap-1">
                        <span className={cn(
                          "text-xs px-2 py-1 font-medium opacity-50 line-through",
                          isGame ? "rounded-full" : isLight ? "rounded-full" : "rounded-none",
                          getVoteBadgeClass(item.previousVote!, isGame, isLight)
                        )}>
                          {item.previousVote === "Yes" ? labels.yes : item.previousVote === "No" ? labels.no : labels.abstain}
                        </span>
                        <span className={cn(
                          "text-xs",
                          isGame ? "text-white/40" : isLight ? "text-muted-foreground/50" : "text-[#0bd1a2]/40"
                        )}>→</span>
                        <span className={cn(
                          "text-xs px-2 py-1 font-medium",
                          isGame ? "rounded-full" : isLight ? "rounded-full" : "rounded-none",
                          getVoteBadgeClass(item.vote!, isGame, isLight)
                        )}>
                          {item.vote === "Yes" ? labels.yes : item.vote === "No" ? labels.no : labels.abstain}
                        </span>
                      </span>
                    ) : (
                      <span className={cn(
                        "text-xs px-2 py-1 font-medium",
                        isGame ? "rounded-full" : isLight ? "rounded-full" : "rounded-none",
                        getVoteBadgeClass(item.vote!, isGame, isLight)
                      )}>
                        {item.vote === "Yes" ? labels.yes : item.vote === "No" ? labels.no : labels.abstain}
                      </span>
                    )}
                  </td>
                  <td className={cn(
                    "py-3 px-2",
                    isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                  )}>
                    {isNotVoted ? "--" : formatDate(item.votedAt, locale)}
                  </td>
                  <td className="py-3 px-2 hidden sm:table-cell">
                    {hasRationale && !isNotVoted ? (
                      <button
                        onClick={() => setSelectedVote(toVoteRecord(item as DRepVoteRecord, drepId, drepName))}
                        className={cn(
                          "text-xs font-medium px-2.5 py-1 transition-colors",
                          isGame
                            ? "game-nav-btn-sm"
                            : isLight
                            ? "rounded-md bg-white text-black shadow-[0_4px_12px_rgba(15,23,42,0.15)] hover:bg-black hover:text-white"
                            : "rounded-none border border-[#0bd1a2]/40 text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
                        )}
                      >
                        {labels.view}
                      </button>
                    ) : (
                      <span className={isGame ? "text-white/30" : isLight ? "text-muted-foreground/50" : "text-[#0bd1a2]/30"}>--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <VotingRationaleModal
        vote={selectedVote}
        open={selectedVote !== null}
        onOpenChange={(open) => { if (!open) setSelectedVote(null); }}
      />
    </>
  );
}

export default function DRepProfile({
  initialDrep,
  initialVotes,
  initialHistory,
}: DRepProfilePageProps) {
  const router = useRouter();
  const { drepId } = router.query;
  const { activeTheme } = useTheme();
  const t = useTranslations("drep.profile");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";
  const drepIdStr = typeof drepId === "string" ? drepId : null;

  const { drep, isLoading: isLoadingDrep, error: drepError, refresh } = useDRepDetail(drepIdStr, initialDrep);
  const { votes: allVotes, rawVotes, isLoading: isLoadingAllVotes } = useAllDRepVotes(drepIdStr, initialVotes);
  const { history: delegationHistory } = useDRepHistory(drepIdStr, initialHistory);

  // Compute deduped vote stats from allVotes (already deduplicated by proposalId).
  // These override backend values which may double-count vote changes.
  const votesLoaded = !isLoadingAllVotes && allVotes.length > 0;
  const dedupedVoteCount = votesLoaded ? allVotes.length : drep?.totalVotesCast ?? 0;
  const dedupedRationalesProvided = votesLoaded
    ? allVotes.filter((v) => v.rationale).length
    : drep?.rationalesProvided ?? 0;

  const isLoading = isLoadingDrep && !drep;

  // Vote filter state
  const [voteFilter, setVoteFilter] = useState<VoteFilter>("voted");
  const { actions: allProposals } = useGovernanceActions();

  // Build voted set and not-voted display items
  const votedIds = useMemo(
    () => new Set(allVotes.map((v) => v.proposalId)),
    [allVotes]
  );

  // Determine whether DReps could actually vote on a proposal.
  // The backend may report a drepThreshold for early-era proposals where no active
  // DRep actually cast a vote (only automated delegations like alwaysAbstain exist).
  // For non-Active proposals, check if any active DRep voted via the breakdown.
  const isDRepEligible = (a: GovernanceAction) => {
    // If backend says no DRep threshold, DReps can't vote
    if (a.threshold && a.threshold.drepThreshold == null) return false;
    // For finished proposals, check if any active DRep actually voted
    if (a.status !== "Active" && a.drepBreakdown) {
      const b = a.drepBreakdown;
      const hasActiveDRepVotes =
        Number(b.activeYes || 0) > 0 || Number(b.activeNo || 0) > 0 || Number(b.activeAbstain || 0) > 0;
      if (!hasActiveDRepVotes) return false;
    }
    return true;
  };

  const notVotedItems = useMemo<VotingDisplayItem[]>(() => {
    if (!allProposals.length) return [];
    return allProposals
      .filter((a) => {
        // Only show Active proposals DReps can still vote on
        if (a.status !== "Active") return false;
        if (!isDRepEligible(a)) return false;
        const id = a.proposalId ?? a.hash;
        return !votedIds.has(id);
      })
      .map((a) => ({
        proposalId: a.proposalId ?? a.hash,
        proposalTitle: a.title,
        proposalType: a.type,
        vote: null,
        votedAt: null,
        txHash: a.txHash ?? a.hash,
        rationale: null,
        anchorUrl: null,
        votingPower: null,
        votingPowerAda: 0,
      }));
  }, [allProposals, votedIds]);

  const votedItems = useMemo<VotingDisplayItem[]>(
    () => allVotes.map((v) => ({ ...v })),
    [allVotes]
  );

  // Proposals where the DRep changed their vote (multiple records for same proposalId)
  const changedVoteItems = useMemo<VotingDisplayItem[]>(() => {
    if (!rawVotes.length) return [];
    // Group raw votes by proposalId
    const grouped = new Map<string, DRepVoteRecord[]>();
    for (const v of rawVotes) {
      const list = grouped.get(v.proposalId) ?? [];
      list.push(v);
      grouped.set(v.proposalId, list);
    }
    const items: VotingDisplayItem[] = [];
    for (const [, records] of grouped) {
      if (records.length < 2) continue;
      // Sort by date ascending so we can pair previous → current
      records.sort((a, b) => (a.votedAt ?? "").localeCompare(b.votedAt ?? ""));
      // Only include if the vote actually changed (not just re-submitted the same vote)
      const uniqueVotes = new Set(records.map((r) => r.vote));
      if (uniqueVotes.size < 2) continue;
      const latest = records[records.length - 1];
      const previous = records[records.length - 2];
      items.push({
        ...latest,
        previousVote: previous.vote,
        previousVotedAt: previous.votedAt,
      });
    }
    return items;
  }, [rawVotes]);

  const displayItems = useMemo<VotingDisplayItem[]>(() => {
    switch (voteFilter) {
      case "voted":
        return votedItems;
      case "not_voted":
        return notVotedItems;
      case "all":
        return [...votedItems, ...notVotedItems];
      case "changed":
        return changedVoteItems;
    }
  }, [voteFilter, votedItems, notVotedItems, changedVoteItems]);

  // Corrected participation: count ALL proposals (any status) that DReps are eligible
  // to vote on, filtered by registration epoch so new DReps aren't penalized for
  // proposals that existed before they registered.
  const registeredEpoch = drep?.registeredEpoch ?? null;
  const eligibleProposalCount = useMemo(() => {
    if (!allProposals.length) return 0;
    return allProposals.filter((a) => {
      if (!isDRepEligible(a)) return false;
      // Only count proposals that hadn't expired when the DRep registered
      if (registeredEpoch != null && a.expiryEpoch < registeredEpoch) return false;
      return true;
    }).length;
  }, [allProposals, registeredEpoch]);
  const correctedParticipation = eligibleProposalCount > 0
    ? (dedupedVoteCount / eligibleProposalCount) * 100
    : 0;

  // Card styling — tri-state for light / game / dark
  const cardClass = isGame
    ? "rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] p-4 sm:p-6 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : isLight
    ? "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-6 shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
    : "rounded-none border border-[#0bd1a2] bg-transparent p-4 sm:p-6 shadow-none";

  return (
    <>
      <Head>
        <title>{drep?.name ? t("pageTitle", { name: drep.name }) : t("pageTitleFallback")}</title>
        <meta
          name="description"
          content={drep?.name ? t("pageDescription", { name: drep.name }) : t("pageDescriptionFallback")}
        />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 pt-8 pb-28 sm:px-4 sm:pt-10 sm:pb-36 md:px-6 md:pt-12 md:pb-44">
          {/* Back link */}
          <Link href="/drep">
            <Button
              variant="default"
              className={cn(
                "mb-4",
                isGame
                  ? "game-nav-btn"
                  : isLight
                  ? "bg-white text-black shadow-[0_12px_30px_rgba(15,23,42,0.25)] hover:bg-black hover:text-white"
                  : "rounded-none border border-[#0bd1a2] bg-transparent text-[#0bd1a2] shadow-none hover:bg-[#0bd1a2] hover:text-black"
              )}
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t("backToDashboard")}
            </Button>
          </Link>

          {/* Loading state */}
          {isLoading && (
            isGame ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 md:py-24">
                <GameLoader />
              </div>
            ) : (
              <Card className="p-6 sm:p-8 md:p-12 mb-4 sm:mb-6">
                <div className="flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-b-2 border-primary mb-3 sm:mb-4" />
                  <p className="text-muted-foreground text-sm sm:text-base">
                    {t("loadingProfile")}
                  </p>
                </div>
              </Card>
            )
          )}

          {/* Content - show available data even if some endpoints fail */}
          {!isLoading && (
            <>
              {/* Profile error - inline warning when detail fails */}
              {drepError && !drep && (
                <Card className="p-3 sm:p-4 mb-4 sm:mb-6 border-destructive/50 bg-destructive/5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-destructive text-sm">
                      {t("detailsUnavailable")}
                    </p>
                    <button
                      onClick={refresh}
                      className="shrink-0 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      {tCommon("retry")}
                    </button>
                  </div>
                </Card>
              )}

              {/* Top Row - Profile Card + Vote Breakdown (only when detail loaded) */}
              {drep && (
              <div className="flex flex-col md:flex-row gap-6 mb-6">
                {/* Main Profile Card - Portrait orientation */}
                <div className={cn(cardClass, "w-full md:w-[360px] md:flex-shrink-0")}>
                <div className="flex flex-col gap-5">
                  {/* Profile Info - Centered */}
                  <div className={cn(
                    "flex flex-col items-center text-center pb-5 border-b",
                    isGame ? "border-white/10" : isLight ? "border-black/5" : "border-[#0bd1a2]/30"
                  )}>
                    {/* Avatar */}
                    {drep.iconUrl ? (
                      <img
                        src={drep.iconUrl}
                        alt={drep.name || t("anonymousDRep")}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover mb-3"
                      />
                    ) : (
                      <div className={cn(
                        "w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl font-bold mb-3",
                        isGame
                          ? "text-white"
                          : isLight
                          ? "bg-primary/10 text-primary"
                          : "border border-[#0bd1a2] bg-transparent text-[#0bd1a2]"
                      )}>
                        {(drep.name?.[0] || "D").toUpperCase()}
                      </div>
                    )}
                    {/* Name */}
                    <h1 className={cn(
                      "text-lg sm:text-xl font-bold",
                      isGame ? "landing-title text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                    )}>
                      {drep.name || t("anonymousDRep")}
                    </h1>
                    {/* DRep ID with copy button */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <p className={cn(
                        "text-xs font-mono",
                        isGame ? "text-white/50" : isLight ? "text-muted-foreground/70" : "text-[#0bd1a2]/50"
                      )}>
                        {truncateId(drepIdStr || "", 8, 6)}
                      </p>
                      <button
                        onClick={() => navigator.clipboard.writeText(drepIdStr || "")}
                        className={cn(
                          "p-1 rounded transition-colors",
                          isGame
                            ? "text-white/40 hover:text-white hover:bg-white/10"
                            : isLight
                            ? "text-muted-foreground/60 hover:text-foreground hover:bg-black/5"
                            : "text-[#0bd1a2]/40 hover:text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
                        )}
                        title={t("copyDRepId")}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Stats Table */}
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className={cn(
                        "border-b",
                        isGame ? "border-white/10" : isLight ? "border-black/5" : "border-[#0bd1a2]/20"
                      )}>
                        <td className={cn(
                          "py-2.5",
                          isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                        )}>
                          {t("votingPower")}
                        </td>
                        <td className={cn(
                          "py-2.5 text-right font-medium",
                          isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                        )}>
                          {formatCompactNumber(drep.votingPowerAda)} ADA
                        </td>
                      </tr>
                      <tr className={cn(
                        "border-b",
                        isGame ? "border-white/10" : isLight ? "border-black/5" : "border-[#0bd1a2]/20"
                      )}>
                        <td className={cn(
                          "py-2.5",
                          isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                        )}>
                          {t("delegators")}
                        </td>
                        <td className={cn(
                          "py-2.5 text-right font-medium",
                          isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                        )}>
                          {formatNumber(drep.delegatorCount)}
                        </td>
                      </tr>
                      <tr className={cn(
                        "border-b",
                        isGame ? "border-white/10" : isLight ? "border-black/5" : "border-[#0bd1a2]/20"
                      )}>
                        <td className={cn(
                          "py-2.5",
                          isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                        )}>
                          {t("votesCast")}
                        </td>
                        <td className={cn(
                          "py-2.5 text-right font-medium",
                          isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                        )}>
                          {formatNumber(dedupedVoteCount)}
                        </td>
                      </tr>
                      <tr className={cn(
                        "border-b",
                        isGame ? "border-white/10" : isLight ? "border-black/5" : "border-[#0bd1a2]/20"
                      )}>
                        <td className={cn(
                          "py-2.5",
                          isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                        )}>
                          {t("votesChanged")}
                        </td>
                        <td className={cn(
                          "py-2.5 text-right font-medium",
                          isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                        )}>
                          {formatNumber(changedVoteItems.length)}
                        </td>
                      </tr>
                      <tr>
                        <td className={cn(
                          "py-2.5",
                          isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                        )}>
                          {t("engagement")}
                        </td>
                        <td className={cn(
                          "py-2.5 text-right font-medium",
                          isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                        )}>
                          {allProposals.length > 0 ? correctedParticipation.toFixed(1) : drep.proposalParticipationPercent.toFixed(1)}%
                        </td>
                      </tr>
                      <tr>
                        <td className={cn(
                          "py-2.5",
                          isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                        )}>
                          <span className="flex items-center gap-1">
                            Registered
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 opacity-50 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[200px]">
                                Start of the epoch in which the DRep registered on-chain
                              </TooltipContent>
                            </UITooltip>
                          </span>
                        </td>
                        <td className={cn(
                          "py-2.5 text-right font-medium",
                          isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                        )}>
                          {drep.registeredDate
                            ? new Date(drep.registeredDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Additional Information */}
                  <div className={cn(
                    "p-4",
                    isGame ? "bg-white/5 rounded-[2px]" : isLight ? "bg-black/[0.02] rounded-xl" : "border border-[#0bd1a2]/20 rounded-none bg-transparent"
                  )}>
                    <h3 className={cn(
                      "text-sm font-semibold mb-3",
                      isGame ? "text-white/80" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                    )}>
                      {t("additionalInfo")}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className={isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"}>
                          {t("rationalesProvided")}
                        </span>
                        <span className={cn(
                          "font-medium",
                          isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                        )}>
                          {dedupedRationalesProvided} / {dedupedVoteCount}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"}>
                          {t("rationaleRate")}
                        </span>
                        <span className={cn(
                          "font-medium",
                          isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                        )}>
                          {dedupedVoteCount > 0
                            ? ((dedupedRationalesProvided / dedupedVoteCount) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

                {/* Charts Card - 3 donut charts side by side */}
                <div className={cn(cardClass, "flex-1 flex flex-col overflow-visible")}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 overflow-visible">
                    {/* Engagement Chart */}
                    <div className="flex flex-col items-center justify-center overflow-visible">
                      <h3 className={cn(
                        "text-sm font-medium mb-2 text-center",
                        isGame ? "text-white/70" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/70"
                      )}>
                        {t("engagement")}
                      </h3>
                      <EngagementChart
                        votedCount={dedupedVoteCount}
                        notVotedCount={Math.max(0, eligibleProposalCount - dedupedVoteCount)}
                        isGame={isGame}
                        isLight={isLight}
                        labels={{
                          voted: t("voted"),
                          notVoted: t("notVoted"),
                          empty: t("noProposalsAvailable"),
                        }}
                      />
                    </div>
                    {/* Vote Breakdown Chart */}
                    <div className="flex flex-col items-center justify-center overflow-visible">
                      <h3 className={cn(
                        "text-sm font-medium mb-2 text-center",
                        isGame ? "text-white/70" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/70"
                      )}>
                        {t("voteBreakdown")}
                      </h3>
                      <VoteBreakdownChart
                        yes={drep.voteBreakdown.yes}
                        no={drep.voteBreakdown.no}
                        abstain={drep.voteBreakdown.abstain}
                        isGame={isGame}
                        isLight={isLight}
                        labels={{
                          yes: t("yes"),
                          no: t("no"),
                          abstain: t("abstain"),
                          empty: t("noVotesCastYet"),
                        }}
                      />
                    </div>
                    {/* Rationale Chart */}
                    <div className="flex flex-col items-center justify-center overflow-visible">
                      <h3 className={cn(
                        "text-sm font-medium mb-2 text-center",
                        isGame ? "text-white/70" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/70"
                      )}>
                        {t("rationales")}
                      </h3>
                      <RationaleChart
                        rationalesProvided={dedupedRationalesProvided}
                        totalVotesCast={dedupedVoteCount}
                        isGame={isGame}
                        isLight={isLight}
                        labels={{
                          withRationale: t("withRationale"),
                          without: t("without"),
                          empty: t("noVotesCastYet"),
                        }}
                      />
                    </div>
                  </div>

                  {/* Delegation History Line Chart */}
                  <div className="mt-10 pt-8 border-t border-border/30">
                    <DRepDelegationChart
                      history={delegationHistory}
                      isGame={isGame}
                      isLight={isLight}
                    />
                  </div>

                </div>
              </div>
              )}

              {/* Voting History - always shown, uses separate endpoint */}
              {/* Filter bar */}
              <div className={cn(
                "mb-4 px-4 sm:px-6 py-3",
                isGame
                  ? "game-drep-content rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
                  : isLight
                  ? "rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
                  : "rounded-none border border-[#0bd1a2] bg-transparent shadow-none"
              )}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2 className={cn(
                    "text-lg font-semibold",
                    isGame ? "landing-title text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                  )}>
                    {t("votingHistory")}
                  </h2>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {(["voted", "not_voted", "changed", "all"] as const).map((filter) => {
                      const label = filter === "voted"
                        ? t("voted")
                        : filter === "not_voted"
                        ? t("notVoted")
                        : filter === "changed"
                        ? t("votesChanged")
                        : t("filterAll");
                      const isActive = voteFilter === filter;
                      return (
                        <button
                          key={filter}
                          onClick={() => setVoteFilter(filter)}
                          className={cn(
                            "text-xs font-semibold uppercase tracking-wide px-2 sm:px-3 py-1 sm:py-1.5 transition-colors whitespace-nowrap",
                            isGame
                              ? cn("game-tab-btn", isActive && "game-tab-btn-active")
                              : isLight
                              ? cn(
                                  "rounded-full border border-white/8 bg-white text-black shadow-[0_12px_30px_rgba(15,23,42,0.25)]",
                                  isActive ? "bg-black text-white" : "hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)]"
                                )
                              : cn(
                                  "rounded-none border border-[#0bd1a2] bg-transparent text-[#0bd1a2] btn-neon",
                                  isActive ? "bg-[#0bd1a2] text-black" : "hover:bg-[#0bd1a2] hover:text-black"
                                )
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Voting table */}
              <div className={cardClass}>
                <div className="max-h-[500px] overflow-y-auto">
                  <VotingHistoryTable
                    items={displayItems}
                    drepId={drepIdStr || ""}
                    drepName={drep?.name || t("anonymousDRep")}
                    isGame={isGame}
                    isLight={isLight}
                    isLoading={isLoadingAllVotes}
                    locale={locale}
                    labels={{
                      empty: t("noVotingHistory"),
                      proposal: t("columnProposal"),
                      type: t("columnType"),
                      vote: t("columnVote"),
                      votingPower: t("columnVotingPower"),
                      date: t("columnDate"),
                      rationale: t("columnRationale"),
                      view: t("viewRationale"),
                      unknown: t("unknown"),
                      yes: t("yes"),
                      no: t("no"),
                      abstain: t("abstain"),
                      notVoted: t("notVoted"),
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = () => ({
  paths: [],
  fallback: "blocking",
});

export const getStaticProps: GetStaticProps<DRepProfilePageProps> = async ({
  params,
  locale,
}) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;
  const drepId = params?.drepId as string;

  if (!drepId) {
    return { notFound: true };
  }

  try {
    // Only fetch lightweight data server-side to avoid Vercel timeout.
    // fetchDRepAllVotesServer does N+1 paginated calls that can exceed
    // the serverless function timeout — let the client handle it via SWR.
    const [initialDrep, initialHistory] = await Promise.all([
      fetchDRepDetailServer(drepId),
      fetchDRepHistoryServer(drepId),
    ]);

    // If the DRep doesn't exist at all, 404
    if (!initialDrep) {
      return { notFound: true };
    }

    return {
      props: {
        messages,
        initialDrep,
        initialVotes: [],
        initialHistory,
      },
      revalidate: 60,
    };
  } catch (error) {
    console.error("Failed to fetch DRep profile data for ISR:", error);
    return {
      props: {
        messages,
        initialDrep: null,
        initialVotes: [],
        initialHistory: null,
      },
      revalidate: 30,
    };
  }
};
