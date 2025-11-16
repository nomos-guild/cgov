import { useMemo } from "react";
import type { Vote } from "@/types/governance";

interface BubbleMapProps {
  votes: Vote[];
}

interface Bubble {
  x: number;
  y: number;
  radius: number;
  vote: Vote;
}

function getVoteBorderColor(vote: Vote["vote"]): string {
  switch (vote) {
    case "Yes":
      return "rgb(22, 163, 74)"; // dark green
    case "No":
      return "rgb(185, 28, 28)"; // dark red
    case "Abstain":
      return "rgb(107, 114, 128)"; // grey
    default:
      return "rgb(107, 114, 128)";
  }
}

function formatAda(ada: number): string {
  if (ada >= 1000000) {
    return `${(ada / 1000000).toFixed(1)}M`;
  }
  if (ada >= 1000) {
    return `${(ada / 1000).toFixed(1)}K`;
  }
  return ada.toFixed(0);
}

function checkOverlap(newBubble: Bubble, existingBubbles: Bubble[]): boolean {
  return existingBubbles.some((b) => {
    const dx = newBubble.x - b.x;
    const dy = newBubble.y - b.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < newBubble.radius + b.radius + 2;
  });
}

function placeBubbleNearCluster(
  vote: Vote,
  radius: number,
  clusterCenterX: number,
  clusterCenterY: number,
  clusterRadius: number,
  placedBubbles: Bubble[]
): Bubble | null {
  const maxAttempts = 300;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * clusterRadius;
    const x = clusterCenterX + Math.cos(angle) * distance;
    const y = clusterCenterY + Math.sin(angle) * distance;
    
    const bubble: Bubble = { x, y, radius, vote };
    
    if (!checkOverlap(bubble, placedBubbles)) {
      return bubble;
    }
  }
  
  return null;
}

export function BubbleMap({ votes }: BubbleMapProps) {
  const bubbles = useMemo(() => {
    if (votes.length === 0) return [];

    const validVotes = votes.filter((v) => v.votingPowerAda !== undefined && v.votingPowerAda > 0);
    const zeroPowerVotes = votes.filter((v) => !v.votingPowerAda || v.votingPowerAda === 0);
    
    const allVotesToPlace = [...validVotes, ...zeroPowerVotes];
    
    if (allVotesToPlace.length === 0) return [];

    const validVotesWithPower = validVotes.filter((v) => (v.votingPowerAda || 0) > 0);
    const maxPower = validVotesWithPower.length > 0 
      ? Math.max(...validVotesWithPower.map((v) => v.votingPowerAda || 0))
      : 1;
    const minPower = validVotesWithPower.length > 0
      ? Math.min(...validVotesWithPower.map((v) => v.votingPowerAda || 0))
      : 1;
    const powerRange = maxPower - minPower || 1;

    const minRadius = 8;
    const maxRadius = 50;
    const radiusRange = maxRadius - minRadius;

    const containerWidth = 800;
    const containerHeight = 600;
    const margin = 100;

    const yesVotes = allVotesToPlace.filter((v) => v.vote === "Yes");
    const noVotes = allVotesToPlace.filter((v) => v.vote === "No");
    const abstainVotes = allVotesToPlace.filter((v) => v.vote === "Abstain");

    const clusters = [
      { 
        votes: yesVotes, 
        centerX: containerWidth * 0.25, 
        centerY: containerHeight * 0.5,
        clusterRadius: 150
      },
      { 
        votes: noVotes, 
        centerX: containerWidth * 0.75, 
        centerY: containerHeight * 0.5,
        clusterRadius: 150
      },
      { 
        votes: abstainVotes, 
        centerX: containerWidth * 0.5, 
        centerY: containerHeight * 0.8,
        clusterRadius: 120
      },
    ];

    const bubbles: Bubble[] = [];
    const placedBubbles: Bubble[] = [];

    clusters.forEach((cluster) => {
      const sortedVotes = [...cluster.votes].sort((a, b) => (b.votingPowerAda || 0) - (a.votingPowerAda || 0));
      
      sortedVotes.forEach((vote) => {
        const power = vote.votingPowerAda || 0;
        let radius: number;
        
        if (power > 0) {
          const normalizedPower = (power - minPower) / powerRange;
          radius = minRadius + normalizedPower * radiusRange;
        } else {
          radius = 10;
        }

        const bubble = placeBubbleNearCluster(
          vote,
          radius,
          cluster.centerX,
          cluster.centerY,
          cluster.clusterRadius,
          placedBubbles
        );

        if (bubble) {
          bubbles.push(bubble);
          placedBubbles.push(bubble);
        }
      });
    });

    return bubbles;
  }, [votes]);

  if (votes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        No votes available
      </div>
    );
  }

  const containerWidth = 800;
  const containerHeight = 600;

  const yesVotes = votes.filter((v) => v.vote === "Yes");
  const noVotes = votes.filter((v) => v.vote === "No");
  const abstainVotes = votes.filter((v) => v.vote === "Abstain");

  const clusters = [
    { label: "Yes", count: yesVotes.length, centerX: containerWidth * 0.25, centerY: containerHeight * 0.5, color: "rgb(34, 197, 94)" },
    { label: "No", count: noVotes.length, centerX: containerWidth * 0.75, centerY: containerHeight * 0.5, color: "rgb(239, 68, 68)" },
    { label: "Abstain", count: abstainVotes.length, centerX: containerWidth * 0.5, centerY: containerHeight * 0.8, color: "rgb(156, 163, 175)" },
  ];

  return (
    <div className="w-full overflow-auto">
      <div className="flex items-center justify-center p-4">
        <svg
          width="800"
          height="600"
          viewBox="0 0 800 600"
          className="border border-border rounded-lg bg-background"
        >
          {clusters.map((cluster) => (
            <g key={cluster.label}>
              <circle
                cx={cluster.centerX}
                cy={cluster.centerY}
                r={cluster.label === "Abstain" ? 120 : 150}
                fill={cluster.color}
                opacity={0.05}
              />
            </g>
          ))}
          {bubbles.map((bubble, index) => {
            const borderColor = getVoteBorderColor(bubble.vote);
            const power = bubble.vote.votingPowerAda || 0;

            return (
              <g key={`${bubble.vote.voterId}-${index}`}>
                <circle
                  cx={bubble.x}
                  cy={bubble.y}
                  r={bubble.radius}
                  fill="rgb(0, 0, 0)"
                  stroke={borderColor}
                  strokeWidth="2"
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <title>
                    {bubble.vote.voterName || bubble.vote.voterId}
                    {`\nVote: ${bubble.vote.vote}`}
                    {power > 0 ? `\nPower: ${formatAda(power)} ADA` : "\nCC Member"}
                  </title>
                </circle>
                {bubble.radius > 15 && (
                  <text
                    x={bubble.x}
                    y={bubble.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-xs fill-white font-semibold pointer-events-none"
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
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-black border-2 border-green-700"></div>
          <span className="text-muted-foreground">Yes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-black border-2 border-red-700"></div>
          <span className="text-muted-foreground">No</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-black border-2 border-gray-500"></div>
          <span className="text-muted-foreground">Abstain</span>
        </div>
      </div>
    </div>
  );
}
