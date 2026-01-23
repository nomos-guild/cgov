import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";

const TYPE_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f97316", // orange
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f59e0b", // amber
];

const TYPE_LABELS: Record<string, string> = {
  InfoAction: "Info",
  HardForkInitiation: "Hard Fork",
  ParameterChange: "Parameter",
  NoConfidence: "No Confidence",
  UpdateCommittee: "Committee",
  NewConstitution: "Constitution",
  Treasury: "Treasury",
};

export function ProposalTypeChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;

  const data = useMemo(() => {
    const typeCounts: Record<string, number> = {};

    actions.forEach((action) => {
      const type = action.type || "Unknown";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return Object.entries(typeCounts)
      .map(([type, count], index) => ({
        type,
        label: TYPE_LABELS[type] || type,
        count,
        fill: TYPE_COLORS[index % TYPE_COLORS.length],
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [actions]);

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-[#faf9f6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none h-full",
        className
      )}
    >
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]">
        Proposal Types
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={isDark ? "#0bd1a2" : entry.fill}
                stroke={isDark ? "#1a1a2e" : "#ffffff"}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
              border: isDark ? "1px solid #0bd1a2" : "1px solid #e5e7eb",
              borderRadius: isDark ? "0" : "8px",
              color: isDark ? "#0bd1a2" : "#1f2937",
            }}
            formatter={(value, name) => [value, name]}
          />
          <Legend
            wrapperStyle={{
              fontSize: "11px",
              color: isDark ? "#0bd1a2" : "#6b7280",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
