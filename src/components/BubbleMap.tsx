import { useMemo, useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import * as d3 from "d3";
import type { VoteRecord, VoterType } from "@/types/governance";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BubbleMapProps {
  votes: VoteRecord[];
}

type VoterFilter = "All" | VoterType;

interface Bubble {
  x: number;
  y: number;
  radius: number;
  vote: VoteRecord;
  fillColor: string;
  borderColor: string;
}

type HierarchyDatum = {
  name: string;
  value?: number;
  vote?: VoteRecord;
  children?: HierarchyDatum[];
};

interface VoteColors {
  fill: string;
  border: string;
}

// Convert a vote's on-chain voting power to ADA
function getVotingPowerAda(vote: VoteRecord): number {
  const { votingPowerAda, votingPower } = vote;

  // 1) Prefer any existing votingPowerAda field
  if (
    typeof votingPowerAda === "number" &&
    !Number.isNaN(votingPowerAda) &&
    votingPowerAda > 0
  ) {
    return votingPowerAda;
  }

  // 2) Otherwise, convert lovelace string/number to ADA
  if (votingPower != null) {
    const n =
      typeof votingPower === "string"
        ? Number(votingPower)
        : (votingPower as number);
    if (!Number.isNaN(n) && n > 0) {
      return n / 1_000_000;
    }
  }

  return 0;
}

function getVoteColors(vote: VoteRecord["vote"], voterType?: VoteRecord["voterType"]): VoteColors {
  // CC bubbles get special styling with distinct colors and patterns
  if (voterType === "CC") {
    switch (vote) {
      case "Yes":
        return {
          fill: "rgba(11, 140, 48, 0.9)", // More opaque for CC
          border: "rgb(11, 140, 48)", // Stronger border matching fill
        };
      case "No":
        return {
          fill: "rgba(140, 32, 11, 0.9)", // More opaque for CC
          border: "rgb(140, 32, 11)", // Stronger border matching fill
        };
      case "Abstain":
      default:
        return {
          fill: "rgba(148, 163, 184, 0.9)", // More opaque gray for CC
          border: "rgb(148, 163, 184)", // Stronger border
        };
    }
  }

  // Regular styling for DRep and SPO
  switch (vote) {
    case "Yes":
      return {
        fill: "rgba(11, 140, 48, 0.7)", // Less transparent green fill
        border: "rgb(11, 140, 48)", // Stronger border
      };
    case "No":
      return {
        fill: "rgba(140, 32, 11, 0.7)", // Less transparent red fill
        border: "rgb(140, 32, 11)", // Stronger border
      };
    case "Abstain":
    default:
      return {
        fill: "rgba(148, 163, 184, 0.7)", // Neutral gray fill for better contrast
        border: "rgb(148, 163, 184)", // Stronger gray border
      };
  }
}


function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) {
    return `${(ada / 1_000_000_000).toFixed(1)}B`;
  }
  if (ada >= 1_000_000) {
    return `${(ada / 1_000_000).toFixed(1)}M`;
  }
  if (ada >= 1_000) {
    return `${(ada / 1_000).toFixed(1)}K`;
  }
  return ada.toFixed(0);
}

export function BubbleMap({ votes }: BubbleMapProps) {
  const { theme, activeTheme } = useTheme();
  const isDark = theme === "dark";
  const isGame = activeTheme.id === "game";
  const [voterFilter, setVoterFilter] = useState<VoterFilter>("All");

  // Determine available roles from votes
  const availableRoles = useMemo(() => {
    const roles = new Set<VoterType>();
    votes.forEach((vote) => {
      if (vote.voterType) {
        roles.add(vote.voterType);
      }
    });
    return Array.from(roles);
  }, [votes]);

  const roleFilterOptions = useMemo<VoterFilter[]>(() => {
    return ["All", ...availableRoles];
  }, [availableRoles]);

  const filteredVotes = useMemo(() => {
    if (voterFilter === "All") return votes;
    return votes.filter((v) => v.voterType === voterFilter);
  }, [votes, voterFilter]);

  const bubbles = useMemo(() => {
    if (filteredVotes.length === 0) return [];

    const containerWidth = 800;
    const containerHeight = 600;
    const padding = 4;

    // Sort votes by voting power (largest first) so they get placed in center
    const sortedVotes = [...filteredVotes].sort((a, b) => {
      const powerA = getVotingPowerAda(a);
      const powerB = getVotingPowerAda(b);
      return powerB - powerA; // Descending order - largest first
    });

    // Create flat hierarchical data structure - all votes in one group
    // No grouping by vote type, just all votes as children of root
    const hierarchicalData: HierarchyDatum = {
      name: "root",
      children: sortedVotes.map((vote) => ({
        name: vote.voterName || vote.voterId || vote.drepId,
        value: Math.max(getVotingPowerAda(vote), 1),
        vote,
      })),
    };

    // Build hierarchy and compute pack layout
    const hierarchy = d3
      .hierarchy<HierarchyDatum>(hierarchicalData)
      .sum((d) => (d.value ? d.value : 0));

    const packGenerator = d3
      .pack<HierarchyDatum>()
      .size([containerWidth, containerHeight])
      .padding(padding);

    const root = packGenerator(hierarchy as d3.HierarchyNode<HierarchyDatum>);

    // Extract bubbles from the packed hierarchy
    const bubbles: Bubble[] = [];

    root.descendants().forEach((node) => {
      // Only process leaf nodes (individual votes)
      // Skip root node
      if (node.data && node.data.vote && !node.children) {
        const vote = node.data.vote as VoteRecord;
        const palette = getVoteColors(vote.vote, vote.voterType);

        bubbles.push({
          x: node.x,
          y: node.y,
          radius: node.r,
          vote: vote,
          fillColor: isDark ? "transparent" : palette.fill,
          borderColor: palette.border,
        });
      }
    });

    return bubbles;
  }, [filteredVotes, isDark]);

  const [hoveredBubble, setHoveredBubble] = useState<{ bubble: Bubble; x: number; y: number } | null>(null);
  const [hoveredBubbleId, setHoveredBubbleId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sort bubbles by vote timestamp
  const sortedBubbles = useMemo(() => {
    return [...bubbles].sort((a, b) => {
      const timeA = a.vote.votedAt ? new Date(a.vote.votedAt).getTime() : 0;
      const timeB = b.vote.votedAt ? new Date(b.vote.votedAt).getTime() : 0;
      return timeA - timeB;
    });
  }, [bubbles]);

  // Get visible bubbles based on current step
  const visibleBubbles = useMemo(() => {
    if (currentStep === null) return sortedBubbles; // Show all if not playing
    return sortedBubbles.slice(0, currentStep + 1);
  }, [sortedBubbles, currentStep]);

  // Animation effect
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev === null) return 0;
        if (prev >= sortedBubbles.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 100); // Show one bubble every 100ms

    return () => clearInterval(interval);
  }, [isPlaying, sortedBubbles.length]);

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentStep === null || currentStep >= sortedBubbles.length - 1) {
        setCurrentStep(0);
      }
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(null);
  };

  const handleMouseEnter = (bubble: Bubble, event: React.MouseEvent<SVGCircleElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setHoveredBubble({
        bubble,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredBubble(null);
  };

  if (votes.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-12 shadow-[0_12px_30px_rgba(15,23,42,0.25)] flex h-96 items-center justify-center text-muted-foreground">
        No votes available
      </div>
    );
  }

  return (
    <div className={
      isGame
        ? "game-detail-card p-2 sm:p-3 overflow-visible"
        : "rounded-2xl border border-white/8 bg-[#faf9f6] p-2 sm:p-3 shadow-[0_12px_30px_rgba(15,23,42,0.25)] overflow-visible dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
    }>
      <div className="mb-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 pb-2 sm:pb-4 text-sm overflow-visible">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayPause}
            className={
              isGame
                ? "game-nav-btn h-8 sm:h-9"
                : "h-8 sm:h-9 rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none"
            }
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          {currentStep !== null && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className={
                isGame
                  ? "game-nav-btn h-8 sm:h-9 text-xs"
                  : "h-8 sm:h-9 rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] text-xs dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none"
              }
            >
              Reset
            </Button>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {roleFilterOptions.map((role) => {
              const isActive = voterFilter === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setVoterFilter(role)}
                  className={
                    isGame
                      ? isActive
                        ? "game-tab-btn-active-inline"
                        : "game-tab-btn-inline"
                      : `role-filter-button rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 shadow-[0_12px_30px_rgba(15,23,42,0.25)] cursor-pointer transition-colors text-[10px] sm:text-xs font-semibold uppercase tracking-wide dark:rounded-none dark:border dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none ${
                          isActive
                            ? "bg-black text-white dark:bg-[#0bd1a2] dark:text-black active"
                            : "bg-white text-black hover:bg-black hover:text-white dark:hover:bg-[#0bd1a2] dark:hover:text-black"
                        }`
                  }
                >
                  {role === "All" ? "All Roles" : role}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div ref={containerRef} className="w-full relative overflow-visible">
        <div className="flex items-center justify-center p-2">
          <svg
            ref={svgRef}
            id="bubble-map-svg"
            viewBox="0 0 800 600"
            className="rounded-lg bg-background w-full h-auto max-h-[350px] sm:max-h-[450px] md:max-h-[600px]"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="bubble-shadow" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="15" result="blur"/>
                <feOffset dx="0" dy="12" in="blur" result="offsetblur"/>
                <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.25" result="shadowColor"/>
                <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
                <feMerge>
                  <feMergeNode in="shadow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="bubble-shadow-hover" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="20" result="blur"/>
                <feOffset dx="0" dy="16" in="blur" result="offsetblur"/>
                <feFlood floodColor="rgba(15, 23, 42)" floodOpacity="0.35" result="shadowColor"/>
                <feComposite in="shadowColor" in2="offsetblur" operator="in" result="shadow"/>
                <feMerge>
                  <feMergeNode in="shadow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="bubble-glow-yes" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="coloredBlur"/>
                <feFlood floodColor="rgba(11, 140, 48, 0.6)" result="glowColor"/>
                <feComposite in="glowColor" in2="coloredBlur" operator="in" result="glow"/>
                <feMerge>
                  <feMergeNode in="glow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="bubble-glow-no" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="coloredBlur"/>
                <feFlood floodColor="rgba(140, 32, 11, 0.6)" result="glowColor"/>
                <feComposite in="glowColor" in2="coloredBlur" operator="in" result="glow"/>
                <feMerge>
                  <feMergeNode in="glow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="bubble-glow-abstain" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="coloredBlur"/>
                <feFlood floodColor="rgba(148, 163, 184, 0.6)" result="glowColor"/>
                <feComposite in="glowColor" in2="coloredBlur" operator="in" result="glow"/>
                <feMerge>
                  <feMergeNode in="glow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              {/* CC bubble pattern - diagonal stripes */}
              <pattern id="cc-pattern-yes" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="rgba(11, 140, 48, 0.9)"/>
                <path d="M0,0 L8,8" stroke="rgba(11, 140, 48, 0.5)" strokeWidth="1.5"/>
              </pattern>
              <pattern id="cc-pattern-no" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="rgba(140, 32, 11, 0.9)"/>
                <path d="M0,0 L8,8" stroke="rgba(140, 32, 11, 0.5)" strokeWidth="1.5"/>
              </pattern>
              <pattern id="cc-pattern-abstain" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="rgba(148, 163, 184, 0.9)"/>
                <path d="M0,0 L8,8" stroke="rgba(148, 163, 184, 0.5)" strokeWidth="1.5"/>
              </pattern>
              {/* Game theme text gradient */}
              <linearGradient id="game-text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.9)"/>
                <stop offset="90%" stopColor="rgba(215, 215, 215, 0.8)"/>
                <stop offset="99%" stopColor="rgba(120, 120, 120, 0.7)"/>
                <stop offset="100%" stopColor="rgba(35, 35, 35, 0.08)"/>
              </linearGradient>
              {/* Game theme bubble gradients - dark on right, normal on left */}
              <linearGradient id="game-bubble-yes" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(11, 140, 48, 0.5)"/>
                <stop offset="70%" stopColor="rgba(11, 140, 48, 0.35)"/>
                <stop offset="100%" stopColor="rgba(5, 70, 24, 0.2)"/>
              </linearGradient>
              <linearGradient id="game-bubble-no" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(140, 32, 11, 0.5)"/>
                <stop offset="70%" stopColor="rgba(140, 32, 11, 0.35)"/>
                <stop offset="100%" stopColor="rgba(70, 16, 5, 0.2)"/>
              </linearGradient>
              <linearGradient id="game-bubble-abstain" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(148, 163, 184, 0.5)"/>
                <stop offset="70%" stopColor="rgba(148, 163, 184, 0.35)"/>
                <stop offset="100%" stopColor="rgba(74, 82, 92, 0.2)"/>
              </linearGradient>
              <filter id="game-text-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.8)" floodOpacity="1"/>
              </filter>
            </defs>
          {visibleBubbles.map((bubble, index) => {
            const palette = getVoteColors(bubble.vote.vote, bubble.vote.voterType);
            const isCC = bubble.vote.voterType === "CC";
            const isHovered = hoveredBubbleId === `${bubble.vote.voterId}-${index}`;
            const scale = isHovered ? 1.1 : 1;
            const filters = isHovered ? "url(#bubble-shadow-hover)" : "url(#bubble-shadow)";

            // CC bubbles get pattern fill and thicker border
            const patternId = isCC 
              ? (bubble.vote.vote === "Yes" ? "cc-pattern-yes" : bubble.vote.vote === "No" ? "cc-pattern-no" : "cc-pattern-abstain")
              : null;
            
            // Game theme: gradient fills (dark on right, normal on left)
            const getGameFill = () => {
              switch (bubble.vote.vote) {
                case "Yes": return "url(#game-bubble-yes)";
                case "No": return "url(#game-bubble-no)";
                default: return "url(#game-bubble-abstain)";
              }
            };
            
            const fillColor = isGame ? getGameFill() : isDark ? "transparent" : patternId ? `url(#${patternId})` : palette.fill;
            const strokeWidth = isGame ? "0" : isDark ? "1.4" : isCC ? "3" : "2";
            const strokeColor = isGame ? "transparent" : palette.border;

            // Find index in sorted bubbles for animation timing
            const sortedIndex = sortedBubbles.findIndex(
              (b) => b.vote.voterId === bubble.vote.voterId && b.vote.votedAt === bubble.vote.votedAt
            );
            const isAnimating = currentStep === null || sortedIndex <= currentStep;
            const animationDelay = currentStep !== null && sortedIndex >= 0 ? sortedIndex * 0.1 : 0;
            const shouldAnimate = currentStep !== null;

            return (
              <g
                key={`${bubble.vote.voterId}-${index}`}
                style={{ 
                  opacity: isAnimating ? 1 : 0,
                  transform: `translate(${bubble.x}, ${bubble.y}) scale(${isAnimating ? scale : 0}) translate(${-bubble.x}, ${-bubble.y})`,
                  transition: shouldAnimate ? "opacity 0.3s ease, transform 0.3s ease" : "none",
                  transitionDelay: shouldAnimate ? `${animationDelay}s` : "0s",
                }}
              >
                <circle
                  cx={bubble.x}
                  cy={bubble.y}
                  r={bubble.radius}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  filter={filters}
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={(e) => {
                    setHoveredBubbleId(`${bubble.vote.voterId}-${index}`);
                    handleMouseEnter(bubble, e);
                  }}
                  onMouseLeave={() => {
                    setHoveredBubbleId(null);
                    handleMouseLeave();
                  }}
                />
                {bubble.radius > 15 && (
                  <text
                    x={bubble.x}
                    y={bubble.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isGame ? "url(#game-text-gradient)" : isDark ? palette.border : "#0f172a"}
                    filter={isGame ? "url(#game-text-shadow)" : undefined}
                    className={isGame ? "pointer-events-none text-xs font-normal" : "pointer-events-none text-xs font-semibold"}
                  >
                    {bubble.vote.voterName
                      ? bubble.vote.voterName.slice(0, Math.floor(bubble.radius / 4))
                      : (bubble.vote.voterId ?? bubble.vote.drepId).slice(
                          0,
                          Math.floor(bubble.radius / 6)
                        )}
                  </text>
                )}
              </g>
            );
          })}
          </svg>
        </div>
        {hoveredBubble && (
          <div
            className={
              isGame
                ? "absolute z-50 rounded-sm px-4 py-3 text-xs pointer-events-none game-tooltip-card"
                : "absolute z-50 rounded-2xl border border-white/8 bg-[#faf9f6] px-4 py-3 text-xs shadow-[0_12px_30px_rgba(15,23,42,0.25)] pointer-events-none"
            }
            style={{
              left: `${hoveredBubble.x + 15}px`,
              top: `${Math.max(8, hoveredBubble.y - 14)}px`,
              transform: "translateY(-100%)",
            }}
          >
            <div className={isGame ? "font-semibold text-white" : "font-semibold text-foreground"}>
              {hoveredBubble.bubble.vote.voterName || hoveredBubble.bubble.vote.voterId}
            </div>
            <div className={isGame ? "mt-1 text-white/70" : "mt-1 text-muted-foreground"}>
              <span className="font-medium">Type:</span> {hoveredBubble.bubble.vote.voterType}
            </div>
            <div className={isGame ? "mt-1 text-white/70" : "mt-1 text-muted-foreground"}>
              <span className="font-medium">Vote:</span> {hoveredBubble.bubble.vote.vote}
            </div>
            {getVotingPowerAda(hoveredBubble.bubble.vote) > 0 ? (
              <div className={isGame ? "mt-1 text-white/70" : "mt-1 text-muted-foreground"}>
                <span className="font-medium">Power:</span>{" "}
                {formatAda(getVotingPowerAda(hoveredBubble.bubble.vote))} ADA
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

