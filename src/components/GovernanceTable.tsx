import { useRouter } from "next/router";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { setTypeFilter } from "@/store/governanceSlice";
import type { GovernanceAction, GovernanceActionType } from "@/types/governance";

function formatHash(hash: string): string {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 12)}...${hash.slice(-6)}`;
}

function getStatusColor(status: GovernanceAction["status"]): string {
  switch (status) {
    case "Active":
      return "bg-success/20 text-success border-success/30";
    case "Ratified":
    case "Approved":
      return "bg-primary/20 text-primary border-primary/30";
    case "Expired":
      return "bg-muted text-muted-foreground border-border";
    case "Not approved":
      return "bg-destructive/20 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function GovernanceTable() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((state) => state.governance.actions);
  const currentFilter = useAppSelector((state) => state.governance.filters.type);

  const filteredActions = actions.filter((action) => {
    if (currentFilter === "All") return true;
    return action.type === currentFilter;
  });

  const handleRowClick = (hash: string) => {
    router.push(`/governance/${hash}`);
  };

  const handleTabChange = (value: string) => {
    dispatch(setTypeFilter(value as GovernanceActionType));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Governance Actions</h2>
        <p className="text-muted-foreground">
          On-chain governance actions that are submitted, ratified, enacted, expired, or dropped
        </p>
      </div>

      <Tabs value={currentFilter} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-secondary/50 flex-wrap h-auto">
          <TabsTrigger value="All" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            All
          </TabsTrigger>
          <TabsTrigger
            value="Info"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Info action
          </TabsTrigger>
          <TabsTrigger
            value="Treasury"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Treasury withdrawals
          </TabsTrigger>
          <TabsTrigger
            value="Constitution"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            New constitution
          </TabsTrigger>
        </TabsList>

        <TabsContent value={currentFilter} className="mt-6 space-y-4">
          {filteredActions.length === 0 ? (
            <Card className="p-12">
              <p className="text-center text-muted-foreground">No governance actions found</p>
            </Card>
          ) : (
            filteredActions.map((action) => (
              <Card
                key={action.hash}
                className="p-6 hover:border-primary/50 transition-all duration-300 cursor-pointer"
                onClick={() => handleRowClick(action.hash)}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Main Info - 5 columns */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={getStatusColor(action.status)}>
                        {action.status}
                      </Badge>
                      <Badge variant="outline" className="bg-secondary/50">
                        {action.type}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold">{action.title}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{formatHash(action.hash)}</p>
                  </div>

                  {/* DRep Votes - 3 columns */}
                  <div className="lg:col-span-3 space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">DRep Votes</div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-success">Yes: {action.drepYesPercent.toFixed(1)}%</span>
                        <span className="text-muted-foreground">{action.drepYesAda} ₳</span>
                      </div>
                      <Progress value={action.drepYesPercent} className="h-2 bg-secondary" />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>No: {action.drepNoPercent.toFixed(1)}%</span>
                      <span>{action.drepNoAda} ₳</span>
                    </div>
                  </div>

                  {/* SPO Votes - 3 columns */}
                  <div className="lg:col-span-3 space-y-2">
                    {action.spoYesPercent !== undefined ? (
                      <>
                        <div className="text-sm font-medium text-muted-foreground">SPO Votes</div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-success">Yes: {action.spoYesPercent.toFixed(1)}%</span>
                            <span className="text-muted-foreground">{action.spoYesAda || "0"} ₳</span>
                          </div>
                          <Progress value={action.spoYesPercent} className="h-2 bg-secondary" />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>No: {action.spoNoPercent?.toFixed(1) || "0"}%</span>
                          <span>{action.spoNoAda || "0"} ₳</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-muted-foreground">SPO Votes</div>
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          Not applicable
                        </div>
                      </>
                    )}
                  </div>

                  {/* Vote Counts - 1 column */}
                  <div className="lg:col-span-1 flex flex-col justify-center text-right lg:text-center space-y-1">
                    <div className="text-sm">
                      <span className="text-success font-semibold">Yes: {action.totalYes}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-destructive font-semibold">No: {action.totalNo}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Abstain: {action.totalAbstain}</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-border/50 flex justify-between text-xs text-muted-foreground">
                  <span>Submission: Epoch {action.submissionEpoch}</span>
                  <span>Expiry: Epoch {action.expiryEpoch}</span>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
