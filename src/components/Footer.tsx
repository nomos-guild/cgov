import { useTranslations } from "next-intl";
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

export function Footer() {
  const t = useTranslations("footer");
  const tA = useTranslations("accessibility");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  return (
    <footer className="border-t border-border glass mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">CGOV</h3>
            <p className="text-sm text-muted-foreground">
              {t("builtBy")}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://nomos.cgov.io/"
              target="_blank"
              rel="noopener noreferrer"
              className={
                isGame
                  ? "game-nav-btn"
                  : "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
              }
              aria-label={tA("website")}
            >
              <Globe className="h-4 w-4" />
            </a>
            <a
              href="https://github.com/nomos-guild"
              target="_blank"
              rel="noopener noreferrer"
              className={
                isGame
                  ? "game-nav-btn"
                  : "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
              }
              aria-label={tA("github")}
            >
              <Github className="h-4 w-4" />
            </a>
            <a
              href="https://x.com/Nomos_guild"
              target="_blank"
              rel="noopener noreferrer"
              className={
                isGame
                  ? "game-nav-btn"
                  : "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
              }
              aria-label={tA("twitter")}
            >
              <XIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
