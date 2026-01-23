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
  Cell,
} from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";

const STATUS_COLORS = {
  Active: "#22c55e",
  Ratified: "#3b82f6",
  Enacted: "#8b5cf6",
  Expired: "#f97316",
  Closed: "#6b7280",
};

export function ProposalStatusChart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;

  const data = useMemo(() => {
    const statusCounts = {
      Active: 0,
      Ratified: 0,
      Enacted: 0,
      Expired: 0,
      Closed: 0,
    };

    actions.forEach((action) => {
      if (action.status in statusCounts) {
        statusCounts[action.status as keyof typeof statusCounts]++;
      }
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      fill: STATUS_COLORS[status as keyof typeof STATUS_COLORS],
    }));
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
        Proposal Status
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <XAxis
            dataKey="status"
            tick={{ fontSize: 11, fill: isDark ? "#0bd1a2" : "#6b7280" }}
            axisLine={{ stroke: isDark ? "#0bd1a2" : "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: isDark ? "#0bd1a2" : "#6b7280" }}
            axisLine={{ stroke: isDark ? "#0bd1a2" : "#e5e7eb" }}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
              border: isDark ? "1px solid #0bd1a2" : "1px solid #e5e7eb",
              borderRadius: isDark ? "0" : "8px",
              color: isDark ? "#0bd1a2" : "#1f2937",
            }}
          />
          <Bar dataKey="count" radius={isDark ? 0 : [4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={isDark ? "#0bd1a2" : entry.fill}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
