import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink } from "lucide-react";
import type { VoteRecord } from "@/types/governance";

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
                <div className="font-semibold truncate">
                  {vote.voterName ?? vote.voterId ?? vote.drepName ?? vote.drepId}
                </div>
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
                  {vote.rationale && vote.rationale.trim().length > 0
                    ? vote.rationale
                    : "No rationale data provided."}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

