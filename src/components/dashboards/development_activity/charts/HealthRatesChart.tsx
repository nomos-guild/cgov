import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import { chartCardClassName, chartCardGameClassName } from "@/components/dashboards/shared/chartTheme";
import type { ChartProps } from "@/types/dashboard";
import { Activity, Users, GitPullRequest, Shield, Ghost, Gauge, Clock, Package, TrendingUp } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";
import { TrendIndicator } from "./TrendIndicator";

function StatCard({ label, value, icon: Icon, metricKey, current, previous }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>;
  metricKey?: string; current?: number; previous?: number;
}) {
  const content = (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-muted/50 dark:bg-white/5">
        <Icon className="w-4 h-4 text-muted-foreground dark:text-[#0bd1a2]" />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-semibold dark:text-[#0bd1a2]">{value}</span>
          {current !== undefined && <TrendIndicator current={current} previous={previous} />}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );

  if (!metricKey) return content;
  return <InfoTooltip metricKey={metricKey}>{content}</InfoTooltip>;
}

function fmtPct(v: number | null | undefined): string {
  return v != null ? `${(v * 100).toFixed(0)}%` : "N/A";
}

function fmtHours(v: number | null | undefined): string {
  if (v == null) return "N/A";
  if (v < 24) return `${v.toFixed(0)}h`;
  const days = Math.floor(v / 24);
  const hours = Math.round(v % 24);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export function HealthRatesChart({ isLoading, className }: ChartProps) {
  const health = useAppSelector((state) => state.development.health);
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const prev = health?.previous;

  if (isLoading) return <ChartSkeleton className={className} />;

  return (
    <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
      <h3 className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]">Ecosystem Health</h3>
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-4 content-center">
        <StatCard icon={Shield} label="Maintenance Rate" value={fmtPct(health?.maintenanceRate)} metricKey="maintenanceRate"
          current={health?.maintenanceRate ?? undefined} previous={prev?.maintenanceRate} />
        <StatCard icon={Users} label="Retention Rate" value={fmtPct(health?.retentionRate)} metricKey="retentionRate"
          current={health?.retentionRate ?? undefined} previous={prev?.retentionRate ?? undefined} />
        <StatCard icon={Gauge} label="Code Velocity" value={health?.codeVelocity != null ? `${health.codeVelocity.toFixed(1)}` : "N/A"} metricKey="codeVelocity"
          current={health?.codeVelocity ?? undefined} previous={prev?.codeVelocity ?? undefined} />
        <StatCard icon={Activity} label="Abandonment Rate" value={fmtPct(health?.abandonmentRate)} metricKey="abandonmentRate" />
        <StatCard icon={Ghost} label="Ghosting Rate" value={fmtPct(health?.ghostingRate)} metricKey="ghostingRate" />
        <StatCard icon={GitPullRequest} label="Avg Merge Time" value={fmtHours(health?.avgMergeTimeHours)} metricKey="avgMergeTime"
          current={health?.avgMergeTimeHours ?? undefined} previous={prev?.avgMergeTimeHours ?? undefined} />
        <StatCard icon={TrendingUp} label="Active / Total Repos" value={health ? `${health.activeRepos}/${health.activeRepos + health.dormantRepos}` : "N/A"} metricKey="activeTotalRepos" />
        <StatCard icon={Package} label="Releases" value={health?.releaseCadence != null ? `${health.releaseCadence}` : "N/A"} metricKey="releases"
          current={health?.releaseCadence} previous={prev?.releaseCadence} />
        <StatCard icon={Clock} label="Issue Resolution" value={fmtHours(health?.avgIssueResolutionHours)} metricKey="issueResolution"
          current={health?.avgIssueResolutionHours ?? undefined} previous={prev?.avgIssueResolutionHours ?? undefined} />
      </div>
    </div>
  );
}
