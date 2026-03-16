import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@meshsdk/react";
import { MeshTxBuilder, hashDrepAnchor } from "@meshsdk/core";
import { useDispatch, useSelector } from "react-redux";
import { useTranslations } from "next-intl";
import type { AppDispatch, RootState } from "@/store";
import { loadGovernanceActionDetail } from "@/store/governanceSlice";
import { useProposalSurvey } from "@/hooks/useGovernanceData";
import {
  verifyDRepRole,
  type DRepVerificationResult,
} from "@/services/api";
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
import { Slider } from "@/components/ui/slider";
import { ConnectWalletButton } from "@/components/wallet";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type {
  ProposalSurveyResponse,
  SurveyQuestion,
  SurveyResponsePayload,
} from "@/types/governance";
import {
  BUILTIN_SURVEY_METHODS,
  buildSurveyResponseMetadata,
  isCustomSurveyMethod,
  SUPPORTED_SURVEY_RESPONSE_ROLE,
  validateSurveyResponse,
} from "@/lib/surveyMetadata";

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

interface WalletRoleState {
  isChecking: boolean;
  drepId: string | null;
  isVerified: boolean | null;
  isActive: boolean | null;
  source: "db" | "koios" | null;
  detail: string | null;
}

type SurveyDraftAnswer = {
  selection?: number[];
  numericValue?: number;
  customValue?: string;
};

async function attachMetadataToVoteBuilder(
  txBuilder: MeshTxBuilder,
  metadata: Record<number, unknown>
) {
  const builder = txBuilder as MeshTxBuilder & Record<string, unknown>;
  const [labelKey] = Object.keys(metadata);
  const label = Number(labelKey);
  const value = metadata[label];

  const candidates: Array<{ name: string; args: unknown[] }> = [
    { name: "metadataValue", args: [label, value] },
    { name: "metadataValue", args: [String(label), value] },
    { name: "metadataJson", args: [label, value] },
    { name: "metadataJson", args: [String(label), value] },
    { name: "metadata", args: [label, value] },
    { name: "metadata", args: [metadata] },
    { name: "txMetadata", args: [label, value] },
    { name: "txMetadata", args: [metadata] },
    { name: "auxiliaryData", args: [metadata] },
  ];

  for (const candidate of candidates) {
    const method = builder[candidate.name];
    if (typeof method !== "function") continue;
    try {
      const result = (method as (...args: unknown[]) => unknown).apply(
        txBuilder,
        candidate.args
      );
      if (result && typeof (result as Promise<unknown>).then === "function") {
        await result;
      }
      return;
    } catch {
      continue;
    }
  }

  throw new Error(
    "This cgov build could not attach CIP-0179 survey metadata to the vote transaction."
  );
}

function hasAnySurveyAnswer(answer: SurveyDraftAnswer | undefined): boolean {
  if (!answer) return false;
  return (
    (Array.isArray(answer.selection) && answer.selection.length > 0) ||
    typeof answer.numericValue === "number" ||
    (typeof answer.customValue === "string" && answer.customValue.trim() !== "")
  );
}

function buildSurveyResponsePayload(
  survey: ProposalSurveyResponse,
  answerState: Record<string, SurveyDraftAnswer>
): SurveyResponsePayload | null {
  const questions = survey.surveyDetails?.questions ?? [];
  const answers: SurveyResponsePayload["answers"] = [];

  for (const question of questions) {
    const answer = answerState[question.questionId];
    if (!hasAnySurveyAnswer(answer)) continue;

    if (question.methodType === BUILTIN_SURVEY_METHODS.numericRange) {
      const numericValue = answer?.numericValue;
      if (!Number.isInteger(numericValue)) {
        throw new Error(`Question "${question.question}" requires an integer value.`);
      }
      answers.push({
        questionId: question.questionId,
        numericValue: numericValue as number,
      });
      continue;
    }

    if (Array.isArray(answer?.selection)) {
      answers.push({
        questionId: question.questionId,
        selection: answer.selection,
      });
      continue;
    }
  }

  if (!answers.length || !survey.surveyTxId) {
    return null;
  }

  return {
    specVersion: "1.0.0",
    surveyTxId: survey.surveyTxId,
    responderRole: SUPPORTED_SURVEY_RESPONSE_ROLE,
    answers,
  };
}

function SurveyQuestionInput({
  question,
  answer,
  setAnswer,
  disabled,
}: {
  question: SurveyQuestion;
  answer?: SurveyDraftAnswer;
  setAnswer: (next: SurveyDraftAnswer | undefined) => void;
  disabled: boolean;
}) {
  if (question.methodType === BUILTIN_SURVEY_METHODS.singleChoice) {
    return (
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap gap-2">
          {(question.options ?? []).map((option, index) => {
            const isSelected = answer?.selection?.[0] === index;
            return (
              <Button
                key={`${question.questionId}-${option}`}
                type="button"
                variant={isSelected ? "default" : "outline"}
                className="h-8 rounded-none text-xs"
                disabled={disabled}
                onClick={() =>
                  setAnswer(
                    isSelected
                      ? undefined
                      : {
                          selection: [index],
                        }
                  )
                }
              >
                {option}
              </Button>
            );
          })}
        </div>
        {answer?.selection?.length ? (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            disabled={disabled}
            onClick={() => setAnswer(undefined)}
          >
            Clear response
          </Button>
        ) : null}
      </div>
    );
  }

  if (question.methodType === BUILTIN_SURVEY_METHODS.multiSelect) {
    const currentSelection = answer?.selection ?? [];
    const maxSelections = question.maxSelections ?? question.options?.length ?? 0;
    const selectionLimitReached = currentSelection.length >= maxSelections;
    return (
      <div className="mt-2 space-y-2">
        {maxSelections > 0 ? (
          <div className="text-xs text-muted-foreground">
            Select up to {maxSelections} option{maxSelections === 1 ? "" : "s"}.
          </div>
        ) : null}
        {(question.options ?? []).map((option, index) => {
          const checked = currentSelection.includes(index);
          return (
            <label
              key={`${question.questionId}-${option}`}
              className={cn(
                "flex items-center gap-2 text-sm",
                !checked && selectionLimitReached && "opacity-60"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled || (!checked && selectionLimitReached)}
                onChange={(event) => {
                  const nextSelection = event.target.checked
                    ? [...currentSelection, index].sort((left, right) => left - right)
                    : currentSelection.filter((item) => item !== index);
                  setAnswer({ selection: nextSelection });
                }}
              />
              <span>{option}</span>
            </label>
          );
        })}
        {currentSelection.length ? (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            disabled={disabled}
            onClick={() => setAnswer(undefined)}
          >
            Clear response
          </Button>
        ) : null}
      </div>
    );
  }

  if (question.methodType === BUILTIN_SURVEY_METHODS.numericRange) {
    const constraints = question.numericConstraints;
    const currentValue = answer?.numericValue;
    if (!constraints) {
      return (
        <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          This numeric question is missing its constraints, so `cgov` cannot render an input for it.
        </div>
      );
    }

    return (
      <div className="mt-2 space-y-2.5">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {constraints.minValue} to {constraints.maxValue}
            {constraints.step ? `, step ${constraints.step}` : ""}
          </span>
          <span className="font-medium text-foreground">
            {currentValue ?? "No answer selected"}
          </span>
        </div>
        <Slider
          disabled={disabled}
          min={constraints.minValue}
          max={constraints.maxValue}
          step={constraints.step ?? 1}
          value={[currentValue ?? constraints.minValue]}
          onValueChange={(values) => {
            const nextValue = values[0];
            if (Number.isInteger(nextValue)) {
              setAnswer({ numericValue: nextValue });
            }
          }}
        />
        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span>{constraints.minValue}</span>
          <span>{constraints.maxValue}</span>
        </div>
        {currentValue !== undefined ? (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            disabled={disabled}
            onClick={() => setAnswer(undefined)}
          >
            Clear response
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
      This survey uses a custom method. `cgov` can display the question, but it does not yet render an interactive input for this method.
    </div>
  );
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [anchorUrl, setAnchorUrl] = useState("");
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, SurveyDraftAnswer>>({});
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
  const [walletRoleState, setWalletRoleState] = useState<WalletRoleState>({
    isChecking: false,
    drepId: null,
    isVerified: null,
    isActive: null,
    source: null,
    detail: null,
  });
  const [walletRoleRefreshNonce, setWalletRoleRefreshNonce] = useState(0);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get current votes from Redux store to check if our vote has synced
  const selectedAction = useSelector(
    (state: RootState) => state.governance.selectedAction
  );
  const linkedSurvey =
    proposalSurvey?.linked &&
    proposalSurvey.linkValidation.valid &&
    proposalSurvey.surveyDetailsValidation.valid &&
    proposalSurvey.surveyDetails &&
    proposalSurvey.surveyTxId
      ? proposalSurvey
      : null;
  const drepCanRespond = !!linkedSurvey?.surveyDetails?.roleWeighting?.DRep;
  const surveyQuestionCount = linkedSurvey?.surveyDetails?.questions.length ?? 0;
  const answeredQuestionCount = linkedSurvey?.surveyDetails?.questions.reduce(
    (count, question) =>
      hasAnySurveyAnswer(surveyAnswers[question.questionId]) ? count + 1 : count,
    0
  ) ?? 0;

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

  useEffect(() => {
    if (!isModalOpen) {
      setSurveyAnswers({});
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

        const verification = await verifyDRepRole(drepId);
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

  const formatDRepId = (value: string | null) => {
    if (!value) return null;
    return value.length > 24
      ? `${value.slice(0, 16)}...${value.slice(-8)}`
      : value;
  };

  const canOpenVoteModal =
    connected &&
    !walletRoleState.isChecking &&
    walletRoleState.isVerified === true &&
    !!walletRoleState.drepId;
  const isWalletRoleReady =
    walletRoleState.isVerified === true && walletRoleState.isActive !== false;

  const handleVoteClick = (vote: VoteChoice) => {
    if (!canOpenVoteModal) return;
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
      const verifiedRole = await verifyDRepRole(drepId);
      if (!verifiedRole?.exists || !verifiedRole.isRegistered) {
        throw new Error(
          "The connected wallet is not currently verifiable as a registered DRep on this network in cgov."
        );
      }

      // Build the vote transaction
      const txBuilder = new MeshTxBuilder({
        verbose: true,
      });

      const surveyResponse = linkedSurvey && drepCanRespond
        ? buildSurveyResponsePayload(linkedSurvey, surveyAnswers)
        : null;
      if (surveyResponse) {
        const surveyValidationErrors = validateSurveyResponse(
          linkedSurvey,
          surveyResponse
        );
        if (surveyValidationErrors.length > 0) {
          throw new Error(surveyValidationErrors[0]);
        }
      }

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
        await attachMetadataToVoteBuilder(
          txBuilder,
          buildSurveyResponseMetadata(surveyResponse)
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
  }, [
    wallet,
    selectedVote,
    txHash,
    certIndex,
    anchorUrl,
    linkedSurvey,
    drepCanRespond,
    surveyAnswers,
    startPolling,
    t,
  ]);

  const closeModal = () => {
    // Stop polling if still running
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsModalOpen(false);
    setSelectedVote(null);
    setAnchorUrl("");
    setSurveyAnswers({});
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
            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                isWalletRoleReady
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : walletRoleState.detail
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-border/50 text-muted-foreground dark:border-[#0bd1a2]/30"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  {walletRoleState.isChecking ? (
                    <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />
                  ) : isWalletRoleReady ? (
                    <CheckCircle className="mt-0.5 h-4 w-4" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                  )}
                  <div className="space-y-1">
                    <div className="font-medium">
                      {walletRoleState.isChecking
                        ? "Checking connected wallet for DRep voting…"
                        : isWalletRoleReady
                          ? "Connected wallet is ready for DRep voting."
                          : walletRoleState.isVerified
                            ? "Connected wallet is registered, but needs review before voting."
                          : "Connected wallet needs attention before voting."}
                    </div>
                    {walletRoleState.drepId && (
                      <div className="text-xs font-mono">
                        DRep ID: {formatDRepId(walletRoleState.drepId)}
                      </div>
                    )}
                    {walletRoleState.detail && (
                      <div className="text-xs">{walletRoleState.detail}</div>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-none text-xs"
                  onClick={() =>
                    setWalletRoleRefreshNonce((previous) => previous + 1)
                  }
                >
                  Re-check Wallet Role
                </Button>
              </div>
            </div>
            <p className={cn("text-sm", isGame ? "text-white/70" : "text-muted-foreground")}>
              {t("selectVoteChoice")}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className={getVoteButtonClass("Yes")}
                disabled={!canOpenVoteModal}
                onClick={() => handleVoteClick("Yes")}
              >
                {tv("yes")}
              </Button>
              <Button
                variant="outline"
                className={getVoteButtonClass("No")}
                disabled={!canOpenVoteModal}
                onClick={() => handleVoteClick("No")}
              >
                {tv("no")}
              </Button>
              <Button
                variant="outline"
                className={getVoteButtonClass("Abstain")}
                disabled={!canOpenVoteModal}
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
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden p-0 sm:w-auto">
          <DialogHeader>
            <DialogTitle className="px-4 pt-4 sm:px-6 sm:pt-6">
              {t("confirmYourVote")}
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
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
                <div className="space-y-4">
                  <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                    <div className="grid gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("proposal")}
                        </div>
                        <div className="mt-1 line-clamp-3 font-medium">
                          {proposalTitle}
                        </div>
                      </div>
                      <div className="sm:text-right">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {tTable("vote")}
                        </div>
                        <div className="mt-1 font-semibold">
                          {selectedVote ? translateVote(selectedVote) : ""}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anchorUrl">{t("rationaleUrlOptional")}</Label>
                    <Textarea
                      id="anchorUrl"
                      className="min-h-[88px] focus-visible:ring-black/20"
                      placeholder={t("rationaleUrlPlaceholder")}
                      value={anchorUrl}
                      onChange={(e) => setAnchorUrl(e.target.value)}
                      disabled={voteState.isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("rationaleUrlHelp")}
                    </p>
                  </div>

                  {isSurveyLoading ? (
                    <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                      Loading linked survey…
                    </div>
                  ) : surveyError ? (
                    <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                      The linked survey could not be loaded. Your governance vote can still be submitted without a survey response.
                    </div>
                  ) : linkedSurvey?.surveyDetails ? (
                    <div className="space-y-3 rounded-md border border-border/50 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">
                            {linkedSurvey.surveyDetails.title}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Optional survey response. Ends at epoch {linkedSurvey.surveyDetails.endEpoch}.
                          </p>
                        </div>
                        {drepCanRespond ? (
                          <Badge variant="outline" className="w-fit text-xs">
                            Answered {answeredQuestionCount} of {surveyQuestionCount}
                          </Badge>
                        ) : null}
                      </div>
                      {!drepCanRespond ? (
                        <div className="text-xs text-muted-foreground">
                          This linked survey does not accept DRep responses, so only the governance vote will be submitted.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {linkedSurvey.surveyDetails.questions.map((question, index) => (
                            <div
                              key={question.questionId}
                              className="rounded-md border border-border/50 bg-background/40 p-3"
                            >
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Question {index + 1}
                                  </div>
                                  <div className="mt-1 text-sm font-medium">
                                    {question.question}
                                  </div>
                                </div>
                                {!isCustomSurveyMethod(question.methodType) ? (
                                  <div className="text-[11px] text-muted-foreground">
                                    {question.methodType}
                                  </div>
                                ) : null}
                              </div>
                              {isCustomSurveyMethod(question.methodType) ? (
                                <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                                  This survey question uses a custom method. `cgov` will not submit a response for this question until a custom renderer is implemented.
                                </div>
                              ) : (
                                <SurveyQuestionInput
                                  question={question}
                                  answer={surveyAnswers[question.questionId]}
                                  disabled={voteState.isSubmitting}
                                  setAnswer={(next) => {
                                    setSurveyAnswers((current) => {
                                      if (!next || !hasAnySurveyAnswer(next)) {
                                        const nextState = { ...current };
                                        delete nextState[question.questionId];
                                        return nextState;
                                      }
                                      return {
                                        ...current,
                                        [question.questionId]: next,
                                      };
                                    });
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
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
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("submitting")}
                        </>
                      ) : (
                        t("confirmVote")
                      )}
                    </Button>
                  </div>

                  <p className="text-center text-xs text-muted-foreground">
                    {t("onChainTransactionNote")}
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
