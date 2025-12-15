import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export function Navbar() {
  const router = useRouter();
  const isGovernancePage = router.pathname.startsWith("/governance/");

  const navItems: Array<{ href: string; label: string }> = [];

  return (
    <nav className="border-b border-border bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
            <span className="text-xl sm:text-2xl font-bold text-foreground">
              CGOV
            </span>
          </Link>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {isGovernancePage && (
              <Link
                href="/"
                className="rounded-2xl border border-white/8 bg-[#faf9f6] px-3 sm:px-4 py-2 text-sm font-medium transition-all whitespace-nowrap shadow-[0_12px_30px_rgba(15,23,42,0.25)] hover:shadow-[0_16px_40px_rgba(15,23,42,0.35)] flex items-center gap-2 text-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Proposals</span>
                <span className="sm:hidden">Back</span>
              </Link>
            )}
            {navItems.map((item) => {
              const isActive = router.pathname === item.href || 
                (item.href !== "/" && router.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-foreground/60 hover:text-foreground hover:bg-foreground/10"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

