import { useState } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import { useDRepDetail, useDRepVotes } from "@/hooks/useDRepData";
import { cn } from "@/lib/utils";
import type { DRepVoteRecord } from "@/types/drep";

type IntlMessages = typeof import("@/messages/en.json");

interface DRepProfilePageProps {
  messages: IntlMessages;
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
 * Format date for display
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get vote badge color
 */
function getVoteBadgeClass(vote: "Yes" | "No" | "Abstain", isGame: boolean): string {
  if (isGame) {
    switch (vote) {
      case "Yes":
        return "bg-green-500/20 text-green-400 border border-green-500/30";
      case "No":
        return "bg-red-500/20 text-red-400 border border-red-500/30";
      case "Abstain":
        return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    }
  }
  switch (vote) {
    case "Yes":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "No":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "Abstain":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  }
}

// Vote breakdown chart colors
const VOTE_COLORS = {
  // Game/Dark theme - vibrant colors
  game: {
    yes: "#22c55e",
    no: "#ef4444",
    abstain: "#eab308",
  },
  // Light theme - graduated greys
  light: {
    yes: "#ffffff",       // white
    abstain: "#e2e8f0",   // slate-200 (same grey)
    no: "#94a3b8",        // slate-400 (darker grey)
  },
};

interface VoteBreakdownChartProps {
  yes: number;
  no: number;
  abstain: number;
  isGame: boolean;
  isLight: boolean;
}

function VoteBreakdownChart({ yes, no, abstain, isGame, isLight }: VoteBreakdownChartProps) {
  const total = yes + no + abstain;
  const colors = isGame ? VOTE_COLORS.game : (isLight ? VOTE_COLORS.light : VOTE_COLORS.game);

  if (total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        No votes cast yet
      </div>
    );
  }

  const data = [
    { name: "Yes", value: yes, color: colors.yes },
    { name: "No", value: no, color: colors.no },
    { name: "Abstain", value: abstain, color: colors.abstain },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {/* Shadow filter for light theme - dark shadow on borders */}
            {isLight && (
              <filter id="pieShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.25" />
              </filter>
            )}
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            style={isLight ? { filter: "url(#pieShadow)" } : undefined}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke={isLight ? "rgba(15, 23, 42, 0.15)" : "none"}
                strokeWidth={isLight ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const item = payload[0].payload;
              const percent = ((item.value / total) * 100).toFixed(1);
              return (
                <div className={cn(
                  "rounded-lg p-2 text-sm",
                  isGame
                    ? "bg-[#1a1a2e] text-white border border-white/10"
                    : "bg-white text-gray-900 border border-gray-200 shadow-[0_4px_12px_rgba(15,23,42,0.15)]"
                )}>
                  <p className="font-medium">{item.name}: {item.value}</p>
                  <p className="text-xs opacity-70">{percent}%</p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        {data.map((item) => {
          const isWhite = isLight && item.color === "#ffffff";
          return (
            <div key={item.name} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5"
                style={{
                  backgroundColor: item.color,
                  border: isWhite ? "1.5px solid rgba(15, 23, 42, 0.3)" : undefined,
                  boxShadow: isLight ? "0 1px 3px rgba(15,23,42,0.2)" : undefined,
                }}
              />
              <span className={isGame ? "text-white/70" : "text-muted-foreground"}>
                {item.name}: {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Engagement chart colors
const ENGAGEMENT_COLORS = {
  game: {
    voted: "#22c55e",     // green
    notVoted: "#6b7280",  // gray
  },
  light: {
    voted: "#ffffff",
    notVoted: "#e2e8f0",  // slate-200 gray
  },
};

interface EngagementChartProps {
  totalVotesCast: number;
  participationPercent: number;
  isGame: boolean;
  isLight: boolean;
}

function EngagementChart({ totalVotesCast, participationPercent, isGame, isLight }: EngagementChartProps) {
  // Calculate total proposals and not voted count
  const voted = totalVotesCast;
  const totalProposals = participationPercent > 0
    ? Math.round(totalVotesCast / (participationPercent / 100))
    : 0;
  const notVoted = totalProposals - voted;
  const total = voted + notVoted;

  const colors = isGame ? ENGAGEMENT_COLORS.game : (isLight ? ENGAGEMENT_COLORS.light : ENGAGEMENT_COLORS.game);

  if (total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        No proposals available
      </div>
    );
  }

  const data = [
    { name: "Voted", value: voted, color: colors.voted },
    { name: "Not Voted", value: notVoted, color: colors.notVoted },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {isLight && (
              <filter id="engagementShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.25" />
              </filter>
            )}
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            style={isLight ? { filter: "url(#engagementShadow)" } : undefined}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke={isLight ? "rgba(15, 23, 42, 0.15)" : "none"}
                strokeWidth={isLight ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const item = payload[0].payload;
              const percent = ((item.value / total) * 100).toFixed(1);
              return (
                <div className={cn(
                  "rounded-lg p-2 text-sm",
                  isGame
                    ? "bg-[#1a1a2e] text-white border border-white/10"
                    : "bg-white text-gray-900 border border-gray-200 shadow-[0_4px_12px_rgba(15,23,42,0.15)]"
                )}>
                  <p className="font-medium">{item.name}: {item.value}</p>
                  <p className="text-xs opacity-70">{percent}%</p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        {data.map((item) => {
          const isWhite = isLight && item.color === "#ffffff";
          return (
            <div key={item.name} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5"
                style={{
                  backgroundColor: item.color,
                  border: isWhite ? "1.5px solid rgba(15, 23, 42, 0.3)" : undefined,
                  boxShadow: isLight ? "0 1px 3px rgba(15,23,42,0.2)" : undefined,
                }}
              />
              <span className={isGame ? "text-white/70" : "text-muted-foreground"}>
                {item.name}: {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Rationale chart colors
const RATIONALE_COLORS = {
  game: {
    withRationale: "#8b5cf6",    // purple
    withoutRationale: "#6b7280", // gray
  },
  light: {
    withRationale: "#ffffff",
    withoutRationale: "#e2e8f0", // slate-200 gray
  },
};

interface RationaleChartProps {
  rationalesProvided: number;
  totalVotesCast: number;
  isGame: boolean;
  isLight: boolean;
}

function RationaleChart({ rationalesProvided, totalVotesCast, isGame, isLight }: RationaleChartProps) {
  const withRationale = rationalesProvided;
  const withoutRationale = totalVotesCast - rationalesProvided;
  const total = totalVotesCast;

  const colors = isGame ? RATIONALE_COLORS.game : (isLight ? RATIONALE_COLORS.light : RATIONALE_COLORS.game);

  if (total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        No votes cast yet
      </div>
    );
  }

  const data = [
    { name: "With Rationale", value: withRationale, color: colors.withRationale },
    { name: "Without", value: withoutRationale, color: colors.withoutRationale },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {isLight && (
              <filter id="rationaleShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.25" />
              </filter>
            )}
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            style={isLight ? { filter: "url(#rationaleShadow)" } : undefined}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke={isLight ? "rgba(15, 23, 42, 0.15)" : "none"}
                strokeWidth={isLight ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const item = payload[0].payload;
              const percent = ((item.value / total) * 100).toFixed(1);
              return (
                <div className={cn(
                  "rounded-lg p-2 text-sm",
                  isGame
                    ? "bg-[#1a1a2e] text-white border border-white/10"
                    : "bg-white text-gray-900 border border-gray-200 shadow-[0_4px_12px_rgba(15,23,42,0.15)]"
                )}>
                  <p className="font-medium">{item.name}: {item.value}</p>
                  <p className="text-xs opacity-70">{percent}%</p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        {data.map((item) => {
          const isWhite = isLight && item.color === "#ffffff";
          return (
            <div key={item.name} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5"
                style={{
                  backgroundColor: item.color,
                  border: isWhite ? "1.5px solid rgba(15, 23, 42, 0.3)" : undefined,
                  boxShadow: isLight ? "0 1px 3px rgba(15,23,42,0.2)" : undefined,
                }}
              />
              <span className={isGame ? "text-white/70" : "text-muted-foreground"}>
                {item.name}: {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VotingHistoryTableProps {
  votes: DRepVoteRecord[];
  isGame: boolean;
  isLoading: boolean;
}

function VotingHistoryTable({ votes, isGame, isLoading }: VotingHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (votes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No voting history available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className={cn(
            "border-b text-left",
            isGame ? "border-white/10 text-white/60" : "border-gray-200 dark:border-gray-700 text-muted-foreground"
          )}>
            <th className="py-3 px-2 font-medium">Proposal</th>
            <th className="py-3 px-2 font-medium">Type</th>
            <th className="py-3 px-2 font-medium">Vote</th>
            <th className="py-3 px-2 font-medium text-right">Voting Power</th>
            <th className="py-3 px-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {votes.map((vote) => (
            <tr
              key={`${vote.proposalId}-${vote.txHash}`}
              className={cn(
                "border-b transition-colors",
                isGame
                  ? "border-white/5 hover:bg-white/5"
                  : "border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              )}
            >
              <td className="py-3 px-2">
                <Link
                  href={`/governance/${encodeURIComponent(vote.proposalId)}`}
                  className={cn(
                    "hover:underline font-medium",
                    isGame ? "text-[#0bd1a2]" : "text-primary"
                  )}
                >
                  {vote.proposalTitle || truncateId(vote.proposalId)}
                </Link>
              </td>
              <td className="py-3 px-2">
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded",
                  isGame ? "bg-white/10 text-white/70" : "bg-gray-100 dark:bg-gray-800 text-muted-foreground"
                )}>
                  {vote.proposalType || "Unknown"}
                </span>
              </td>
              <td className="py-3 px-2">
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full font-medium",
                  getVoteBadgeClass(vote.vote, isGame)
                )}>
                  {vote.vote}
                </span>
              </td>
              <td className={cn(
                "py-3 px-2 text-right tabular-nums",
                isGame ? "text-white/70" : "text-muted-foreground"
              )}>
                {formatCompactNumber(vote.votingPowerAda)} ADA
              </td>
              <td className={cn(
                "py-3 px-2",
                isGame ? "text-white/60" : "text-muted-foreground"
              )}>
                {formatDate(vote.votedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DRepProfile() {
  const router = useRouter();
  const { drepId } = router.query;
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light";
  const [votesPage, setVotesPage] = useState(1);

  const drepIdStr = typeof drepId === "string" ? drepId : null;

  const { drep, isLoading: isLoadingDrep, error: drepError, refresh } = useDRepDetail(drepIdStr);
  const { votes, pagination: votesPagination, isLoading: isLoadingVotes } = useDRepVotes(drepIdStr, {
    page: votesPage,
    pageSize: 10,
  });

  const isLoading = isLoadingDrep && !drep;
  const error = drepError;

  // Card styling
  const cardClass = cn(
    "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-6 shadow-[0_12px_30px_rgba(15,23,42,0.25)]",
    "dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
  );

  return (
    <>
      <Head>
        <title>{drep?.name || "DRep Profile"} - CGOV</title>
        <meta
          name="description"
          content={`View ${drep?.name || "DRep"} profile - voting power, participation, and voting history on Cardano governance`}
        />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 pt-8 pb-4 sm:px-4 sm:pt-10 sm:pb-6 md:px-6 md:pt-12 md:pb-8">
          {/* Back link */}
          <Link
            href="/drep"
            className={cn(
              "inline-flex items-center gap-1 text-sm mb-4 transition-colors",
              isGame ? "text-[#0bd1a2] hover:text-[#0bd1a2]/80" : "text-primary hover:text-primary/80"
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to DRep Dashboard
          </Link>

          {/* Error state */}
          {error && (
            <Card className="p-4 sm:p-6 mb-4 sm:mb-6 border-destructive bg-destructive/10">
              <div className="text-center">
                <p className="text-destructive font-medium mb-2 text-sm sm:text-base">
                  Failed to load DRep data
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">{error}</p>
                <button
                  onClick={refresh}
                  className="mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Retry
                </button>
              </div>
            </Card>
          )}

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
                    Loading DRep profile...
                  </p>
                </div>
              </Card>
            )
          )}

          {/* Content */}
          {drep && !isLoading && (
            <>
              {/* Top Row - Profile Card + Vote Breakdown */}
              <div className="flex flex-col md:flex-row gap-6 mb-6">
                {/* Main Profile Card - Portrait orientation */}
                <div className={cn(cardClass, "w-full md:w-[360px] md:flex-shrink-0")}>
                <div className="flex flex-col gap-5">
                  {/* Profile Info - Centered */}
                  <div className="flex flex-col items-center text-center pb-5 border-b border-black/5 dark:border-white/10">
                    {/* Avatar - Smaller */}
                    <div className={cn(
                      "w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl font-bold mb-3",
                      isGame
                        ? "bg-[#0bd1a2]/20 text-[#0bd1a2]"
                        : "bg-primary/10 text-primary"
                    )}>
                      {drep.iconUrl ? (
                        <img
                          src={drep.iconUrl}
                          alt={drep.name || "DRep"}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        (drep.name?.[0] || "D").toUpperCase()
                      )}
                    </div>
                    {/* Name */}
                    <h1 className={cn(
                      "text-lg sm:text-xl font-bold",
                      isGame ? "text-white" : "text-foreground"
                    )}>
                      {drep.name || "Anonymous DRep"}
                    </h1>
                    {/* DRep ID with copy button */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <p className={cn(
                        "text-xs font-mono",
                        isGame ? "text-white/50" : "text-muted-foreground/70"
                      )}>
                        {truncateId(drepIdStr || "", 8, 6)}
                      </p>
                      <button
                        onClick={() => navigator.clipboard.writeText(drepIdStr || "")}
                        className={cn(
                          "p-1 rounded transition-colors",
                          isGame
                            ? "text-[#0bd1a2]/60 hover:text-[#0bd1a2] hover:bg-white/10"
                            : "text-muted-foreground/60 hover:text-foreground hover:bg-black/5"
                        )}
                        title="Copy DRep ID"
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
                        isGame ? "border-white/10" : "border-black/5"
                      )}>
                        <td className={cn(
                          "py-2.5",
                          isGame ? "text-white/60" : "text-muted-foreground"
                        )}>
                          Voting Power
                        </td>
                        <td className={cn(
                          "py-2.5 text-right font-medium",
                          isGame ? "text-[#0bd1a2]" : "text-foreground"
                        )}>
                          {formatCompactNumber(drep.votingPowerAda)} ADA
                        </td>
                      </tr>
                      <tr className={cn(
                        "border-b",
                        isGame ? "border-white/10" : "border-black/5"
                      )}>
                        <td className={cn(
                          "py-2.5",
                          isGame ? "text-white/60" : "text-muted-foreground"
                        )}>
                          Delegators
                        </td>
                        <td className={cn(
                          "py-2.5 text-right font-medium",
                          isGame ? "text-[#0bd1a2]" : "text-foreground"
                        )}>
                          {formatNumber(drep.delegatorCount)}
                        </td>
                      </tr>
                      <tr className={cn(
                        "border-b",
                        isGame ? "border-white/10" : "border-black/5"
                      )}>
                        <td className={cn(
                          "py-2.5",
                          isGame ? "text-white/60" : "text-muted-foreground"
                        )}>
                          Votes Cast
                        </td>
                        <td className={cn(
                          "py-2.5 text-right font-medium",
                          isGame ? "text-[#0bd1a2]" : "text-foreground"
                        )}>
                          {formatNumber(drep.totalVotesCast)}
                        </td>
                      </tr>
                      <tr>
                        <td className={cn(
                          "py-2.5",
                          isGame ? "text-white/60" : "text-muted-foreground"
                        )}>
                          Participation
                        </td>
                        <td className={cn(
                          "py-2.5 text-right font-medium",
                          isGame ? "text-[#0bd1a2]" : "text-foreground"
                        )}>
                          {drep.proposalParticipationPercent.toFixed(1)}%
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Additional Information */}
                  <div className={cn(
                    "p-4 rounded-xl",
                    isGame ? "bg-white/5" : "bg-black/[0.02]"
                  )}>
                    <h3 className={cn(
                      "text-sm font-semibold mb-3",
                      isGame ? "text-white/80" : "text-foreground"
                    )}>
                      Additional Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className={isGame ? "text-white/60" : "text-muted-foreground"}>
                          Rationales Provided
                        </span>
                        <span className={cn(
                          "font-medium",
                          isGame ? "text-white" : "text-foreground"
                        )}>
                          {drep.rationalesProvided} / {drep.totalVotesCast}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={isGame ? "text-white/60" : "text-muted-foreground"}>
                          Rationale Rate
                        </span>
                        <span className={cn(
                          "font-medium",
                          isGame ? "text-white" : "text-foreground"
                        )}>
                          {drep.totalVotesCast > 0
                            ? ((drep.rationalesProvided / drep.totalVotesCast) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                    </div>
                    {drep.paymentAddr && (
                      <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10">
                        <span className={cn(
                          "block text-xs mb-1",
                          isGame ? "text-white/60" : "text-muted-foreground"
                        )}>
                          Payment Address
                        </span>
                        <span className={cn(
                          "text-xs font-mono break-all",
                          isGame ? "text-white/50" : "text-muted-foreground/70"
                        )}>
                          {drep.paymentAddr}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

                {/* Charts Card - 3 donut charts side by side */}
                <div className={cn(cardClass, "flex-1")}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Engagement Chart */}
                    <div className="flex flex-col items-center justify-center">
                      <h3 className={cn(
                        "text-sm font-medium mb-2 text-center",
                        isGame ? "text-white/70" : "text-muted-foreground"
                      )}>
                        Engagement
                      </h3>
                      <EngagementChart
                        totalVotesCast={drep.totalVotesCast}
                        participationPercent={drep.proposalParticipationPercent}
                        isGame={isGame}
                        isLight={isLight}
                      />
                    </div>
                    {/* Vote Breakdown Chart */}
                    <div className="flex flex-col items-center justify-center">
                      <h3 className={cn(
                        "text-sm font-medium mb-2 text-center",
                        isGame ? "text-white/70" : "text-muted-foreground"
                      )}>
                        Vote Breakdown
                      </h3>
                      <VoteBreakdownChart
                        yes={drep.voteBreakdown.yes}
                        no={drep.voteBreakdown.no}
                        abstain={drep.voteBreakdown.abstain}
                        isGame={isGame}
                        isLight={isLight}
                      />
                    </div>
                    {/* Rationale Chart */}
                    <div className="flex flex-col items-center justify-center">
                      <h3 className={cn(
                        "text-sm font-medium mb-2 text-center",
                        isGame ? "text-white/70" : "text-muted-foreground"
                      )}>
                        Rationales
                      </h3>
                      <RationaleChart
                        rationalesProvided={drep.rationalesProvided}
                        totalVotesCast={drep.totalVotesCast}
                        isGame={isGame}
                        isLight={isLight}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Voting History */}
              <div className={cardClass}>
                <h2 className={cn(
                  "text-lg font-semibold mb-4",
                  isGame ? "text-white" : "text-foreground"
                )}>
                  Voting History
                </h2>
                <VotingHistoryTable
                  votes={votes}
                  isGame={isGame}
                  isLoading={isLoadingVotes}
                />
                {/* Pagination */}
                {votesPagination && votesPagination.totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setVotesPage((p) => Math.max(1, p - 1))}
                      disabled={votesPage === 1}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        isGame
                          ? "bg-white/10 text-white hover:bg-white/20"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      Previous
                    </button>
                    <span className={cn(
                      "text-sm",
                      isGame ? "text-white/70" : "text-muted-foreground"
                    )}>
                      Page {votesPage} of {votesPagination.totalPages}
                    </span>
                    <button
                      onClick={() => setVotesPage((p) => Math.min(votesPagination.totalPages, p + 1))}
                      disabled={votesPage === votesPagination.totalPages}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        isGame
                          ? "bg-white/10 text-white hover:bg-white/20"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<DRepProfilePageProps> = async ({ locale }) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  return {
    props: {
      messages,
    },
  };
};
