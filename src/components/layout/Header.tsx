import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type ComponentType } from "react";
import { ChevronDown } from "lucide-react";
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
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header
      className={cn(
        "relative",
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

      {/* Centered expand toggle at bottom edge */}
      <button
        onClick={() => setNavOpen((v) => !v)}
        aria-label="Toggle navigation"
        aria-expanded={navOpen}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 -bottom-3 z-10",
          "flex items-center justify-center w-6 h-6 rounded-full",
          "transition-colors duration-200",
          isGame
            ? "bg-[#1a1a1a] border border-white/20 text-white/60 hover:text-white hover:border-white/40"
            : isLight
              ? "bg-background border border-border text-muted-foreground hover:text-foreground"
              : "bg-background border border-border text-[#0bd1a2]/60 hover:text-[#0bd1a2]"
        )}
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            navOpen && "rotate-180"
          )}
        />
      </button>

      {/* Expandable nav row */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          navOpen ? "max-h-14 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className={cn(
          "container mx-auto px-3 sm:px-4",
          isGame
            ? "border-t border-white/10"
            : "border-t border-border/50"
        )}>
          <nav className="flex items-center gap-2 h-10">
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
                          "px-3 py-1 text-sm font-medium transition-colors border",
                          isLight ? "rounded-full" : "rounded-none",
                          isActive
                            ? isLight
                              ? "bg-foreground text-background border-foreground"
                              : "bg-[#0bd1a2] text-black border-[#0bd1a2]"
                            : isLight
                              ? "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/50"
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
    </header>
  );
}
