import { useEffect, useState } from "react";
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
        body?: { comment?: string };
        comment?: string;
      };

      // Prefer CIP-100 body.comment
      if (obj.body && typeof obj.body.comment === "string") {
        return obj.body.comment;
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
  // We do not rely on backend-provided rationale; always derive it from anchorUrl when present.
  const [resolvedRationale, setResolvedRationale] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset local state when the vote changes
  useEffect(() => {
    setResolvedRationale(null);
    setError(null);
    setIsLoading(false);
  }, [vote]);

  // Fetch rationale from anchor URL on demand
  useEffect(() => {
    if (!open || !vote || !vote.anchorUrl || resolvedRationale) {
      return;
    }

    let cancelled = false;

    const fetchRationale = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const url = resolveAnchorUrl(vote.anchorUrl!);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const rawText = await response.text();
        const text = extractRationaleText(rawText).trim();

        if (!cancelled) {
          setResolvedRationale(text || null);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load rationale from anchor link.");
          setResolvedRationale(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchRationale();

    return () => {
      cancelled = true;
    };
  }, [open, vote, resolvedRationale]);

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
                  href={resolveAnchorUrl(vote.anchorUrl)}
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
                {isLoading ? (
                  <div className="text-sm text-muted-foreground">
                    Loading rationale from anchor link...
                  </div>
                ) : error ? (
                  <div className="text-sm text-destructive">{error}</div>
                ) : (
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {resolvedRationale && resolvedRationale.trim().length > 0
                      ? resolvedRationale
                      : "No rationale data provided."}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

