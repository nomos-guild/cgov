import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@meshsdk/react";
import { MeshTxBuilder, hashDrepAnchor } from "@meshsdk/core";
import { useDispatch, useSelector } from "react-redux";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectWalletButton } from "@/components/wallet";
import {
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

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
        throw new Error(
          "Could not get DRep ID. Please ensure your wallet is registered as a DRep."
        );
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

      // Start polling to sync the vote
      startPolling();
    } catch (err) {
      console.error("Vote submission error:", err);
      setVoteState({
        isSubmitting: false,
        isSuccess: false,
        error: err instanceof Error ? err.message : "Failed to submit vote",
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
    const baseClass = "flex-1 h-16 text-lg font-semibold transition-all";
    const selectedClass = "ring-2 ring-offset-2 ring-offset-background";

    switch (vote) {
      case "Yes":
        return selectedVote === vote
          ? `${baseClass} ${selectedClass} bg-emerald-500 hover:bg-emerald-600 text-white ring-emerald-500`
          : `${baseClass} bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30`;
      case "No":
        return selectedVote === vote
          ? `${baseClass} ${selectedClass} bg-red-500 hover:bg-red-600 text-white ring-red-500`
          : `${baseClass} bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30`;
      case "Abstain":
        return selectedVote === vote
          ? `${baseClass} ${selectedClass} bg-gray-500 hover:bg-gray-600 text-white ring-gray-500`
          : `${baseClass} bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 border-gray-500/30`;
    }
  };

  if (!isActive) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Cast Your Vote</h3>
        <div className="py-6">
          <Badge variant="outline" className="mb-3 rounded-none border-foreground/30 bg-transparent px-3 py-1 text-sm font-semibold uppercase tracking-wide dark:border-[#0bd1a2] dark:text-[#0bd1a2]">
            {status}
          </Badge>
          <p className="text-muted-foreground">
            Voting is no longer available for this proposal.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Cast Your Vote</h3>

        {!connected ? (
          <div className="py-6 space-y-4">
            <p className="text-muted-foreground">
              Connect your wallet to vote on this governance action.
            </p>
            <ConnectWalletButton />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select your vote choice:
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className={getVoteButtonClass("Yes")}
                onClick={() => handleVoteClick("Yes")}
              >
                <ThumbsUp className="h-5 w-5 mr-2" />
                Yes
              </Button>
              <Button
                variant="outline"
                className={getVoteButtonClass("No")}
                onClick={() => handleVoteClick("No")}
              >
                <ThumbsDown className="h-5 w-5 mr-2" />
                No
              </Button>
              <Button
                variant="outline"
                className={getVoteButtonClass("Abstain")}
                onClick={() => handleVoteClick("Abstain")}
              >
                <MinusCircle className="h-5 w-5 mr-2" />
                Abstain
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your vote will be submitted on-chain as a DRep vote.
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
            <DialogTitle>Confirm Your Vote</DialogTitle>
            <DialogDescription>
              You are about to vote <strong>{selectedVote}</strong> on this
              governance action.
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
                  Vote Submitted Successfully!
                </p>
                <p className="text-sm text-muted-foreground">
                  Your vote has been submitted to the blockchain.
                </p>
                {voteState.txHash && (
                  <a
                    href={`https://adastat.net/transactions/${voteState.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm flex items-center justify-center gap-1 hover:underline"
                  >
                    View on AdaStat
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Sync Status Indicator */}
              <div className="bg-secondary/50 p-4 rounded-lg">
                {syncState.isPolling ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-muted-foreground">
                      Syncing your vote... ({syncState.pollCount}/
                      {syncState.maxPolls})
                    </span>
                  </div>
                ) : syncState.isSynced ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-success">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      Vote synced! You can view it in the voting records below.
                    </span>
                  </div>
                ) : syncState.pollCount >= syncState.maxPolls ? (
                  <div className="text-center text-sm text-muted-foreground">
                    <p>Sync timed out. Your vote was submitted successfully.</p>
                    <p className="text-xs mt-1">
                      It may take a few more minutes to appear in the voting
                      records.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Preparing to sync...</span>
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={closeModal}>
                {syncState.isSynced ? "View Updated Records" : "Close"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-secondary/50 p-4 rounded-lg">
                <p className="text-sm font-medium mb-1">Proposal:</p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {proposalTitle}
                </p>
              </div>

              <div className="flex justify-center">
                <Badge
                  variant="outline"
                  className={
                    selectedVote === "Yes"
                      ? "rounded-none bg-transparent text-emerald-400 border-emerald-500/60 text-lg px-6 py-2 dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                      : selectedVote === "No"
                      ? "rounded-none bg-transparent text-red-400 border-red-500/60 text-lg px-6 py-2 dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                      : "rounded-none bg-transparent text-gray-400 border-gray-500/60 text-lg px-6 py-2 dark:border-[#0bd1a2] dark:text-[#0bd1a2]"
                  }
                >
                  {selectedVote}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="anchorUrl">Rationale URL (Optional)</Label>
                <Input
                  id="anchorUrl"
                  placeholder="https://... or ipfs://..."
                  value={anchorUrl}
                  onChange={(e) => setAnchorUrl(e.target.value)}
                  disabled={voteState.isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Provide a URL to your voting rationale (e.g., IPFS link to a
                  JSON document).
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
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={submitVote}
                  disabled={voteState.isSubmitting}
                >
                  {voteState.isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Confirm Vote"
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                This will create an on-chain transaction. You will be asked to
                sign with your wallet.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
