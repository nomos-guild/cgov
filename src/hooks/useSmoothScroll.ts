import { useEffect } from "react";

const LERP_FACTOR = 0.04;
const EPSILON = 0.3;

interface ElementScroll {
  target: number;
  current: number;
  rafId: number | null;
}

export function useSmoothScroll() {
  useEffect(() => {
    // Window scroll state
    let winTarget = window.scrollY;
    let winCurrent = window.scrollY;
    let winRaf: number | null = null;

    // Per-element scroll state
    const elMap = new WeakMap<Element, ElementScroll>();

    function animateWindow() {
      winCurrent += (winTarget - winCurrent) * LERP_FACTOR;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      winTarget = Math.max(0, Math.min(winTarget, max));

      if (Math.abs(winTarget - winCurrent) < EPSILON) {
        winCurrent = winTarget;
        window.scrollTo(0, winCurrent);
        winRaf = null;
        return;
      }
      window.scrollTo(0, winCurrent);
      winRaf = requestAnimationFrame(animateWindow);
    }

    function animateElement(el: Element) {
      const s = elMap.get(el);
      if (!s) return;

      s.current += (s.target - s.current) * LERP_FACTOR;
      const max = el.scrollHeight - el.clientHeight;
      s.target = Math.max(0, Math.min(s.target, max));

      if (Math.abs(s.target - s.current) < EPSILON) {
        s.current = s.target;
        el.scrollTop = s.current;
        s.rafId = null;
        return;
      }
      el.scrollTop = s.current;
      s.rafId = requestAnimationFrame(() => animateElement(el));
    }

    function findScrollable(target: HTMLElement | null): HTMLElement | null {
      let el = target;
      while (el && el !== document.documentElement) {
        const { overflowY } = getComputedStyle(el);
        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight
        ) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    }

    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      // If any dialog/modal is open, only allow scrolling inside it — never the page
      const dialogOpen = !!document.querySelector("[role='dialog']");

      const delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      const scrollable = findScrollable(e.target as HTMLElement);

      // Inner scrollable element
      if (scrollable) {
        const atTop = scrollable.scrollTop <= 0 && delta < 0;
        const atBottom =
          scrollable.scrollTop + scrollable.clientHeight >=
            scrollable.scrollHeight - 1 && delta > 0;

        if (!atTop && !atBottom) {
          e.preventDefault();
          let s = elMap.get(scrollable);
          if (!s) {
            s = { target: scrollable.scrollTop, current: scrollable.scrollTop, rafId: null };
            elMap.set(scrollable, s);
          }
          if (!s.rafId) {
            s.current = scrollable.scrollTop;
            s.target = scrollable.scrollTop;
          }
          s.target += delta;
          if (!s.rafId) {
            s.rafId = requestAnimationFrame(() => animateElement(scrollable));
          }
          return;
        }
      }

      // Dialog is open — block window scroll entirely
      if (dialogOpen) {
        e.preventDefault();
        return;
      }

      // Window scroll
      e.preventDefault();
      if (!winRaf) {
        winCurrent = window.scrollY;
        winTarget = window.scrollY;
      }
      winTarget += delta;
      if (!winRaf) {
        winRaf = requestAnimationFrame(animateWindow);
      }
    }

    function onScroll() {
      if (!winRaf) {
        winCurrent = window.scrollY;
        winTarget = window.scrollY;
      }
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      if (winRaf) cancelAnimationFrame(winRaf);
    };
  }, []);
}
