import { Card } from "@/components/ui/card";
import { useAppSelector } from "@/store/hooks";

export function GovernanceStats() {
  const actions = useAppSelector((state) => state.governance.actions);

  const stats = {
    total: actions.length,
    active: actions.filter((a) => a.status === "Active").length,
    ratified: actions.filter((a) => a.status === "Ratified" || a.status === "Approved").length,
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

      <Card className="p-6 border-border/50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">🏛️</div>
          <div className="text-sm text-muted-foreground">On-chain Governance</div>
        </div>
      </Card>
    </div>
  );
}
