import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Copy, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/router";
import type { VoteRecord } from "@/types/governance";
import { useTheme } from "@/lib/theme";
import { useContentTranslation } from "@/hooks/useContentTranslation";
import { cn } from "@/lib/utils";

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
  const { activeTheme } = useTheme();
  const t = useTranslations("rationaleModal");
  const tt = useTranslations("translation");
  const isGame = activeTheme.id === "game";

  // Prefer rationale text returned directly from the backend/database.
  // This may contain either plain text or a CIP-100-style JSON structure.
  const rationaleText = vote?.rationale && vote.rationale.trim().length > 0
    ? extractRationaleText(vote.rationale).trim()
    : "";

  // Auto-translate rationale when locale is not English
  const rationaleTranslation = useContentTranslation({
    originalText: rationaleText,
  });

  const router = useRouter();
  const locale = (router.locale || "en") as string;
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!vote) return null;
  const isNoVote = vote.vote === "No";

  const voterId = vote.voterId || vote.drepId || null;

  const formattedDate = vote.votedAt
    ? new Date(vote.votedAt).toLocaleString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-4xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col w-[calc(100vw-2rem)] sm:w-auto",
          isGame 
            ? "game-modal-card" 
            : "rounded-2xl border border-border/40 bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-black dark:bg-opacity-90 dark:shadow-none",
          isNoVote && "no-vote"
        )}
      >
        <DialogHeader>
          <DialogTitle className={cn("text-xl sm:text-2xl font-bold", isGame ? "text-white" : "dark:text-[#0bd1a2]")}>
            {t("votingRationale")}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 sm:space-y-4 overflow-y-auto flex-1 min-h-0">
          {isGame ? (
            <>
              {/* Compact voter info on mobile */}
              <div className="space-y-2 sm:space-y-3 pb-3 sm:pb-4 border-b border-white/10">
                <div className="flex flex-wrap items-center gap-2 text-sm text-white">
                  <span className="font-semibold">{vote.voterName ?? vote.drepName ?? vote.voterId ?? vote.drepId ?? t("unknownVoter")}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded", vote.vote === "Yes" ? "bg-green-400/20 text-green-400" : vote.vote === "No" ? "bg-red-400/20 text-red-400" : "bg-white/10 text-white/70")}>{vote.vote}</span>
                  {vote.voterType !== "CC" && vote.votingPowerAda && (
                    <span className="text-xs text-white/70">{vote.votingPowerAda.toLocaleString()} ADA</span>
                  )}
                </div>
                {voterId && (
                  <div className="flex items-center gap-1.5 text-2xs sm:text-xs font-mono break-all text-white/50 hidden sm:block">
                    <span className="flex-1">{voterId}</span>
                    <button onClick={() => handleCopy(voterId, "id")} className="hover:text-white/80 transition-colors shrink-0" title="Copy">
                      {copiedField === "id" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                )}
                {vote.txHash && (
                  <div className="flex items-center gap-1.5 text-2xs sm:text-xs text-white/50">
                    <span className="text-white/40 shrink-0">{t("txHash")}:</span>
                    <a
                      href={`https://adastat.net/transactions/${vote.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono hover:text-white/80 transition-colors break-all"
                    >
                      {vote.txHash}
                    </a>
                    <button onClick={() => handleCopy(vote.txHash!, "tx")} className="hover:text-white/80 transition-colors shrink-0" title="Copy">
                      {copiedField === "tx" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                )}
                {formattedDate && (
                  <div className="text-2xs sm:text-xs text-white/50">
                    <span className="text-white/40">{t("votedOn")}:</span>{" "}
                    {formattedDate}
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <h2 className="text-base sm:text-xl font-semibold text-white">{t("rationale")}</h2>
                  {vote.anchorUrl && (
                    <a
                      href={resolveAnchorUrl(vote.anchorUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-xs sm:text-sm flex items-center gap-1 text-white/70 hover:text-white"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="hidden sm:inline">{t("openOnIpfs")}</span>
                      <span className="sm:hidden">{t("ipfs")}</span>
                    </a>
                  )}
                </div>
                <ScrollArea className="h-[45vh] sm:h-[400px] w-full overflow-hidden">
                  <div className="text-sm whitespace-pre-wrap leading-relaxed text-white game-proposal-content mr-3 [overflow-wrap:anywhere]">
                    {rationaleText.length > 0 ? (
                      rationaleTranslation.isTranslating ? (
                        <span className="opacity-50">{rationaleText}</span>
                      ) : (
                        rationaleTranslation.displayText
                      )
                    ) : (
                      t("noRationaleData")
                    )}
                  </div>
                  {rationaleTranslation.isTranslating && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
                      {tt("translating")}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          ) : (
            <>
              {/* Compact voter info on mobile */}
              <div className="rounded-xl sm:rounded-2xl border border-border/40 bg-card p-3 sm:p-5 shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none space-y-2 sm:space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm dark:text-[#0bd1a2]">
                  <span className="font-semibold">{vote.voterName ?? vote.drepName ?? vote.voterId ?? vote.drepId ?? t("unknownVoter")}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded border border-current">{vote.vote}</span>
                  {vote.voterType !== "CC" && vote.votingPowerAda && (
                    <span className="text-xs text-muted-foreground dark:text-[#0bd1a2]">{vote.votingPowerAda.toLocaleString()} ADA</span>
                  )}
                </div>
                {voterId && (
                  <div className="flex items-center gap-1.5 text-2xs sm:text-xs text-muted-foreground font-mono break-all dark:text-[#0bd1a2] hidden sm:block">
                    <span className="flex-1">{voterId}</span>
                    <button onClick={() => handleCopy(voterId, "id")} className="hover:opacity-80 transition-opacity shrink-0" title="Copy">
                      {copiedField === "id" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                )}
                {vote.txHash && (
                  <div className="flex items-center gap-1.5 text-2xs sm:text-xs text-muted-foreground dark:text-[#0bd1a2]/60">
                    <span className="opacity-70 shrink-0">{t("txHash")}:</span>
                    <a
                      href={`https://adastat.net/transactions/${vote.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono hover:opacity-80 transition-opacity break-all"
                    >
                      {vote.txHash}
                    </a>
                    <button onClick={() => handleCopy(vote.txHash!, "tx")} className="hover:opacity-80 transition-opacity shrink-0" title="Copy">
                      {copiedField === "tx" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                )}
                {formattedDate && (
                  <div className="text-2xs sm:text-xs text-muted-foreground dark:text-[#0bd1a2]/60">
                    <span className="opacity-70">{t("votedOn")}:</span>{" "}
                    {formattedDate}
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <h2 className="text-base sm:text-xl font-semibold dark:text-[#0bd1a2]">{t("rationale")}</h2>
                  {vote.anchorUrl && (
                    <a
                      href={resolveAnchorUrl(vote.anchorUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:underline text-xs sm:text-sm flex items-center gap-1 dark:text-[#0bd1a2]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="hidden sm:inline">{t("openOnIpfs")}</span>
                      <span className="sm:hidden">{t("ipfs")}</span>
                    </a>
                  )}
                </div>
                <ScrollArea className="h-[45vh] sm:h-[400px] w-full overflow-hidden">
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed dark:text-[#0bd1a2] mr-3 [overflow-wrap:anywhere]">
                    {rationaleText.length > 0 ? (
                      rationaleTranslation.isTranslating ? (
                        <span className="opacity-50">{rationaleText}</span>
                      ) : (
                        rationaleTranslation.displayText
                      )
                    ) : (
                      t("noRationaleData")
                    )}
                  </div>
                  {rationaleTranslation.isTranslating && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {tt("translating")}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

