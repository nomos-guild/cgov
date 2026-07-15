import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@meshsdk/react";
import { MeshTxBuilder, hashDrepAnchor } from "@meshsdk/core";
import { CredentialType, DRepID } from "@meshsdk/core-cst";
import { Role, type AnswerItem, type Credential } from "cip-179";
import { useTranslations } from "next-intl";
import { useProposalSurvey } from "@/hooks/useGovernanceData";
import {
  verifyDRepRole,
  type DRepVerificationResult,
} from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConnectWalletButton } from "@/components/wallet";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Info,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { wrapRationaleAsJson } from "@/lib/rationaleHelpers";
import { toCip129DRepId } from "@/lib/drepFormatters";
import {
  buildDrepResponse,
  encodeResponseMetadata,
  SURVEY_METADATA_LABEL,
  validateDrepResponse,
} from "@/lib/surveyMetadata";
import { Cip179ResponseForm } from "@/components/governance/Cip179ResponseForm";
import { useCip179Presentation } from "@/hooks/useCip179Presentation";

type VoteChoice = "Yes" | "No" | "Abstain";

interface VoteOnProposalProps {
  txHash: string;
  certIndex: number;
  proposalTitle: string;
  status: string;
  proposalId: string;
  onVoteSubmitted?: () => void;
}

interface VoteState {
  isSubmitting: boolean;
  isSuccess: boolean;
  error: string | null;
  txHash: string | null;
}


interface WalletRoleState {
  isChecking: boolean;
  drepId: string | null;
  isVerified: boolean | null;
  isActive: boolean | null;
  source: "db" | "koios" | null;
  detail: string | null;
}

function credentialHashBytes(hash: string): Uint8Array {
  return Uint8Array.from(
    hash.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []
  );
}

export function VoteOnProposal({
  txHash,
  certIndex,
  proposalTitle,
  status,
  proposalId,
  onVoteSubmitted,
}: VoteOnProposalProps) {
  const { connected, wallet } = useWallet();
  const { activeTheme } = useTheme();
  const t = useTranslations("voteAction");
  const tv = useTranslations("voting");
  const tTable = useTranslations("table");
  const isGame = activeTheme.id === "game";
  const isDark = activeTheme.id === "dark";
  const {
    survey: proposalSurvey,
    isLoading: isSurveyLoading,
    error: surveyError,
  } = useProposalSurvey(proposalId);

  const translateVote = (vote: VoteChoice) => {
    switch (vote) {
      case "Yes": return tv("yes");
      case "No": return tv("no");
      case "Abstain": return tv("abstain");
    }
  };
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [isVoteDropdownOpen, setIsVoteDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [anchorUrl, setAnchorUrl] = useState("");
  const [rationaleMode, setRationaleMode] = useState<"url" | "write" | "json">("write");
  const [rationaleTitle, setRationaleTitle] = useState("");
  const [rationaleComment, setRationaleComment] = useState("");
  const [rationaleJsonText, setRationaleJsonText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState<AnswerItem[] | null>([]);
  const [voteState, setVoteState] = useState<VoteState>({
    isSubmitting: false,
    isSuccess: false,
    error: null,
    txHash: null,
  });
  const [walletRoleState, setWalletRoleState] = useState<WalletRoleState>({
    isChecking: false,
    drepId: null,
    isVerified: null,
    isActive: null,
    source: null,
    detail: null,
  });
  const [walletRoleRefreshNonce] = useState(0);

  const linkedSurvey =
    proposalSurvey?.linked &&
    proposalSurvey.linkValidation.valid &&
    proposalSurvey.phase === "open" &&
    proposalSurvey.bundle &&
    proposalSurvey.surveyRef
      ? proposalSurvey
      : null;
  const sourceDefinition = linkedSurvey?.bundle?.survey.definition ?? null;
  const { definition: surveyDefinition, error: surveyPresentationError } =
    useCip179Presentation(sourceDefinition);
  const drepCanRespond = !!surveyDefinition &&
    surveyDefinition.submissionMode.type === "public" &&
    surveyDefinition.eligibleRoles.includes(Role.DRep);
  const handleSurveyAnswers = useCallback((answers: AnswerItem[] | null) => {
    setSurveyAnswers(answers);
  }, []);

  const isVotingOpen = status === "Active";


  useEffect(() => {
    if (!isModalOpen) {
      setSurveyAnswers([]);
    }
  }, [isModalOpen]);

  useEffect(() => {
    let cancelled = false;

    const buildVerificationDetail = (
      verification: DRepVerificationResult | null
    ): string | null => {
      if (!verification) {
        return "cgov-api could not verify this DRep right now. Check that the backend is reachable on the current network and try again.";
      }
      if (!verification.exists) {
        return "This DRep ID was not found on the current network.";
      }
      if (!verification.isRegistered) {
        return "This DRep ID exists on the current network, but it is not currently registered.";
      }
      if (verification.isActive === false) {
        return `This DRep is registered on the current network but currently marked inactive.${verification.expiresEpoch !== null ? ` Expires at epoch ${verification.expiresEpoch}.` : ""}`;
      }
      return verification.source === "koios"
        ? "Verified from live Koios data for this network."
        : "Verified from the local cgov-api cache for this network.";
    };

    async function checkWalletRole() {
      if (!connected || !wallet) {
        if (!cancelled) {
          setWalletRoleState({
            isChecking: false,
            drepId: null,
            isVerified: null,
            isActive: null,
            source: null,
            detail: null,
          });
        }
        return;
      }

      setWalletRoleState({
        isChecking: true,
        drepId: null,
        isVerified: null,
        isActive: null,
        source: null,
        detail: null,
      });

      try {
        const dRep = await wallet.getDRep();
        const drepId = dRep?.dRepIDCip105 ?? null;

        if (!drepId) {
          if (!cancelled) {
            setWalletRoleState({
              isChecking: false,
              drepId: null,
              isVerified: false,
              isActive: null,
              source: null,
              detail:
                "The connected wallet does not expose a DRep ID. This cgov flow can only submit DRep votes.",
            });
          }
          return;
        }

        // Use CIP-129 format for backend verification (DB stores CIP-129 from Koios)
        const verification = await verifyDRepRole(toCip129DRepId(drepId));
        const isVerified = !!verification?.exists && !!verification?.isRegistered;

        if (!cancelled) {
          setWalletRoleState({
            isChecking: false,
            drepId,
            isVerified,
            isActive: verification?.isActive ?? null,
            source: verification?.source ?? null,
            detail: buildVerificationDetail(verification),
          });
        }
      } catch (error) {
        if (!cancelled) {
            setWalletRoleState({
              isChecking: false,
              drepId: null,
              isVerified: false,
              isActive: null,
              source: null,
              detail:
                error instanceof Error
                  ? error.message
                  : "Failed to inspect the connected wallet for DRep voting.",
          });
        }
      }
    }

    checkWalletRole();

    return () => {
      cancelled = true;
    };
  }, [connected, wallet, walletRoleRefreshNonce]);

  const canOpenVoteModal =
    connected &&
    !walletRoleState.isChecking &&
    walletRoleState.isVerified === true &&
    !!walletRoleState.drepId;

  const handleVoteClick = (vote: VoteChoice) => {
    if (!canOpenVoteModal) return;
    setSelectedVote(vote);
    setRationaleMode("write");
    setRationaleTitle("");
    setRationaleComment("");
    setRationaleJsonText("");
    setAnchorUrl("");
    setIsAdvancedOpen(false);
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
      // Use CIP-129 format for backend verification (DB stores CIP-129 from Koios)
      const verifiedRole = await verifyDRepRole(toCip129DRepId(drepId));
      if (!verifiedRole?.exists || !verifiedRole.isRegistered) {
        throw new Error(
          "The connected wallet is not currently verifiable as a registered DRep on this network in cgov."
        );
      }

      // Build the vote transaction
      const txBuilder = new MeshTxBuilder({
        verbose: true,
      });

      let surveyResponse = null;
      if (
        linkedSurvey &&
        surveyDefinition &&
        drepCanRespond &&
        surveyAnswers &&
        surveyAnswers.length > 0
      ) {
        const drepCredential = DRepID.toCredential(DRepID(drepId));
        const credential: Credential =
          drepCredential.type === CredentialType.KeyHash
            ? { type: "key", keyHash: credentialHashBytes(drepCredential.hash) }
            : { type: "script", scriptHash: credentialHashBytes(drepCredential.hash) };
        surveyResponse = buildDrepResponse({
          survey: linkedSurvey,
          credential,
          answers: surveyAnswers,
        });
      }
      if (surveyResponse) {
        const surveyValidationErrors = validateDrepResponse(
          surveyDefinition!,
          surveyResponse
        );
        if (surveyValidationErrors.length > 0) {
          throw new Error(
            `CIP-179 response validation failed: ${surveyValidationErrors[0]}`
          );
        }
      }

      // Prepare anchor if URL or written rationale provided (optional — skip on failure)
      let anchor = undefined;

      if (rationaleMode === "write" && rationaleComment.trim()) {
        try {
          setIsUploading(true);
          const rationaleJson = wrapRationaleAsJson(rationaleComment, rationaleTitle);

          const uploadRes = await fetch(API_ENDPOINTS.ipfsUpload, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ json: rationaleJson }),
          });
          if (!uploadRes.ok) {
            throw new Error(`Upload failed: ${uploadRes.status}`);
          }
          const { url } = await uploadRes.json();

          // Hash the local JSON directly — no need to fetch back from IPFS gateway
          const anchorDataHash = hashDrepAnchor(rationaleJson);

          anchor = {
            anchorUrl: url,
            anchorDataHash,
          };
        } catch {
          throw new Error(
            `Failed to upload rationale to IPFS. Your vote was not submitted. Please try again.`
          );
        } finally {
          setIsUploading(false);
        }
      } else if (rationaleMode === "json" && rationaleJsonText.trim()) {
        try {
          setIsUploading(true);
          const rationaleJson = JSON.parse(rationaleJsonText.trim());

          const uploadRes = await fetch(API_ENDPOINTS.ipfsUpload, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ json: rationaleJson }),
          });
          if (!uploadRes.ok) {
            throw new Error(`Upload failed: ${uploadRes.status}`);
          }
          const { url } = await uploadRes.json();

          // Hash the local JSON directly — no need to fetch back from IPFS gateway
          const anchorDataHash = hashDrepAnchor(rationaleJson);

          anchor = {
            anchorUrl: url,
            anchorDataHash,
          };
        } catch {
          throw new Error(
            `Failed to upload rationale to IPFS. Your vote was not submitted. Please try again.`
          );
        } finally {
          setIsUploading(false);
        }
      } else if (rationaleMode === "url" && anchorUrl.trim()) {
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
        } catch {
          throw new Error(
            `Failed to fetch rationale from the provided URL. Your vote was not submitted. Please check the URL and try again.`
          );
        }
      }

      // Build the transaction
      txBuilder.vote(
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
      );
      if (surveyResponse) {
        txBuilder.metadataValue(
          SURVEY_METADATA_LABEL,
          encodeResponseMetadata(surveyResponse)
        );
      }

      await txBuilder
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

      // Frontload vote to backend for immediate visibility, then refresh page data
      try {
        await fetch(API_ENDPOINTS.voteFrontload, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: submittedTxHash,
            proposalId,
            vote: selectedVote.toUpperCase(),
            voterType: "DREP",
            voterId: toCip129DRepId(drepId),
            anchorUrl: anchor?.anchorUrl,
            anchorHash: anchor?.anchorDataHash,
            rationale: anchor ? JSON.stringify(
              rationaleMode === "write"
                ? wrapRationaleAsJson(rationaleComment, rationaleTitle)
                : rationaleMode === "json"
                  ? JSON.parse(rationaleJsonText.trim())
                  : undefined
            ) : undefined,
          }),
        });
        // Small delay to ensure DB write is committed before read
        await new Promise((r) => setTimeout(r, 1000));
        onVoteSubmitted?.();
      } catch {
        // Non-critical — cron will pick up the vote eventually
      }
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
  }, [
    wallet,
    selectedVote,
    txHash,
    certIndex,
    anchorUrl,
    rationaleMode,
    rationaleTitle,
    rationaleComment,
    rationaleJsonText,
    linkedSurvey,
    surveyDefinition,
    drepCanRespond,
    surveyAnswers,
    onVoteSubmitted,
    proposalId,
    t,
  ]);

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedVote(null);
    setAnchorUrl("");
    setRationaleMode("write");
    setRationaleTitle("");
    setRationaleComment("");
    setRationaleJsonText("");
    setIsAdvancedOpen(false);
    setSurveyAnswers([]);
    setVoteState({
      isSubmitting: false,
      isSuccess: false,
      error: null,
      txHash: null,
    });
  };

  const getVoteButtonStyle = (vote: VoteChoice) => {
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
      return {
        variant: "outline" as const,
        className: cn(baseClass, voteTypeClass, isSelected && "selected"),
      };
    }

    // Light theme: white buttons, black on hover — same as modal action buttons
    const cardBase = "bg-white text-black border border-input shadow-elevation-1 hover:bg-black hover:text-white hover:border-black";

    return {
      variant: undefined,
      className: cn(baseClass, voteTypeClass, cardBase, isSelected && "bg-black text-white border-black"),
    };
  };

  if (!isVotingOpen) {
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
        "px-7 py-8 vote-on-proposal-card",
        isGame && "game-detail-card"
      )}>
        <h3 className={cn("text-lg font-semibold", isGame && "text-white")}>{t("castYourVote")}</h3>

        {!connected ? (
          <div className="mt-6 space-y-5">
            <p className={isGame ? "text-white/70" : "text-muted-foreground"}>
              {t("connectWalletToVote")}
            </p>
            <ConnectWalletButton />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <p className={cn("text-sm", isGame ? "text-white/70" : "text-muted-foreground")}>
                {t("selectVoteChoice")}
              </p>
              <div className="flex gap-3">
                {(["Yes", "No", "Abstain"] as VoteChoice[]).map((choice) => {
                  const style = getVoteButtonStyle(choice);
                  return (
                    <Button
                      key={choice}
                      variant={style.variant}
                      className={style.className}
                      disabled={!canOpenVoteModal}
                      onClick={() => handleVoteClick(choice)}
                    >
                      {translateVote(choice)}
                    </Button>
                  );
                })}
              </div>
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
          if (!open) {
            closeModal();
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden p-0 sm:w-auto">
          <DialogHeader>
            <DialogTitle className="px-4 pt-4 sm:px-6 sm:pt-6">
              {t("castYourVote")}
            </DialogTitle>
            <DialogDescription className="px-4 pb-3 sm:px-6">
              {t.rich("aboutToVote", {
                vote: selectedVote ? translateVote(selectedVote) : "",
                bold: (chunks) => <strong>{chunks}</strong>,
              })}
            </DialogDescription>
          </DialogHeader>

          {voteState.isSuccess ? (
            <div className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
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
              </div>

              <Button variant="secondary" className="w-full" onClick={closeModal}>
                {t("close")}
              </Button>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6">
                <div className="space-y-4">
                  <div className={cn("border p-3", isDark ? "rounded-none border-[#0bd1a2]/40 bg-transparent" : "rounded-md border-border/60 bg-muted/30")}>
                    <div className="grid gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("proposal")}
                        </div>
                        <div className="mt-1 line-clamp-3 font-medium">
                          {proposalTitle}
                        </div>
                      </div>
                      <div className="relative text-right">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground pr-0.5">
                          {tTable("vote")}
                        </div>
                        <button
                          type="button"
                          className="mt-1 inline-flex items-center gap-1 font-semibold rounded-md py-0.5 hover:bg-muted transition-colors disabled:opacity-50"
                          disabled={voteState.isSubmitting}
                          onClick={() => setIsVoteDropdownOpen((prev) => !prev)}
                          onBlur={() => setTimeout(() => setIsVoteDropdownOpen(false), 150)}
                        >
                          {selectedVote ? translateVote(selectedVote) : ""}
                          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isVoteDropdownOpen && "rotate-180")} />
                        </button>
                        {isVoteDropdownOpen && (
                          <div className="absolute right-0 z-50 mt-1 min-w-[120px] rounded-md border border-border bg-popover p-1 shadow-md">
                            {(["Yes", "No", "Abstain"] as VoteChoice[]).map((choice) => (
                              <button
                                key={choice}
                                type="button"
                                className={cn(
                                  "flex w-full items-center rounded-sm px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                                  selectedVote === choice && "font-semibold bg-muted"
                                )}
                                onClick={() => {
                                  setSelectedVote(choice);
                                  setIsVoteDropdownOpen(false);
                                }}
                              >
                                {translateVote(choice)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Label>{t("rationaleUrlOptional")}</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px] text-xs">
                          {rationaleMode === "url"
                            ? t("rationaleUrlHelp")
                            : rationaleMode === "json"
                              ? t("rationaleJsonHelp")
                              : t("rationaleWriteHelp")}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {rationaleMode === "write" && (
                      <Textarea
                        id="rationaleComment"
                        className="min-h-[120px] focus-visible:ring-black/20"
                        placeholder=""
                        value={rationaleComment}
                        onChange={(e) => setRationaleComment(e.target.value)}
                        disabled={voteState.isSubmitting || isUploading}
                      />
                    )}

                    {rationaleMode === "url" && (
                      <Textarea
                        id="anchorUrl"
                        className="min-h-[88px] focus-visible:ring-black/20"
                        placeholder={t("rationaleUrlPlaceholder")}
                        value={anchorUrl}
                        onChange={(e) => setAnchorUrl(e.target.value)}
                        disabled={voteState.isSubmitting}
                      />
                    )}

                    {rationaleMode === "json" && (
                      <Textarea
                        id="rationaleJsonText"
                        className="min-h-[160px] font-mono text-sm focus-visible:ring-black/20"
                        placeholder={'{"body": {"title": "My rationale", "comment": "I vote Yes because..."}}'}
                        value={rationaleJsonText}
                        onChange={(e) => setRationaleJsonText(e.target.value)}
                        disabled={voteState.isSubmitting || isUploading}
                      />
                    )}

                    <div className="border-t border-border/60 pt-3">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setIsAdvancedOpen((prev) => !prev)}
                      >
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isAdvancedOpen && "rotate-180")} />
                        Advanced
                      </button>
                      {isAdvancedOpen && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            type="button"
                            variant={rationaleMode === "url" ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setRationaleMode("url")}
                            disabled={voteState.isSubmitting}
                          >
                            {t("pasteUrl")}
                          </Button>
                          <Button
                            type="button"
                            variant={rationaleMode === "json" ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setRationaleMode("json")}
                            disabled={voteState.isSubmitting}
                          >
                            {t("advancedPasteJson")}
                          </Button>
                          {rationaleMode !== "write" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setRationaleMode("write")}
                              disabled={voteState.isSubmitting}
                            >
                              {t("writeRationale")}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSurveyLoading ? (
                    <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                      Loading linked survey…
                    </div>
                  ) : surveyError ? (
                    <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                      The linked survey could not be loaded. Your governance vote can still be submitted without a survey response.
                    </div>
                  ) : surveyPresentationError && !surveyDefinition ? (
                    <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                      The linked survey cannot be rendered: {surveyPresentationError}
                    </div>
                  ) : surveyDefinition ? (
                    <div className="space-y-3 rounded-md border border-border/50 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">
                            {surveyDefinition.title}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Optional CIP-179 response. Ends at epoch {surveyDefinition.endEpoch}.
                          </p>
                        </div>
                        <Badge variant="outline" className="w-fit text-xs">Version 5</Badge>
                      </div>
                      {surveyPresentationError ? (
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                          External labels could not be verified: {surveyPresentationError}
                        </div>
                      ) : null}
                      {surveyDefinition.submissionMode.type === "sealed" ? (
                        <div className="text-xs text-muted-foreground">
                          This survey uses sealed responses. This CGov release displays sealed surveys but does not submit encrypted answers.
                        </div>
                      ) : !drepCanRespond ? (
                        <div className="text-xs text-muted-foreground">
                          This linked survey does not accept DRep responses, so only the governance vote will be submitted.
                        </div>
                      ) : (
                        <Cip179ResponseForm
                          definition={surveyDefinition}
                          disabled={voteState.isSubmitting}
                          onAnswersChange={handleSurveyAnswers}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-border/60 bg-background px-4 py-4 sm:px-6">
                <div className="space-y-3">
                  {voteState.error && (
                    <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{voteState.error}</span>
                    </div>
                  )}

                  <div className={cn("flex gap-3", isGame && "justify-end gap-2")}>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1",
                        !isDark && !isGame && "bg-white hover:bg-black hover:text-white hover:border-black"
                      )}
                      onClick={closeModal}
                      disabled={voteState.isSubmitting}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      variant={isDark || isGame ? "secondary" : "outline"}
                      className={cn(
                        "flex-1",
                        !isDark && !isGame && "bg-white hover:bg-black hover:text-white hover:border-black"
                      )}
                      onClick={submitVote}
                      disabled={voteState.isSubmitting}
                    >
                      {voteState.isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("submitting")}
                        </>
                      ) : (
                        t("confirmVote")
                      )}
                    </Button>
                  </div>

                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
