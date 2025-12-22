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

function resolveAnchorUrl(anchorUrl: string): string {
  if (!anchorUrl) return anchorUrl;

  // Handle ipfs://<cid> or ipfs://ipfs/<cid> formats
  if (anchorUrl.startsWith("ipfs://")) {
    const withoutScheme = anchorUrl.replace("ipfs://", "");
    const path = withoutScheme.startsWith("ipfs/")
      ? withoutScheme.replace("ipfs/", "")
      : withoutScheme;
    return `https://ipfs.io/ipfs/${path}`;
  }

  return anchorUrl;
}

function extractRationaleText(raw: string): string {
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (parsed && typeof parsed === "object") {
      const obj = parsed as {
        body?: {
          comment?: string;
          rationaleStatement?: string;
          conclusion?: string;
        };
        comment?: string;
      };

      // Prefer CIP-100 body.comment
      if (obj.body && typeof obj.body.comment === "string") {
        return obj.body.comment;
      }

      // CIP-136: body.rationaleStatement (optionally with conclusion)
      if (obj.body && typeof obj.body.rationaleStatement === "string") {
        const rationale = obj.body.rationaleStatement;
        const conclusion =
          typeof obj.body.conclusion === "string" ? obj.body.conclusion : "";

        return conclusion.trim().length > 0
          ? `${rationale}\n\n${conclusion}`
          : rationale;
      }

      // Fallback: top-level comment field
      if (typeof obj.comment === "string") {
        return obj.comment;
      }
    }
  } catch {
    // Not JSON – fall through and return raw text
  }

  return raw;
}

export function VotingRationaleModal({
  vote,
  open,
  onOpenChange,
}: VotingRationaleModalProps) {
  if (!vote) return null;

  // Prefer rationale text returned directly from the backend/database.
  // This may contain either plain text or a CIP-100-style JSON structure.
  const rationaleText =
    vote.rationale && vote.rationale.trim().length > 0
      ? extractRationaleText(vote.rationale).trim()
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-white/8 bg-[#faf9f6] shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-black dark:bg-opacity-90 dark:shadow-none">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold dark:text-[#0bd1a2]">
            Voting Rationale
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto flex-1">
          <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-5 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm dark:text-[#0bd1a2]">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5 dark:text-[#0bd1a2]">Voter</div>
                <div className="font-semibold truncate dark:text-[#0bd1a2]">
                  {vote.voterName ?? vote.voterId ?? vote.drepName ?? vote.drepId}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate dark:text-[#0bd1a2]">{vote.voterId}</div>
              </div>
              {vote.voterType !== "CC" && vote.votingPowerAda && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5 dark:text-[#0bd1a2]">Voting Power</div>
                  <div className="font-medium dark:text-[#0bd1a2]">{vote.votingPowerAda.toLocaleString()} ADA</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-0.5 dark:text-[#0bd1a2]">Vote</div>
                <div className="font-medium dark:text-[#0bd1a2]">{vote.vote}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5 dark:text-[#0bd1a2]">Voted At</div>
                <div className="font-medium dark:text-[#0bd1a2]">
                  {vote.votedAt ? new Date(vote.votedAt).toLocaleDateString() : "Unknown"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-[#faf9f6] p-4 sm:p-6 shadow-[0_12px_30px_rgba(15,23,42,0.25)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold dark:text-[#0bd1a2]">Rationale</h2>
              {vote.anchorUrl && (
                <a
                  href={resolveAnchorUrl(vote.anchorUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline text-sm flex items-center gap-1 dark:text-[#0bd1a2]"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open on IPFS
                </a>
              )}
            </div>
            <div className="modal-scrollbar">
              <ScrollArea className="h-[500px] w-full rounded-md border p-4 dark:rounded-none dark:border-[#0bd1a2]">
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed dark:text-[#0bd1a2]">
                  {rationaleText.length > 0
                    ? rationaleText
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

