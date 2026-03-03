import { useState, useEffect, type ComponentType } from "react";

interface VoteOnProposalProps {
  txHash: string;
  certIndex: number;
  proposalTitle: string;
  status: string;
  proposalId: string;
}

export function LazyVoteOnProposal(props: VoteOnProposalProps) {
  const [Comp, setComp] = useState<ComponentType<VoteOnProposalProps> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(window.crypto && window.crypto.subtle)) return;
    import("@/components/governance/VoteOnProposal")
      .then((mod) => setComp(() => mod.VoteOnProposal))
      .catch(() => {});
  }, []);

  if (!Comp) return null;
  return <Comp {...props} />;
}
