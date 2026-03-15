import { useState, useEffect, type ComponentType } from "react";
import { Card } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

interface VoteOnProposalProps {
  txHash: string;
  certIndex: number;
  proposalTitle: string;
  status: string;
  proposalId: string;
}

type VoteLoaderState = "loading" | "ready" | "error";

export function LazyVoteOnProposal(props: VoteOnProposalProps) {
  const [Comp, setComp] = useState<ComponentType<VoteOnProposalProps> | null>(null);
  const [state, setState] = useState<VoteLoaderState>("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;

    import("@/components/governance/VoteOnProposal")
      .then((mod) => {
        setComp(() => mod.VoteOnProposal);
        setState("ready");
      })
      .catch((error) => {
        console.warn("Vote controls failed to initialize:", error);
        setState("error");
      });
  }, []);

  if (!Comp) {
    return (
      <Card className="p-6 vote-on-proposal-card">
        <h3 className="mb-4 font-semibold">Cast Your Vote</h3>
        {state === "error" ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Wallet voting controls could not be initialized in this browser session.
              Refresh once, then confirm the wallet button is visible in the header.
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading vote controls...
          </div>
        )}
      </Card>
    );
  }

  return <Comp {...props} />;
}
