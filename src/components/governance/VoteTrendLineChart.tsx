import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { formatAdaValue } from "@/lib/formatters";
import type { TimelinePoint, VoteColorSet } from "@/lib/voteColors";

export interface VoteTrendLineChartProps {
  data: TimelinePoint[];
  chartDomain: [number | string, number | string];
  dailyTicks: number[];
  yAxisDomain?: [number, number];
  voteColors: VoteColorSet;
  shouldShowPower: boolean;
  useDashedPowerLines?: boolean;
  formatTickDate: (ts: number) => string;
  renderTooltip: (props: TooltipContentProps) => React.ReactElement | null;
  /** Show chart legend (curves tab only) */
  showLegend?: boolean;
  /** Chart height in px */
  height: number;
  /** Line chart margin */
  margin?: { top: number; right: number; left: number; bottom: number };
  /** Tick font size */
  tickFontSize?: number;
  /** Min tick gap for XAxis */
  minTickGap?: number;
  /** Projected mode reference line */
  thresholdReferenceValue?: number | null;
  thresholdLabel?: string;
  isGame?: boolean;
  isDark?: boolean;
  /** Power line labels (curves tab shows names, sidebar doesn't) */
  yesPowerLabel?: string;
  noPowerLabel?: string;
  abstainPowerLabel?: string;
  yesCountLabel?: string;
  noCountLabel?: string;
  abstainCountLabel?: string;
}

export function VoteTrendLineChart({
  data,
  chartDomain,
  dailyTicks,
  yAxisDomain,
  voteColors,
  shouldShowPower,
  useDashedPowerLines = false,
  formatTickDate,
  renderTooltip,
  showLegend = false,
  height,
  margin = { top: 5, right: 30, left: -10, bottom: 5 },
  tickFontSize = 10,
  minTickGap = 30,
  thresholdReferenceValue,
  thresholdLabel,
  isGame = false,
  isDark = false,
}: VoteTrendLineChartProps) {
  return (
    <div className={`h-[${height}px] w-full min-w-0`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={chartDomain}
            ticks={dailyTicks}
            tick={{ fontSize: tickFontSize }}
            minTickGap={minTickGap}
            tickFormatter={formatTickDate}
          />
          <YAxis
            yAxisId="primary"
            allowDecimals={false}
            tick={{ fontSize: tickFontSize }}
            domain={yAxisDomain}
            tickFormatter={
              shouldShowPower
                ? (value) => formatAdaValue(value).replace(" ₳", "")
                : undefined
            }
          />
          <RechartsTooltip content={renderTooltip} />
          {showLegend && <Legend iconType="square" />}
          {thresholdReferenceValue != null && (
            <ReferenceLine
              y={thresholdReferenceValue}
              yAxisId="primary"
              stroke={isGame ? "#FFD700" : isDark ? "#0bd1a2" : "#000000"}
              strokeDasharray="6 4"
              strokeWidth={1}
              label={{
                value: thresholdLabel ?? "",
                position: "insideTopRight",
                fill: isGame ? "#FFD700" : isDark ? "#0bd1a2" : "#000000",
                fontSize: tickFontSize <= 10 ? 8 : 10,
                fontWeight: 500,
              }}
            />
          )}
          {shouldShowPower ? (
            <>
              <Line
                type="monotone"
                dataKey="yesPower"
                stroke={voteColors.yes}
                strokeWidth={2}
                strokeDasharray={useDashedPowerLines ? "5 4" : undefined}
                dot={false}
                yAxisId="primary"
              />
              <Line
                type="monotone"
                dataKey="noPower"
                stroke={voteColors.no}
                strokeWidth={2}
                strokeDasharray={useDashedPowerLines ? "5 4" : undefined}
                dot={false}
                yAxisId="primary"
              />
              <Line
                type="monotone"
                dataKey="abstainPower"
                stroke={voteColors.abstain}
                strokeOpacity={0.9}
                strokeWidth={2}
                strokeDasharray={useDashedPowerLines ? "5 4" : undefined}
                dot={false}
                yAxisId="primary"
              />
            </>
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="yesCount"
                stroke={voteColors.yes}
                strokeWidth={2}
                dot={false}
                yAxisId="primary"
              />
              <Line
                type="monotone"
                dataKey="noCount"
                stroke={voteColors.no}
                strokeWidth={2}
                dot={false}
                yAxisId="primary"
              />
              <Line
                type="monotone"
                dataKey="abstainCount"
                stroke={voteColors.abstain}
                strokeOpacity={0.9}
                strokeWidth={2}
                dot={false}
                yAxisId="primary"
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
