import { useRouter } from "next/router";
import { useCallback } from "react";
import type { MouseEvent } from "react";

type RowLinkHandlers = {
  onClick: (e: MouseEvent<HTMLElement>) => void;
  onAuxClick: (e: MouseEvent<HTMLElement>) => void;
};

/**
 * Factory hook for "linkable rows" — table rows or list items that act as
 * a link to a destination URL. Returns a function that, given a target
 * `href`, produces the matching `onClick` + `onAuxClick` handlers.
 *
 * Why a factory: the handlers depend on a runtime `href` that varies per
 * row, but `useRouter` can't be called inside a `.map()` body. The
 * factory captures the router once and yields per-row handler bundles.
 *
 * Behavior:
 * - Plain click → `router.push(href)`
 * - Ctrl/Cmd/Shift + click → `window.open(href, "_blank")`
 * - Middle-click → `window.open(href, "_blank")`
 * - Click on a real `<a>` inside the row → defers to the browser
 *   (avoids double-firing navigation)
 *
 * For native right-click "Open in new tab" support the row content must
 * include at least one real `<a>` (e.g. a `next/link` wrapping the title).
 * Browsers only surface that menu item on actual anchor elements.
 */
export function useRowLink() {
  const router = useRouter();

  return useCallback(
    (href: string): RowLinkHandlers => ({
      onClick: (e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        router.push(href);
      },
      onAuxClick: (e) => {
        if (e.button !== 1) return;
        if ((e.target as HTMLElement).closest("a")) return;
        e.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
      },
    }),
    [router]
  );
}
