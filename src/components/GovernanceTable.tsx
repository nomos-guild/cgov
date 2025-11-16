import { useRouter } from "next/router";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { VoteProgress } from "@/components/ui/vote-progress";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { setTypeFilter } from "@/store/governanceSlice";
import type { GovernanceAction, GovernanceActionType } from "@/types/governance";

function getStatusColor(status: GovernanceAction["status"]): string {
  return status === "Active"
    ? "text-foreground border-foreground/40 bg-foreground/5"
    : "text-foreground/60 border-foreground/20 bg-transparent";
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

  const handleRowClick = (id: string) => {
    router.push(`/governance/${id}`);
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
          <TabsTrigger value="All" className="data-[state=active]:bg-foreground data-[state=active]:text-background">
            All
          </TabsTrigger>
          <TabsTrigger
            value="Info"
            className="data-[state=active]:bg-foreground data-[state=active]:text-background">
            Info action
          </TabsTrigger>
          <TabsTrigger
            value="Treasury"
            className="data-[state=active]:bg-foreground data-[state=active]:text-background">
            Treasury withdrawals
          </TabsTrigger>
          <TabsTrigger
            value="Constitution"
            className="data-[state=active]:bg-foreground data-[state=active]:text-background">
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
                key={action.id}
                className="hover:border-foreground/30 transition-all duration-300 cursor-pointer"
                onClick={() => handleRowClick(action.id)}>
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold flex-1 min-w-0">{action.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className={getStatusColor(action.status)}>
                        {action.status}
                      </Badge>
                      <Badge variant="outline" className="bg-secondary/50">
                        {action.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {action.drep && (
                      <VoteProgress
                        title="DRep Votes"
                        yesPercent={action.drep.yesPercent}
                        noPercent={action.drep.noPercent}
                        yesAda={action.drep.yesAda}
                        noAda={action.drep.noAda}
                        showPercentages={false}
                        showAda={false}
                      />
                    )}
                    {action.cc ? (
                      <VoteProgress
                        title="CC"
                        yesPercent={action.cc.yesPercent}
                        noPercent={action.cc.noPercent}
                        showPercentages={false}
                        showAda={false}
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap w-16 sm:w-24 flex-shrink-0">CC</span>
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground">Not applicable</span>
                        </div>
                      </div>
                    )}
                    {action.spo ? (
                      <VoteProgress
                        title="SPO Votes"
                        yesPercent={action.spo.yesPercent}
                        noPercent={action.spo.noPercent}
                        yesAda={action.spo.yesAda || "0"}
                        noAda={action.spo.noAda || "0"}
                        showPercentages={false}
                        showAda={false}
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap w-20 sm:w-24 flex-shrink-0">SPO Votes</span>
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground">Not applicable</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
