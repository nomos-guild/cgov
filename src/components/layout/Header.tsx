import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Globe, Github } from "lucide-react";
import { useTheme } from "@/lib/theme";

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
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

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className={
                isGame
                  ? "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center bg-white transition-colors hover:bg-[#0bd1a2]"
                  : "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center bg-white transition-colors hover:bg-black"
              }
              aria-label="Proposals"
              title="Proposals"
            />
            <Link
              href="/dashboard"
              className={
                isGame
                  ? "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white transition-colors hover:bg-[#0bd1a2]"
                  : "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white transition-colors hover:bg-black"
              }
              aria-label="Dashboard"
              title="Dashboard"
            />
          </nav>

          <div className="flex items-center gap-2 sm:gap-6">
            <ThemeToggle />
            <div className="flex items-center gap-1.5 sm:gap-3">
              <a
                href="https://nomos.cgov.io/"
                target="_blank"
                rel="noopener noreferrer"
                className={
                  isGame
                    ? "game-nav-btn"
                    : "flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] btn-neon"
                }
                aria-label="Website"
              >
                <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </a>
              <a
                href="https://github.com/nomos-guild"
                target="_blank"
                rel="noopener noreferrer"
                className={
                  isGame
                    ? "game-nav-btn"
                    : "flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] btn-neon"
                }
                aria-label="GitHub"
              >
                <Github className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </a>
              <a
                href="https://x.com/Nomos_guild"
                target="_blank"
                rel="noopener noreferrer"
                className={
                  isGame
                    ? "game-nav-btn"
                    : "flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] btn-neon"
                }
                aria-label="X (Twitter)"
              >
                <XIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
