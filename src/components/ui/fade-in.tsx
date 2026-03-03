import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FadeInProps {
  children: ReactNode;
  /** Delay before animation starts (ms) */
  delay?: number;
  /** Animation duration (ms) */
  duration?: number;
  /** Slide direction */
  direction?: "up" | "down" | "left" | "right";
  /** Slide distance in pixels */
  distance?: number;
  /** If provided, animation triggers when this becomes true. Otherwise uses IntersectionObserver. */
  show?: boolean;
  className?: string;
}

const directionMap = {
  up: (d: number) => `translateY(${d}px)`,
  down: (d: number) => `translateY(-${d}px)`,
  left: (d: number) => `translateX(${d}px)`,
  right: (d: number) => `translateX(-${d}px)`,
};

// Track routes where entrance animations have already played.
// Survives React tree remounts (e.g. from MeshProvider loading)
// so animations don't replay on the same page.
const animatedRoutes = new Set<string>();

export function FadeIn({
  children,
  delay = 0,
  duration = 500,
  direction = "up",
  distance = 20,
  show,
  className,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const route = typeof window !== "undefined" ? window.location.pathname : "";
  const alreadyAnimated = show === undefined && animatedRoutes.has(route);
  const [visible, setVisible] = useState(alreadyAnimated);

  // IntersectionObserver mode (when `show` is not provided)
  useEffect(() => {
    if (show !== undefined || alreadyAnimated) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animatedRoutes.add(route);
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [show, alreadyAnimated, route]);

  // Controlled mode (when `show` is provided)
  useEffect(() => {
    if (show !== undefined) {
      setVisible(show);
    }
  }, [show]);

  const isVisible = show !== undefined ? visible && show : visible;

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translate(0, 0)" : directionMap[direction](distance),
        transition: alreadyAnimated
          ? undefined
          : `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms ease-out ${delay}ms`,
        willChange: isVisible ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
