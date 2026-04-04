import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { SafeResponsiveContainer as ResponsiveContainer } from "@/components/ui/safe-responsive-container";
import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import type { DRepSummary } from "@/types/drep";

interface DRepDelegatedAdaDonutProps {
  dreps: DRepSummary[];
  className?: string;
}

interface SliceData {
  name: string;
  value: number;
  fill: string;
  [key: string]: string | number;
}

function formatAda(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

type TopN = 10 | 20 | 50;
const TOP_OPTIONS: TopN[] = [10, 20, 50];

export function DRepDelegatedAdaDonut({ dreps, className }: DRepDelegatedAdaDonutProps) {
  const t = useTranslations();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";
  const isDark = !isLight && !isGame;
  const [topN, setTopN] = useState<TopN>(10);

  const sorted = useMemo(() => {
    return [...dreps]
      .filter((d) => d.votingPowerAda > 0)
      .sort((a, b) => b.votingPowerAda - a.votingPowerAda);
  }, [dreps]);

  const data = useMemo<SliceData[]>(() => {
    const top = sorted.slice(0, topN);
    const rest = sorted.slice(topN);
    const othersValue = rest.reduce((sum, d) => sum + d.votingPowerAda, 0);

    const slices: SliceData[] = top.map((d, i) => {
      const name = d.name || `${d.drepId.slice(0, 8)}...`;
      // Rank-based shade variation per theme
      const ratio = i / Math.max(top.length - 1, 1);
      const tealOpacity = 0.6 - ratio * 0.5;
      const gameShade = Math.round(20 + ratio * 35);
      const fill = isLight
        ? "#ffffff"
        : isGame
        ? `rgba(${gameShade},${gameShade},${gameShade},0.7)`
        : `rgba(11,209,162,${tealOpacity.toFixed(2)})`;
      return { name, value: d.votingPowerAda, fill };
    });

    if (othersValue > 0) {
      const fill = isLight
        ? "#94a3b8"
        : isGame
        ? "rgba(60,60,60,0.7)"
        : "rgba(11,209,162,0.08)";
      slices.push({
        name: t("drep.others"),
        value: othersValue,
        fill,
      });
    }

    return slices;
  }, [sorted, topN, isLight, isGame, t]);

  const total = useMemo(() => sorted.reduce((s, d) => s + d.votingPowerAda, 0), [sorted]);

  // Concentration stats for legend
  const concentration = useMemo(() => {
    const cumSum = (n: number) => sorted.slice(0, n).reduce((s, d) => s + d.votingPowerAda, 0);
    return { top10: cumSum(10), top20: cumSum(20), top50: cumSum(50) };
  }, [sorted]);

  if (sorted.length === 0) return null;

  const textColor = isGame ? "text-white" : isLight ? "text-black" : "text-foreground";
  const mutedColor = isGame ? "text-white/60" : "text-muted-foreground";

  return (
    <div className={className}>
      {/* Title centered */}
      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 text-center ${mutedColor}`}>
        {t("drep.delegationAdaConcentrationTitle")}
      </h4>

      {/* Chart with tabs on left */}
      <div className="flex items-center">
        <div className="flex flex-col gap-0.5">
          {TOP_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              className={`px-1.5 py-0.5 text-3xs font-medium rounded transition-colors ${
                topN === n
                  ? isLight
                    ? "bg-black/10 text-black"
                    : isGame
                    ? "bg-white/15 text-white"
                    : "bg-[#0bd1a2]/20 text-[#0bd1a2]"
                  : isLight
                  ? "text-black/40 hover:text-black/60"
                  : isGame
                  ? "text-white/30 hover:text-white/50"
                  : "text-[#0bd1a2]/40 hover:text-[#0bd1a2]/60"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="relative flex-1 overflow-visible [&_.recharts-wrapper]:!overflow-visible" style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart style={{ overflow: "visible" }}>
            {isLight && (
              <defs>
                <filter id="delegatedAdaDonutShadow" x="-50%" y="-50%" width="200%" height="200%">
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
              style={isLight ? { filter: "url(#delegatedAdaDonutShadow)" } : undefined}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`${entry.name}-${index}`}
                  fill={entry.fill}
                  fillOpacity={isGame ? 0.85 : 1}
                  stroke={isLight ? "rgba(15,23,42,0.15)" : isGame ? `rgba(255,255,255,${0.4 + index * 0.08})` : "rgba(11,209,162,0.5)"}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              isAnimationActive={false}
              content={({ active: isActive, payload }) => {
                if (!isActive || !payload?.[0]) return null;
                const d = payload[0].payload as SliceData;
                const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                return (
                  <div className={
                    isGame
                      ? "game-tooltip-card rounded-sm px-3 py-2 text-xs"
                      : isLight
                      ? "rounded-lg p-2 text-sm bg-white text-gray-900 border border-gray-200 shadow-elevation-1"
                      : "bg-[rgba(8,8,8,0.95)] border border-[#0bd1a2]/30 rounded-sm px-3 py-2 text-xs"
                  }>
                    <p className={isGame ? "font-medium text-white" : isDark ? "font-medium text-[#0bd1a2]" : "font-medium"}>
                      {d.name}: {formatAda(d.value)} ADA
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
      </div>

      {/* Legend - concentration breakdown */}
      <div className="flex justify-center mt-3 px-3">
        <div className="flex flex-col gap-1.5">
          {[
            { label: t("drep.delegatorsAll"), value: total, pct: 100, n: null as number | null },
            { label: t("drep.delegatorsTop", { n: 10 }), value: concentration.top10, pct: total > 0 ? (concentration.top10 / total) * 100 : 0, n: 10 },
            { label: t("drep.delegatorsTop", { n: 20 }), value: concentration.top20, pct: total > 0 ? (concentration.top20 / total) * 100 : 0, n: 20 },
            { label: t("drep.delegatorsTop", { n: 50 }), value: concentration.top50, pct: total > 0 ? (concentration.top50 / total) * 100 : 0, n: 50 },
          ].map(({ label, value, pct, n }) => {
            const isActive = n === topN;
            return (
              <div key={label} className={`flex items-center gap-3 text-xs rounded px-1 -mx-1 transition-colors ${
                isActive
                  ? isLight
                    ? "bg-black/8"
                    : isGame
                    ? "bg-white/10"
                    : "bg-[#0bd1a2]/10"
                  : ""
              }`}>
                <span className={`w-[50px] ${isActive
                  ? isLight ? "text-black font-semibold" : isGame ? "text-white font-semibold" : "text-[#0bd1a2] font-semibold"
                  : mutedColor
                }`}>{label}</span>
                <span className={`w-[55px] text-right font-medium ${textColor}`}>{formatAda(value)}</span>
                <span className={`font-medium ${textColor}`}>{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
