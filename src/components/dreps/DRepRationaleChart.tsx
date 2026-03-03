import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

const RATIONALE_COLORS = {
  game: {
    withRationale: "rgba(20, 20, 20, 0.7)",
    withoutRationale: "rgba(55, 55, 55, 0.7)",
  },
  light: {
    withRationale: "#ffffff",
    withoutRationale: "#e2e8f0",
  },
  dark: {
    withRationale: "rgba(11, 209, 162, 0.6)",
    withoutRationale: "rgba(11, 209, 162, 0.15)",
  },
};

export interface RationaleChartProps {
  rationalesProvided: number;
  totalVotesCast: number;
  isGame: boolean;
  isLight: boolean;
  labels: { withRationale: string; without: string; empty: string };
}

export function RationaleChart({ rationalesProvided, totalVotesCast, isGame, isLight, labels }: RationaleChartProps) {
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
