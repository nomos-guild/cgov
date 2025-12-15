import { useMemo, useState, useRef } from "react";
import type { VoteRecord, VoterType } from "@/types/governance";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
          fill: "rgba(13, 148, 136, 0.9)", // More opaque for CC
          border: "rgba(13, 148, 136, 0.8)", // Stronger border matching fill
        };
      case "No":
        return {
          fill: "rgba(91, 33, 182, 0.9)", // More opaque for CC
          border: "rgba(91, 33, 182, 0.8)", // Stronger border matching fill
        };
      case "Abstain":
      default:
        return {
          fill: "rgba(148, 163, 184, 0.9)", // More opaque gray for CC
          border: "rgba(148, 163, 184, 0.8)", // Stronger border
        };
    }
  }

  // Regular styling for DRep and SPO
  switch (vote) {
    case "Yes":
      return {
        fill: "rgba(13, 148, 136, 0.7)", // Less transparent green-teal fill
        border: "rgba(255, 255, 255, 0.3)", // More visible border
      };
    case "No":
      return {
        fill: "rgba(91, 33, 182, 0.7)", // Less transparent dark purple fill
        border: "rgba(255, 255, 255, 0.3)", // More visible border
      };
    case "Abstain":
    default:
      return {
        fill: "#faf9f6", // Cream fill
        border: "rgba(255, 255, 255, 0.3)", // More visible border
      };
  }
}


function formatAda(ada: number): string {
  if (ada >= 1_000_000) {
    return `${(ada / 1_000_000).toFixed(1)}M`;
  }
  if (ada >= 1_000) {
    return `${(ada / 1_000).toFixed(1)}K`;
  }
  return ada.toFixed(0);
}

function checkOverlap(newBubble: Bubble, existingBubbles: Bubble[]): boolean {
  return existingBubbles.some((b) => {
    const dx = newBubble.x - b.x;
    const dy = newBubble.y - b.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = newBubble.radius + b.radius + 2;
    return distance < minDistance;
  });
}

function placeBubbleInCircle(
  vote: VoteRecord,
  radius: number,
  centerX: number,
  centerY: number,
  circleRadius: number,
  angle: number,
  placedBubbles: Bubble[],
  fillColor: string,
  borderColor: string,
  containerWidth: number,
  containerHeight: number
): Bubble | null {
  const x = centerX + Math.cos(angle) * circleRadius;
  const y = centerY + Math.sin(angle) * circleRadius;

  const minX = radius + 10;
  const maxX = containerWidth - radius - 10;
  const minY = radius + 10;
  const maxY = containerHeight - radius - 10;

  const clampedX = Math.max(minX, Math.min(maxX, x));
  const clampedY = Math.max(minY, Math.min(maxY, y));

  const bubble: Bubble = {
    x: clampedX,
    y: clampedY,
    radius,
    vote,
    fillColor,
    borderColor,
  };

  if (!checkOverlap(bubble, placedBubbles)) {
    return bubble;
  }

  return null;
}

export function BubbleMap({ votes }: BubbleMapProps) {
  const [voterFilter, setVoterFilter] = useState<VoterFilter>("All");

  const filteredVotes = useMemo(() => {
    if (voterFilter === "All") return votes;
    return votes.filter((v) => v.voterType === voterFilter);
  }, [votes, voterFilter]);

  const bubbles = useMemo(() => {
    if (filteredVotes.length === 0) return [];

    const validVotes = filteredVotes.filter((v) => getVotingPowerAda(v) > 0);
    const zeroPowerVotes = filteredVotes.filter((v) => getVotingPowerAda(v) === 0);
    const allVotesToPlace = [...validVotes, ...zeroPowerVotes];
    if (allVotesToPlace.length === 0) return [];

    const validVotesWithPower = validVotes.filter((v) => getVotingPowerAda(v) > 0);
    const maxPower =
      validVotesWithPower.length > 0 ? Math.max(...validVotesWithPower.map((v) => getVotingPowerAda(v))) : 1;
    const minPower =
      validVotesWithPower.length > 0 ? Math.min(...validVotesWithPower.map((v) => getVotingPowerAda(v))) : 1;
    const powerRange = maxPower - minPower || 1;

    const minRadius = 8;
    const maxRadius = 50;
    const radiusRange = maxRadius - minRadius;

    const containerWidth = 800;
    const containerHeight = 600;

    const yesVotes = allVotesToPlace.filter((v) => v.vote === "Yes");
    const noVotes = allVotesToPlace.filter((v) => v.vote === "No");
    const abstainVotes = allVotesToPlace.filter((v) => v.vote === "Abstain");

    const maxClusterRadius = Math.min(containerWidth * 0.35, containerHeight * 0.35);

    const clusters = [
      {
        votes: yesVotes,
        centerX: containerWidth * 0.25,
        centerY: containerHeight * 0.45,
        clusterRadius: Math.min(Math.max(120, Math.sqrt(yesVotes.length) * 18), maxClusterRadius),
      },
      {
        votes: noVotes,
        centerX: containerWidth * 0.75,
        centerY: containerHeight * 0.45,
        clusterRadius: Math.min(Math.max(120, Math.sqrt(noVotes.length) * 18), maxClusterRadius),
      },
      {
        votes: abstainVotes,
        centerX: containerWidth * 0.5,
        centerY: containerHeight * 0.65,
        clusterRadius: Math.min(Math.max(100, Math.sqrt(abstainVotes.length) * 18), maxClusterRadius),
      },
    ];

    const bubbles: Bubble[] = [];
    const placedBubbles: Bubble[] = [];

    clusters.forEach((cluster) => {
      // Separate CC votes from other votes
      const ccVotes = cluster.votes.filter((v) => v.voterType === "CC");
      const nonCCVotes = cluster.votes.filter((v) => v.voterType !== "CC");
      
      // Sort both groups by voting power
      const sortedCCVotes = [...ccVotes].sort(
        (a, b) => getVotingPowerAda(b) - getVotingPowerAda(a)
      );
      const sortedNonCCVotes = [...nonCCVotes].sort(
        (a, b) => getVotingPowerAda(b) - getVotingPowerAda(a)
      );

      // Place CC votes first in a tight sub-cluster at the center
      if (sortedCCVotes.length > 0) {
        const ccClusterRadius = Math.min(40, Math.sqrt(sortedCCVotes.length) * 12);
        
        sortedCCVotes.forEach((vote, index) => {
          const power = getVotingPowerAda(vote);
          const radius = power > 0 ? minRadius + ((power - minPower) / powerRange) * radiusRange : 10;

          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.log("[BubbleMap] CC bubble", {
              voterId: vote.voterId || vote.drepId,
              voterType: vote.voterType,
              vote: vote.vote,
              powerAda: power,
              radius,
            });
          }

          const palette = getVoteColors(vote.vote, vote.voterType);
          const angleStep = sortedCCVotes.length > 1 ? (Math.PI * 2) / sortedCCVotes.length : 0;
          const angle = index * angleStep;
          const circleRadius = ccClusterRadius * 0.5;

          let bubble = placeBubbleInCircle(
            vote,
            radius,
            cluster.centerX,
            cluster.centerY,
            circleRadius,
            angle,
            placedBubbles,
            palette.fill,
            palette.border,
            containerWidth,
            containerHeight
          );

          if (!bubble) {
            let attempts = 0;
            let maxRadius = ccClusterRadius;
            let spiralAngle = angle;
            let spiralRadius = circleRadius;

            while (!bubble && attempts < 500) {
              spiralAngle += 0.3;
              if (attempts % 20 === 0) {
                spiralRadius += 3;
              }

              if (spiralRadius > maxRadius) {
                maxRadius += 5;
                spiralRadius = circleRadius;
              }

              bubble = placeBubbleInCircle(
                vote,
                radius,
                cluster.centerX,
                cluster.centerY,
                spiralRadius,
                spiralAngle,
                placedBubbles,
                palette.fill,
                palette.border,
                containerWidth,
                containerHeight
              );
              attempts++;
            }
          }

          if (bubble) {
            bubbles.push(bubble);
            placedBubbles.push(bubble);
          }
        });
      }

      // Place non-CC votes around the CC cluster
      const startAngle = sortedCCVotes.length > 0 ? Math.PI / 4 : 0; // Offset if CC votes exist
      sortedNonCCVotes.forEach((vote, index) => {
        const power = getVotingPowerAda(vote);
        const radius = power > 0 ? minRadius + ((power - minPower) / powerRange) * radiusRange : 10;

        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log("[BubbleMap] non-CC bubble", {
            voterId: vote.voterId || vote.drepId,
            voterType: vote.voterType,
            vote: vote.vote,
            powerAda: power,
            radius,
          });
        }

        const palette = getVoteColors(vote.vote, vote.voterType);
        const angleStep = sortedNonCCVotes.length > 0 ? (Math.PI * 2) / sortedNonCCVotes.length : 0;
        const angle = startAngle + index * angleStep;
        // Start further out if CC votes exist
        const baseRadius = sortedCCVotes.length > 0 ? cluster.clusterRadius * 0.3 : cluster.clusterRadius * 0.6;
        const circleRadius = baseRadius;

        let bubble = placeBubbleInCircle(
          vote,
          radius,
          cluster.centerX,
          cluster.centerY,
          circleRadius,
          angle,
          placedBubbles,
          palette.fill,
          palette.border,
          containerWidth,
          containerHeight
        );

        if (!bubble) {
          let attempts = 0;
          let maxRadius = cluster.clusterRadius;
          let spiralAngle = angle;
          let spiralRadius = circleRadius;

          while (!bubble && attempts < 500) {
            spiralAngle += 0.3;
            if (attempts % 20 === 0) {
              spiralRadius += 5;
            }

            if (spiralRadius > maxRadius) {
              maxRadius += 10;
              spiralRadius = circleRadius;
            }

            bubble = placeBubbleInCircle(
              vote,
              radius,
              cluster.centerX,
              cluster.centerY,
              spiralRadius,
              spiralAngle,
              placedBubbles,
              palette.fill,
              palette.border,
              containerWidth,
              containerHeight
            );
            attempts++;
          }
        }

        if (bubble) {
          bubbles.push(bubble);
          placedBubbles.push(bubble);
        }
      });
    });

    return bubbles;
  }, [filteredVotes]);

  const [hoveredBubble, setHoveredBubble] = useState<{ bubble: Bubble; x: number; y: number } | null>(null);
  const [hoveredBadge, setHoveredBadge] = useState<"Yes" | "No" | "Abstain" | null>(null);
  const [hoveredBubbleId, setHoveredBubbleId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

          const yesVotes = filteredVotes.filter((v) => v.vote === "Yes");
          const noVotes = filteredVotes.filter((v) => v.vote === "No");
          const abstainVotes = filteredVotes.filter((v) => v.vote === "Abstain");

  const containerWidth = 800;
  const containerHeight = 600;
  const maxClusterRadius = Math.min(containerWidth * 0.35, containerHeight * 0.35);

  const clusters = [
    {
      label: "Yes",
      count: yesVotes.length,
      centerX: containerWidth * 0.25,
      centerY: containerHeight * 0.45,
      color: "rgb(34, 197, 94)",
      radius: Math.min(Math.max(120, Math.sqrt(yesVotes.length) * 18), maxClusterRadius),
    },
    {
      label: "No",
      count: noVotes.length,
      centerX: containerWidth * 0.75,
      centerY: containerHeight * 0.45,
      color: "rgb(239, 68, 68)",
      radius: Math.min(Math.max(120, Math.sqrt(noVotes.length) * 18), maxClusterRadius),
    },
    {
      label: "Abstain",
      count: abstainVotes.length,
      centerX: containerWidth * 0.5,
      centerY: containerHeight * 0.65,
      color: "rgb(156, 163, 175)",
      radius: Math.min(Math.max(100, Math.sqrt(abstainVotes.length) * 18), maxClusterRadius),
    },
  ];

  return (
    <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.25)] overflow-visible">
      <div className="mb-2 flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-2 pb-4 text-sm overflow-visible">
        <div className="flex items-center gap-3">
          <div
            className="rounded-2xl border border-white/8 bg-[#faf9f6] px-4 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.25)] cursor-pointer transition-all hover:shadow-[0_16px_40px_rgba(15,23,42,0.35)]"
            onMouseEnter={() => setHoveredBadge("Yes")}
            onMouseLeave={() => setHoveredBadge(null)}
          >
            <LegendSwatch color="rgba(13, 148, 136, 0.15)" stroke="rgba(255, 255, 255, 0.08)" label={`Yes (${yesVotes.length})`} />
          </div>
          <div
            className="rounded-2xl border border-white/8 bg-[#faf9f6] px-4 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.25)] cursor-pointer transition-all hover:shadow-[0_16px_40px_rgba(15,23,42,0.35)]"
            onMouseEnter={() => setHoveredBadge("No")}
            onMouseLeave={() => setHoveredBadge(null)}
          >
            <LegendSwatch color="rgba(91, 33, 182, 0.15)" stroke="rgba(255, 255, 255, 0.08)" label={`No (${noVotes.length})`} />
          </div>
          <div
            className="rounded-2xl border border-white/8 bg-[#faf9f6] px-4 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.25)] cursor-pointer transition-all hover:shadow-[0_16px_40px_rgba(15,23,42,0.35)]"
            onMouseEnter={() => setHoveredBadge("Abstain")}
            onMouseLeave={() => setHoveredBadge(null)}
          >
            <LegendSwatch color="#faf9f6" stroke="rgba(255, 255, 255, 0.08)" label={`Abstain (${abstainVotes.length})`} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Filter:</span>
          <Select value={voterFilter} onValueChange={(value) => setVoterFilter(value as VoterFilter)}>
            <SelectTrigger className="w-[120px] h-9 rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="DRep">DRep</SelectItem>
              <SelectItem value="SPO">SPO</SelectItem>
              <SelectItem value="CC">CC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div ref={containerRef} className="w-full overflow-auto relative">
        <div className="flex items-center justify-center p-2">
          <svg
            ref={svgRef}
            id="bubble-map-svg"
            width="800"
            height="600"
            viewBox="0 0 800 600"
            className="rounded-lg bg-background"
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
                <feFlood floodColor="rgba(13, 148, 136, 0.6)" result="glowColor"/>
                <feComposite in="glowColor" in2="coloredBlur" operator="in" result="glow"/>
                <feMerge>
                  <feMergeNode in="glow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="bubble-glow-no" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="coloredBlur"/>
                <feFlood floodColor="rgba(91, 33, 182, 0.6)" result="glowColor"/>
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
                <rect width="8" height="8" fill="rgba(13, 148, 136, 0.9)"/>
                <path d="M0,0 L8,8" stroke="rgba(13, 148, 136, 0.5)" strokeWidth="1.5"/>
              </pattern>
              <pattern id="cc-pattern-no" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="rgba(91, 33, 182, 0.9)"/>
                <path d="M0,0 L8,8" stroke="rgba(91, 33, 182, 0.5)" strokeWidth="1.5"/>
              </pattern>
              <pattern id="cc-pattern-abstain" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="rgba(148, 163, 184, 0.9)"/>
                <path d="M0,0 L8,8" stroke="rgba(148, 163, 184, 0.5)" strokeWidth="1.5"/>
              </pattern>
            </defs>
          {bubbles.map((bubble, index) => {
            const power = getVotingPowerAda(bubble.vote);
            const palette = getVoteColors(bubble.vote.vote, bubble.vote.voterType);
            const isCC = bubble.vote.voterType === "CC";
            const isHighlighted = hoveredBadge === bubble.vote.vote;
            const isHovered = hoveredBubbleId === `${bubble.vote.voterId}-${index}`;
            const scale = isHighlighted ? 1.15 : isHovered ? 1.1 : 1;
            let filters = isHovered ? "url(#bubble-shadow-hover)" : "url(#bubble-shadow)";
            if (isHighlighted) {
              const glowFilter = bubble.vote.vote === "Yes" ? "bubble-glow-yes" : bubble.vote.vote === "No" ? "bubble-glow-no" : "bubble-glow-abstain";
              filters = isHovered 
                ? `url(#bubble-shadow-hover) url(#${glowFilter})`
                : `url(#bubble-shadow) url(#${glowFilter})`;
            }

            // CC bubbles get pattern fill and thicker border
            const patternId = isCC 
              ? (bubble.vote.vote === "Yes" ? "cc-pattern-yes" : bubble.vote.vote === "No" ? "cc-pattern-no" : "cc-pattern-abstain")
              : null;
            const fillColor = patternId ? `url(#${patternId})` : palette.fill;
            const strokeWidth = isCC ? "3" : "2";
            const strokeColor = isCC ? palette.border : palette.border;

            return (
              <g
                key={`${bubble.vote.voterId}-${index}`}
                transform={`translate(${bubble.x}, ${bubble.y}) scale(${scale}) translate(${-bubble.x}, ${-bubble.y})`}
                style={{ transition: "transform 0.3s ease" }}
              >
                {/* Circular signal waves for CC bubbles */}
                {isCC && (
                  <>
                    <circle cx={bubble.x} cy={bubble.y} r={bubble.radius} fill="none" stroke={palette.border} strokeWidth="1.5" strokeOpacity="0.4">
                      <animate
                        attributeName="r"
                        values={`${bubble.radius};${bubble.radius + 30}`}
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="stroke-opacity"
                        values="0.4;0"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle cx={bubble.x} cy={bubble.y} r={bubble.radius} fill="none" stroke={palette.border} strokeWidth="1.5" strokeOpacity="0.4">
                      <animate
                        attributeName="r"
                        values={`${bubble.radius};${bubble.radius + 30}`}
                        dur="2s"
                        begin="0.67s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="stroke-opacity"
                        values="0.4;0"
                        dur="2s"
                        begin="0.67s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle cx={bubble.x} cy={bubble.y} r={bubble.radius} fill="none" stroke={palette.border} strokeWidth="1.5" strokeOpacity="0.4">
                      <animate
                        attributeName="r"
                        values={`${bubble.radius};${bubble.radius + 30}`}
                        dur="2s"
                        begin="1.33s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="stroke-opacity"
                        values="0.4;0"
                        dur="2s"
                        begin="1.33s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </>
                )}
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
                >
                  {isCC && (
                    <animate
                      attributeName="r"
                      values={`${bubble.radius};${bubble.radius * 1.05};${bubble.radius}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
                {bubble.radius > 15 && (
                  <text
                    x={bubble.x}
                    y={bubble.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#0f172a"
                    className="pointer-events-none text-xs font-semibold"
                  >
                    {bubble.vote.voterName
                      ? bubble.vote.voterName.slice(0, Math.floor(bubble.radius / 4))
                      : bubble.vote.voterId.slice(0, Math.floor(bubble.radius / 6))}
                  </text>
                )}
              </g>
            );
          })}
          </svg>
        </div>
        {hoveredBubble && (
          <div
            className="absolute z-50 rounded-2xl border border-white/8 bg-[#faf9f6] px-4 py-3 text-xs shadow-[0_12px_30px_rgba(15,23,42,0.25)] pointer-events-none"
            style={{
              left: `${hoveredBubble.x + 15}px`,
              top: `${hoveredBubble.y - 10}px`,
              transform: "translateY(-100%)",
            }}
          >
            <div className="font-semibold text-foreground">
              {hoveredBubble.bubble.vote.voterName || hoveredBubble.bubble.vote.voterId}
            </div>
            <div className="mt-1 text-muted-foreground">
              <span className="font-medium">Type:</span> {hoveredBubble.bubble.vote.voterType}
            </div>
            <div className="mt-1 text-muted-foreground">
              <span className="font-medium">Vote:</span> {hoveredBubble.bubble.vote.vote}
            </div>
            {getVotingPowerAda(hoveredBubble.bubble.vote) > 0 ? (
              <div className="mt-1 text-muted-foreground">
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

function LegendSwatch({ color, stroke, label }: { color: string; stroke: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="16" height="16" className="flex-shrink-0">
        <circle
          cx="8"
          cy="8"
          r="6"
          fill={color}
          stroke={stroke}
          strokeWidth="1.5"
        />
      </svg>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
