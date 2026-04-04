import { useRouter } from "next/router";
import { useEffect, useState, type ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"visible" | "fading-out" | "fading-in">("visible");
  const [displayContent, setDisplayContent] = useState(children);
  const [currentPath, setCurrentPath] = useState(router.asPath);

  useEffect(() => {
    const onStart = () => {
      setPhase("fading-out");
    };

    const onComplete = () => {
      window.scrollTo({ top: 0 });
    };

    router.events.on("routeChangeStart", onStart);
    router.events.on("routeChangeComplete", onComplete);
    return () => {
      router.events.off("routeChangeStart", onStart);
      router.events.off("routeChangeComplete", onComplete);
    };
  }, [router]);

  // When children (page content) changes, update the displayed content
  useEffect(() => {
    if (router.asPath !== currentPath) {
      setDisplayContent(children);
      setCurrentPath(router.asPath);
      setPhase("fading-in");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhase("visible");
        });
      });
    } else {
      setDisplayContent(children);
    }
  }, [children, router.asPath, currentPath]);

  return (
    <div
      style={{
        opacity: phase === "fading-out" ? 0 : phase === "fading-in" ? 0 : 1,
        transform:
          phase === "fading-out"
            ? "translateY(-4px)"
            : phase === "fading-in"
              ? "translateY(4px)"
              : "translateY(0)",
        transition:
          phase === "fading-in"
            ? "none"
            : "opacity 120ms ease-out, transform 120ms ease-out",
      }}
    >
      {displayContent}
    </div>
  );
}
