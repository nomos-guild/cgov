import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Globe, Github } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

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

interface NavLinkProps {
  href: string;
  children: string;
  isGame: boolean;
}

function NavLink({ href, children, isGame }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "text-sm font-medium transition-colors",
        isGame
          ? cn(
              "text-[#0bd1a2]/70 hover:text-[#0bd1a2]",
              isActive && "text-[#0bd1a2]"
            )
          : cn(
              "text-muted-foreground hover:text-foreground",
              isActive && "text-foreground"
            )
      )}
    >
      {children}
    </Link>
  );
}

export function Header() {
  const t = useTranslations("accessibility");
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

          {/* Navigation */}
          <nav className="hidden sm:flex items-center gap-6">
            <NavLink href="/" isGame={isGame}>Governance</NavLink>
            <NavLink href="/dashboard" isGame={isGame}>Dashboard</NavLink>
            <NavLink href="/drep" isGame={isGame}>DReps</NavLink>
          </nav>

          <div className="flex items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSelector />
            </div>
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
                aria-label={t("website")}
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
                aria-label={t("github")}
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
                aria-label={t("twitter")}
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
