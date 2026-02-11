import { useState } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import { useDRepDetail, useAllDRepVotes } from "@/hooks/useDRepData";
import { cn } from "@/lib/utils";
import { VotingRationaleModal } from "@/components/VotingRationaleModal";
import type { VoteRecord } from "@/types/governance";
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
      return "bg-green-100 text-green-700";
    case "No":
      return "bg-red-100 text-red-700";
    case "Abstain":
      return "bg-yellow-100 text-yellow-700";
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
                  stroke={isLight ? "rgba(15, 23, 42, 0.15)" : isGame ? `rgba(255,255,255,${0.4 + index * 0.08})` : "rgba(11, 209, 162, 0.5)"}
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
  totalVotesCast: number;
  participationPercent: number;
  isGame: boolean;
  isLight: boolean;
  labels: { voted: string; notVoted: string; empty: string };
}

function EngagementChart({ totalVotesCast, participationPercent, isGame, isLight, labels }: EngagementChartProps) {
  // Calculate total proposals and not voted count
  const voted = totalVotesCast;
  const totalProposals = participationPercent > 0
    ? Math.round(totalVotesCast / (participationPercent / 100))
    : 0;
  const notVoted = totalProposals - voted;
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
                  stroke={isLight ? "rgba(15, 23, 42, 0.15)" : isGame ? `rgba(255,255,255,${0.4 + index * 0.08})` : "rgba(11, 209, 162, 0.5)"}
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
                  stroke={isLight ? "rgba(15, 23, 42, 0.15)" : isGame ? `rgba(255,255,255,${0.4 + index * 0.08})` : "rgba(11, 209, 162, 0.5)"}
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

interface VotingHistoryTableProps {
  votes: DRepVoteRecord[];
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
  };
}

function VotingHistoryTable({ votes, drepId, drepName, isGame, isLight, isLoading, locale, labels }: VotingHistoryTableProps) {
  const [selectedVote, setSelectedVote] = useState<VoteRecord | null>(null);

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
            {votes.map((vote) => {
              const hasRationale = vote.rationale != null && vote.rationale.trim().length > 0;
              return (
                <tr
                  key={`${vote.proposalId}-${vote.txHash}`}
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
                      href={`/governance/${encodeURIComponent(vote.proposalId)}`}
                      className={cn(
                        "hover:underline font-medium",
                        isGame ? "text-white" : isLight ? "text-primary" : "text-[#0bd1a2]"
                      )}
                    >
                      {vote.proposalTitle || truncateId(vote.proposalId)}
                    </Link>
                  </td>
                  <td className="py-3 px-2 hidden sm:table-cell">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      isGame ? "bg-white/10 text-white/70" : isLight ? "bg-gray-100 text-muted-foreground" : "bg-[#0bd1a2]/10 text-[#0bd1a2]/70"
                    )}>
                      {vote.proposalType || labels.unknown}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className={cn(
                      "text-xs px-2 py-1 font-medium",
                      isLight ? "rounded-full" : "rounded-none",
                      getVoteBadgeClass(vote.vote, isGame, isLight)
                    )}>
                      {vote.vote === "Yes" ? labels.yes : vote.vote === "No" ? labels.no : labels.abstain}
                    </span>
                  </td>
                  <td className={cn(
                    "py-3 px-2",
                    isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                  )}>
                    {formatDate(vote.votedAt, locale)}
                  </td>
                  <td className="py-3 px-2 hidden sm:table-cell">
                    {hasRationale ? (
                      <button
                        onClick={() => setSelectedVote(toVoteRecord(vote, drepId, drepName))}
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

export default function DRepProfile() {
  const router = useRouter();
  const { drepId } = router.query;
  const { activeTheme } = useTheme();
  const t = useTranslations("drep.profile");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light";
  const drepIdStr = typeof drepId === "string" ? drepId : null;

  const { drep, isLoading: isLoadingDrep, error: drepError, refresh } = useDRepDetail(drepIdStr);
  const { votes: allVotes, isLoading: isLoadingAllVotes } = useAllDRepVotes(drepIdStr);

  // Compute deduped vote stats from allVotes (already deduplicated by proposalId).
  // These override backend values which may double-count vote changes.
  const votesLoaded = !isLoadingAllVotes && allVotes.length > 0;
  const dedupedVoteCount = votesLoaded ? allVotes.length : drep?.totalVotesCast ?? 0;
  const dedupedRationalesProvided = votesLoaded
    ? allVotes.filter((v) => v.rationale).length
    : drep?.rationalesProvided ?? 0;

  const isLoading = isLoadingDrep && !drep;

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
        <div className="container mx-auto px-3 pt-8 pb-4 sm:px-4 sm:pt-10 sm:pb-6 md:px-6 md:pt-12 md:pb-8">
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
                      <tr>
                        <td className={cn(
                          "py-2.5",
                          isGame ? "text-white/60" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60"
                        )}>
                          {t("participation")}
                        </td>
                        <td className={cn(
                          "py-2.5 text-right font-medium",
                          isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                        )}>
                          {drep.proposalParticipationPercent.toFixed(1)}%
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
                        totalVotesCast={dedupedVoteCount}
                        participationPercent={drep.proposalParticipationPercent}
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

                </div>
              </div>
              )}

              {/* Voting History - always shown, uses separate endpoint */}
              <div className={cardClass}>
                <h2 className={cn(
                  "text-lg font-semibold mb-4",
                  isGame ? "landing-title text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"
                )}>
                  {t("votingHistory")}
                </h2>
                <div className="max-h-[500px] overflow-y-auto">
                  <VotingHistoryTable
                    votes={allVotes}
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

export const getServerSideProps: GetServerSideProps<DRepProfilePageProps> = async ({ locale }) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  return {
    props: {
      messages,
    },
  };
};
