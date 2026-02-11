---
name: i18n
updated: 2026-02-11
description: Add or update translations across all 7 locale files and wire them into React components or pure utility functions.
argument-hint: [scope description]
allowed-tools: Read, Edit, Write, Glob, Grep
---

# i18n — Internationalization Skill

## Arguments
- `$0` - What to translate (e.g., "DRep dashboard labels", "new filter buttons")

## Quick Reference

**Locales**: `en`, `de`, `fr`, `es`, `pt`, `ja`, `zh` — files at `src/messages/{locale}.json`
**Library**: `next-intl` — `useTranslations("namespace")` in components, typed labels object for `lib/` utilities
**CRITICAL**: All 7 files must stay in sync. Missing keys cause runtime errors.

## Procedure

1. **Grep** for the insertion point in `en.json` (find neighboring keys)
2. **Read** just those lines (offset/limit) across all 7 files
3. **Edit** all 7 files — add key after the neighboring key
4. **Wire up** in component: `const t = useTranslations("namespace"); t("key")`

## Namespaces

| Namespace | Purpose |
|-----------|---------|
| `common` | Shared UI: `loading`, `retry`, `search`, `showMore` |
| `meta` | Page titles/descriptions |
| `landing` | Landing page |
| `dashboard` | Dashboard page |
| `stats` | Stat cards |
| `status` | Status labels: `Active`, `Ratified`, `Enacted` |
| `actionTypes` | `NoConfidence`, `UpdateCommittee`, etc. |
| `filters` | Filter UI |
| `table` | Table headers |
| `voting` | `drep`, `spo`, `cc`, `yes`, `no`, `abstain`, `threshold` |
| `charts` | Dashboard chart titles |
| `sort` | Sort controls |
| `proposal` | Proposal detail page |
| `export` | Export file labels |
| `drep` | DRep dashboard |
| `drep.profile` | DRep profile page |
| `tabs` | Tab labels |
| `expiry` | Proposal expiry |
| `errors` | Error states |
| `download` | Download dropdown |
| `accessibility` | Screen reader labels |

Max one nesting level (e.g., `charts.proposalStatus.title`).

## Project Conventions — What Stays English

- Landing page filter dropdown labels
- Action type names and status values on proposal cards
- Machine-readable values (API constants, JSON export keys, tx hashes)
- Technical terms: DRep, SPO, ADA, CC — English in all locales

## Translation Guidelines

- Natural fluent translations, not word-for-word
- CJK (ja, zh): no spaces, appropriate particles
- Portuguese: European (pt-PT)
- Interpolation: ICU syntax `"Show {count} more"` — ensure `{count}` in all locales
- CSV export: prepend UTF-8 BOM (`"\uFEFF"`) for Excel compatibility

## Pattern: Labels for lib/ Utilities

Functions in `lib/` can't use hooks. Pass a typed labels object from the component:

```typescript
// lib/export.ts
export interface ExportLabels { noRationale: string; voteYes: string; }
export function exportToCSV(data: Data[], labels: ExportLabels) { ... }

// Component
const labels: ExportLabels = useMemo(() => ({
  noRationale: t("noRationale"), voteYes: t("voteYes"),
}), [t]);
```

## Key Rules

- Always use original English values for styling/logic (`getVoteBadgeClasses(vote.vote)`), translated values only for display
- `useLocale()` for date/number formatting: `new Date(ts).toLocaleDateString(locale, {...})`
