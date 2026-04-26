import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type ComponentType } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Wallet } from "lucide-react";

type WalletButtonState = "loading" | "ready" | "error";

function LazyWalletButton() {
  const [WalletBtn, setWalletBtn] = useState<ComponentType | null>(null);
  const [state, setState] = useState<WalletButtonState>("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;

    import("@/components/wallet/ConnectWalletButton")
      .then((mod) => {
        setWalletBtn(() => mod.ConnectWalletButton);
        setState("ready");
      })
      .catch((error) => {
        console.warn("Wallet button failed to initialize:", error);
        setState("error");
      });
  }, []);

  if (!WalletBtn) {
    return (
      <Button
        variant="outline"
        disabled
        title={
          state === "error"
            ? "Wallet UI could not be initialized in this browser session."
            : "Loading wallet UI"
        }
        className="flex items-center gap-2 rounded-none"
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">
          {state === "error" ? "Wallet unavailable" : "Loading..."}
        </span>
      </Button>
    );
  }

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
  { href: "/treasury", label: "Treasury" },
  // { href: "/adadev", label: "AdaDev" },
] as const;

export function Header() {
  const { components, activeTheme } = useTheme();
  const router = useRouter();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light";
  const Brand = components?.HeaderBrand ?? DefaultBrand;

  return (
    <header
      className={cn(
        "sticky top-0 z-10",
        isGame
          ? "border-b border-transparent game-detail-card !rounded-none"
          : "border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-4">
          {/* Left: brand + desktop nav */}
          <div className="flex items-center gap-1 sm:gap-6">
            <Link href="/" className="flex items-center space-x-2 shrink-0">
              <Brand />
            </Link>

            <nav className="hidden sm:flex items-center gap-1">
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
                            "relative px-3 py-1.5 text-sm font-medium transition-all duration-200 inline-flex items-center",
                            isActive
                              ? isLight
                                ? "text-foreground after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/5 after:h-[2px] after:bg-foreground after:rounded-full"
                                : "text-[#0bd1a2] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/5 after:h-[2px] after:bg-[#0bd1a2] after:rounded-full"
                              : isLight
                                ? "text-muted-foreground hover:text-foreground active:text-foreground/70"
                                : "text-[#0bd1a2]/50 hover:text-[#0bd1a2] active:text-[#0bd1a2]/70"
                          )
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSelector />
            </div>
            <LazyWalletButton />
          </div>
        </div>

        {/* Mobile nav row */}
        <nav className="flex sm:hidden items-center gap-1 pb-2 -mt-1">
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
                        "relative px-3 py-1.5 text-sm font-medium transition-all duration-200 inline-flex items-center",
                        isActive
                          ? isLight
                            ? "text-foreground after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/5 after:h-[2px] after:bg-foreground after:rounded-full"
                            : "text-[#0bd1a2] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/5 after:h-[2px] after:bg-[#0bd1a2] after:rounded-full"
                          : isLight
                            ? "text-muted-foreground hover:text-foreground active:text-foreground/70"
                            : "text-[#0bd1a2]/50 hover:text-[#0bd1a2] active:text-[#0bd1a2]/70"
                      )
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
