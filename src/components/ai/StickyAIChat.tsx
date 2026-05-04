import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { MessageCircle, Maximize2, Minimize2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIChatPanel } from "@/components/ai/AIChatPanel";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

/**
 * Single-instance AI chat — same React component renders as a sticky
 * popover on most pages and morphs into the on-page chat on /ai.
 *
 * Architecture: AIChatPanel is mounted exactly once, inside a permanent
 * body-level host, via createPortal. Its DOM home never changes — the
 * React tree position is fixed. We *visually* relocate it by changing
 * inline `position: fixed; top/left/width/height` to mirror either:
 *
 *   - the popover anchor (bottom-right of viewport), or
 *   - the on-page slot's bounding rect (when on /ai).
 *
 * Both modes use the same set of CSS properties so a single CSS
 * transition handles the smooth movement between them. Because the
 * React subtree is stable, in-flight requests, scroll position, and
 * (eventually) SSE streams survive navigation untouched.
 */

const CHAT_SLOT_ID = "cgov-ai-chat-slot";
const AI_PATH = "/ai";

const POPOVER_MARGIN_DESKTOP = 24; // sm:bottom-6 / sm:right-6
const POPOVER_MARGIN_MOBILE = 16; // bottom-4 / right-4
const POPOVER_W_OPEN = 448; // ~ max-w-md
const POPOVER_W_EXPANDED = 768; // ~ max-w-3xl
const POPOVER_H_OPEN_PX = 560;
const POPOVER_H_EXPANDED_PX = 800;

type ChatState = "closed" | "open" | "expanded";

interface Coords {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function StickyAIChat() {
  const router = useRouter();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const [state, setState] = useState<ChatState>("closed");

  const isAIPage =
    router.pathname === AI_PATH || router.pathname.startsWith(`${AI_PATH}/`);

  const [popoverHost, setPopoverHost] = useState<HTMLElement | null>(null);
  const [slotRect, setSlotRect] = useState<DOMRect | null>(null);
  const [popoverCoords, setPopoverCoords] = useState<Coords | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // The panel is portaled to document.body so it escapes the page-level
  // PageTransition fade-out wrapper. Without listening to router events,
  // the panel would stay at full opacity covering the destination page
  // for the ~150ms transition. router.pathname only updates when the
  // new page mounts (not on routeChangeStart), so we can't detect "we're
  // leaving" from pathname alone — we have to subscribe to the events.
  useEffect(() => {
    const onStart = () => setIsNavigating(true);
    const onSettle = () => setIsNavigating(false);
    router.events.on("routeChangeStart", onStart);
    router.events.on("routeChangeComplete", onSettle);
    router.events.on("routeChangeError", onSettle);
    return () => {
      router.events.off("routeChangeStart", onStart);
      router.events.off("routeChangeComplete", onSettle);
      router.events.off("routeChangeError", onSettle);
    };
  }, [router]);

  // Permanent body-level host. The portal target NEVER changes — that's
  // what keeps AIChatPanel's React identity (and any in-flight fetch)
  // stable across route navigation.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const host = document.createElement("div");
    host.dataset.cgovAiHost = "1";
    document.body.appendChild(host);
    setPopoverHost(host);
    return () => {
      host.remove();
    };
  }, []);

  // Track the on-page slot's bounding rect when on /ai. Updates on
  // scroll, resize, and any size change (ResizeObserver) so the panel
  // tracks the slot — including when the slot is `lg:sticky`.
  useEffect(() => {
    if (!isAIPage) {
      setSlotRect(null);
      return;
    }
    if (typeof window === "undefined") return;

    let cancelled = false;
    let raf = 0;
    let resizeObs: ResizeObserver | null = null;
    let observed: HTMLElement | null = null;

    const measure = () => {
      if (cancelled) return;
      const slot = document.getElementById(CHAT_SLOT_ID);
      if (!slot) {
        raf = window.requestAnimationFrame(measure);
        return;
      }
      const rect = slot.getBoundingClientRect();
      setSlotRect((prev) => {
        if (
          prev &&
          Math.abs(prev.top - rect.top) < 0.5 &&
          Math.abs(prev.left - rect.left) < 0.5 &&
          Math.abs(prev.width - rect.width) < 0.5 &&
          Math.abs(prev.height - rect.height) < 0.5
        ) {
          return prev;
        }
        return rect;
      });
      if (observed !== slot) {
        resizeObs?.disconnect();
        resizeObs = new ResizeObserver(() => {
          if (cancelled) return;
          setSlotRect(slot.getBoundingClientRect());
        });
        resizeObs.observe(slot);
        observed = slot;
      }
    };

    measure();

    const onWindowChange = () => {
      if (cancelled) return;
      const slot = document.getElementById(CHAT_SLOT_ID);
      if (slot) setSlotRect(slot.getBoundingClientRect());
    };
    window.addEventListener("scroll", onWindowChange, { passive: true });
    window.addEventListener("resize", onWindowChange);

    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      resizeObs?.disconnect();
      window.removeEventListener("scroll", onWindowChange);
      window.removeEventListener("resize", onWindowChange);
    };
  }, [isAIPage, router.pathname]);

  // Compute the popover anchor (bottom-right) in absolute pixel coords
  // so it shares the same property set as embed mode → CSS transitions
  // smoothly between them.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const margin = w >= 640 ? POPOVER_MARGIN_DESKTOP : POPOVER_MARGIN_MOBILE;

      const isExpanded = state === "expanded";
      const targetW = isExpanded ? POPOVER_W_EXPANDED : POPOVER_W_OPEN;
      const width = Math.min(targetW, w - margin * 2);
      const heightCap = isExpanded ? POPOVER_H_EXPANDED_PX : POPOVER_H_OPEN_PX;
      const heightPct = isExpanded ? 0.85 : 0.7;
      const height = Math.min(heightCap, h * heightPct);

      setPopoverCoords({
        top: h - height - margin,
        left: w - width - margin,
        width,
        height,
      });
    };

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [state]);

  // Three modes during navigation:
  //   - embed:           on /ai, settled, panel mirrors the on-page slot.
  //   - fadingOutEmbed:  on /ai, navigation just started — keep coords
  //                      pinned to the slot but fade opacity to 0 quickly.
  //                      This lets the panel exit gracefully instead of
  //                      hovering over the destination page during the
  //                      PageTransition fade-out (which can't dim the
  //                      portal-rendered panel from outside).
  //   - popover:         everywhere else, including mobile /ai (the slot
  //                      is `hidden lg:block`, so its rect collapses to
  //                      0×0 and we fall back to the regular FAB/popover
  //                      behaviour seen on every other page).
  const slotIsVisible =
    slotRect !== null && slotRect.width > 0 && slotRect.height > 0;
  const wasOnAIPage = isAIPage && slotIsVisible;
  const useEmbedMode = wasOnAIPage && !isNavigating;
  const isFadingOutEmbed = isNavigating && wasOnAIPage;
  const isOpen = state !== "closed";
  const isExpanded = state === "expanded";

  // When the navigation settles to a different page, the coords swap
  // from slot → popover at the same instant the panel becomes visible
  // again (state="open" case). We don't want a 300ms slide across the
  // viewport in that moment — snap once for that single render.
  const wasNavigatingRef = useRef(isNavigating);
  const skipTransition =
    wasNavigatingRef.current && !isNavigating && !useEmbedMode;
  useEffect(() => {
    wasNavigatingRef.current = isNavigating;
  });

  // Coords pick:
  //  - embed or fading-out-from-embed → slot coords (panel stays put
  //    while opacity transitions to 0)
  //  - everywhere else → popover bottom-right.
  const coords: Coords | null =
    (useEmbedMode || isFadingOutEmbed) && slotRect
      ? {
          top: slotRect.top,
          left: slotRect.left,
          width: slotRect.width,
          height: slotRect.height,
        }
      : popoverCoords;

  // Visibility — invisible during the embed-fade-out so it doesn't block
  // the destination page's load/transition animation.
  const visible = isFadingOutEmbed ? false : useEmbedMode || isOpen;

  if (!popoverHost) return null;

  return createPortal(
    <>
      <PanelWrapper
        coords={coords}
        visible={visible}
        useEmbedMode={useEmbedMode}
        isExpanded={isExpanded}
        isGame={isGame}
        skipTransition={skipTransition}
        isFadingOutEmbed={isFadingOutEmbed}
        onMinimize={() => setState("closed")}
        onToggleExpand={() => setState(isExpanded ? "open" : "expanded")}
      >
        <AIChatPanel
          variant="embedded"
          hideHeader
          heightClassName="flex-1 min-h-0"
          className="flex h-full flex-col"
        />
      </PanelWrapper>
      {!useEmbedMode && (
        <FabButton
          isOpen={isOpen}
          isGame={isGame}
          onClick={() => setState("open")}
        />
      )}
    </>,
    popoverHost,
  );
}

interface PanelWrapperProps {
  coords: Coords | null;
  visible: boolean;
  useEmbedMode: boolean;
  isExpanded: boolean;
  isGame: boolean;
  skipTransition: boolean;
  isFadingOutEmbed: boolean;
  onMinimize: () => void;
  onToggleExpand: () => void;
  children: React.ReactNode;
}

function PanelWrapper({
  coords,
  visible,
  useEmbedMode,
  isExpanded,
  isGame,
  skipTransition,
  isFadingOutEmbed,
  onMinimize,
  onToggleExpand,
  children,
}: PanelWrapperProps) {
  // Inline style is the source of truth for position+size in BOTH modes.
  // CSS transition on top/left/width/height interpolates between them.
  const style: React.CSSProperties = coords
    ? {
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        height: `${coords.height}px`,
      }
    : { display: "none" };

  return (
    <div
      aria-hidden={!visible || undefined}
      style={style}
      className={cn(
        "z-40",
        skipTransition
          ? "transition-none"
          : isFadingOutEmbed
            ? // Quick opacity-only fade out so the panel disappears
              // before the destination page's loader / fade-in starts.
              "transition-opacity duration-150 ease-out"
            : "transition-[top,left,width,height,opacity,transform] duration-300 ease-out",
        visible
          ? "pointer-events-auto opacity-100 scale-100"
          : "pointer-events-none opacity-0 scale-95",
      )}
    >
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-hidden",
          isGame
            ? cn("game-detail-card", !useEmbedMode && "!rounded-none")
            : useEmbedMode
              ? "rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
              : "rounded-2xl border border-border bg-card shadow-elevation-4 dark:rounded-none dark:border-[#0bd1a2] dark:bg-background",
        )}
      >
        {/* Popover-only header bar. Conditional render keeps {children}
            (the AIChatPanel) at the same JSX position across mode flips
            so its React state survives. */}
        {!useEmbedMode && (
          <div
            className={cn(
              "flex items-center justify-between border-b px-4 py-2",
              isGame
                ? "border-white/10 text-white"
                : "border-border dark:border-[#0bd1a2]/40 dark:text-[#0bd1a2]",
            )}
          >
            <span className="text-sm font-semibold">CGOV AI</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={isExpanded ? "Shrink chat" : "Expand chat"}
                onClick={onToggleExpand}
                tabIndex={visible ? 0 : -1}
                className={cn(
                  "h-7 w-7 transition-colors",
                  isGame ? "text-white hover:bg-white/10" : "dark:text-[#0bd1a2]",
                )}
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Minimize chat"
                onClick={onMinimize}
                tabIndex={visible ? 0 : -1}
                className={cn(
                  "h-7 w-7 transition-colors",
                  isGame ? "text-white hover:bg-white/10" : "dark:text-[#0bd1a2]",
                )}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        <div
          className={cn(
            "flex flex-1 flex-col overflow-hidden",
            useEmbedMode ? "p-4 sm:p-5" : "p-3",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

interface FabButtonProps {
  isOpen: boolean;
  isGame: boolean;
  onClick: () => void;
}

function FabButton({ isOpen, isGame, onClick }: FabButtonProps) {
  return (
    <div
      aria-hidden={isOpen}
      className={cn(
        "fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6",
        "transition-[opacity,transform] duration-200 ease-out",
        isOpen
          ? "pointer-events-none scale-90 opacity-0"
          : "pointer-events-auto scale-100 opacity-100",
      )}
    >
      <div className="relative">
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full",
            !isOpen && "cgov-fab-halo",
            isGame ? "bg-white/40" : "bg-foreground/40 dark:bg-[#0bd1a2]/50",
          )}
        />
        <Button
          type="button"
          aria-label="Open AI chat — ask about Cardano governance"
          onClick={onClick}
          tabIndex={isOpen ? -1 : 0}
          className={cn(
            "relative h-12 w-12 rounded-full p-0 shadow-elevation-3 sm:h-14 sm:w-14",
            !isOpen && "cgov-fab-breath",
            isGame
              ? "game-nav-btn !rounded-full"
              : "bg-foreground text-background hover:bg-foreground/90 dark:bg-[#0bd1a2] dark:text-black dark:hover:bg-[#0bd1a2]/90",
          )}
        >
          <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      </div>
    </div>
  );
}
