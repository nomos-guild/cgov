import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";

const VOTE_COLORS = {
  yes: "#22c55e",
  no: "#ef4444",
  abstain: "#6b7280",
};

export function VotingPowerChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;

  const data = useMemo(() => {
    // Aggregate voting power across all active actions
    const activeActions = actions.filter((a) => a.status === "Active");

    if (activeActions.length === 0) {
      return [];
    }

    // Sum up voting power for DRep and SPO
    let drepYes = 0, drepNo = 0, drepAbstain = 0;
    let spoYes = 0, spoNo = 0, spoAbstain = 0;

    activeActions.forEach((action) => {
      drepYes += action.drepYesAda || 0;
      drepNo += action.drepNoAda || 0;
      drepAbstain += action.drepAbstainAda || 0;
      spoYes += action.spoYesAda || 0;
      spoNo += action.spoNoAda || 0;
      spoAbstain += action.spoAbstainAda || 0;
    });

    // Normalize to percentages per voter type
    const drepTotal = drepYes + drepNo + drepAbstain;
    const spoTotal = spoYes + spoNo + spoAbstain;

    return [
      {
        name: "DRep",
        yes: drepTotal > 0 ? (drepYes / drepTotal) * 100 : 0,
        no: drepTotal > 0 ? (drepNo / drepTotal) * 100 : 0,
        abstain: drepTotal > 0 ? (drepAbstain / drepTotal) * 100 : 0,
      },
      {
        name: "SPO",
        yes: spoTotal > 0 ? (spoYes / spoTotal) * 100 : 0,
        no: spoTotal > 0 ? (spoNo / spoTotal) * 100 : 0,
        abstain: spoTotal > 0 ? (spoAbstain / spoTotal) * 100 : 0,
      },
    ];
  }, [actions]);

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  const hasData = data.length > 0 && data.some((d) => d.yes > 0 || d.no > 0 || d.abstain > 0);

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none h-full",
        className
      )}
    >
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]">
        Voting Power Distribution
      </h3>

      {!hasData ? (
        <p className="text-sm text-muted-foreground">No active proposals with votes</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 5, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: isDark ? "#0bd1a2" : "#6b7280" }}
              axisLine={{ stroke: isDark ? "#0bd1a2" : "#e5e7eb" }}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: isDark ? "#0bd1a2" : "#6b7280" }}
              axisLine={{ stroke: isDark ? "#0bd1a2" : "#e5e7eb" }}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
                border: isDark ? "1px solid #0bd1a2" : "1px solid #e5e7eb",
                borderRadius: isDark ? "0" : "8px",
                color: isDark ? "#0bd1a2" : "#1f2937",
              }}
              formatter={(value) => [`${Number(value).toFixed(1)}%`]}
            />
            <Legend
              wrapperStyle={{
                fontSize: "11px",
              }}
            />
            <Bar
              dataKey="yes"
              name="Yes"
              stackId="a"
              fill={isDark ? "#0bd1a2" : VOTE_COLORS.yes}
              radius={0}
            />
            <Bar
              dataKey="no"
              name="No"
              stackId="a"
              fill={isDark ? "#ff6b6b" : VOTE_COLORS.no}
              radius={0}
            />
            <Bar
              dataKey="abstain"
              name="Abstain"
              stackId="a"
              fill={isDark ? "#4a5568" : VOTE_COLORS.abstain}
              radius={0}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
