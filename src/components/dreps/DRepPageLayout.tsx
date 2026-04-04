import { useMemo, type ReactNode } from "react";
import { Info } from "lucide-react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import { useDRepStats, useAllDReps } from "@/hooks/useDRepData";
import type { DRepStatsApiResponse } from "@/hooks/useDRepData";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/ui/fade-in";
import type { DRepSummary } from "@/types/drep";

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

const NAV_TABS = [
  { href: "/drep", label: "tabDRepList" },
  { href: "/drep/charts", label: "tabDRep" },
  { href: "/drep/picker", label: "tabDRepPicker" },
] as const;

interface DRepPageLayoutProps {
  initialDrepStats: DRepStatsApiResponse | null;
  initialDreps?: DRepSummary[];
  children: ReactNode;
}

export default function DRepPageLayout({
  initialDrepStats,
  initialDreps,
  children,
}: DRepPageLayoutProps) {
  const t = useTranslations("drep");
  const router = useRouter();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";

  const { stats, isLoading } = useDRepStats(initialDrepStats ?? undefined);
  const { dreps } = useAllDReps({}, initialDreps);

  const totalDelegators = useMemo(
    () => dreps.reduce((sum, d) => sum + (d.delegatorCount ?? 0), 0),
    [dreps]
  );

  const activeDRepCount = useMemo(
    () => dreps.filter((d) => d.votingPowerAda > 0 && d.totalVotesCast > 0).length,
    [dreps]
  );

  const showLoadingSpinner = isLoading && !stats;

  return (
    <>
      <Head>
        <title>{t("pageTitle")}</title>
        <meta name="description" content={t("pageDescription")} />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 pt-8 pb-28 sm:px-4 sm:pt-10 sm:pb-36 md:px-6 md:pt-12 md:pb-44">
          {/* Header */}
          <FadeIn delay={0} duration={400} distance={12} routeKey="/drep">
            <div className="mb-6 sm:mb-8 md:mb-10 text-left">
              <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black dark:text-foreground">
                {t("title")}
              </h1>
            </div>
          </FadeIn>

          {/* Loading state */}
          {showLoadingSpinner && (
            isGame ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 md:py-24">
                <GameLoader />
              </div>
            ) : (
              <Card className="p-6 sm:p-8 md:p-12 mb-4 sm:mb-6">
                <div className="flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-b-2 border-primary mb-3 sm:mb-4"></div>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    {t("loadingData")}
                  </p>
                </div>
              </Card>
            )
          )}

          {/* Content */}
          {!showLoadingSpinner && (
            <>
              {/* Stats Cards */}
              <FadeIn delay={120} duration={500} distance={18} routeKey="/drep">
                <div className={cn(
                  "grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6",
                  isGame && "game-drep-stats"
                )}>
                  {([
                    { label: t("totalDReps"), value: dreps.length ? formatNumber(activeDRepCount) : "--", tooltip: t("activeDRepsTooltip") },
                    { label: t("totalDelegators"), value: dreps.length ? formatNumber(totalDelegators) : "--" },
                    { label: t("totalDelegatedAda"), value: stats ? `${formatCompactNumber(stats.totalDelegatedAda)} ADA` : "--" },
                    { label: t("totalVotesCast"), value: stats ? formatNumber(stats.totalVotesCast) : "--" },
                  ] as { label: string; value: string; tooltip?: string }[]).map(({ label, value, tooltip }) => (
                    <div
                      key={label}
                      className={
                        isLight
                          ? "rounded-2xl border border-border/40 bg-card p-4 shadow-elevation-2"
                          : isGame
                          ? "rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.35)]"
                          : "rounded-none border border-[#0bd1a2] bg-transparent p-4 shadow-none"
                      }
                    >
                      <p className={`text-sm ${isGame ? "text-white/70" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]"}`}>
                        {label}
                        {tooltip && (
                          <span className="relative ml-1 inline-block align-middle group">
                            <Info className={cn("inline h-3.5 w-3.5 cursor-help", isGame ? "text-white/50" : isLight ? "text-muted-foreground" : "text-[#0bd1a2]/60")} />
                            <span className={cn(
                              "pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 rounded px-2.5 py-1.5 text-xs font-normal leading-snug opacity-0 transition-opacity group-hover:opacity-100 z-50",
                              isGame ? "bg-black/90 text-white border border-white/20" : isLight ? "bg-foreground text-background shadow-lg" : "bg-black text-[#0bd1a2] border border-[#0bd1a2]"
                            )}>
                              {tooltip}
                            </span>
                          </span>
                        )}
                      </p>
                      <p className={`text-2xl font-bold ${isGame ? "text-white" : isLight ? "" : "text-[#0bd1a2]"}`}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </FadeIn>

              {/* Tab-style navigation */}
              <FadeIn delay={260} duration={500} distance={24} routeKey="/drep">
                <div className={
                  isLight
                    ? "rounded-2xl border border-border/40 bg-card px-4 sm:px-6 pt-3 pb-4 shadow-elevation-2 mb-4 overflow-visible"
                    : isGame
                    ? "game-drep-content rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] px-4 sm:px-6 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)] mb-4"
                    : "rounded-none border border-[#0bd1a2] bg-transparent px-4 sm:px-6 py-3 shadow-none mb-4"
                }>
                  <nav className="flex flex-wrap items-center justify-start gap-1.5 sm:gap-2 overflow-visible">
                    {NAV_TABS.map(({ href, label }) => {
                      const isActive = router.pathname === href;

                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            isGame
                              ? cn(
                                  "game-tab-btn text-2xs sm:text-xs",
                                  isActive && "game-tab-btn-active"
                                )
                              : cn(
                                  "rounded-full border border-border/40 bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-2xs sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-normal ease-in-out shadow-elevation-2 hover:scale-101 hover:shadow-elevation-3 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon",
                                  isActive && "bg-black text-white dark:bg-[#0bd1a2] dark:text-black"
                                )
                          )}
                        >
                          {t(label)}
                        </Link>
                      );
                    })}
                  </nav>
                </div>

                {/* Page content */}
                {children}
              </FadeIn>
            </>
          )}
        </div>
      </div>
    </>
  );
}
