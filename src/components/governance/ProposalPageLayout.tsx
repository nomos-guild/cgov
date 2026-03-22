import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/ui/fade-in";

const NAV_TABS = [
  { href: "/", label: "tabAllProposals" },
  { href: "/analytics", label: "tabAnalytics" },
] as const;

interface ProposalPageLayoutProps {
  children: ReactNode;
}

export default function ProposalPageLayout({ children }: ProposalPageLayoutProps) {
  const t = useTranslations("landing");
  const router = useRouter();
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light" || activeTheme.id === "neural";

  // Hide tab nav until multiple tabs are ready (e.g. /analytics)
  const showNav = false;

  return (
    <FadeIn delay={260} duration={500} distance={24}>
      {showNav && (
        <div className={
          isLight
            ? "rounded-2xl border border-white/8 bg-[#faf9f6] px-4 sm:px-6 pt-3 pb-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] mb-4 overflow-visible"
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
                          "game-tab-btn text-[10px] sm:text-xs",
                          isActive && "game-tab-btn-active"
                        )
                      : cn(
                          "rounded-full border border-white/8 bg-white text-black px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide transform-gpu transition-transform transition-shadow duration-450 ease-in-out shadow-[0_12px_30px_rgba(15,23,42,0.25)] hover:scale-[1.015] hover:shadow-[0_18px_46px_rgba(15,23,42,0.32)] dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon",
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
      )}

      {/* Page content */}
      {children}
    </FadeIn>
  );
}
