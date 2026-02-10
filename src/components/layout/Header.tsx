import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTheme } from "@/lib/theme";

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

export function Header() {
  const { components, activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const Brand = components?.HeaderBrand ?? DefaultBrand;

  return (
    <header
      className={
        isGame
          ? "border-b border-transparent bg-transparent backdrop-blur-none supports-[backdrop-filter]:bg-transparent"
          : "border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      }
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
  );
}
