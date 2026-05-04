/**
 * Parser for structured tags the assistant emits inside its reply text.
 *
 * Today: `<followup>` and `<navigate>`. Both are stripped from the rendered
 * content and surfaced as separate chip groups in the chat UI. The model's
 * contract for emitting these is documented in
 * cgov-kb/projects/cgov/system-prompt.md.
 */

export interface NavigationSuggestion {
  label: string;
  path: string;
}

export interface ParsedAssistantReply {
  content: string;
  followups: string[];
  navigations: NavigationSuggestion[];
}

const FOLLOWUP_TAG = /<followup>([\s\S]*?)<\/followup>/i;
const NAVIGATE_TAG = /<navigate>([\s\S]*?)<\/navigate>/i;
const FOLLOWUP_TAG_GLOBAL = /<followup>[\s\S]*?<\/followup>/gi;
const NAVIGATE_TAG_GLOBAL = /<navigate>[\s\S]*?<\/navigate>/gi;

const LOCALE_PREFIXES = ["en", "de", "fr", "es", "pt", "ja", "zh"];

/**
 * Whitelist of internal CGOV path prefixes the assistant is allowed to
 * suggest as a clickable navigation chip. Prevents hallucinated routes
 * from being promoted to a prominent UI affordance — they'll just be
 * dropped silently from the parsed result.
 *
 * Mirrors the route surface in cgov-kb/projects/cgov/navigation.md. Keep
 * the two in sync if you add a new top-level page.
 */
const ALLOWED_PATH_PREFIXES = [
  "/governance",
  "/adadev",
  "/drep",
  "/treasury",
  "/ai",
];

const NAV_LIMIT = 3;
const FOLLOWUP_LIMIT = 3;

function stripLocalePrefix(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length > 0 && LOCALE_PREFIXES.includes(segments[0])) {
    return "/" + segments.slice(1).join("/");
  }
  return path;
}

function isValidCgovPath(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const path = raw.trim();
  if (path.length === 0) return false;
  // External URLs disallowed for chip navigation — even if the host
  // happens to be cgov.io. The chip uses next/link client-side nav,
  // which only works with same-origin paths.
  if (path.includes("://")) return false;
  if (!path.startsWith("/")) return false;
  const stripped = stripLocalePrefix(path);
  if (stripped === "/") return true;
  return ALLOWED_PATH_PREFIXES.some(
    (prefix) => stripped === prefix || stripped.startsWith(prefix + "/"),
  );
}

function parseFollowupBlock(inner: string): string[] {
  const trimmed = inner.trim();
  let candidates: string[] = [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      candidates = parsed.filter(
        (v): v is string => typeof v === "string",
      );
    }
  } catch {
    // Lenient fallback for malformed JSON: split on lines/commas, strip
    // leading bullet markers and surrounding quotes. Followups are low
    // stakes — a stray entry is fine.
    candidates = trimmed
      .split(/\n|,/)
      .map((s) => s.replace(/^["'\s\-*]+|["'\s]+$/g, ""));
  }
  return candidates
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, FOLLOWUP_LIMIT);
}

function parseNavigateBlock(inner: string): NavigationSuggestion[] {
  const trimmed = inner.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Strict — navigation chips are a high-stakes UI affordance, so we
    // refuse to guess at malformed JSON. Better no chips than wrong ones.
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const result: NavigationSuggestion[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const { label, path } = entry as { label?: unknown; path?: unknown };
    if (typeof label !== "string") continue;
    const cleanLabel = label.trim();
    if (cleanLabel.length === 0) continue;
    if (!isValidCgovPath(path)) continue;
    result.push({ label: cleanLabel, path: (path as string).trim() });
    if (result.length >= NAV_LIMIT) break;
  }
  return result;
}

/**
 * Parse a raw assistant reply, extracting `<followup>` and `<navigate>`
 * tag contents and stripping them from the displayed content.
 *
 * Resilient to absent tags (returns empty arrays) and to malformed tag
 * bodies (returns empty array for that tag, keeps content clean).
 */
export function parseAssistantTags(raw: string): ParsedAssistantReply {
  const followupMatch = raw.match(FOLLOWUP_TAG);
  const navigateMatch = raw.match(NAVIGATE_TAG);

  const followups = followupMatch ? parseFollowupBlock(followupMatch[1]) : [];
  const navigations = navigateMatch
    ? parseNavigateBlock(navigateMatch[1])
    : [];

  const content = raw
    .replace(FOLLOWUP_TAG_GLOBAL, "")
    .replace(NAVIGATE_TAG_GLOBAL, "")
    .trim();

  return { content, followups, navigations };
}

/**
 * Strip the locale prefix from a path so it can be passed to next/link
 * without causing Next.js i18n to double-prefix. Exported so the chip
 * renderer can use the same logic as the markdown internal-link handler.
 */
export function toClientPath(path: string): string {
  return stripLocalePrefix(path);
}
