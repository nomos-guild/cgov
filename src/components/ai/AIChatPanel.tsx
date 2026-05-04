import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useWallet } from "@meshsdk/react";
import Link from "next/link";
import { Send, Loader2, Sparkles, Lock, ArrowUpRight, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { MarkdownContent } from "@/components/ai/MarkdownContent";
import {
  filterValidNavigations,
  parseAssistantTags,
  toClientPath,
  type NavigationSuggestion,
} from "@/components/ai/assistantTags";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import type { GovernanceActionDetail } from "@/types/governance";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  followups?: string[];
  navigations?: NavigationSuggestion[];
}

const CHAT_UPDATE_EVENT = "cgov-ai-chat:updated";

interface ChatUpdateDetail {
  key: string;
  sourceId: string;
}

const MAX_CONTEXT_CHARS = 4_000;

// Sidanclaw `truncateFromMessageId` requires a session_messages UUID.
// Local synthetic ids (`u-…`/`a-…`) only show up between a fresh send and
// the post-send history rehydrate; gating retry on UUID format prevents
// the upstream from rejecting with `message_not_found`.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildProposalContext(action: GovernanceActionDetail): string {
  const description = (action.description || "").slice(0, MAX_CONTEXT_CHARS);
  const rationale = (action.rationale || "").slice(0, MAX_CONTEXT_CHARS);
  const lines = [
    "You are an assistant helping a user understand a Cardano governance proposal.",
    `Proposal Title: ${action.title || "(untitled)"}`,
    `Proposal ID: ${action.proposalId || action.hash || "(unknown)"}`,
    `Type: ${action.type || "(unknown)"}`,
    action.status ? `Status: ${action.status}` : "",
    description ? `Description:\n${description}` : "",
    rationale ? `Rationale:\n${rationale}` : "",
  ].filter(Boolean);
  return lines.join("\n\n");
}

const GENERIC_CONTEXT =
  "You are CGOV's customer-service assistant. Help users understand Cardano governance (CIP-1694), DReps, SPOs, the constitutional committee, treasury, and how to use the CGOV dashboard.";

export interface AIChatPanelProps {
  action?: GovernanceActionDetail;
  variant?: "card" | "embedded";
  heightClassName?: string;
  className?: string;
  hideHeader?: boolean;
}

export function AIChatPanel({
  action,
  variant = "card",
  heightClassName,
  className,
  hideHeader = false,
}: AIChatPanelProps) {
  const t = useTranslations("aiChat");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const { connected, wallet } = useWallet();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");

  const sessionScope = action?.proposalId || action?.hash || "global";
  const sessionIdRef = useRef<string>("");
  const hasSentContextRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const instanceIdRef = useRef<string>(
    `panel-${Math.random().toString(36).slice(2)}`,
  );

  const storageKey = walletAddress
    ? `cgov-ai-chat:${sessionScope}:${walletAddress}`
    : null;
  const pendingKey = storageKey ? `${storageKey}:pending` : null;

  const [pendingRetry, setPendingRetry] = useState<string | null>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);

  useEffect(() => {
    let cancelled = false;
    async function resolveAddress() {
      if (!connected || !wallet) {
        setWalletAddress("");
        return;
      }
      try {
        let addr = "";
        try {
          const reward = await wallet.getRewardAddresses();
          if (reward && reward.length > 0) addr = reward[0];
        } catch { /* fall through */ }
        if (!addr) {
          try {
            addr = await wallet.getChangeAddress();
          } catch { /* fall through */ }
        }
        if (!cancelled) setWalletAddress(addr || "");
      } catch {
        if (!cancelled) setWalletAddress("");
      }
    }
    resolveAddress();
    return () => {
      cancelled = true;
    };
  }, [connected, wallet]);

  useEffect(() => {
    setError(null);

    if (!walletAddress) {
      setMessages([]);
      sessionIdRef.current = "";
      hasSentContextRef.current = false;
      return;
    }

    sessionIdRef.current = `cgov-${sessionScope}-${walletAddress}`;

    if (typeof window === "undefined" || !storageKey) {
      setMessages([]);
      hasSentContextRef.current = false;
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setMessages([]);
        hasSentContextRef.current = false;
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setMessages(parsed as ChatMessage[]);
        hasSentContextRef.current = parsed.length > 0;
      } else {
        setMessages([]);
        hasSentContextRef.current = false;
      }
    } catch {
      setMessages([]);
      hasSentContextRef.current = false;
    }
  }, [sessionScope, walletAddress, storageKey]);

  // Self-healing rehydrate from upstream Sidanclaw via cgov-api. Provides
  // the authoritative server view: assigns upstream message UUIDs to local
  // bubbles (which is what the retry endpoint needs as
  // `truncateFromMessageId`) and recovers replies that were generated while
  // a previous tab was unmounted.
  //
  // `respectSendingFlag` defaults true on the mount-time hydrate (don't
  // trample in-flight optimistic state). After-send refreshes pass false:
  // the send has just resolved, and we want the upstream IDs immediately
  // so a follow-up retry click can target the correct row.
  const refreshHistory = useCallback(
    async (opts: { respectSendingFlag?: boolean } = {}) => {
      if (typeof window === "undefined") return;
      if (!walletAddress || !storageKey || !pendingKey) return;
      const respectSending = opts.respectSendingFlag !== false;

      try {
        const url =
          `/api/ai-chat/history?walletAddress=${encodeURIComponent(walletAddress)}` +
          `&scope=${encodeURIComponent(sessionScope)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || !Array.isArray(data.messages)) return;

        if (respectSending && isSendingRef.current) return;

        const projected: ChatMessage[] = (data.messages as Array<{
          id: string;
          role: string;
          content: string;
        }>)
          .filter(
            (m) =>
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.length > 0,
          )
          .map((m) => {
            if (m.role === "assistant") {
              const { content, followups, navigations } = parseAssistantTags(
                m.content,
              );
              return {
                id: m.id,
                role: "assistant" as const,
                content: content || m.content,
                followups: followups.length > 0 ? followups : undefined,
                navigations:
                  navigations.length > 0 ? navigations : undefined,
              };
            }
            return {
              id: m.id,
              role: "user" as const,
              content: m.content,
            };
          });

        // Resolve pending retry state. If the server's last message is an
        // assistant reply, the previous in-flight request actually
        // completed — clear the pending flag silently. Otherwise (last
        // message is from the user) surface a retry affordance using the
        // user's last text.
        const pendingRaw = window.localStorage.getItem(pendingKey);
        const last = projected[projected.length - 1];
        if (pendingRaw) {
          if (last && last.role === "assistant") {
            window.localStorage.removeItem(pendingKey);
            setPendingRetry(null);
          } else {
            const lastUser = [...projected].reverse().find(
              (m) => m.role === "user",
            );
            if (lastUser) setPendingRetry(lastUser.content);
          }
        }

        // If projected is non-empty, replace local. Otherwise leave the
        // existing localStorage state — server may not yet have anything
        // (e.g., POST never landed) and we shouldn't blank the UI.
        if (projected.length > 0) {
          setMessages(projected);
          hasSentContextRef.current = true;
        }
      } catch {
        /* network failure — keep local state, no banner shown */
      }
    },
    [walletAddress, storageKey, pendingKey, sessionScope],
  );

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    try {
      const trimmed = messages.slice(-50);
      window.localStorage.setItem(storageKey, JSON.stringify(trimmed));
      window.dispatchEvent(
        new CustomEvent<ChatUpdateDetail>(CHAT_UPDATE_EVENT, {
          detail: { key: storageKey, sourceId: instanceIdRef.current },
        }),
      );
    } catch {
      /* quota / private mode — silently skip persistence */
    }
  }, [messages, storageKey]);

  // Cross-instance sync: re-hydrate when another AIChatPanel (or another tab)
  // writes to the same storage key. Without this, the sticky widget and the
  // /ai page panel would diverge whenever one of them sent a message.
  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;

    const rehydrate = () => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          setMessages([]);
          hasSentContextRef.current = false;
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setMessages(parsed as ChatMessage[]);
          hasSentContextRef.current = parsed.length > 0;
        }
      } catch {
        /* ignore */
      }
    };

    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<ChatUpdateDetail>).detail;
      if (!detail) return;
      if (detail.key !== storageKey) return;
      if (detail.sourceId === instanceIdRef.current) return;
      rehydrate();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      rehydrate();
    };

    window.addEventListener(CHAT_UPDATE_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHAT_UPDATE_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [storageKey]);

  // Validate navigation chips against the backend and drop any whose target
  // 404s. Defends against the LLM hallucinating well-formed IDs (e.g. a
  // confabulated `drep1y…` bech32 or proposal txHash). Runs per-message and
  // tracks completion in a ref so we don't re-probe on every state update.
  const validatedMessageIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    const targets = messages.filter(
      (m) =>
        m.role === "assistant" &&
        m.navigations &&
        m.navigations.length > 0 &&
        !validatedMessageIdsRef.current.has(m.id),
    );
    if (targets.length === 0) return;

    targets.forEach((m) => validatedMessageIdsRef.current.add(m.id));

    targets.forEach(async (m) => {
      const filtered = await filterValidNavigations(m.navigations!);
      if (cancelled) return;
      if (filtered.length === m.navigations!.length) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === m.id
            ? {
                ...msg,
                navigations: filtered.length > 0 ? filtered : undefined,
              }
            : msg,
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const initialContext = useMemo(
    () => (action ? buildProposalContext(action) : GENERIC_CONTEXT),
    [action],
  );

  // Fires the actual fetch + handles the response. Does NOT append a user
  // message to state — the caller decides whether this is a fresh send
  // (which adds the user message first) or a retry (which leaves the
  // existing user message in place).
  //
  // `truncateFromMessageId` is the upstream Sidanclaw destroy-and-regenerate
  // hook: when set, the named row and everything after it are deleted
  // server-side before the new turn is appended, and the model gets a hint
  // to pick a different angle. UUID-only — synthetic local ids are skipped.
  const requestAssistantReply = async (
    text: string,
    userMessageId: string,
    options: { truncateFromMessageId?: string } = {},
  ) => {
    setIsSending(true);
    setError(null);
    setPendingRetry(null);

    if (typeof window !== "undefined" && pendingKey) {
      try {
        window.localStorage.setItem(
          pendingKey,
          JSON.stringify({
            userMessageId,
            sentAt: new Date().toISOString(),
            sessionId: sessionIdRef.current,
          }),
        );
      } catch {
        /* quota — skip the marker; retry banner just won't appear */
      }
    }

    const includeContext = !hasSentContextRef.current;

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: sessionIdRef.current,
          walletAddress,
          context: includeContext ? initialContext : undefined,
          ...(options.truncateFromMessageId
            ? { truncateFromMessageId: options.truncateFromMessageId }
            : {}),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          (data && data.error) || `Request failed (${res.status})`,
        );
      }

      hasSentContextRef.current = true;
      if (data?.sessionId) sessionIdRef.current = data.sessionId;

      const reply: string = (data?.reply || "").toString().trim();
      if (!reply) {
        throw new Error(t("emptyReply"));
      }

      const { content, followups, navigations } = parseAssistantTags(reply);

      setMessages((prev) => [
        ...prev,
        {
          id: data?.messageId || `a-${Date.now()}`,
          role: "assistant",
          content: content || reply,
          followups: followups.length > 0 ? followups : undefined,
          navigations: navigations.length > 0 ? navigations : undefined,
        },
      ]);

      // Pull the upstream UUIDs onto local user bubbles so a follow-up
      // retry click has a real `truncateFromMessageId` to send. Pass
      // respectSendingFlag:false because the in-flight guard would
      // otherwise bail (we've already setIsSending(false) below, but
      // leaving the flag truthy until then). We're past the optimistic
      // race — the assistant reply is already in state.
      void refreshHistory({ respectSendingFlag: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("unknownError");
      setError(msg);
    } finally {
      setIsSending(false);
      if (typeof window !== "undefined" && pendingKey) {
        try {
          window.localStorage.removeItem(pendingKey);
        } catch {
          /* ignore */
        }
      }
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    if (!connected || !walletAddress) {
      setError(t("walletRequired"));
      return;
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    await requestAssistantReply(trimmed, userMsg.id);
  };

  // Re-fire the last user message's request without duplicating the user
  // bubble. Triggered by the Retry button in the error banner — useful
  // for transient backend errors (5xx, network blips) that the user can
  // recover from with one click instead of retyping.
  const retryLastMessage = () => {
    if (isSending) return;
    if (!connected || !walletAddress) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    void requestAssistantReply(lastUser.content, lastUser.id);
  };

  // Retry from a specific user message: tells upstream Sidanclaw to delete
  // that row and every subsequent row before regenerating, via the public
  // API's `truncateFromMessageId`. Locally we drop the trailing assistant
  // reply (and any later turns) so the UI matches what the server is about
  // to do.
  //
  // Synthetic ids (`u-…`) — bubbles that haven't yet been reconciled with
  // the upstream history GET — can't be used: the server only accepts a
  // real session_messages UUID. Fetching history before retry would close
  // the gap, but in practice the rehydrate after each successful send
  // means the window is small.
  const retryFromMessage = (messageId: string) => {
    if (isSending) return;
    if (!connected || !walletAddress) return;
    if (!UUID_PATTERN.test(messageId)) return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    const target = messages[idx];
    if (target.role !== "user") return;

    setMessages((prev) => prev.slice(0, idx + 1));
    void requestAssistantReply(target.content, target.id, {
      truncateFromMessageId: target.id,
    });
  };

  const canRetry =
    !isSending &&
    !!walletAddress &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "user";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const cardClass = cn(
    "flex flex-col",
    variant === "card" && "p-4 sm:p-5",
    variant === "card" &&
      (isGame
        ? "game-detail-card"
        : "rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"),
    className,
  );

  const titleText = action ? t("title") : t("titleGlobal");
  const subtitleText = action ? t("subtitle") : t("subtitleGlobal");
  const emptyStateText = action ? t("emptyState") : t("emptyStateGlobal");
  const walletGateText = action ? t("walletGate") : t("walletGateGlobal");

  const poweredByLine = (
    <p
      className={cn(
        "flex items-center gap-1.5 text-2xs",
        isGame ? "text-white/40" : "text-muted-foreground/80",
      )}
    >
      <img
        src="/sidanclaw-icon.png"
        alt=""
        width={14}
        height={14}
        className="h-3.5 w-3.5 shrink-0"
        style={{ imageRendering: "pixelated" }}
      />
      <span>
        Chat powered by{" "}
        <a
          href="https://sidan.ai"
          target="_blank"
          rel="noreferrer"
          className={cn(
            "underline-offset-2 hover:underline",
            isGame ? "text-white/70" : "text-foreground/80 dark:text-[#0bd1a2]",
          )}
        >
          SidanClaw · sidan.ai
        </a>
      </span>
    </p>
  );

  const userBubbleClass = cn(
    "ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
    isGame
      ? "bg-white/15 text-white"
      : "bg-foreground text-background dark:rounded-none dark:bg-[#0bd1a2] dark:text-black",
  );

  const assistantBubbleClass = cn(
    "mr-auto max-w-[85%] rounded-2xl px-3 py-2 text-sm",
    isGame
      ? "bg-white/5 text-white/90 border border-white/10"
      : "bg-muted text-foreground dark:rounded-none dark:border dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2]",
  );

  const Wrapper = variant === "card" ? Card : "div";

  return (
    <Wrapper className={cardClass}>
      {!hideHeader && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className={cn("h-4 w-4", isGame ? "text-white" : "text-primary dark:text-[#0bd1a2]")} />
            <h3 className={cn("text-sm font-semibold sm:text-base", isGame && "text-white")}>
              {titleText}
            </h3>
          </div>
          <p className={cn("mb-4 text-xs sm:text-sm", isGame ? "text-white/70" : "text-muted-foreground")}>
            {subtitleText}
          </p>
        </>
      )}

      <div
        ref={scrollRef}
        className={cn(
          "mb-3 flex flex-col gap-2 overflow-y-auto rounded-md p-3",
          heightClassName ?? "min-h-[240px] max-h-[420px]",
          isGame
            ? "bg-black/30 border border-white/10"
            : "bg-muted/30 dark:bg-transparent dark:border dark:border-[#0bd1a2]/40 dark:rounded-none",
        )}
      >
        {messages.length === 0 && !isSending && !connected && (
          <div className="m-auto flex flex-col items-center gap-3 px-3 text-center">
            <Lock className={cn("h-8 w-8", isGame ? "text-white/70" : "text-muted-foreground")} />
            <p className={cn("max-w-sm text-xs sm:text-sm", isGame ? "text-white/70" : "text-muted-foreground")}>
              {walletGateText}
            </p>
            <ConnectWalletButton />
          </div>
        )}
        {messages.length === 0 && !isSending && connected && (
          <div className={cn("m-auto text-center text-xs sm:text-sm", isGame ? "text-white/60" : "text-muted-foreground")}>
            {emptyStateText}
          </div>
        )}
        {messages.map((m, idx) => {
          const isLast = idx === messages.length - 1;
          const showFollowups =
            isLast &&
            m.role === "assistant" &&
            !isSending &&
            m.followups &&
            m.followups.length > 0;
          const showNavigations =
            m.role === "assistant" &&
            m.navigations &&
            m.navigations.length > 0;
          return (
            <div key={m.id} className="flex flex-col gap-2">
              {m.role === "user" ? (
                <div className="ml-auto flex max-w-[85%] items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => retryFromMessage(m.id)}
                    disabled={
                      isSending || !walletAddress || !UUID_PATTERN.test(m.id)
                    }
                    aria-label={t("retry")}
                    title={t("retry")}
                    className={cn(
                      "shrink-0 rounded-full p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                      isGame
                        ? "text-white/60 hover:bg-white/10 hover:text-white"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground dark:text-[#0bd1a2]/70 dark:hover:bg-[#0bd1a2]/10 dark:hover:text-[#0bd1a2]",
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <div className={cn(userBubbleClass, "ml-0 max-w-none")}>
                    {m.content}
                  </div>
                </div>
              ) : (
                <div className={assistantBubbleClass}>
                  <MarkdownContent isGame={isGame} isAssistant>
                    {m.content}
                  </MarkdownContent>
                </div>
              )}
              {showNavigations && (
                <div className="mr-auto flex max-w-[85%] flex-wrap gap-1.5">
                  {m.navigations!.map((nav, i) => (
                    <Link
                      key={`${m.id}-n-${i}`}
                      href={toClientPath(nav.path)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-2xs font-medium transition-colors",
                        isGame
                          ? "border-white/40 bg-white/10 text-white hover:bg-white/20"
                          : "border-foreground/40 bg-background text-foreground hover:bg-muted dark:border-[#0bd1a2] dark:bg-[#0bd1a2]/10 dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2]/20 dark:rounded-none",
                      )}
                    >
                      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      <span>{nav.label}</span>
                    </Link>
                  ))}
                </div>
              )}
              {showFollowups && (
                <div className="mr-auto flex max-w-[85%] flex-wrap gap-1.5">
                  {m.followups!.map((f, i) => (
                    <button
                      key={`${m.id}-f-${i}`}
                      type="button"
                      onClick={() => sendMessage(f)}
                      disabled={isSending || !walletAddress}
                      className={cn(
                        "rounded-full border px-3 py-1 text-2xs transition-colors disabled:opacity-50",
                        isGame
                          ? "border-white/20 bg-white/5 text-white/80 hover:bg-white/10"
                          : "border-border bg-background text-foreground/80 hover:bg-muted dark:border-[#0bd1a2]/60 dark:bg-transparent dark:text-[#0bd1a2] dark:hover:bg-[#0bd1a2]/10 dark:rounded-none",
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {isSending && (
          <div className={cn("mr-auto flex items-center gap-2 text-xs", isGame ? "text-white/70" : "text-muted-foreground")}>
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("thinking")}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span className="flex-1">{error}</span>
          {canRetry && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={retryLastMessage}
              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {pendingRetry && !isSending && (
        <div
          className={cn(
            "mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-xs",
            isGame
              ? "border border-white/20 bg-white/5 text-white/80"
              : "border border-amber-300/60 bg-amber-50 text-amber-900 dark:border-[#0bd1a2]/40 dark:bg-transparent dark:text-[#0bd1a2]",
          )}
        >
          <span className="flex-1">
            Previous reply didn&apos;t come through.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const text = pendingRetry;
              setPendingRetry(null);
              if (typeof window !== "undefined" && pendingKey) {
                try {
                  window.localStorage.removeItem(pendingKey);
                } catch {
                  /* ignore */
                }
              }
              if (text) sendMessage(text);
            }}
            className={cn(
              "h-7 px-2 text-xs",
              isGame ? "text-white hover:bg-white/10" : "dark:text-[#0bd1a2]",
            )}
          >
            Retry
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-stretch gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          rows={2}
          maxLength={4000}
          disabled={isSending || !connected}
          className={cn(
            "min-h-[44px] resize-none text-sm",
            isGame && "bg-black/40 text-white placeholder:text-white/40 border-white/20",
          )}
        />
        <Button
          type="submit"
          disabled={isSending || !input.trim() || !walletAddress}
          className={cn(
            "h-auto shrink-0 self-stretch",
            isGame
              ? "game-nav-btn"
              : "bg-foreground text-background hover:bg-foreground/90 dark:bg-[#0bd1a2] dark:text-black dark:hover:bg-[#0bd1a2]/90",
          )}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">{t("send")}</span>
        </Button>
      </form>

      <p className={cn("mt-2 text-2xs", isGame ? "text-white/50" : "text-muted-foreground")}>
        {t("disclaimer")}
      </p>
      <div className="mt-1 flex justify-end">
        {poweredByLine}
      </div>
    </Wrapper>
  );
}
