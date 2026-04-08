import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";

export function PageLoadingBar() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const start = () => {
      setLoading(true);
      setVisible(true);
      setProgress(0);
      // Fast initial burst, then slow crawl
      let p = 0;
      timer.current = setInterval(() => {
        p += (90 - p) * 0.08;
        setProgress(p);
      }, 80);
    };

    const done = () => {
      clearInterval(timer.current);
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          setLoading(false);
          setProgress(0);
        }, 200);
      }, 150);
    };

    router.events.on("routeChangeStart", start);
    router.events.on("routeChangeComplete", done);
    router.events.on("routeChangeError", done);

    return () => {
      clearInterval(timer.current);
      router.events.off("routeChangeStart", start);
      router.events.off("routeChangeComplete", done);
      router.events.off("routeChangeError", done);
    };
  }, [router]);

  if (!loading) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease-out" }}
    >
      <div
        className="h-full bg-foreground/80 rounded-r-full"
        style={{
          width: `${progress}%`,
          transition: progress === 0 ? "none" : "width 200ms ease-out",
        }}
      />
    </div>
  );
}
