import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { SafeResponsiveContainer as ResponsiveContainer } from "@/components/ui/safe-responsive-container";
import { useConcentrationHistory } from "@/hooks/useDRepData";
import { useTranslations } from "next-intl";
import type { ConcentrationHistoryPoint } from "@/types/drep";

interface DRepConcentrationChartProps {
  metric: "votingPower" | "delegators";
  isGame: boolean;
  isLight: boolean;
}

interface ChartDataPoint {
  epoch: number;
  top10: number;
  top20: number;
  top50: number;
  [key: string]: string | number;
}

function getLineColors(isGame: boolean, isLight: boolean) {
  if (isGame) {
    return {
      top10: "#ffd700",
      top20: "rgba(255,255,255,0.7)",
      top50: "rgba(255,255,255,0.35)",
    };
  }
  if (isLight) {
    return {
      top10: "#0f172a",
      top20: "#64748b",
      top50: "#cbd5e1",
    };
  }
  // dark / nerd
  return {
    top10: "#0bd1a2",
    top20: "rgba(11,209,162,0.55)",
    top50: "rgba(11,209,162,0.25)",
  };
}

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

interface ConcentrationTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; payload?: ChartDataPoint }>;
  label?: number;
  isGame: boolean;
  isLight: boolean;
  colors: ReturnType<typeof getLineColors>;
  labels: { top10: string; top20: string; top50: string };
  history: ConcentrationHistoryPoint[];
}

function ConcentrationTooltip({
  active,
  payload,
  label,
  isGame,
  isLight,
  colors,
  labels,
  history,
}: ConcentrationTooltipProps) {
  if (!active || !payload?.length) return null;

  const epoch = label as number;
  const point = history.find((h) => h.epoch === epoch);

  const top10 = payload.find((p) => p.dataKey === "top10")?.value ?? 0;
  const top20 = payload.find((p) => p.dataKey === "top20")?.value ?? 0;
  const top50 = payload.find((p) => p.dataKey === "top50")?.value ?? 0;

  const textColor = isGame ? "rgba(255,255,255,0.85)" : isLight ? "#334155" : "rgba(11,209,162,0.85)";
  const mutedColor = isGame ? "rgba(255,255,255,0.45)" : isLight ? "#94a3b8" : "rgba(11,209,162,0.5)";

  return (
    <div
      style={{
        backgroundColor: isGame
          ? "rgba(12,12,12,0.95)"
          : isLight
            ? "#fff"
            : "rgba(10,22,40,0.95)",
        border: `1px solid ${isGame ? "rgba(255,255,255,0.2)" : isLight ? "#cbd5e1" : "rgba(11,209,162,0.3)"}`,
        borderRadius: isLight ? 6 : isGame ? 4 : 0,
        boxShadow: isGame
          ? "0 4px 16px rgba(0,0,0,0.6)"
          : isLight
            ? "0 4px 12px rgba(15,23,42,0.15)"
            : "0 4px 16px rgba(0,0,0,0.5)",
        padding: "8px 12px",
        fontSize: 12,
        whiteSpace: "nowrap" as const,
      }}
    >
      <p
        style={{
          fontWeight: 600,
          marginBottom: 6,
          color: isGame ? "#fff" : isLight ? "#1e293b" : "#0bd1a2",
        }}
      >
        Epoch {epoch}
      </p>
      {[
        { key: "top50", color: colors.top50, label: labels.top50, value: top50, ada: point?.top50VpAda, del: point?.top50Del },
        { key: "top20", color: colors.top20, label: labels.top20, value: top20, ada: point?.top20VpAda, del: point?.top20Del },
        { key: "top10", color: colors.top10, label: labels.top10, value: top10, ada: point?.top10VpAda, del: point?.top10Del },
      ].map((item) => (
        <div
          key={item.key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: textColor,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 3,
              borderRadius: 1,
              backgroundColor: item.color,
              flexShrink: 0,
            }}
          />
          <span>{item.label}: {item.value.toFixed(1)}%</span>
          {point && (
            <span style={{ color: mutedColor, fontSize: 10 }}>
              {formatCompact(item.ada ?? 0)} ₳ · {formatCompact(item.del ?? 0)} del
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function DRepConcentrationChart({
  metric,
  isGame,
  isLight,
}: DRepConcentrationChartProps) {
  const t = useTranslations();
  const { history, isLoading, error } = useConcentrationHistory();

  const [highlightedLine, setHighlightedLine] = useState<"top10" | "top20" | "top50" | null>(null);
  const [localMetric, setLocalMetric] = useState<"votingPower" | "delegators">(metric);

  const colors = getLineColors(isGame, isLight);
  const labels = {
    top10: t("drep.concentrationTop10"),
    top20: t("drep.concentrationTop20"),
    top50: t("drep.concentrationTop50"),
  };

  const data: ChartDataPoint[] = useMemo(() => {
    return history.map((h: ConcentrationHistoryPoint) => ({
      epoch: h.epoch,
      top10: localMetric === "votingPower" ? h.top10VpPct : h.top10DelPct,
      top20: localMetric === "votingPower" ? h.top20VpPct : h.top20DelPct,
      top50: localMetric === "votingPower" ? h.top50VpPct : h.top50DelPct,
    }));
  }, [history, localMetric]);

  const gridColor = isGame
    ? "rgba(255, 255, 255, 0.06)"
    : isLight
      ? "rgba(0, 0, 0, 0.06)"
      : "rgba(11, 209, 162, 0.1)";

  const textColor = isGame
    ? "rgba(255, 255, 255, 0.5)"
    : isLight
      ? "#94a3b8"
      : "rgba(11, 209, 162, 0.5)";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div
          className={`animate-pulse text-xs ${isGame ? "text-white/40" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/40"}`}
        >
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p
          className={`text-xs ${isGame ? "text-white/40" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/40"}`}
        >
          {t("drep.concentrationNoData")}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header + Legend */}
      <div className="flex flex-col gap-2 mb-3">
        <h3
          className={`text-sm font-semibold ${isGame ? "text-white" : isLight ? "text-foreground" : "text-[#0bd1a2]"}`}
        >
          {t("drep.concentrationTitle")}
        </h3>
        <div className="flex items-center gap-3">
          {/* Metric toggle */}
          <div className="flex items-center gap-1.5">
            {([
              { key: "votingPower" as const, label: t("drep.votingPower") },
              { key: "delegators" as const, label: t("drep.delegators") },
            ]).map((item) => (
              <button
                key={item.key}
                onClick={() => setLocalMetric(item.key)}
                className={`
                  px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide
                  transition-all duration-200
                  ${isGame
                    ? `${localMetric === item.key ? "bg-white/10 text-white border border-white/20" : "bg-transparent text-white/40 border border-border hover:bg-white/5"}`
                    : isLight
                      ? `${localMetric === item.key ? "bg-black text-white border border-black" : "bg-transparent text-slate-400 border border-slate-200 hover:bg-slate-50"}`
                      : `${localMetric === item.key ? "bg-[#0bd1a2] text-black border border-[#0bd1a2]" : "bg-transparent text-[#0bd1a2]/40 border border-[#0bd1a2]/20 hover:bg-[#0bd1a2]/5"}`
                  }
                `}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={`w-px h-4 ${isGame ? "bg-white/10" : isLight ? "bg-slate-200" : "bg-[#0bd1a2]/15"}`} />
          {/* Top-N filter */}
          <div className="flex items-center gap-1.5">
          {([
            { key: "top10" as const, color: colors.top10, label: labels.top10 },
            { key: "top20" as const, color: colors.top20, label: labels.top20 },
            { key: "top50" as const, color: colors.top50, label: labels.top50 },
          ]).map((item) => {
            const isSelected = highlightedLine === item.key;
            const isDimmed = highlightedLine !== null && !isSelected;
            return (
              <button
                key={item.key}
                onClick={() => setHighlightedLine(isSelected ? null : item.key)}
                className={`
                  px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide
                  transition-all duration-200 border-l-2
                  ${isGame
                    ? `${isSelected ? "bg-white/10 text-white" : isDimmed ? "bg-transparent text-white/30" : "bg-transparent text-white/60 hover:bg-white/5"}`
                    : isLight
                      ? `${isSelected ? "bg-slate-100 text-slate-900" : isDimmed ? "bg-transparent text-slate-300" : "bg-transparent text-slate-500 hover:bg-slate-50"}`
                      : `${isSelected ? "bg-[#0bd1a2]/10 text-[#0bd1a2]" : isDimmed ? "bg-transparent text-[#0bd1a2]/25" : "bg-transparent text-[#0bd1a2]/60 hover:bg-[#0bd1a2]/5"}`
                  }
                `}
                style={{ borderLeftColor: item.color }}
              >
                {item.label}
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="epoch"
            tick={{ fontSize: 10, fill: textColor }}
            tickLine={{ stroke: gridColor }}
            axisLine={{ stroke: gridColor }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 10, fill: textColor }}
            tickLine={{ stroke: gridColor }}
            axisLine={{ stroke: gridColor }}
            tickFormatter={(v: number) => `${v}%`}
            width={45}
          />
          <Tooltip
            content={
              <ConcentrationTooltip
                isGame={isGame}
                isLight={isLight}
                colors={colors}
                labels={labels}
                history={history}
              />
            }
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="top10"
            stroke={colors.top10}
            strokeWidth={highlightedLine === "top10" ? 3.5 : 2.5}
            strokeOpacity={highlightedLine === null || highlightedLine === "top10" ? 1 : 0.15}
            dot={false}
            activeDot={highlightedLine === null || highlightedLine === "top10"
              ? { fill: colors.top10, stroke: "rgba(0,0,0,0.3)", strokeWidth: 2, r: 5 }
              : false}
          />
          <Line
            type="monotone"
            dataKey="top20"
            stroke={colors.top20}
            strokeWidth={highlightedLine === "top20" ? 3.5 : 2}
            strokeOpacity={highlightedLine === null || highlightedLine === "top20" ? 1 : 0.15}
            dot={false}
            activeDot={highlightedLine === null || highlightedLine === "top20"
              ? { fill: colors.top20, stroke: "rgba(0,0,0,0.3)", strokeWidth: 2, r: 4 }
              : false}
          />
          <Line
            type="monotone"
            dataKey="top50"
            stroke={colors.top50}
            strokeWidth={highlightedLine === "top50" ? 3.5 : 2}
            strokeOpacity={highlightedLine === null || highlightedLine === "top50" ? 1 : 0.15}
            dot={false}
            activeDot={highlightedLine === null || highlightedLine === "top50"
              ? { fill: colors.top50, stroke: "rgba(0,0,0,0.3)", strokeWidth: 2, r: 4 }
              : false}
          />
        </LineChart>
        </ResponsiveContainer>
    </div>
  );
}
