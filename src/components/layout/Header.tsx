import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type ComponentType } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

function LazyWalletButton() {
  const [WalletBtn, setWalletBtn] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(window.crypto && window.crypto.subtle)) return;
    import("@/components/wallet/ConnectWalletButton")
      .then((mod) => setWalletBtn(() => mod.ConnectWalletButton))
      .catch(() => {});
  }, []);

  if (!WalletBtn) return null;
  return <WalletBtn />;
}

function DefaultBrand() {
  return (
    <span className="text-xl font-bold text-black dark:text-[#0bd1a2]">
      CGOV
    </span>
  );
}

const NAV_LINKS = [
  { href: "/", label: "Proposals" },
  { href: "/drep", label: "DReps" },
  // { href: "/adadev", label: "AdaDev" },
] as const;

export function Header() {
  const { components, activeTheme } = useTheme();
  const router = useRouter();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light";
  const Brand = components?.HeaderBrand ?? DefaultBrand;

  return (
    <>
    <header
      className={cn(
        isGame
          ? "border-b border-transparent game-detail-card !rounded-none"
          : "border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Brand />
          </Link>

          <div className="flex items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSelector />
            </div>
            <LazyWalletButton />
          </div>
        </div>
      </div>

    </header>

      {/* Navigation bar */}
      <div className={cn(
        "mt-2",
        isGame
          ? "game-detail-card !rounded-none border-b border-transparent"
          : "border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}>
        <div className="container mx-auto px-3 sm:px-4">
          <nav className="flex items-center gap-2 py-2">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = href === "/"
                ? router.pathname === "/"
                : router.pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    isGame
                      ? cn(
                          "game-nav-btn !h-7 !min-h-[28px] !px-3 !text-xs",
                          isActive && "!bg-white/10"
                        )
                      : cn(
                          "h-10 px-4 text-sm font-medium transition-colors border inline-flex items-center btn-neon",
                          isLight ? "rounded-md" : "rounded-none",
                          isActive
                            ? isLight
                              ? "bg-black text-white border-black shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
                              : "bg-[#0bd1a2] text-black border-[#0bd1a2]"
                            : isLight
                              ? "bg-background/80 text-foreground border-input shadow-soft hover:bg-black hover:text-white"
                              : "bg-transparent text-[#0bd1a2]/60 border-[#0bd1a2]/20 hover:text-[#0bd1a2] hover:border-[#0bd1a2]/50"
                        )
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
