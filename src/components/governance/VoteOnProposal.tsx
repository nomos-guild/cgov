import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@meshsdk/react";
import { MeshTxBuilder, hashDrepAnchor } from "@meshsdk/core";
import { useDispatch, useSelector } from "react-redux";
import { useTranslations } from "next-intl";
import type { AppDispatch, RootState } from "@/store";
import { loadGovernanceActionDetail } from "@/store/governanceSlice";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConnectWalletButton } from "@/components/wallet";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type VoteChoice = "Yes" | "No" | "Abstain";

interface VoteOnProposalProps {
  txHash: string;
  certIndex: number;
  proposalTitle: string;
  status: string;
  proposalId: string; // governance action ID for polling
}

interface VoteState {
  isSubmitting: boolean;
  isSuccess: boolean;
  error: string | null;
  txHash: string | null;
}

interface SyncState {
  isPolling: boolean;
  isSynced: boolean;
  pollCount: number;
  maxPolls: number;
}

export function VoteOnProposal({
  txHash,
  certIndex,
  proposalTitle,
  status,
  proposalId,
}: VoteOnProposalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { connected, wallet } = useWallet();
  const { activeTheme } = useTheme();
  const t = useTranslations("voteAction");
  const tv = useTranslations("voting");
  const tTable = useTranslations("table");
  const isGame = activeTheme.id === "game";
  const isDark = activeTheme.id === "dark";

  const translateVote = (vote: VoteChoice) => {
    switch (vote) {
      case "Yes": return tv("yes");
      case "No": return tv("no");
      case "Abstain": return tv("abstain");
    }
  };
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [anchorUrl, setAnchorUrl] = useState("");
  const [voteState, setVoteState] = useState<VoteState>({
    isSubmitting: false,
    isSuccess: false,
    error: null,
    txHash: null,
  });
  const [syncState, setSyncState] = useState<SyncState>({
    isPolling: false,
    isSynced: false,
    pollCount: 0,
    maxPolls: 15, // 15 polls * 20 seconds = 5 minutes timeout
  });

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get current votes from Redux store to check if our vote has synced
  const selectedAction = useSelector(
    (state: RootState) => state.governance.selectedAction
  );

  const isActive = status === "Active";

  // Store initial vote count when polling starts
  const initialVoteCountRef = useRef<number>(0);

  // Start polling after successful vote submission
  const startPolling = useCallback(() => {
    // Store current vote count to detect changes
    const currentCount = selectedAction?.votes?.length || 0;
    initialVoteCountRef.current = currentCount;
    console.log(
      `[Vote Sync] Starting polling. Initial vote count: ${currentCount}`
    );

    setSyncState({
      isPolling: true,
      isSynced: false,
      pollCount: 0,
      maxPolls: 15,
    });

    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Track poll count locally to avoid stale closure issues
    let localPollCount = 0;

    pollingIntervalRef.current = setInterval(() => {
      localPollCount += 1;
      console.log(`[Vote Sync] Poll #${localPollCount} starting...`);

      // Check if we've exceeded max polls (timeout)
      if (localPollCount >= 15) {
        console.log(`[Vote Sync] Timeout reached at poll #${localPollCount}`);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setSyncState((prev) => ({
          ...prev,
          isPolling: false,
          pollCount: localPollCount,
        }));
        return;
      }

      // Update poll count in state for UI
      setSyncState((prev) => ({
        ...prev,
        pollCount: localPollCount,
      }));

      // Dispatch action to refresh proposal data (triggers backend sync-on-read)
      console.log(
        `[Vote Sync] Dispatching loadGovernanceActionDetail for ${proposalId}`
      );
      dispatch(loadGovernanceActionDetail(proposalId));
    }, 20000); // Poll every 20 seconds
    // Note: We intentionally exclude selectedAction?.votes?.length from deps
    // because we capture the initial count inside the function, and we don't
    // want the callback to be recreated when votes change (which would break polling)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, proposalId]);

  // Check if vote is synced (vote count increased)
  useEffect(() => {
    const currentVoteCount = selectedAction?.votes?.length || 0;
    console.log(
      `[Vote Sync] Sync check effect - isPolling: ${syncState.isPolling}, pollCount: ${syncState.pollCount}, initialCount: ${initialVoteCountRef.current}, currentCount: ${currentVoteCount}`
    );

    if (syncState.isPolling && voteState.txHash && syncState.pollCount > 1) {
      // Check if vote count increased (works even when initial count is 0)
      if (currentVoteCount > initialVoteCountRef.current) {
        // Vote synced - stop polling
        console.log(
          `[Vote Sync] Vote synced! Initial: ${initialVoteCountRef.current}, Current: ${currentVoteCount}`
        );
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setSyncState((prev) => ({
          ...prev,
          isPolling: false,
          isSynced: true,
        }));
      }
    }
  }, [
    syncState.isPolling,
    syncState.pollCount,
    selectedAction?.votes?.length,
    voteState.txHash,
  ]);

  // Cleanup interval on unmount only
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  const handleVoteClick = (vote: VoteChoice) => {
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

      // Prepare anchor if URL provided (optional — skip on failure)
      let anchor = undefined;
      if (anchorUrl.trim()) {
        const trimmedUrl = anchorUrl.trim();
        try {
          const response = await fetch(trimmedUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const contentText = await response.text();
          const contentJson = JSON.parse(contentText);
          const anchorDataHash = hashDrepAnchor(contentJson);

          anchor = {
            anchorUrl: trimmedUrl,
            anchorDataHash,
          };
        } catch (fetchError) {
          console.warn("Anchor fetch failed, proceeding without rationale:", fetchError);
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

      // Start polling to sync the vote
      startPolling();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("failedToSubmitVote");

      // If user declined the wallet signing, just close the modal
      if (message.toLowerCase().includes("user declined") || message.toLowerCase().includes("user rejected")) {
        closeModal();
        return;
      }

      console.error("Vote submission error:", err);
      setVoteState({
        isSubmitting: false,
        isSuccess: false,
        error: message,
        txHash: null,
      });
    }
  }, [wallet, selectedVote, txHash, certIndex, anchorUrl, startPolling]);

  const closeModal = () => {
    // Stop polling if still running
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsModalOpen(false);
    setSelectedVote(null);
    setAnchorUrl("");
    setVoteState({
      isSubmitting: false,
      isSuccess: false,
      error: null,
      txHash: null,
    });
    setSyncState({
      isPolling: false,
      isSynced: false,
      pollCount: 0,
      maxPolls: 15,
    });
  };

  const getVoteButtonClass = (vote: VoteChoice) => {
    const baseClass = "flex-1 h-10 text-sm font-semibold transition-all";
    const isSelected = selectedVote === vote;
    const voteTypeClass =
      vote === "Yes"
        ? "vote-btn-yes"
        : vote === "No"
        ? "vote-btn-no"
        : "vote-btn-abstain";

    // Game & Dark themes: CSS token overrides handle all visual styling
    if (isGame || isDark) {
      return cn(baseClass, voteTypeClass, isSelected && "selected");
    }

    // Light theme: white card-style buttons with shadow
    const cardBase = "bg-white border-transparent shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:bg-gray-50 hover:text-black";
    switch (vote) {
      case "Yes":
        return cn(
          baseClass,
          voteTypeClass,
          isSelected
            ? "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
            : `${cardBase} text-black`
        );
      case "No":
        return cn(
          baseClass,
          voteTypeClass,
          isSelected
            ? "bg-red-600 hover:bg-red-700 text-white border-transparent shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
            : `${cardBase} text-black`
        );
      case "Abstain":
        return cn(
          baseClass,
          voteTypeClass,
          isSelected
            ? "bg-gray-500 hover:bg-gray-600 text-white border-transparent shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
            : `${cardBase} text-black`
        );
    }
  };

  if (!isActive) {
    return (
      <Card className={cn(
        "p-6 vote-on-proposal-card",
        isGame && "game-detail-card"
      )}>
        <h3 className={cn("font-semibold mb-4", isGame && "text-white")}>{t("castYourVote")}</h3>
        <div className="py-6">
          <Badge variant="outline" className={cn(
            "mb-3 rounded-none bg-transparent px-3 py-1 text-sm font-semibold uppercase tracking-wide",
            isGame
              ? "border-white/30 text-white"
              : "border-foreground/30 dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
          )}>
            {status}
          </Badge>
          <p className={isGame ? "text-white/70" : "text-muted-foreground"}>
            {t("votingNoLongerAvailable")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn(
        "p-6 vote-on-proposal-card",
        isGame && "game-detail-card"
      )}>
        <h3 className={cn("font-semibold mb-4", isGame && "text-white")}>{t("castYourVote")}</h3>

        {!connected ? (
          <div className="py-6 space-y-4">
            <p className={isGame ? "text-white/70" : "text-muted-foreground"}>
              {t("connectWalletToVote")}
            </p>
            <ConnectWalletButton />
          </div>
        ) : (
          <div className="space-y-4">
            <p className={cn("text-sm", isGame ? "text-white/70" : "text-muted-foreground")}>
              {t("selectVoteChoice")}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className={getVoteButtonClass("Yes")}
                onClick={() => handleVoteClick("Yes")}
              >
                {tv("yes")}
              </Button>
              <Button
                variant="outline"
                className={getVoteButtonClass("No")}
                onClick={() => handleVoteClick("No")}
              >
                {tv("no")}
              </Button>
              <Button
                variant="outline"
                className={getVoteButtonClass("Abstain")}
                onClick={() => handleVoteClick("Abstain")}
              >
                {tv("abstain")}
              </Button>
            </div>
            <p className={cn("text-xs", isGame ? "text-white/70" : "text-muted-foreground")}>
              {t("voteSubmittedOnChain")}
            </p>
          </div>
        )}
      </Card>

      {/* Vote Confirmation Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open: boolean) => {
          console.log(
            `[Vote Sync] Dialog onOpenChange called with: ${open}, isPolling: ${syncState.isPolling}, isSuccess: ${voteState.isSuccess}`
          );
          // Only close if explicitly requested (not from re-renders)
          if (!open) {
            closeModal();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirmYourVote")}</DialogTitle>
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
                {syncState.isSynced ? (
                  <CheckCircle className="h-16 w-16 text-success" />
                ) : (
                  <CheckCircle className="h-16 w-16 text-success" />
                )}
              </div>
              <div className="text-center space-y-2">
                <p className="font-semibold text-success">
                  {t("voteSubmittedSuccess")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("voteSubmittedToBlockchain")}
                </p>
              </div>

              {/* Sync Status Indicator */}
              <div className="bg-secondary/50 p-4 rounded-lg">
                {syncState.isPolling ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-muted-foreground">
                      {t("syncingVote", { current: syncState.pollCount, max: syncState.maxPolls })}
                    </span>
                  </div>
                ) : syncState.isSynced ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-success">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      {t("voteSynced")}
                    </span>
                  </div>
                ) : syncState.pollCount >= syncState.maxPolls ? (
                  <div className="text-center text-sm text-muted-foreground">
                    <p>{t("syncTimedOut")}</p>
                    <p className="text-xs mt-1">
                      {t("syncTimedOutDetail")}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t("preparingToSync")}</span>
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={closeModal}>
                {syncState.isSynced ? t("viewUpdatedRecords") : t("close")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 pr-4 font-medium text-muted-foreground whitespace-nowrap">{t("proposal")}</td>
                    <td className="py-2 line-clamp-2">{proposalTitle}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-muted-foreground whitespace-nowrap">{tTable("vote")}</td>
                    <td className="py-2 font-semibold">{selectedVote ? translateVote(selectedVote) : ""}</td>
                  </tr>
                </tbody>
              </table>

              <div className="space-y-2">
                <Label htmlFor="anchorUrl">{t("rationaleUrlOptional")}</Label>
                <Textarea
                  id="anchorUrl"
                  className="min-h-[100px] focus-visible:ring-black/20"
                  placeholder={t("rationaleUrlPlaceholder")}
                  value={anchorUrl}
                  onChange={(e) => setAnchorUrl(e.target.value)}
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
