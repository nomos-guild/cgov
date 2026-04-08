import { useState, useCallback } from "react";
import type { ChangeEvent, MouseEvent } from "react";
import { useWallet } from "@meshsdk/react";
import { MeshTxBuilder, hashDrepAnchor } from "@meshsdk/core";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

type VoteChoice = "Yes" | "No" | "Abstain";

interface VoteButtonsProps {
  txHash: string;
  certIndex: number;
  proposalTitle: string;
  status: string;
  compact?: boolean;
}

interface VoteState {
  isSubmitting: boolean;
  isSuccess: boolean;
  error: string | null;
  txHash: string | null;
}

export function VoteButtons({
  txHash,
  certIndex,
  proposalTitle,
  status,
  compact = false,
}: VoteButtonsProps) {
  const { connected, wallet } = useWallet();
  const t = useTranslations("voteAction");
  const tv = useTranslations("voting");
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [anchorUrl, setAnchorUrl] = useState("");
  const [voteState, setVoteState] = useState<VoteState>({
    isSubmitting: false,
    isSuccess: false,
    error: null,
    txHash: null,
  });

  const isActive = status === "Active";

  const handleVoteClick = (vote: VoteChoice, e: MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!connected) return;
    setSelectedVote(vote);
    setIsModalOpen(true);
    setVoteState({
      isSubmitting: false,
      isSuccess: false,
      error: null,
      txHash: null,
    });
  };

  const submitVote = useCallback(async () => {
    if (!wallet || !selectedVote) return;

    setVoteState({
      isSubmitting: true,
      isSuccess: false,
      error: null,
      txHash: null,
    });

    try {
      // Get wallet data
      const utxos = await wallet.getUtxos();
      const changeAddress = await wallet.getChangeAddress();

      // Get DRep ID using wallet.getDRep() method (per MeshJS documentation)
      const dRep = await wallet.getDRep();

      if (!dRep || !dRep.dRepIDCip105) {
        throw new Error(t("drepIdError"));
      }

      const drepId = dRep.dRepIDCip105;

      // Build the vote transaction
      const txBuilder = new MeshTxBuilder({
        verbose: true,
      });

      // Prepare anchor if URL provided
      let anchor = undefined;
      if (anchorUrl.trim()) {
        const trimmedUrl = anchorUrl.trim();

        // Fetch the content from the URL and compute Blake2b-256 hash
        try {
          const response = await fetch(trimmedUrl);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch anchor content: ${response.status}`
            );
          }
          const contentText = await response.text();
          const contentJson = JSON.parse(contentText);
          const anchorDataHash = hashDrepAnchor(contentJson);

          anchor = {
            anchorUrl: trimmedUrl,
            anchorDataHash,
          };
        } catch (fetchError) {
          throw new Error(
            `Failed to fetch or hash anchor content: ${
              fetchError instanceof Error ? fetchError.message : "Unknown error"
            }. ` +
              `Please ensure the URL is accessible and contains valid JSON.`
          );
        }
      }

      // Build the transaction
      await txBuilder
        .vote(
          {
            type: "DRep",
            drepId: drepId,
          },
          {
            txHash: txHash,
            txIndex: certIndex,
          },
          {
            voteKind: selectedVote,
            anchor,
          }
        )
        .selectUtxosFrom(utxos)
        .changeAddress(changeAddress)
        .complete();

      const unsignedTx = txBuilder.txHex;

      // Sign the transaction
      const signedTx = await wallet.signTx(unsignedTx);

      // Submit the transaction
      const submittedTxHash = await wallet.submitTx(signedTx);

      setVoteState({
        isSubmitting: false,
        isSuccess: true,
        error: null,
        txHash: submittedTxHash,
      });
    } catch (err) {
      console.error("Vote submission error:", err);
      setVoteState({
        isSubmitting: false,
        isSuccess: false,
        error: err instanceof Error ? err.message : t("failedToSubmitVote"),
        txHash: null,
      });
    }
  }, [wallet, selectedVote, txHash, certIndex, anchorUrl, t]);

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedVote(null);
    setAnchorUrl("");
    setVoteState({
      isSubmitting: false,
      isSuccess: false,
      error: null,
      txHash: null,
    });
  };

  // Don't render anything for non-active proposals
  if (!isActive) {
    return null;
  }

  // Compact version for landing page
  if (compact) {
    // Only show vote buttons when wallet is connected
    if (!connected) {
      return null;
    }

    const translateVote = (vote: VoteChoice) => {
      switch (vote) {
        case "Yes": return tv("yes");
        case "No": return tv("no");
        case "Abstain": return tv("abstain");
      }
    };

    return (
      <>
        <div
          className="flex items-center gap-2"
          onClick={(e: MouseEvent) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="outline"
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30"
            onClick={(e: MouseEvent) => handleVoteClick("Yes", e)}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            {tv("yes")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
            onClick={(e: MouseEvent) => handleVoteClick("No", e)}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            {tv("no")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 border-gray-500/30"
            onClick={(e: MouseEvent) => handleVoteClick("Abstain", e)}
          >
            <MinusCircle className="h-4 w-4 mr-1" />
            {tv("abstain")}
          </Button>
        </div>

        {/* Vote Confirmation Modal */}
        <Dialog open={isModalOpen} onOpenChange={closeModal}>
          <DialogContent
            className="sm:max-w-md"
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle>{t("castYourVote")}</DialogTitle>
              <DialogDescription>
                {t.rich("aboutToVote", {
                  vote: selectedVote ? translateVote(selectedVote) : "",
                  bold: (chunks) => <strong>{chunks}</strong>,
                })}
              </DialogDescription>
            </DialogHeader>

            {voteState.isSuccess ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-6">
                  <CheckCircle className="h-16 w-16 text-success" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-semibold text-success">
                    {t("voteSubmittedSuccess")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("voteSubmittedToBlockchain")}
                  </p>
                  {voteState.txHash && (
                    <a
                      href={`https://adastat.net/transactions/${voteState.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm flex items-center justify-center gap-1 hover:underline"
                    >
                      {t("viewOnAdaStat")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <Button className="w-full" onClick={closeModal}>
                  {t("close")}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-secondary/50 p-4 rounded-lg">
                  <p className="text-sm font-medium mb-1">{t("proposal")}:</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {proposalTitle}
                  </p>
                </div>

                <div className="flex justify-center">
                  <Badge
                    className={
                      selectedVote === "Yes"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-lg px-6 py-2"
                        : selectedVote === "No"
                        ? "bg-red-500/20 text-red-400 border-red-500/30 text-lg px-6 py-2"
                        : "bg-gray-500/20 text-gray-400 border-gray-500/30 text-lg px-6 py-2"
                    }
                  >
                    {selectedVote ? translateVote(selectedVote) : ""}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="anchorUrl">{t("rationaleUrlOptional")}</Label>
                  <Input
                    id="anchorUrl"
                    placeholder={t("rationaleUrlPlaceholder")}
                    value={anchorUrl}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setAnchorUrl(e.target.value)
                    }
                    disabled={voteState.isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("rationaleUrlHelp")}
                  </p>
                </div>

                {voteState.error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{voteState.error}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={closeModal}
                    disabled={voteState.isSubmitting}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={submitVote}
                    disabled={voteState.isSubmitting}
                  >
                    {voteState.isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("submitting")}
                      </>
                    ) : (
                      t("confirmVote")
                    )}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {t("onChainTransactionNote")}
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Full version (not used in this component, but available)
  return null;
}
