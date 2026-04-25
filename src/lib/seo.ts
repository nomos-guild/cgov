/**
 * SEO helpers — canonical URL building and locale-aware hreflang alternates.
 *
 * Site URL is sourced from NEXT_PUBLIC_SITE_URL (set per deployment).
 * The fallback matches the reference URL in src/lib/treasuryEntities.ts.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://app.cgov.io"
).replace(/\/$/, "");

export const SUPPORTED_LOCALES = [
  "en",
  "de",
  "fr",
  "es",
  "pt",
  "ja",
  "zh",
] as const;

export const DEFAULT_LOCALE = "en";

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Build a fully-qualified URL for a given path and locale, matching how
 * Next.js i18n routes pages: default locale gets no prefix, other locales
 * are prefixed with /<locale>.
 */
export function buildLocaleUrl(path: string, locale: string): string {
  const cleanPath = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) {
    return `${SITE_URL}${cleanPath || "/"}`;
  }
  return `${SITE_URL}/${locale}${cleanPath || "/"}`;
}

/**
 * Strip query strings and hash fragments from a path. Canonical URLs
 * should not include user-specific query params.
 */
export function stripPath(path: string): string {
  const qIdx = path.indexOf("?");
  const hIdx = path.indexOf("#");
  let end = path.length;
  if (qIdx !== -1) end = Math.min(end, qIdx);
  if (hIdx !== -1) end = Math.min(end, hIdx);
  return path.slice(0, end);
}
