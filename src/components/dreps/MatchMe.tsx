import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { fetchGovernanceActionDetail } from "@/services/api";
import type { GovernanceAction, GovernanceActionDetail } from "@/types/governance";
import {
  selectProposals,
  buildVoteIndex,
  calculateMatches,
  type UserVote,
  type MatchResult,
} from "@/lib/matchMe";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface MatchMeProps {
  actions: GovernanceAction[];
  drepNames: Map<string, string | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "voting" | "loading" | "results";

export default function MatchMe({
  actions,
  drepNames,
  open,
  onOpenChange,
}: MatchMeProps) {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";

  const [step, setStep] = useState<Step>("voting");
  const [userVotes, setUserVotes] = useState<Map<string, UserVote>>(new Map());
  const [results, setResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [descCache, setDescCache] = useState<Map<string, string>>(new Map());
  const [loadingDesc, setLoadingDesc] = useState<string | null>(null);

  // Select proposals once when modal data is ready
  const proposals = selectProposals(actions);
  const allVoted = proposals.length > 0 && userVotes.size === proposals.length;

  const toggleExpand = useCallback(async (hash: string) => {
    if (expandedHash === hash) {
      setExpandedHash(null);
      return;
    }
    setExpandedHash(hash);
    if (!descCache.has(hash)) {
      setLoadingDesc(hash);
      try {
        const detail = await fetchGovernanceActionDetail(hash);
        const text = detail?.description || detail?.rationale || "";
        setDescCache((prev) => {
          const next = new Map(prev);
          next.set(hash, text);
          return next;
        });
      } catch {
        setDescCache((prev) => {
          const next = new Map(prev);
          next.set(hash, "");
          return next;
        });
      } finally {
        setLoadingDesc(null);
      }
    }
  }, [expandedHash, descCache]);

  const handleVote = useCallback((hash: string, vote: UserVote) => {
    setUserVotes((prev) => {
      const next = new Map(prev);
      next.set(hash, vote);
      return next;
    });
  }, []);

  const handleFindMatches = useCallback(async () => {
    setStep("loading");
    setError(null);

    try {
      // Fetch full details (with vote arrays) for all quiz proposals in parallel
      const details = await Promise.all(
        proposals.map((p) => fetchGovernanceActionDetail(p.hash))
      );

      const validDetails = details.filter(
        (d): d is GovernanceActionDetail => d !== null
      );

      if (validDetails.length < 2) {
        setError("Could not load enough proposal data. Please try again.");
        setStep("voting");
        return;
      }

      const voteIndex = buildVoteIndex(validDetails);
      const matches = calculateMatches(
        userVotes,
        voteIndex,
        proposals.length,
        50
      );

      // Enrich with DRep names
      for (const m of matches) {
        m.drepName = drepNames.get(m.drepId) ?? null;
      }

      setResults(matches);
      setStep("results");
    } catch {
      setError("Failed to fetch proposal data. Please try again.");
      setStep("voting");
    }
  }, [proposals, userVotes, drepNames]);

  const handleBack = useCallback(() => {
    setStep("voting");
  }, []);

  const handleReset = useCallback(() => {
    setUserVotes(new Map());
    setResults([]);
    setStep("voting");
    setError(null);
    setExpandedHash(null);
  }, []);

  // Theme classes
  const cardBg = isLight
    ? "bg-[#f5f4f1] border border-black/5"
    : isGame
      ? "bg-[rgba(255,255,255,0.03)] border border-white/5"
      : "bg-transparent border border-[#0bd1a2]/20";

  const voteButtonBase = cn(
    "px-4 py-1.5 text-xs font-semibold transition-all duration-150",
    isLight ? "rounded-full" : isGame ? "rounded-[2px]" : "rounded-none"
  );

  const headingClass = isGame
    ? "text-white"
    : isLight
      ? "text-black"
      : "text-[#0bd1a2]";

  const subtextClass = isGame
    ? "text-white/50"
    : isLight
      ? "text-black/50"
      : "text-[#0bd1a2]/60";

  const shortId = (id: string) =>
    id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-2xl max-h-[85vh] overflow-y-auto",
          isGame
            ? "game-detail-card !rounded-[2px] border-none bg-[rgba(12,12,12,0.95)]"
            : isLight
              ? "rounded-2xl bg-card"
              : "rounded-none border-[#0bd1a2] bg-[#0a0a0a]"
        )}
      >
        {step === "voting" && (
          <>
            <DialogHeader>
              <DialogTitle className={headingClass}>
                Match Me &mdash; Find Your DRep
              </DialogTitle>
              <DialogDescription className={subtextClass}>
                Vote on these proposals to find DReps that share your governance
                views. No wallet needed.
              </DialogDescription>
            </DialogHeader>

            {proposals.length === 0 ? (
              <p className={`text-xs ${subtextClass}`}>
                No proposals available for matching. Check back later.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {proposals.map((proposal, idx) => {
                  const current = userVotes.get(proposal.hash);
                  return (
                    <div
                      key={proposal.hash}
                      className={cn("p-3 sm:p-4", cardBg, isLight ? "rounded-xl" : isGame ? "rounded-[2px]" : "rounded-none")}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <span
                          className={cn(
                            "flex-shrink-0 text-2xs font-bold w-5 h-5 flex items-center justify-center",
                            isLight
                              ? "bg-black text-white rounded-full"
                              : isGame
                                ? "bg-white/10 text-white rounded-[2px]"
                                : "bg-[#0bd1a2] text-black rounded-none"
                          )}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-xs font-semibold leading-snug line-clamp-2",
                              isGame ? "text-white" : isLight ? "text-black" : "text-white"
                            )}
                          >
                            {proposal.title}
                          </p>
                          <span
                            className={cn(
                              "text-2xs mt-0.5 inline-block",
                              subtextClass
                            )}
                          >
                            {proposal.type}
                          </span>
                        </div>
                      </div>

                      {/* Expand details toggle */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(proposal.hash)}
                        className={cn(
                          "flex items-center gap-1 text-2xs mb-2 transition-colors",
                          subtextClass,
                          isLight ? "hover:text-black/70" : isGame ? "hover:text-white/70" : "hover:text-[#0bd1a2]/80"
                        )}
                      >
                        <ChevronDown className={cn(
                          "h-3 w-3 transition-transform",
                          expandedHash === proposal.hash && "rotate-180"
                        )} />
                        Details
                      </button>
                      {expandedHash === proposal.hash && (
                        <div className={cn(
                          "mb-2 text-xs leading-relaxed max-h-[120px] overflow-y-auto",
                          isLight
                            ? "bg-black/[0.03] text-black/60 rounded-lg p-2.5"
                            : isGame
                              ? "bg-white/[0.03] text-white/50 rounded-[2px] p-2.5"
                              : "bg-[#0bd1a2]/[0.03] text-[#0bd1a2]/50 rounded-none p-2.5"
                        )}>
                          {loadingDesc === proposal.hash ? (
                            <span className="animate-pulse">Loading...</span>
                          ) : descCache.get(proposal.hash) ? (
                            <p className="whitespace-pre-wrap">{descCache.get(proposal.hash)}</p>
                          ) : (
                            <span>No description available.</span>
                          )}
                        </div>
                      )}

                      {/* Vote buttons */}
                      <div className="flex gap-2">
                        {(["Yes", "No", "Abstain"] as UserVote[]).map(
                          (vote) => {
                            const isSelected = current === vote;
                            let activeClass = "";
                            if (isSelected) {
                              if (vote === "Yes") {
                                activeClass = isLight
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-emerald-500 text-black border-emerald-500";
                              } else if (vote === "No") {
                                activeClass = isLight
                                  ? "bg-red-600 text-white border-red-600"
                                  : "bg-red-500 text-black border-red-500";
                              } else {
                                activeClass = isLight
                                  ? "bg-gray-500 text-white border-gray-500"
                                  : "bg-gray-400 text-black border-gray-400";
                              }
                            }

                            const inactiveClass = isLight
                              ? "border border-black/10 text-black/70 hover:bg-black/5"
                              : isGame
                                ? "border border-white/10 text-white/70 hover:bg-white/5"
                                : "border border-[#0bd1a2]/30 text-[#0bd1a2]/70 hover:bg-[#0bd1a2]/5";

                            return (
                              <button
                                key={vote}
                                onClick={() => handleVote(proposal.hash, vote)}
                                className={cn(
                                  voteButtonBase,
                                  isSelected ? activeClass : inactiveClass
                                )}
                              >
                                {vote}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {error && (
              <p className="text-xs text-red-500 mt-1">{error}</p>
            )}

            {/* Find Matches button */}
            <div className="flex items-center justify-between mt-2">
              <span className={cn("text-2xs", subtextClass)}>
                {userVotes.size}/{proposals.length} voted
              </span>
              <button
                disabled={!allVoted}
                onClick={handleFindMatches}
                className={cn(
                  "px-5 py-2 text-xs font-bold transition-all duration-150",
                  isLight ? "rounded-full" : isGame ? "rounded-[2px]" : "rounded-none",
                  allVoted
                    ? isLight
                      ? "bg-black text-white hover:bg-black/80"
                      : isGame
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-[#0bd1a2] text-black hover:bg-[#0bd1a2]/80"
                    : isLight
                      ? "bg-black/10 text-black/30 cursor-not-allowed"
                      : isGame
                        ? "bg-white/10 text-white/30 cursor-not-allowed"
                        : "bg-[#0bd1a2]/10 text-[#0bd1a2]/30 cursor-not-allowed"
                )}
              >
                Find My Matches
              </button>
            </div>
          </>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className={cn(
                "w-8 h-8 border-2 border-t-transparent rounded-full animate-spin",
                isLight ? "border-black" : isGame ? "border-white" : "border-[#0bd1a2]"
              )}
            />
            <p className={cn("text-xs", subtextClass)}>
              Analyzing DRep voting patterns...
            </p>
          </div>
        )}

        {step === "results" && (
          <>
            <DialogHeader>
              <DialogTitle className={headingClass}>
                Your DRep Matches
              </DialogTitle>
              <DialogDescription className={subtextClass}>
                Based on your votes on {proposals.length} proposals
              </DialogDescription>
            </DialogHeader>

            {results.length === 0 ? (
              <p className={cn("text-xs py-8 text-center", subtextClass)}>
                No DReps matched enough proposals. Try different votes.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[55vh] overflow-y-auto pr-1">
                {results.map((match, idx) => {
                  return (
                    <Link
                      key={match.drepId}
                      href={`/drep/${encodeURIComponent(match.drepId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center gap-3 p-3 no-underline transition-all duration-200 ease-out",
                        isLight
                          ? "rounded-xl bg-white shadow-elevation-1 hover:scale-101 hover:shadow-elevation-2"
                          : isGame
                            ? "rounded-[2px] bg-white/5 hover:scale-101 hover:bg-white/10 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                            : "rounded-none border border-[#0bd1a2]/30 bg-transparent hover:scale-101 hover:border-[#0bd1a2] hover:shadow-[0_4px_16px_rgba(11,209,162,0.15)]"
                      )}
                    >
                      {/* Rank */}
                      <span
                        className={cn(
                          "flex-shrink-0 text-2xs font-bold w-5 h-5 flex items-center justify-center",
                          isLight
                            ? "bg-black/5 text-black/40 rounded-full"
                            : isGame
                              ? "bg-white/5 text-white/40 rounded-[2px]"
                              : "bg-[#0bd1a2]/10 text-[#0bd1a2]/40 rounded-none"
                        )}
                      >
                        {idx + 1}
                      </span>

                      {/* Match % */}
                      <span
                        className={cn(
                          "flex-shrink-0 text-sm font-bold tabular-nums w-12 text-right",
                          isGame ? "text-white" : isLight ? "text-black" : "text-[#0bd1a2]"
                        )}
                      >
                        {match.matchPercent}%
                      </span>

                      {/* DRep info */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-xs font-semibold truncate",
                            isGame ? "text-white" : isLight ? "text-black" : "text-white"
                          )}
                        >
                          {match.drepName || shortId(match.drepId)}
                        </p>
                        <p className={cn("text-2xs", subtextClass)}>
                          {match.matchedCount}/{match.totalProposals} same votes
                        </p>
                      </div>

                      {/* Arrow */}
                      <span className={cn("text-xs flex-shrink-0", subtextClass)}>
                        &rarr;
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={handleBack}
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold transition-all duration-150",
                  isLight
                    ? "rounded-full border border-black/10 text-black/70 hover:bg-black/5"
                    : isGame
                      ? "rounded-[2px] border border-white/10 text-white/70 hover:bg-white/5"
                      : "rounded-none border border-[#0bd1a2]/30 text-[#0bd1a2]/70 hover:bg-[#0bd1a2]/5"
                )}
              >
                &larr; Change My Votes
              </button>
              <button
                onClick={handleReset}
                className={cn(
                  "px-4 py-1.5 text-xs transition-all duration-150",
                  subtextClass,
                  "hover:underline"
                )}
              >
                Start Over
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
