import { useMemo, useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { SafeResponsiveContainer as ResponsiveContainer } from "@/components/ui/safe-responsive-container";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import {
  getChartColors, chartCardClassName, chartCardGameClassName,
} from "@/components/dashboards/shared/chartTheme";
import type { ChartProps } from "@/types/dashboard";
import { Building2 } from "lucide-react";

export function OrgContributionChart({ isLoading, className }: ChartProps) {
  const network = useAppSelector((state) => state.development.network);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const data = useMemo(() => {
    if (!network?.orgBreakdown?.length) return [];
    return network.orgBreakdown.slice(0, 12).map((o) => ({
      org: o.org.length > 18 ? `${o.org.slice(0, 16)}...` : o.org,
      fullOrg: o.org,
      commits: o.commitCount,
      repos: o.repoCount,
      contributors: o.contributorCount,
    }));
  }, [network]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = useCallback((data: any) => {
    const org = data?.fullOrg ?? data?.payload?.fullOrg;
    if (org) window.open(`https://github.com/${org}`, "_blank", "noopener,noreferrer");
  }, []);

  if (isLoading) return <ChartSkeleton className={className} />;

  if (!data.length) {
    return (
      <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
        <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]">Org Contributions</h3>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          No org data available
        </div>
      </div>
    );
  }

  return (
    <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]">Org Contributions</h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridLine} horizontal={false} />
            <XAxis type="number" tick={{ fill: chartColors.axisText, fontSize: 11 }} stroke={chartColors.axisLine} />
            <YAxis
              type="category"
              dataKey="org"
              width={120}
              tick={{ fill: chartColors.axisText, fontSize: 10 }}
              stroke={chartColors.axisLine}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: chartColors.tooltipBg,
                border: `1px solid ${chartColors.tooltipBorder}`,
                color: chartColors.tooltipText,
                borderRadius: 8,
                fontSize: 12,
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, _name: any, props: any) => {
                const d = props.payload;
                return [
                  `${value} commits | ${d?.repos ?? 0} repos | ${d?.contributors ?? 0} devs`,
                  d?.fullOrg ?? "",
                ];
              }}
            />
            <Bar dataKey="commits" radius={[0, 4, 4, 0]} cursor="pointer" onClick={handleBarClick}>
              {data.map((_, i) => (
                <Cell key={i} fill={chartColors.palette[i % chartColors.palette.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
        <Building2 className="w-3 h-3" />
        <span>{network?.orgBreakdown?.length ?? 0} organizations tracked</span>
      </div>
    </div>
  );
}
