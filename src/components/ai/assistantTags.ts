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
  if (
    !ALLOWED_PATH_PREFIXES.some(
      (prefix) => stripped === prefix || stripped.startsWith(prefix + "/"),
    )
  ) {
    return false;
  }
  return hasPlausibleEntityId(stripped);
}

/**
 * Reject deep-link chips whose ID can't possibly be real. Catches the
 * common LLM placeholder patterns — wrong-length txHashes, bech32 IDs
 * containing characters outside the bech32 alphabet, "deadbeef…"-style
 * filler — without waiting on a backend probe. A `true` here just means
 * "shape is plausible"; the async `validateNavigationPath` still runs to
 * confirm the ID actually resolves.
 */
function hasPlausibleEntityId(strippedPath: string): boolean {
  const path = strippedPath.split(/[?#]/)[0];

  const drepMatch = path.match(/^\/drep\/([^/]+)$/);
  if (drepMatch) return isPlausibleDrepId(drepMatch[1]);

  const govMatch = path.match(/^\/governance\/([^/]+)$/);
  if (govMatch) return isPlausibleProposalId(govMatch[1]);

  return true;
}

// Bech32 data-part alphabet (RFC) — note `b`, `i`, `o`, `1` are excluded.
// We accept both DRep ID conventions:
//   - CIP-129 — 29-byte payload, always `drep1y…` (key) or `drep1u…` (script).
//   - CIP-105 — 28-byte raw key hash, any bech32 char after `drep1`.
// LLMs (and some older tooling) still produce CIP-105; the cgov-api
// `normalizeDrepIdToCip129` server-side handles the rewrite, so we just
// need to let the chip survive the client gate. Real IDs run ~52–60
// chars after the `drep1` separator; the wider band stays
// forward-compatible.
const BECH32_DREP_RE = /^drep1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{40,90}$/;

function isPlausibleDrepId(id: string): boolean {
  return BECH32_DREP_RE.test(id);
}

// Proposal route accepts a 64-char hex txHash, optionally suffixed with
// `:N` or `#N` (the cert index). Anything else — including the LLM's
// favourite trick of repeating `b9b9b9…` to pad to a plausible-looking
// length — is rejected.
const PROPOSAL_HASH_RE = /^[0-9a-f]{64}([:#][0-9]+)?$/i;

function isPlausibleProposalId(id: string): boolean {
  return PROPOSAL_HASH_RE.test(id);
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

/**
 * Module-level cache so repeated chip validations across messages and
 * panel instances share the same probe result. Keyed by API probe URL
 * so multiple chip paths that resolve to the same backend resource
 * (e.g. detail vs. detail?voter=…) only spend one round trip.
 */
const navValidationCache = new Map<string, Promise<boolean>>();

/**
 * Map a chip path to the API URL we should probe to confirm the target
 * exists. Returns null for paths that don't carry a deep-linked ID
 * (landing pages, treasury entity slugs that resolve client-side, etc.) —
 * those are treated as always-valid by the caller.
 */
function probeUrlForPath(path: string): string | null {
  const stripped = stripLocalePrefix(path).split(/[?#]/)[0];

  const drepMatch = stripped.match(/^\/drep\/([^/]+)$/);
  if (drepMatch) {
    const id = decodeURIComponent(drepMatch[1]);
    return `/api/dreps/${encodeURIComponent(id)}`;
  }

  const govMatch = stripped.match(/^\/governance\/([^/]+)$/);
  if (govMatch) {
    const id = decodeURIComponent(govMatch[1]);
    return `/api/proposal/${encodeURIComponent(id)}`;
  }

  return null;
}

/**
 * Probe the backend to confirm a chip's target actually exists. Resolves
 * `false` on any 4xx — covers 404 (id not found) and 400/422 (id is the
 * wrong shape, e.g. a hallucinated 72-char "txHash" or a bech32 with the
 * wrong checksum). 5xx and network errors fail open so a flaky backend
 * doesn't blank chips the user could otherwise click and retry.
 *
 * Used to defend against hallucinated `/drep/{id}` and `/governance/{id}`
 * IDs from the LLM, which can be either well-formed-but-nonexistent or
 * malformed-but-plausible-looking.
 */
export function validateNavigationPath(path: string): Promise<boolean> {
  const probeUrl = probeUrlForPath(path);
  if (!probeUrl) return Promise.resolve(true);

  const cached = navValidationCache.get(probeUrl);
  if (cached) return cached;

  const promise = fetch(probeUrl, { method: "GET" })
    .then((res) => !(res.status >= 400 && res.status < 500))
    .catch(() => true);
  navValidationCache.set(probeUrl, promise);
  return promise;
}

/**
 * Filter a list of navigation suggestions, dropping any whose target
 * 404s. Order is preserved so the assistant's intended priority survives.
 */
export async function filterValidNavigations(
  navs: NavigationSuggestion[],
): Promise<NavigationSuggestion[]> {
  if (navs.length === 0) return navs;
  const verdicts = await Promise.all(
    navs.map((nav) => validateNavigationPath(nav.path)),
  );
  return navs.filter((_, i) => verdicts[i]);
}
