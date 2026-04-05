import { useRouter } from "next/router";
import { useEffect, useState, type ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

function NomosWriteOut() {
  // Uses the exact original nomos.svg paths. Each letter gets its own clipPath
  // with a rect that wipes left-to-right, timed sequentially to look like writing.
  // Letter bounding boxes (x, width) and timing for the wipe:
  const letters: {
    id: string;
    x: number;
    w: number;
    delay: number;
    dur: number;
    paths: { d: string; fill: string }[];
  }[] = [
    {
      id: "dot",
      x: 24, w: 30,
      delay: 0, dur: 0.1,
      paths: [
        { d: "M39.981289,232.331696 C35.209637,232.331680 30.928352,232.331680 26.483917,232.331680 C26.483917,225.417587 26.483917,219.016220 26.483917,212.333633 C34.752609,212.333633 42.818199,212.333633 51.280975,212.333633 C51.280975,218.751770 51.280975,225.268356 51.280975,232.331711 C47.698372,232.331711 44.085014,232.331711 39.981289,232.331696z", fill: "current" },
      ],
    },
    {
      id: "n",
      x: 62, w: 56,
      delay: 0.1, dur: 0.18,
      paths: [
        { d: "M76.175735,198.017593 C75.763184,209.297958 75.763184,220.422668 75.763184,231.813095 C71.584351,231.813095 68.010727,231.813095 64.160294,231.813095 C64.160294,211.090576 64.160294,190.370407 64.160294,168.768356 C77.556259,182.556351 90.515770,195.895111 104.244659,210.025772 C104.244659,197.420593 104.244659,185.892471 104.244659,174.051178 C108.276299,174.051178 111.843536,174.051178 115.589111,174.051178 C115.589111,194.972473 115.589111,215.722198 115.589111,234.745224 C103.158691,222.989700 89.873489,210.425812 76.175735,198.017593z", fill: "current" },
      ],
    },
    {
      id: "o1",
      x: 118, w: 68,
      delay: 0.28, dur: 0.16,
      paths: [
        { d: "M184.398056,197.766296 C186.249954,211.453842 180.321945,223.328354 168.582306,230.029526 C157.477219,236.368484 142.779770,235.195938 132.529770,227.153305 C122.387627,219.195297 118.299599,206.627319 121.798759,194.162613 C125.450172,181.155548 139.260666,171.557526 153.782074,171.934830 C168.657028,172.321335 180.810440,182.433731 184.398056,197.766296z", fill: "current" },
        { d: "M163.798965,186.999603 C173.011520,194.081711 175.359528,203.434952 170.409729,212.139893 C165.363907,221.013672 154.692627,224.684616 144.890396,220.918610 C135.737366,217.402039 130.763000,207.926376 133.021225,198.309021 C136.019226,185.541138 150.869812,179.944839 163.798965,186.999603z", fill: "bg" },
      ],
    },
    {
      id: "m",
      x: 184, w: 73,
      delay: 0.44, dur: 0.2,
      paths: [
        { d: "M242.979034,230.311172 C240.595978,221.095291 238.270630,212.302505 235.574554,202.107941 C230.305145,214.472885 225.516403,225.709915 220.453903,237.589279 C215.425995,225.732010 210.620651,214.399597 205.285461,201.817673 C202.485031,212.540237 200.008316,222.023346 197.457092,231.791748 C193.753418,231.791748 189.992722,231.791748 186.037506,231.791748 C191.549179,210.754288 197.033707,189.820389 202.894073,167.452026 C208.944580,181.680618 214.518738,194.788986 220.466568,208.776138 C226.302780,194.895859 231.826859,181.757904 237.862762,167.402695 C243.664612,189.525970 249.180481,210.558762 254.981796,232.680008 C250.675034,231.978485 246.855881,231.356369 242.979034,230.311172z", fill: "current" },
      ],
    },
    {
      id: "o2",
      x: 254, w: 68,
      delay: 0.64, dur: 0.16,
      paths: [
        { d: "M256.101807,208.751495 C252.713821,185.286697 271.620422,171.973114 287.644592,171.919540 C304.110077,171.864487 317.984406,183.899597 319.852173,200.012482 C321.553619,214.690430 310.641296,229.865799 296.071564,233.083313 C278.987915,236.856003 262.594757,228.344498 257.361786,212.974564 C256.932587,211.713882 256.577087,210.428101 256.101807,208.751495z", fill: "current" },
        { d: "M268.036316,207.695557 C266.501953,198.278763 269.716553,190.988083 277.184906,186.440964 C283.978607,182.304581 293.625732,182.889542 300.216034,187.837463 C306.750397,192.743408 309.321381,200.244598 307.181030,208.158417 C305.318695,215.044128 298.535645,221.109772 291.718262,221.985764 C282.164093,223.213425 273.744873,219.322861 269.661774,211.741348 C269.035034,210.577606 268.607086,209.306808 268.036316,207.695557z", fill: "bg" },
      ],
    },
    {
      id: "s",
      x: 320, w: 46,
      delay: 0.8, dur: 0.18,
      paths: [
        { d: "M337.180786,203.839142 C325.032318,196.574554 322.399628,185.738327 330.480682,177.498596 C336.452637,171.409363 346.412872,170.032379 354.975128,174.635513 C358.186005,176.361725 360.805542,179.188004 364.101593,181.840179 C360.464447,184.760559 357.645508,187.023956 356.157410,188.218796 C351.076324,186.508377 347.136871,184.739746 343.015289,184.032013 C341.549103,183.780243 338.691711,185.816269 338.227722,187.342499 C337.841553,188.612839 339.628754,191.314438 341.149963,192.253128 C346.213776,195.377869 351.888092,197.561600 356.773773,200.914261 C362.936981,205.143661 364.998779,211.721512 363.818146,218.922333 C362.688202,225.813797 358.373749,230.660645 351.821014,232.977448 C339.340210,237.390121 325.769135,229.266296 322.929199,215.574615 C326.313110,214.632095 329.728882,213.680695 333.023621,212.763016 C335.019592,215.356354 336.532532,217.976181 338.655548,219.934647 C342.284454,223.282349 348.755341,222.848129 351.174225,219.482285 C353.655975,216.028976 351.885010,211.020782 346.997864,208.372849 C343.942383,206.717316 340.684326,205.435730 337.180786,203.839142z", fill: "current" },
      ],
    },
  ];

  // Cycle: write in (0–1s) + hold (1–1.4s) + fade out via CSS (1.4–1.7s) + gap (1.7–2s)
  const cycle = 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <style>{`
        @keyframes nomos-cycle {
          0% { opacity: 0; }
          3% { opacity: 1; }
          70% { opacity: 1; }
          85% { opacity: 0; }
          100% { opacity: 0; }
        }
      `}</style>
      <svg
        viewBox="20 160 350 85"
        fill="none"
        width="220"
        className="text-foreground dark:text-[#0bd1a2]"
        role="img"
        aria-label="Loading"
        style={{ animation: `nomos-cycle ${cycle}s ease-in-out infinite` }}
      >
        <defs>
          {letters.map(({ id, x, w, delay, dur }) => {
            // Convert letter timing to fraction of the full cycle
            const t0 = delay / cycle;
            const t1 = (delay + dur) / cycle;
            const hold = 0.7;   // hold until 70% of cycle
            const reset = 0.85; // reset at 85%

            return (
              <clipPath key={id} id={`clip-${id}`}>
                <rect x={x} y="160" width="0" height="85">
                  <animate
                    attributeName="width"
                    values={`0;0;${w};${w};0;0`}
                    keyTimes={`0;${t0.toFixed(3)};${t1.toFixed(3)};${hold};${reset};1`}
                    dur={`${cycle}s`}
                    repeatCount="indefinite"
                  />
                </rect>
              </clipPath>
            );
          })}
        </defs>
        {letters.map(({ id, paths }) => (
          <g key={id} clipPath={`url(#clip-${id})`}>
            {paths.map(({ d, fill }, j) => (
              <path
                key={j}
                d={d}
                fill={fill === "bg" ? undefined : "currentColor"}
                className={fill === "bg" ? "fill-background" : undefined}
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function PageTransition({ children }: PageTransitionProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"visible" | "fading-out" | "fading-in">("visible");
  const [displayContent, setDisplayContent] = useState(children);
  const [currentPath, setCurrentPath] = useState(router.asPath);
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const onStart = () => {
      setPhase("fading-out");
      setShowLoader(true);
    };

    const onComplete = () => {
      setShowLoader(false);
      window.scrollTo({ top: 0 });
    };

    // Show loader immediately on internal link clicks — before routeChangeStart fires,
    // which can be delayed while Next.js fetches the page JS bundle.
    const onLinkClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (
        !anchor ||
        !anchor.href ||
        anchor.target === "_blank" ||
        anchor.origin !== window.location.origin ||
        anchor.pathname === window.location.pathname ||
        e.metaKey || e.ctrlKey || e.shiftKey
      ) return;
      setPhase("fading-out");
      setShowLoader(true);
    };

    document.addEventListener("click", onLinkClick, true);
    router.events.on("routeChangeStart", onStart);
    router.events.on("routeChangeComplete", onComplete);
    router.events.on("routeChangeError", onComplete);
    return () => {
      document.removeEventListener("click", onLinkClick, true);
      router.events.off("routeChangeStart", onStart);
      router.events.off("routeChangeComplete", onComplete);
      router.events.off("routeChangeError", onComplete);
    };
  }, [router]);

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
    <>
      {showLoader && <NomosWriteOut />}
      <div
        style={{
          opacity: phase === "fading-out" ? 0.4 : phase === "fading-in" ? 0 : 1,
          filter: phase === "fading-out" ? "blur(1px)" : "none",
          transform:
            phase === "fading-out"
              ? "translateY(-4px)"
              : phase === "fading-in"
                ? "translateY(4px)"
                : "translateY(0)",
          transition:
            phase === "fading-in"
              ? "none"
              : "opacity 150ms ease-out, filter 150ms ease-out, transform 150ms ease-out",
          pointerEvents: phase === "fading-out" ? "none" : "auto",
        }}
      >
        {displayContent}
      </div>
    </>
  );
}
