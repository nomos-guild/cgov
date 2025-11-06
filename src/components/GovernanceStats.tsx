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
  };

  // Calculate NCL progress percentage
  const nclProgress = (mockNCLData.currentValue / mockNCLData.targetValue) * 100;

  // Format large numbers to M (millions)
  const formatToMillions = (value: number): string => {
    return `${(value / 1000000).toFixed(0)}M`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
        <div className="text-5xl font-bold text-primary mb-2">{stats.total}</div>
        <div className="text-sm text-muted-foreground uppercase tracking-wide">Total Actions</div>
      </Card>

      <Card className="p-6 border-border/50">
        <div className="text-2xl font-semibold text-foreground mb-3">Governance Statistics</div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Active</span>
            <span className="text-success font-semibold">{stats.active}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Ratified</span>
            <span className="text-primary font-semibold">{stats.ratified}</span>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/30">
        <div className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
          {mockNCLData.year} NCL Progress
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-foreground">{formatToMillions(mockNCLData.currentValue)}</span>
          <span className="text-lg text-muted-foreground">/ {formatToMillions(mockNCLData.targetValue)}</span>
        </div>
        <Progress value={nclProgress} className="h-2 mb-2" />
        <div className="text-right">
          <span className="text-xl font-bold text-blue-500">{nclProgress.toFixed(1)}%</span>
        </div>
      </Card>
    </div>
  );
}
