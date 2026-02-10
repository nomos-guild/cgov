# Localized Export Files

**Date:** 2026-02-04
**Branch:** frontend-v2

## Summary

Added full i18n support to the voting data export feature (MD, CSV, JSON) on proposal detail pages. Previously, exported files were always in English regardless of the user's selected language. Now both structural labels (headings, column headers, vote values) and rationale content are translated to the user's chosen language.

## What Was Done

1. **Created `ExportLabels` interface** in `exportRationales.ts` with 21 typed label keys, keeping export functions pure and framework-agnostic
2. **Updated all three export functions** (`exportToMarkdown`, `exportToCSV`, `exportToJSON`) to accept localized labels and a locale parameter
3. **Added locale-aware formatting** — Markdown export uses `toLocaleString(locale)` for dates and numbers
4. **Added UTF-8 BOM to CSV** — prepending `\uFEFF` ensures Excel correctly handles non-ASCII characters (CJK, umlauts)
5. **Added `"export"` namespace** to all 7 locale files (en, de, fr, es, pt, ja, zh) with 21 translation keys each
6. **Added `translateVotesForExport()`** — async batch translator that translates rationale content via the existing DeepL `/api/translate` endpoint before export
7. **Made `handleExport` async** with `isExporting` loading state shown as "Translating..." in the download dropdown
8. **Vote values translated** in MD and CSV exports (Yes/No/Abstain mapped to locale equivalents), kept as English constants in JSON for machine readability

## Key Learnings

### Two-tier translation approach for exports
Static labels (headings, headers) use `next-intl` translation files while dynamic content (rationale text) requires runtime translation via DeepL API. These are fundamentally different concerns and should be handled separately.

### Pure utility functions need a labels pattern
Export functions in `lib/` can't use React hooks like `useTranslations()`. The solution is a typed `ExportLabels` interface that the React component populates and passes in. This keeps utilities testable and framework-agnostic.

### JSON export keys should stay English
JSON is a data interchange format — consumers may rely on field names like `"vote": "Yes"` as machine-readable constants. Only translate user-facing fallback text (like "No rationale data provided"), not structural keys or enum-like values.

### UTF-8 BOM is critical for CSV i18n
Without `\uFEFF` prefix, Excel will garble non-ASCII characters (Japanese, Chinese, German umlauts). This is a single-character fix but essential for any CSV that may contain non-Latin characters.

### Batch translation needs throttling
Translating all rationales at once could overwhelm the API. Batching in groups of 5 with `Promise.allSettled` provides parallelism while avoiding rate limits. Deduplicating unique texts prevents redundant API calls.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/exportRationales.ts` | Added `ExportLabels` interface, `translateVoteValue()` helper, `translateVotesForExport()` async batch translator. Updated `getRationale()`, `exportToJSON()`, `exportToMarkdown()`, `exportToCSV()` to accept labels/locale. Added UTF-8 BOM to CSV. |
| `src/pages/governance/[hash].tsx` | Added `tExport`, `exportLabels` memo, `isExporting` state. Made `handleExport` async with rationale translation. Passed `isExporting` to `VotingRecords`. |
| `src/components/VotingRecords.tsx` | Added `isExporting` prop, `tTranslation` hook. Shows "Translating..." placeholder and disables dropdown during export. |
| `src/messages/en.json` | Added `"export"` namespace (21 keys) |
| `src/messages/de.json` | Added `"export"` namespace (21 keys, German) |
| `src/messages/fr.json` | Added `"export"` namespace (21 keys, French) |
| `src/messages/es.json` | Added `"export"` namespace (21 keys, Spanish) |
| `src/messages/pt.json` | Added `"export"` namespace (21 keys, Portuguese) |
| `src/messages/ja.json` | Added `"export"` namespace (21 keys, Japanese) |
| `src/messages/zh.json` | Added `"export"` namespace (21 keys, Chinese) |

## Patterns Discovered

### Typed labels interface for localizing pure utility functions

```typescript
// Define typed interface for all translatable strings
export interface ExportLabels {
  noRationale: string;
  voteYes: string;
  // ... all labels
}

// Utility function accepts labels, stays pure
export function exportToCSV(votes: Vote[], title: string, labels: ExportLabels): string {
  const headers = [labels.csvProposal, labels.csvVoterType, ...];
  // ...
}

// React component builds labels from useTranslations and passes them
const tExport = useTranslations("export");
const exportLabels: ExportLabels = useMemo(() => ({
  noRationale: tExport("noRationale"),
  voteYes: tExport("voteYes"),
  // ...
}), [tExport]);
```

### Batch async translation with deduplication

```typescript
export async function translateVotesForExport(votes: Vote[], locale: string): Promise<Vote[]> {
  if (locale === "en") return votes;

  // Deduplicate texts
  const uniqueTexts = new Map<string, string>();
  for (const vote of votes) {
    const text = getRationale(vote.rationale);
    if (text && !uniqueTexts.has(text)) uniqueTexts.set(text, "");
  }

  // Translate in batches of 5
  const entries = Array.from(uniqueTexts.keys());
  for (let i = 0; i < entries.length; i += 5) {
    const batch = entries.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(text => fetch("/api/translate", { ... }))
    );
    // Map results back...
  }

  // Return votes with translated rationales
  return votes.map(vote => { ... });
}
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| New `"export"` namespace vs extending existing | Cleaner separation; avoids coupling UI labels with export-specific strings |
| Don't translate JSON vote values | JSON is machine-readable; consumers may expect "Yes"/"No"/"Abstain" as constants |
| Translate MD/CSV vote values | These are human-readable documents where localization matters |
| UTF-8 BOM for CSV | Required for Excel to correctly detect encoding for non-ASCII characters |
| Batch size of 5 for translation | Balance between speed and API rate limiting |
| Optional `labels` param for `exportToJSON` | Backward compatibility — only the rationale fallback needs translation |

## Skills Evolved

Based on learnings from this session, the following skills were updated:

| Skill | Version | Changes |
|-------|---------|---------|
| add-chart | 1.7.0 -> 1.8.0 | Added i18n section: using `useTranslations` for chart titles, locale keys for registry, `ExportLabels` pattern for export utilities |
