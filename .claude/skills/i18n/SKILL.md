---
name: i18n
version: 1.0.0
created: 2026-02-04
last-evolved: null
evolution-count: 0
feedback-count: 0
description: Add or update translations across all 7 locale files and wire them into React components or pure utility functions. Use when localizing new features, adding translation keys, or fixing hardcoded English strings.
argument-hint: [scope description]
allowed-tools: Read, Edit, Write, Glob, Grep
---

# i18n — Internationalization Skill

Add translation keys to all locale files and wire them into components using `next-intl`.

## Arguments

- `$0` - Description of what to translate (e.g., "DRep dashboard labels", "export column headers", "new filter buttons")

## Overview

This project uses **next-intl** with **7 locales**: `en`, `de`, `fr`, `es`, `pt`, `ja`, `zh`.

Locale files live at `src/messages/{locale}.json`. Each file has the same structure with namespaced keys.

---

## Step 1: Identify Strings to Translate

Search for hardcoded English strings in the target component(s):

```bash
# Look for obvious hardcoded strings in JSX
grep -n '"[A-Z][a-z]' src/components/TargetComponent.tsx
```

**What to translate:**
- UI labels, headings, button text
- Placeholder text, tooltips, aria-labels
- Error messages and loading states
- "Show more", "Reset", "Loading..." patterns

**What to keep in English:**
- Machine-readable values (JSON export keys, API constants)
- Technical identifiers (transaction hashes, IDs)
- Brand names, proper nouns
- Filter dropdown labels (per project convention — the landing page filter dropdowns stay English)
- Action type names and status values on the landing page proposal cards (per project convention)

---

## Step 2: Choose or Create a Namespace

### Existing Namespaces

| Namespace | Purpose | Example Keys |
|-----------|---------|--------------|
| `common` | Shared UI words | `loading`, `retry`, `search`, `showMore`, `showMoreProposals` |
| `meta` | Page titles & descriptions | `homeTitle`, `dashboardTitle` |
| `landing` | Landing page headings | `title`, `subtitle` |
| `dashboard` | Dashboard page | `title`, `subtitle`, `loadingData` |
| `notFound` | 404 page | `title`, `description`, `returnHome` |
| `stats` | Stat cards | `total`, `active`, `ratified`, `expired` |
| `status` | Status labels | `Active`, `Ratified`, `Enacted`, `Expired`, `Closed` |
| `actionTypes` | Governance action types | `NoConfidence`, `UpdateCommittee`, `NewConstitution`, etc. |
| `filters` | Filter UI elements | `filterActionTypes`, `filterByStatus`, `actionTypes` |
| `table` | Table headers | `proposalTitle`, `actionType`, `type`, `voter`, `vote` |
| `voting` | Voting-related labels | `drep`, `spo`, `cc`, `yes`, `no`, `abstain`, `threshold` |
| `charts` | Dashboard chart titles | `proposalStatus.title`, `nclProgress.description` |
| `sort` | Sort controls | `newestFirst`, `oldestFirst`, `highestPower` |
| `download` | Download dropdown | `downloadRationales`, `json`, `markdown`, `csv` |
| `rationaleFilter` | Rationale filter | `allRecords`, `withRationale` |
| `errors` | Error states | `failedToLoadData`, `loadingGovernanceData` |
| `accessibility` | Screen reader labels | `website`, `github`, `switchToCompactView` |
| `footer` | Footer text | `builtBy` |
| `language` | Language picker | `en`, `de`, `selectLanguage` |
| `translation` | Translation feature | `translate`, `translating`, `showOriginal` |
| `expiry` | Proposal expiry info | `timeUntilExpiry`, `day`, `days`, `submissionDate` |
| `tabs` | Tab labels | `liveVoting`, `thresholds`, `bubbleMap`, `curves`, `details` |
| `proposal` | Proposal detail page | `backToDashboard`, `drepVotes`, `shareOnX`, `votingTrend` |
| `export` | Export file labels | `noRationale`, `voteYes`, `csvProposal`, `csvVote` |

**Rules for namespaces:**
- Use an existing namespace if the key fits its purpose
- Create a new namespace only for a clearly distinct feature area
- Keep namespace names short and descriptive
- One level of nesting max (e.g., `charts.proposalStatus.title`)

---

## Step 3: Add Keys to All 7 Locale Files

**CRITICAL: All 7 files must be updated in sync.** Missing keys will cause runtime errors.

### File Order (always update in this order)

1. `src/messages/en.json` — English (source of truth)
2. `src/messages/de.json` — German
3. `src/messages/fr.json` — French
4. `src/messages/es.json` — Spanish
5. `src/messages/pt.json` — Portuguese
6. `src/messages/ja.json` — Japanese
7. `src/messages/zh.json` — Chinese

### Translation Quality Guidelines

- Use natural, fluent translations (not word-for-word)
- Keep translations concise — UI space is limited
- For CJK languages (ja, zh): no spaces between words, use appropriate particles
- For Portuguese: use European Portuguese (pt-PT) by default
- Technical terms (DRep, SPO, ADA, CC) stay in English across all locales
- Abbreviations in parentheses can be kept (e.g., "SPO" stays "SPO" in all languages)

### Example: Adding a New Key

English (`en.json`):
```json
"proposal": {
  "existingKey": "Existing value",
  "newKey": "New English text"
}
```

German (`de.json`):
```json
"proposal": {
  "existingKey": "Vorhandener Wert",
  "newKey": "Neuer deutscher Text"
}
```

Japanese (`ja.json`):
```json
"proposal": {
  "existingKey": "既存の値",
  "newKey": "新しい日本語テキスト"
}
```

### Interpolation

For dynamic values, use ICU message syntax:

```json
"showMore": "Show {count} more"
```

```typescript
t("common.showMore", { count: 5 }) // "Show 5 more"
```

---

## Step 4: Wire Up in React Components

### Pattern A: Direct Hook Usage (most common)

```typescript
import { useTranslations } from "next-intl";

export function MyComponent() {
  const t = useTranslations("namespace");

  return <h1>{t("keyName")}</h1>;
}
```

**Multiple namespaces in one component:**

```typescript
const tCommon = useTranslations("common");
const tProposal = useTranslations("proposal");

return (
  <>
    <h1>{tProposal("title")}</h1>
    <button>{tCommon("retry")}</button>
  </>
);
```

### Pattern B: Mapping API Values to Translations

When API returns English constants (e.g., "Yes", "No", "Abstain") that need to be displayed in the user's language:

```typescript
const tVoting = useTranslations("voting");

const translateVote = (vote: string) => {
  const map: Record<string, string> = {
    Yes: tVoting("yes"),
    No: tVoting("no"),
    Abstain: tVoting("abstain"),
  };
  return map[vote] ?? vote;
};

// Usage in JSX
<span>{translateVote(vote.vote)}</span>

// IMPORTANT: Keep original English value for styling/logic
<Badge className={getVoteBadgeClasses(vote.vote)}>  // Original English
  {translateVote(vote.vote)}                         // Translated display
</Badge>
```

### Pattern C: Typed Labels for Pure Utility Functions

Functions in `lib/` cannot use React hooks. Pass a typed labels object instead:

```typescript
// 1. Define interface in the utility file
export interface ExportLabels {
  noRationale: string;
  voteYes: string;
  voteNo: string;
  voteAbstain: string;
  csvProposal: string;
  csvVote: string;
  // ... all needed labels
}

// 2. Utility function accepts labels
export function exportToCSV(data: Data[], labels: ExportLabels): string {
  const headers = [labels.csvProposal, labels.csvVote];
  // ...
}

// 3. Component builds labels from useTranslations
const tExport = useTranslations("export");
const exportLabels: ExportLabels = useMemo(() => ({
  noRationale: tExport("noRationale"),
  voteYes: tExport("voteYes"),
  voteNo: tExport("voteNo"),
  voteAbstain: tExport("voteAbstain"),
  csvProposal: tExport("csvProposal"),
  csvVote: tExport("csvVote"),
}), [tExport]);

// 4. Pass to utility
const csv = exportToCSV(votes, exportLabels);
```

### Pattern D: Locale-Aware Formatting

Pass the locale for date/number formatting:

```typescript
import { useRouter } from "next/router";

const { locale } = useRouter();

// In exported files
new Date(timestamp).toLocaleString(locale);
number.toLocaleString(locale);
```

---

## Step 5: Special Considerations

### UTF-8 BOM for CSV Export

When generating CSV files that may contain non-ASCII characters (CJK, umlauts, accented characters), prepend the UTF-8 BOM:

```typescript
const BOM = "\uFEFF";
const csvContent = BOM + headers + "\n" + rows;
```

Without this, Excel will garble non-Latin characters.

### Batch Translation of Dynamic Content

For translating user-generated content (e.g., rationale text) at runtime:

```typescript
export async function translateTexts(
  texts: string[],
  targetLocale: string
): Promise<Map<string, string>> {
  if (targetLocale === "en") return new Map();

  // Deduplicate
  const unique = [...new Set(texts.filter(Boolean))];
  const results = new Map<string, string>();

  // Batch in groups of 5 to avoid rate limits
  for (let i = 0; i < unique.length; i += 5) {
    const batch = unique.slice(i, i + 5);
    const responses = await Promise.allSettled(
      batch.map((text) =>
        fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, targetLang: targetLocale }),
        }).then((r) => r.json())
      )
    );

    responses.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value.translatedText) {
        results.set(batch[idx], result.value.translatedText);
      }
    });
  }

  return results;
}
```

### JSON Export: Keep Keys English

JSON is a data interchange format. Structural keys and enum-like values should stay in English:

```typescript
// CORRECT - keys stay English, only fallback text translated
{
  "vote": "Yes",              // English constant
  "rationale": labels.noRationale  // Translated fallback
}

// WRONG - don't translate keys or enum values in JSON
{
  "Stimme": "Ja",   // Bad: translated key and value
}
```

---

## Verification Checklist

After adding translations:

1. [ ] All 7 locale files updated with identical key structure
2. [ ] Keys match across all files (no typos in key names)
3. [ ] Interpolation variables match (e.g., `{count}` in all locales)
4. [ ] `npm run build` passes with no TypeScript errors
5. [ ] Switch to non-English language and verify strings display correctly
6. [ ] Check that translated text fits in the UI (CJK and German text can be longer)
7. [ ] Verify CSV export shows correct characters when opened in Excel
8. [ ] Original English values still used for logic/styling (badge colors, conditionals)

---

## Quick Reference: Adding a Single Translation Key

Minimum steps for adding one new key:

1. **Pick namespace** — check table above
2. **Add to `en.json`** — the source of truth
3. **Add to 6 other locale files** — with proper translations
4. **Use in component** — `const t = useTranslations("namespace"); t("key")`
5. **Build** — `npm run build` to verify

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgetting a locale file | Always update all 7 files |
| Translating filter dropdown labels | Landing page filter dropdowns stay English (project convention) |
| Translating action type/status on proposal cards | These stay English on the landing page (project convention) |
| Using `t()` in `lib/` utility files | Use typed labels interface pattern instead |
| Styling based on translated text | Always use original English values for className logic |
| Missing interpolation variable | Ensure `{count}`, `{year}` etc. appear in all locale translations |
| Nesting too deep | Max one level: `"charts.myChart.title"` is fine, deeper is not |
