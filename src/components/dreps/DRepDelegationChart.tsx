import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DRepHistoryDataPoint } from "@/types/drep";

interface DRepDelegationChartProps {
  history: DRepHistoryDataPoint[];
  isGame: boolean;
  isLight: boolean;
}

function formatAda(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatDate(date: string | null, epoch: number): string {
  if (!date) return `Epoch ${epoch}`;
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

interface ChartDataPoint {
  epoch: number;
  date: string | null;
  ada: number;
  delegators: number;
  [key: string]: string | number | null;
}

interface DelegationTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; payload?: ChartDataPoint }>;
  label?: number;
  isGame: boolean;
  isLight: boolean;
}

function DelegationTooltip({
  active,
  payload,
  label,
  isGame,
  isLight,
}: DelegationTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as ChartDataPoint | undefined;
  const epoch = label as number;
  const dateStr = point?.date ? new Date(point.date).toLocaleDateString() : "";

  const ada = payload.find((p) => p.dataKey === "ada")?.value ?? 0;
  const delegators = payload.find((p) => p.dataKey === "delegators")?.value ?? 0;

  return (
    <div
      style={{
        backgroundColor: isGame ? "rgba(12,12,12,0.95)" : isLight ? "#fff" : "rgba(10,22,40,0.95)",
        border: `1px solid ${isGame ? "rgba(255,255,255,0.2)" : isLight ? "#cbd5e1" : "rgba(11,209,162,0.3)"}`,
        borderRadius: isLight ? 6 : isGame ? 4 : 0,
        boxShadow: isGame
          ? "0 4px 16px rgba(0,0,0,0.6)"
          : isLight
            ? "0 4px 12px rgba(15,23,42,0.15)"
            : "0 4px 16px rgba(0,0,0,0.5)",
        padding: "8px 12px",
        color: isGame ? "#fff" : isLight ? "#1e293b" : "#0bd1a2",
        fontSize: 12,
        whiteSpace: "nowrap" as const,
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 4 }}>
        Epoch {epoch}{dateStr ? ` — ${dateStr}` : ""}
      </p>
      <p style={{ margin: 0 }}>Delegated ADA: {formatAda(ada)} ₳</p>
      <p style={{ margin: 0 }}>Delegators: {formatAda(delegators)}</p>
    </div>
  );
}

export function DRepDelegationChart({
  history,
  isGame,
  isLight,
}: DRepDelegationChartProps) {
  // Trim leading epochs before the DRep had any delegation
  const firstActiveIdx = history.findIndex(
    (h) => h.votingPowerAda > 0 || h.delegatorCount > 0
  );
  const trimmed = firstActiveIdx > 0 ? history.slice(firstActiveIdx) : history;

  const data: ChartDataPoint[] = trimmed.map((h) => ({
    epoch: h.epoch,
    date: h.date,
    ada: h.votingPowerAda,
    delegators: h.delegatorCount,
  }));

  const adaStroke = isGame
    ? "#ffffff"
    : isLight
      ? "#64748b"
      : "#0bd1a2";

  const adaFill = isGame
    ? "rgba(255, 255, 255, 0.08)"
    : isLight
      ? "rgba(100, 116, 139, 0.1)"
      : "rgba(11, 209, 162, 0.15)";

  const delegatorStroke = isGame
    ? "#f59e0b"
    : isLight
      ? "#f59e0b"
      : "#f59e0b";

  const delegatorFill = isGame
    ? "rgba(245, 158, 11, 0.08)"
    : isLight
      ? "rgba(245, 158, 11, 0.08)"
      : "rgba(245, 158, 11, 0.1)";

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

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <p className={isGame ? "text-white/40" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/40"}>
          No delegation history available
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 220 }}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="epoch"
          tick={{ fontSize: 11, fill: textColor }}
          tickLine={false}
          axisLine={{ stroke: gridColor }}
          tickFormatter={(epoch: number) => {
            const point = data.find((d) => d.epoch === epoch);
            return formatDate(point?.date ?? null, epoch);
          }}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          yAxisId="ada"
          tick={{ fontSize: 11, fill: textColor }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${formatAda(v)} ₳`}
          width={70}
        />
        <YAxis
          yAxisId="delegators"
          orientation="right"
          tick={{ fontSize: 11, fill: textColor }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatAda(v)}
          width={50}
        />
        <Tooltip
          content={<DelegationTooltip isGame={isGame} isLight={isLight} />}
        />
        <Area
          yAxisId="ada"
          type="monotone"
          dataKey="ada"
          stroke={adaStroke}
          strokeWidth={2}
          fill={adaFill}
          dot={false}
          activeDot={{
            r: 4,
            stroke: adaStroke,
            strokeWidth: 2,
            fill: isGame ? "#1a1a2e" : isLight ? "#fff" : "#0a1628",
          }}
        />
        <Area
          yAxisId="delegators"
          type="monotone"
          dataKey="delegators"
          stroke={delegatorStroke}
          strokeWidth={2}
          fill={delegatorFill}
          dot={false}
          activeDot={{
            r: 4,
            stroke: delegatorStroke,
            strokeWidth: 2,
            fill: isGame ? "#1a1a2e" : isLight ? "#fff" : "#0a1628",
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}
