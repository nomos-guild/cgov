import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAppSelector } from "@/store/hooks";
import { mockNCLData } from "@/data/mockData";

export function GovernanceStats() {
  const actions = useAppSelector((state) => state.governance.actions);

  const stats = {
    total: actions.length,
    active: actions.filter((a) => a.status === "Active").length,
    ratified: actions.filter((a) => a.status === "Ratified" || a.status === "Approved").length,
    expired: actions.filter((a) => a.status === "Expired").length,
  };

  // Calculate NCL progress percentage
  const nclProgress = (mockNCLData.currentValue / mockNCLData.targetValue) * 100;

  // Format large numbers to M (millions)
  const formatToMillions = (value: number): string => {
    return `${(value / 1000000).toFixed(0)}M`;
  };

  return (
    <Card className="p-4 mb-6 border-border">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left side - Stats */}
        <div className="flex flex-wrap items-center gap-6 md:gap-8">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{stats.total}</span>
            <span className="text-sm text-muted-foreground uppercase tracking-wide">Total</span>
          </div>
          
          <div className="h-8 w-px bg-border" />
          
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{stats.active}</span>
            <span className="text-sm text-muted-foreground">Active</span>
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{stats.ratified}</span>
            <span className="text-sm text-muted-foreground">Ratified</span>
          </div>
          
          <div className="h-8 w-px bg-border" />
          
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{stats.expired}</span>
            <span className="text-sm text-muted-foreground">Expired</span>
          </div>
        </div>

        {/* Right side - NCL Progress */}
        <div className="flex-1 md:max-w-md md:ml-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              {mockNCLData.year} NCL
            </span>
            <span className="text-sm font-semibold">{nclProgress.toFixed(1)}%</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-lg font-bold">{formatToMillions(mockNCLData.currentValue)}</span>
            <span className="text-sm text-muted-foreground">/ {formatToMillions(mockNCLData.targetValue)}</span>
          </div>
          <Progress value={nclProgress} className="h-1.5" />
        </div>
      </div>
    </Card>
  );
}
