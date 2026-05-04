import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

const CGOV_MCP_REPO_URL = "https://github.com/nomos-guild/cgov-mcp";
const SIDANCLAW_URL = "https://sidan.ai";

const CGOV_MCP_URL = "https://cgov-mcp-589811450826.asia-south1.run.app/mcp";

const HTTP_CONFIG = `{
  "mcpServers": {
    "cgov-mcp": {
      "type": "http",
      "url": "${CGOV_MCP_URL}"
    }
  }
}`;

const TOOLS = [
  "query_database",
  "list_tables",
  "describe_table",
  "search_constitution",
  "search_vision_2030",
  "get_vision_kpis",
  "search_voting_rationale",
  "get_drep_voting_history",
  "get_proposal_rationales",
  "get_rationale_stats",
];

function CodeBlock({ code, isGame }: { code: string; isGame: boolean }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="relative">
      <pre
        className={cn(
          "overflow-x-auto rounded-md p-3 text-xs leading-relaxed sm:text-2xs",
          isGame
            ? "bg-black/40 text-white/90 border border-white/10"
            : "bg-muted text-foreground dark:border dark:border-[#0bd1a2]/40 dark:bg-transparent dark:text-[#0bd1a2] dark:rounded-none",
        )}
      >
        <code className="whitespace-pre font-mono">{code}</code>
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onCopy}
        aria-label="Copy to clipboard"
        className={cn(
          "absolute right-1.5 top-1.5 h-7 w-7",
          isGame ? "text-white hover:bg-white/10" : "dark:text-[#0bd1a2]",
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function AboutCGOVAI() {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  const cardClass = cn(
    "min-w-0 overflow-hidden p-4 sm:p-6",
    isGame
      ? "game-detail-card"
      : "rounded-2xl border border-border bg-card shadow-elevation-2 dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none",
  );

  const linkClass = cn(
    "inline-flex items-center gap-1 underline-offset-2 hover:underline",
    isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]",
  );

  const headingClass = cn(
    "text-base font-semibold sm:text-lg",
    isGame && "text-white",
  );

  const subHeadingClass = cn(
    "text-sm font-semibold",
    isGame ? "text-white/90" : "dark:text-[#0bd1a2]",
  );

  const bodyClass = cn(
    "text-sm leading-relaxed break-words",
    isGame ? "text-white/80" : "text-muted-foreground",
  );

  return (
    <Card className={cardClass}>
      <h2 className={headingClass}>How this works</h2>
      <p className={cn(bodyClass, "mt-2")}>
        <strong className={cn(isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]")}>
          Ask CGOV AI
        </strong>{" "}
        is a live demo of{" "}
        <a href={CGOV_MCP_REPO_URL} target="_blank" rel="noreferrer" className={linkClass}>
          cgov-mcp
          <ExternalLink className="h-3 w-3" />
        </a>{" "}
        — a Model Context Protocol server for Cardano governance data — consumed
        through a{" "}
        <a href={SIDANCLAW_URL} target="_blank" rel="noreferrer" className={linkClass}>
          SidanClaw
          <ExternalLink className="h-3 w-3" />
        </a>{" "}
        assistant. Each message you send is routed to the assistant, which calls
        cgov-mcp tools to query on-chain governance state and composes a reply.
      </p>

      <h3 className={cn(subHeadingClass, "mt-6")}>Connect cgov-mcp to your own MCP client</h3>
      <p className={cn(bodyClass, "mt-2")}>
        cgov-mcp speaks the standard Model Context Protocol, so you can plug
        the hosted server into Claude Desktop, Claude Code, Cursor, or any
        MCP-capable client. Add the snippet below to your client&apos;s
        <code className={cn("mx-1 rounded px-1 py-0.5 font-mono text-xs", isGame ? "bg-black/40 text-white" : "bg-muted text-foreground dark:bg-black/30 dark:text-[#0bd1a2]")}>mcpServers</code>
        configuration.
      </p>

      <div className="mt-3">
        <CodeBlock code={HTTP_CONFIG} isGame={isGame} />
      </div>

      <h3 className={cn(subHeadingClass, "mt-6")}>Available tools</h3>
      <p className={cn(bodyClass, "mt-2")}>
        Once connected, your client can call any of these tools:
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {TOOLS.map((name) => (
          <code
            key={name}
            className={cn(
              "max-w-full break-all rounded-full border px-2.5 py-1 font-mono text-xs sm:text-2xs",
              isGame
                ? "border-white/20 bg-white/5 text-white/80"
                : "border-border bg-background text-foreground/80 dark:border-[#0bd1a2]/60 dark:bg-transparent dark:text-[#0bd1a2] dark:rounded-none",
            )}
          >
            {name}
          </code>
        ))}
      </div>
      <p className={cn(bodyClass, "mt-3 text-xs sm:text-xs")}>
        Full list and usage examples in the{" "}
        <a href={CGOV_MCP_REPO_URL} target="_blank" rel="noreferrer" className={linkClass}>
          cgov-mcp README
          <ExternalLink className="h-3 w-3" />
        </a>
        .
      </p>
    </Card>
  );
}
