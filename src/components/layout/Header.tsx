import Link from "next/link";
import { ConnectWalletButton } from "@/components/wallet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Globe, Github, Twitter } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-black dark:text-[#0bd1a2]">
              CGOV
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <ThemeToggle />
            <div className="flex items-center gap-3">
              <a
                href="https://nomos.cgov.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] btn-neon"
                aria-label="Website"
              >
                <Globe className="h-4 w-4" />
              </a>
              <a
                href="https://github.com/nomos-guild"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] btn-neon"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://x.com/Nomos_guild"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] btn-neon"
                aria-label="X (Twitter)"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
            <ConnectWalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}
