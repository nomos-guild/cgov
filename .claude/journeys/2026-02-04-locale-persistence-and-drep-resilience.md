# Locale Persistence & DRep Page Resilience

**Date**: 2026-02-04
**Branch**: frontend-v2

## Summary

Two improvements in one session: (1) Language preferences now persist across browser sessions via localStorage, matching how theme persistence already works. (2) DRep Dashboard and Profile pages now degrade gracefully when backend endpoints fail, specifically handling the missing `delegator_count` column in the production database.

## What Was Done

1. **Locale persistence in `_app.tsx`** - Added a `useEffect` that reads `preferred-locale` from localStorage on mount and redirects via `router.replace` if it differs from the current locale. The `LanguageSelector` was already saving the preference but nothing was reading it back.

2. **DRep Dashboard graceful degradation** - Removed the blocking error card from `/drep` that hid ALL content (including the DRep list) when the stats endpoint failed. Stats cards now show "--" and the DRep list (separate endpoint) still renders.

3. **DRep Profile graceful degradation** - Restructured `/drep/[drepId]` so the Voting History section (separate `/votes` endpoint) renders independently of the profile detail endpoint. Added an inline warning banner when profile details fail, replacing the full-page blocking error.

4. **Defensive `delegatorCount` transform** - Added `?? null` fallback in `transformDRepDetail` so missing/undefined `delegatorCount` from the API is safely handled.

## Key Learnings

### Pattern: Graceful Degradation for Multi-Endpoint Pages

When a page depends on multiple independent API endpoints, **never gate all content behind a single endpoint's success**. Instead:
- Each data section should handle its own loading/error state
- Failed sections show fallback values ("--") or inline warnings
- Working sections render independently

**Anti-pattern** (what we had):
```tsx
{error && <FullPageError />}
{data && !error && <AllContent />}
```

**Better pattern** (what we changed to):
```tsx
{!isLoading && (
  <>
    {error && !data && <InlineWarning />}
    {data && <ProfileSection />}
    <VotingHistory /> {/* always renders, separate endpoint */}
  </>
)}
```

### Pattern: localStorage Preference Persistence

The theme system established the pattern: save on change, restore on mount with `useEffect([], [])`. Language persistence follows the same pattern but uses `router.replace` instead of direct DOM manipulation because Next.js i18n routing is URL-based.

Key detail: use `router.replace` (not `push`) to avoid polluting browser history with the redirect.

### Insight: Backend Schema Mismatches

When the backend Prisma schema references a column that doesn't exist in the production database, ALL queries on that model can fail - not just the ones explicitly referencing the column. Frontend resilience is a good safety net, but the root fix must happen in the backend (either run the migration or remove the column from the schema).

## Files Changed

| File | Change |
|------|--------|
| `src/pages/_app.tsx` | Added `useEffect` to restore saved locale from localStorage on mount |
| `src/pages/drep/index.tsx` | Removed blocking error card, simplified render condition to always show content |
| `src/pages/drep/[drepId].tsx` | Split content into `drep`-gated and always-rendered sections, added inline warning |
| `src/hooks/useDRepData.ts` | Added `?? null` for defensive `delegatorCount` handling |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Use `router.replace` for locale redirect | Avoids polluting browser history with intermediate URL |
| Run locale restore only on mount (`[]` deps) | Prevents infinite redirect loop when locale changes |
| Remove full-page error card on DRep Dashboard | Stats failure shouldn't block DRep list which uses separate endpoint |
| Keep Voting History outside `drep &&` gate | Votes endpoint is independent and may work even when detail endpoint fails |
| Inline warning instead of full error card on Profile | Less disruptive UX when partial data is available |

## Skills Evolved

Based on learnings from this session, the following skills were updated:

| Skill | Version | Changes |
|-------|---------|---------|
| add-dashboard | 2.0.0 -> 2.1.0 | Added graceful degradation pattern to page template, replaced full-page error with inline warning, added Gotchas section and checklist item |
