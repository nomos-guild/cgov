import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink } from "lucide-react";
import type { VoteRecord } from "@/types/governance";

// Mock rationale function - in real app, this would fetch from IPFS
function getMockRationale(voterName: string, vote: string): string {
  if (voterName === "SIPO") {
    return `SIPO has chosen to ${vote} on this proposal.

Our decision reflects both recognition of the proposal's innovation and concern for its structural implications on fairness, governance precedent, and long-term ecosystem balance.

On the Loan-Based Treasury Model
SIPO deeply appreciates the innovation behind this proposal—the introduction of a repayable, interest-bearing treasury loan.
This marks a significant step toward treating Cardano's treasury not merely as a grant pool, but as a public revolving fund—a self-sustaining capital engine for ecosystem growth.

Such a model introduces accountability and enables the treasury to recycle its funds through investment, repayment, and reinvestment, strengthening Cardano's financial autonomy and maturity as a decentralized system.

Why SIPO ${vote}s
SIPO supports the spirit and direction of this proposal:
• Introducing a repayable, audited, legally binding treasury mechanism;
• Enhancing visibility and liquidity for Cardano Native Tokens;
• And promoting sustainable financial governance.

We believe this pilot can become an educational milestone—demonstrating how a decentralized treasury can evolve from "funding" to responsible capital management, if built with transparency and replicability in mind.`;
  }

  const templates = {
    Yes: `After careful consideration, ${voterName} votes YES on this proposal.

We believe this initiative aligns with Cardano's long-term vision and will contribute positively to the ecosystem's growth. The proposal demonstrates:

• Clear objectives and measurable outcomes
• Responsible use of treasury funds
• Strong community support and engagement
• Alignment with Cardano's governance principles

We support this action and look forward to seeing its positive impact on the ecosystem.`,
    No: `${voterName} votes NO on this proposal.

While we appreciate the effort behind this submission, we have concerns about:

• The current structure and implementation plan
• Potential risks to the treasury and ecosystem
• Lack of sufficient detail in certain areas
• Questions about long-term sustainability

We encourage the proposers to address these concerns and potentially resubmit with improvements.`,
    Abstain: `${voterName} chooses to ABSTAIN on this proposal.

This decision reflects our position that while the proposal has merit, we require additional information or time for proper evaluation:

• Further community discussion needed
• Awaiting clarification on specific technical details
• Observing how governance precedent develops
• Maintaining neutrality on this particular matter

We remain engaged and will continue monitoring the proposal's progress.`,
  };

  return templates[vote as keyof typeof templates] || "No rationale provided.";
}

interface VotingRationaleModalProps {
  vote: VoteRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VotingRationaleModal({ vote, open, onOpenChange }: VotingRationaleModalProps) {
  if (!vote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold">
            Voting Rationale
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto flex-1">
          <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-5 shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Voter</div>
                <div className="font-semibold truncate">{vote.voterName || vote.voterId}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">{vote.voterId}</div>
              </div>
              {vote.voterType !== "CC" && vote.votingPowerAda && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Voting Power</div>
                  <div className="font-medium">{vote.votingPowerAda.toLocaleString()} ADA</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Vote</div>
                <div className="font-medium">{vote.vote}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Voted At</div>
                <div className="font-medium">
                  {vote.votedAt ? new Date(vote.votedAt).toLocaleDateString() : "Unknown"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-6 shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Rationale</h2>
              {vote.anchorUrl && (
                <a
                  href={vote.anchorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline text-sm flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open on IPFS
                </a>
              )}
            </div>
            <div className="modal-scrollbar">
              <ScrollArea className="h-[500px] w-full rounded-md border p-4">
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {getMockRationale(vote.voterName || vote.voterId, vote.vote)}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

