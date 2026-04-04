import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";

interface DRepActivityDonutProps {
  dreps: DRepSummary[];
  className?: string;
}

interface SliceData {
  name: string;
  value: number;
  fill: string;
  [key: string]: string | number;
}

export function DRepActivityDonut({ dreps, className }: DRepActivityDonutProps) {
  const t = useTranslations();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";

  const { zeroPower, zeroVotes, active } = useMemo(() => {
    let zeroPower = 0;
    let zeroVotes = 0;
    let active = 0;
    for (const d of dreps) {
      if (d.votingPowerAda === 0) {
        zeroPower++;
      } else if (d.totalVotesCast === 0) {
        zeroVotes++;
      } else {
        active++;
      }
    }
    return { zeroPower, zeroVotes, active };
  }, [dreps]);

  const total = dreps.length;

  const isDark = !isLight && !isGame;

  const data = useMemo<SliceData[]>(() => {
    if (total === 0) return [];
    // Match DRep profile page donut colors exactly
    const c = isLight
      ? { active: "#ffffff", zeroPower: "#e2e8f0", zeroVotes: "#94a3b8" }
      : isGame
      ? { active: "rgba(20,20,20,0.7)", zeroPower: "rgba(55,55,55,0.7)", zeroVotes: "rgba(40,40,40,0.7)" }
      : { active: "rgba(11,209,162,0.6)", zeroPower: "rgba(11,209,162,0.25)", zeroVotes: "rgba(11,209,162,0.1)" };
    return [
      { name: t("drep.activityActive"), value: active, fill: c.active },
      { name: t("drep.activityZeroPower"), value: zeroPower, fill: c.zeroPower },
      { name: t("drep.activityZeroVotes"), value: zeroVotes, fill: c.zeroVotes },
    ].filter((s) => s.value > 0);
  }, [total, active, zeroPower, zeroVotes, isLight, isGame, t]);

  if (total === 0) return null;

  const textColor = isGame ? "text-white" : isLight ? "text-black" : "text-foreground";
  const mutedColor = isGame ? "text-white/60" : "text-muted-foreground";

  return (
    <div className={className}>
      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 text-center ${mutedColor}`}>
        {t("drep.activityTitle")}
      </h4>
      <div className="relative w-full overflow-visible [&_.recharts-wrapper]:!overflow-visible" style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart style={{ overflow: "visible" }}>
            {isLight && (
              <defs>
                <filter id="activityDonutShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.25" />
                </filter>
              </defs>
            )}
            <Pie
              isAnimationActive={false}
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              cornerRadius={isLight ? 0 : 2}
              paddingAngle={isGame ? 2 : 3}
              stroke="none"
              style={isLight ? { filter: "url(#activityDonutShadow)" } : undefined}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={entry.fill}
                  fillOpacity={isGame ? 0.85 : 1}
                  stroke={isLight ? "rgba(15,23,42,0.15)" : isGame ? `rgba(255,255,255,${0.6 + index * 0.1})` : "rgba(11,209,162,0.5)"}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              isAnimationActive={false}
              content={({ active: isActive, payload }) => {
                if (!isActive || !payload?.[0]) return null;
                const d = payload[0].payload as SliceData;
                const pct = ((d.value / total) * 100).toFixed(1);
                return (
                  <div className={
                    isGame
                      ? "game-tooltip-card rounded-sm px-3 py-2 text-xs"
                      : isLight
                      ? "rounded-lg p-2 text-sm bg-white text-gray-900 border border-gray-200 shadow-elevation-1"
                      : "bg-[rgba(8,8,8,0.95)] border border-[#0bd1a2]/30 rounded-sm px-3 py-2 text-xs"
                  }>
                    <p className={isGame ? "font-medium text-white" : isDark ? "font-medium text-[#0bd1a2]" : "font-medium"}>
                      {d.name}: {d.value.toLocaleString()}
                    </p>
                    <p className={isGame ? "text-xs text-white/70" : isDark ? "text-xs text-[#0bd1a2]/70" : "text-xs opacity-70"}>
                      {pct}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-col gap-1.5 mt-3 px-3">
        <div className="flex items-center justify-between text-xs">
          <span className={`font-semibold ${textColor}`}>{t("drep.activityTotal")}</span>
          <span className={`font-bold ${textColor}`}>{total.toLocaleString()}</span>
        </div>
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between text-xs gap-4">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: entry.fill,
                  border: isLight ? "1px solid rgba(15,23,42,0.1)"
                    : isGame ? "1px solid rgba(255,255,255,0.15)"
                    : "1px solid rgba(0,0,0,0.2)",
                  boxShadow: isLight ? "0 1px 3px rgba(15,23,42,0.2)" : undefined,
                }}
              />
              <span className={mutedColor}>{entry.name}</span>
            </div>
            <span className={`font-medium ${textColor}`}>{entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
