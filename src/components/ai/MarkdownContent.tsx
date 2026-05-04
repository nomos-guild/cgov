import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const LOCALE_PREFIXES = ["en", "de", "fr", "es", "pt", "ja", "zh"];

function isInternalPath(href: string | undefined): boolean {
  if (!href) return false;
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try {
    const url = new URL(href);
    if (typeof window !== "undefined" && url.host === window.location.host) {
      return true;
    }
  } catch {
    /* not an absolute URL */
  }
  return false;
}

function toLocalPath(href: string): string {
  try {
    const url = new URL(href);
    return url.pathname + url.search + url.hash;
  } catch {
    return href;
  }
}

function stripLocalePrefix(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length > 0 && LOCALE_PREFIXES.includes(segments[0])) {
    return "/" + segments.slice(1).join("/");
  }
  return path;
}

export function MarkdownContent({
  children,
  isGame,
  isAssistant,
}: {
  children: string;
  isGame: boolean;
  isAssistant: boolean;
}) {
  const linkColor = isGame
    ? "text-white underline"
    : isAssistant
      ? "underline dark:text-[#0bd1a2]"
      : "underline";

  const codeInlineClass = cn(
    "rounded px-1 py-0.5 font-mono text-[0.85em]",
    isGame
      ? "bg-black/40 text-white"
      : isAssistant
        ? "bg-background/60 text-foreground dark:bg-black/30 dark:text-[#0bd1a2]"
        : "bg-background/20 text-background",
  );

  const codeBlockClass = cn(
    "overflow-x-auto rounded-md p-2 text-2xs leading-relaxed font-mono",
    isGame
      ? "bg-black/50 text-white border border-white/10"
      : isAssistant
        ? "bg-background/60 text-foreground dark:bg-black/30 dark:text-[#0bd1a2] dark:border dark:border-[#0bd1a2]/30"
        : "bg-background/20 text-background",
  );

  return (
    <div className="prose prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          h1: ({ children }) => <h1 className="mt-3 mb-1 text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-3 mb-1 text-sm font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-semibold">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-2 mb-1 text-sm font-semibold">{children}</h4>,
          a: ({ children, href }) => {
            const internal = isInternalPath(href);
            if (internal && href) {
              const localPath = stripLocalePrefix(toLocalPath(href));
              return (
                <Link
                  href={localPath}
                  className={cn(
                    "inline-flex items-baseline gap-0.5 underline-offset-2 hover:opacity-80",
                    linkColor,
                  )}
                >
                  {children}
                  <ArrowUpRight className="h-3 w-3 self-center" aria-hidden="true" />
                </Link>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex items-baseline gap-0.5 underline-offset-2 hover:opacity-80",
                  linkColor,
                )}
              >
                {children}
                <ExternalLink className="h-3 w-3 self-center" aria-hidden="true" />
              </a>
            );
          },
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote
              className={cn(
                "my-2 border-l-2 pl-3 italic",
                isGame ? "border-white/30 text-white/80" : "border-border text-foreground/80",
              )}
            >
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...rest }) => {
            const isBlock = (rest as { node?: { tagName?: string } }).node?.tagName === "code"
              && /language-/.test(className ?? "");
            if (isBlock) {
              return (
                <code className={cn(className, "block")}>
                  {children}
                </code>
              );
            }
            return (
              <code className={codeInlineClass}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className={cn("my-2", codeBlockClass)}>{children}</pre>,
          hr: () => (
            <hr
              className={cn(
                "my-3 border-t",
                isGame ? "border-white/20" : "border-border dark:border-[#0bd1a2]/30",
              )}
            />
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th
              className={cn(
                "border px-2 py-1 text-left font-semibold",
                isGame ? "border-white/20" : "border-border dark:border-[#0bd1a2]/40",
              )}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className={cn(
                "border px-2 py-1",
                isGame ? "border-white/10" : "border-border dark:border-[#0bd1a2]/30",
              )}
            >
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
