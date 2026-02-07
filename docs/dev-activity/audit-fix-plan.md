# Fix Plan: Clean Up Contribution for Merge

## Context

Audit of commits `4488bad` (cgov) + `74f5ffa` (cgov-api) revealed 18 issues.
This plan fixes all of them in 6 phases. The development activity feature and neural
spike theme are functionally complete — these are cleanup/hardening changes to make
the PR merge-ready.

## Decided: Not Changing

- **DEFAULT_CHART_LAYOUTS flat map** — leave as-is, both dashboards pick what they need
- **`!` non-null assertions in governance/charts/index.tsx** — leave as-is, keys always exist
- **transform: translate() animation on governance cards** — confirmed intentional

---

## Phase A: cgov-api — Critical SQL + Security Fixes

### A1. SQL injection in getLanguages.ts

**File**: `cgov-api/src/controllers/development/getLanguages.ts`

**Problem**: 3 instances of string interpolation in SQL (lines 9, 72-73, 77):

```typescript
// BEFORE (line 9) — string interpolation, uses $queryRawUnsafe
const dateFilter = since ? `AND h.date >= '${since.toISOString().slice(0, 10)}'` : "";
// ... used inside $queryRawUnsafe template string
```

**Fix**: Convert both queries to Prisma `$queryRaw` with tagged template literals:

```typescript
// AFTER — parameterized via Prisma.sql tagged templates
import { Prisma } from "@prisma/client";

async function queryLanguages(since?: Date): Promise<LanguageBreakdown[]> {
  const dateFilter = since
    ? Prisma.sql`AND h.date >= ${since}`
    : Prisma.empty;

  const languages = await prisma.$queryRaw<Array<{...}>>(
    Prisma.sql`SELECT ... FROM ... LEFT JOIN (
      SELECT repo_id, SUM(commit_count) AS commits
      FROM activity_historical
      WHERE 1=1 ${dateFilter}
      GROUP BY repo_id
    ) h ON h.repo_id = r.id
    WHERE r.is_active = true
    GROUP BY COALESCE(r.language, 'Unknown')
    ORDER BY repo_count DESC`
  );
  // ...
}
```

Same pattern for the "previous" comparison query (lines 57-80):

```typescript
// BEFORE (lines 72-73, 77)
WHERE date >= '${twoYearsAgo.toISOString().slice(0, 10)}'
  AND date < '${oneYearAgo.toISOString().slice(0, 10)}'
...
AND r.repo_created_at < '${oneYearAgo.toISOString()}'

// AFTER — all 3 values as Prisma.sql parameters
const previousLanguages = await prisma.$queryRaw<Array<{...}>>(
  Prisma.sql`SELECT ... WHERE date >= ${twoYearsAgo} AND date < ${oneYearAgo} ...
    AND r.repo_created_at < ${oneYearAgo} ...`
);
```

**Risk**: Medium — changing SQL query construction. Must verify output is identical.
**Test**: Compare JSON output of `/development/languages?compare=previous` before and after.

### A2. $queryRawUnsafe in getRepos.ts

**File**: `cgov-api/src/controllers/development/getRepos.ts` (lines 43-91)

**Problem**: Uses `$queryRawUnsafe` for the ORDER BY clause. The `sort` param IS validated
against `ORDER_CLAUSES` whitelist (line 28-30), so injection is blocked. But `$queryRawUnsafe`
is a code smell.

**Fix**: Can't fully switch to `$queryRaw` because Prisma tagged templates don't support
ORDER BY parameterization. Instead:

1. Keep `$queryRawUnsafe` but add a **defensive comment** explaining why it's safe:

```typescript
// ORDER BY cannot be parameterized in Prisma. The `sort` value is validated
// against ORDER_CLAUSES whitelist above — only pre-defined SQL fragments are used.
const repos = await prisma.$queryRawUnsafe<Array<{...}>>(
```

2. Add `as const` to `ORDER_CLAUSES` for extra type safety.

**Risk**: Low — no behavioral change, just documentation.

### A3. Error handling standardization

**Files**: 10 catch blocks across development controllers + triggerGithub.ts

**Before** (identical pattern in all 10 files):

```typescript
} catch (error: any) {
  res.status(500).json({ error: "Failed to fetch X", message: error.message });
}
```

**After** (match governance pattern from `getOverviewProposals.ts:38-44`):

```typescript
} catch (error) {
  console.error("Error fetching X", error);
  res.status(500).json({
    error: "Failed to fetch X",
    message: error instanceof Error ? error.message : "Unknown error",
  });
}
```

**Exact files and line numbers**:

| File | Line | Error string |
| ---- | ---- | ------------ |
| `getOverview.ts` | 46 | "Failed to fetch overview" |
| `getActivity.ts` | 43 | "Failed to fetch activity" |
| `getHealth.ts` | 253 | "Failed to fetch health metrics" |
| `getNetwork.ts` | 64 | "Failed to fetch network graph" |
| `getContributors.ts` | 53 | "Failed to fetch contributors" |
| `getRepos.ts` | 113 | "Failed to fetch repos" |
| `getStars.ts` | 74 | "Failed to fetch star trends" |
| `getLanguages.ts` | 92 | "Failed to fetch languages" |
| `getRecent.ts` | 52 | "Failed to fetch recent activity" |
| `getStatus.ts` | 39 | "Failed to fetch status" |
| `triggerGithub.ts` | 11,42,54,63 | "Discovery/Sync/Backfill/Snapshot failed" |

**Risk**: Low — only changes error handling, no logic changes.

### A4. Concurrency guard on triggerGithub.ts

**File**: `cgov-api/src/controllers/data/triggerGithub.ts`

**Problem**: Multiple simultaneous calls to `/data/github/sync` spawn parallel syncs that
can exhaust GitHub rate limits.

**Fix**: Add module-level lock flags:

```typescript
let syncInProgress = false;
let discoveryInProgress = false;
let backfillInProgress = false;
let snapshotInProgress = false;

export const postTriggerSync = async (req: Request, res: Response) => {
  if (syncInProgress) {
    return res.status(429).json({ error: "Sync already in progress" });
  }
  syncInProgress = true;
  try {
    // ... existing logic ...
  } catch (error) {
    // ... error handling ...
  } finally {
    syncInProgress = false;
  }
};
```

Same pattern for discovery, backfill, snapshot.

**Risk**: Low — adds guard, doesn't change sync logic itself.

---

## Phase B: cgov — High Priority Frontend Fixes

### B1. Move neural theme CSS from globals.css to neural/tokens.css

**From**: `cgov/src/styles/globals.css` lines 462-1036 (575 lines starting at the comment block)
**To**: `cgov/src/themes/neural/tokens.css` (append after existing 49 lines)

**Why this is safe**: This matches the exact pattern used by the existing themes:
- `dark/tokens.css` = 34 lines of tokens + 86 lines of component overrides
- `game/tokens.css` = 44 lines of tokens + 1332 lines of component overrides
- The CSS import in `globals.css` line 4 (`@import "../themes/neural/tokens.css"`) already
  exists, so the moved CSS will still be loaded.

**What stays in globals.css**: Everything from lines 1-461 (tokens imports, tailwind directives,
animations, base styles, recharts overflow fix, utility classes, light theme overrides).

**What moves**: The entire `/* NEURAL SPIKE THEME */` block (lines 462-1036 inclusive).

**Post-move globals.css size**: ~461 lines (was 1036).
**Post-move neural/tokens.css size**: ~624 lines (was 49).

**Risk**: Medium — large block move. Must verify neural theme still renders correctly.
**Test**: Switch to neural theme in browser, check header, footer, cards, charts, scrollbar.

### B2. Scope recharts focus suppression

**File**: `cgov/src/styles/globals.css` lines 261-283

**Problem**: These rules suppress focus outlines on ALL Recharts elements in ALL themes.
This hurts keyboard accessibility on governance charts.

**Fix**: Move lines 261-275 (the `.recharts-wrapper` block) into the neural theme CSS
(which is now in `neural/tokens.css` after B1). Keep lines 277-283 (the `[data-chart-card]`
block) in globals.css since it only targets dashboard cards.

**Before** (globals.css):

```css
/* Lines 261-275 — REMOVE from here */
.recharts-wrapper:focus,
.recharts-wrapper:focus-visible,
/* ... 12 selectors ... */
{
  outline: none !important;
  box-shadow: none !important;
}

/* Lines 277-283 — KEEP here */
[data-chart-card],
[data-chart-card]:focus,
/* ... */
```

**After**: The recharts block moves to neural/tokens.css, scoped under `[data-theme="neural"]`:

```css
[data-theme="neural"] .recharts-wrapper:focus,
[data-theme="neural"] .recharts-wrapper:focus-visible,
/* ... */
```

**Risk**: Low — only removes global focus suppression, adds theme-scoped version.
**Test**: In governance dashboard (light/dark theme), tab through charts — focus rings should appear.

### B3. Self-host Space Mono font

**Current**: `_document.tsx` loads Space Mono from Google Fonts for ALL users, ALL themes.

**Fix** (matches game theme pattern at `game/tokens.css:1-7`):

1. Download Space Mono woff2 files:
   - `curl -o cgov/public/fonts/SpaceMono-Regular.woff2 <google-fonts-url>`
   - `curl -o cgov/public/fonts/SpaceMono-Bold.woff2 <google-fonts-url>`

2. Add `@font-face` at top of `cgov/src/themes/neural/tokens.css`:

```css
@font-face {
  font-family: "Space Mono";
  src: url("/fonts/SpaceMono-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Space Mono";
  src: url("/fonts/SpaceMono-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

3. Remove from `_document.tsx` (lines 8-12):
   - `<link rel="preconnect" href="https://fonts.googleapis.com" />`
   - `<link rel="preconnect" href="https://fonts.gstatic.com" ... />`
   - `<link href="https://fonts.googleapis.com/css2?family=Space+Mono..." />`

**Why this works**: `@font-face` only downloads the font file when it's actually referenced
in computed styles. `--font-sans: "Space Mono"` is only set inside `[data-theme="neural"]`,
so the font only loads when neural theme is active. Identical to how game theme's "Tw Cen MT"
works.

**Risk**: Low — just changes where the font comes from.
**Test**: Switch to neural theme, verify monospace font renders. Switch to light theme, verify
no network request for Space Mono in browser DevTools.

### B4. Remove cgov-mcp from .mcp.json

**File**: `cgov/.mcp.json`

**Remove**: The `cgov-mcp` entry (lines ~8-18 pointing to `../cgov-mcp/dist/index.js`).
Other contributors won't have cgov-mcp cloned at that relative path.

**Keep**: `cardano-governance` and `cgov-project` entries.

**Risk**: None — only affects local Claude Code tooling.

---

## Phase C: cgov-api — Medium Priority Fixes

### C1. Extract RANGE_DAYS to shared constants

**New file**: `cgov-api/src/constants/development.ts`

```typescript
export const RANGE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
  "5y": 1825,
};
```

**Update these 7 files** to `import { RANGE_DAYS } from "../../constants/development"`:
- `getOverview.ts` (line 8-14, delete local definition)
- `getActivity.ts` (line 8-14, delete local definition)
- `getHealth.ts` (line 8, delete local definition)
- `getContributors.ts` (line 8, delete local definition)
- `getRepos.ts` (lines 8-14, delete local definition)
- `getStars.ts` (line 8, delete local definition)
- `getNetwork.ts` (line 8, rename `VALID_RANGES` to use shared `RANGE_DAYS`)

**Risk**: Low — simple import replacement.

### C2. parseInt NaN validation

**Files and exact lines**:

| File | Line | Before | After |
| ---- | ---- | ------ | ----- |
| `getContributors.ts` | 12 | `Math.min(parseInt(... \|\| "50", 10), 200)` | `Math.min(parseInt(... \|\| "50", 10) \|\| 50, 200)` |
| `getRecent.ts` | 9 | `Math.min(parseInt(... \|\| "50", 10), 200)` | `Math.min(parseInt(... \|\| "50", 10) \|\| 50, 200)` |
| `getRecent.ts` | 10 | `parseInt(... \|\| "0", 10)` | `Math.max(0, parseInt(... \|\| "0", 10) \|\| 0)` |
| `getRepos.ts` | 26 | `Math.min(parseInt(... \|\| "50", 10), 200)` | `Math.min(parseInt(... \|\| "50", 10) \|\| 50, 200)` |
| `triggerGithub.ts` | 48 | `parseInt(... \|\| "50", 10)` | `Math.max(1, parseInt(... \|\| "50", 10) \|\| 50)` |
| `triggerGithub.ts` | 49 | `parseInt(... \|\| "0", 10)` | `Math.max(0, parseInt(... \|\| "0", 10) \|\| 0)` |

**Pattern**: Add `|| <default>` after parseInt to catch NaN, and `Math.max(0, ...)` for offsets.

**Risk**: Very low — adds fallback for edge case.

### C3. Cache cleanup mechanism

**File**: `cgov-api/src/services/cache.ts`

**Before** (25 lines):

```typescript
const store = new Map<string, { data: unknown; expiresAt: number }>();
// only lazy deletion on cacheGet
```

**After**: Add `MAX_ENTRIES` and cleanup in `cacheSet`:

```typescript
const MAX_ENTRIES = 500;

export function cacheSet(key: string, data: unknown, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  if (store.size > MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (now > v.expiresAt) store.delete(k);
    }
  }
}
```

**Risk**: Very low — only triggers cleanup when store grows large.

---

## Phase D: cgov — Medium Priority Frontend Fixes

### D1. localStorage migration for dashboard config

**File**: `cgov/src/components/dashboards/shared/DashboardProvider.tsx`
**Location**: Inside the mount `useEffect` (lines 138-148)

**Before**:

```typescript
useEffect(() => {
  const stored = typeof localStorage !== "undefined"
    ? localStorage.getItem(storageKey)
    : null;
  const parsed = parseStoredConfig(stored, validChartIds, defaultConfig, defaultLayouts);
  // ...
```

**After**: Check legacy key first, migrate if found:

```typescript
useEffect(() => {
  const LEGACY_KEY = "dashboard-config";
  if (typeof localStorage !== "undefined" && dashboardId === "governance") {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy && !localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, legacy);
      localStorage.removeItem(LEGACY_KEY);
    }
  }
  const stored = typeof localStorage !== "undefined"
    ? localStorage.getItem(storageKey)
    : null;
  // ... rest unchanged
```

**Why `dashboardId === "governance"`**: Only the governance dashboard existed before, so only
its users have the legacy key. The dev-activity dashboard never used the old key.

**Risk**: Low — one-time migration, only for governance users, no data lost.
**Test**: Set `localStorage.setItem("dashboard-config", JSON.stringify({...}))` in browser
console, reload, verify it appears under `"governance-dashboard-config"`.

### D2. Fix broken fetchDevNetwork + make network range-independent

The ecosystem network graph should always show the **full current state**, not be filtered
by the user's selected range. The backend already defaults to 90d but we should make this
explicit and fix the broken dead code.

**File 1**: `cgov/src/config/api.ts` (line 31) — keep as static string (already correct):

```typescript
// NO CHANGE — already correct
devNetwork: "/api/development/network",
```

**File 2**: `cgov/src/services/api.ts` — fix the broken `fetchDevNetwork` function:

```typescript
// BEFORE (broken — calls string as function)
export async function fetchDevNetwork(range: string): Promise<NetworkGraphData> {
  return fetchApi<NetworkGraphData>(API_ENDPOINTS.devNetwork(range));
}

// AFTER — remove range param, use static endpoint
export async function fetchDevNetwork(): Promise<NetworkGraphData> {
  return fetchApi<NetworkGraphData>(API_ENDPOINTS.devNetwork);
}
```

**File 3**: `cgov/src/hooks/useDevelopmentData.ts` — no change needed.
`useDevNetwork()` already uses the static `API_ENDPOINTS.devNetwork` string and takes no
range parameter. It's already correct for the "always show full state" behavior.

**Risk**: Very low — only fixes dead/broken code in services/api.ts.
**Test**: Verify network graph renders the same data regardless of selected range.

---

## Phase E: Documentation Updates

### E1. Update START-HERE.md

**File**: `cgov/docs/dev-activity/START-HERE.md`
- Update "Phase" to "Post-audit cleanup complete"
- Update "config version" to 14
- Add "Phase 9 (Audit Cleanup)" to "Last Completed" section with bullet points:
  - SQL injection fixes in getLanguages.ts
  - Self-hosted Space Mono font (removed Google Fonts dependency)
  - Neural theme CSS moved to tokens.css (matching dark/game pattern)
  - localStorage migration for dashboard config
  - Network graph range parameter wired through
  - Shared RANGE_DAYS constant extracted
  - Error handling standardized across all controllers
  - Cache cleanup mechanism added
  - Concurrency guard on admin sync endpoints

### E2. Update dev-activity-architecture.md

**File**: `cgov/docs/dev-activity/dev-activity-architecture.md`
- Update "Status" line
- Add section documenting the neural theme CSS organization pattern
- Note the shared `RANGE_DAYS` constant location
- Document the font self-hosting approach and why

### E3. Update cross-cutting.md

**File**: `cgov/docs/dev-activity/cross-cutting.md`
- Add "Dashboard Config Migration" section: explains the localStorage key rename and migration
- Add "Theme CSS Organization" section: tokens.css pattern for all 4 themes
- Add "Cache" section: TTL-based in-process Map, cleanup at MAX_ENTRIES, invalidation on sync

---

## Phase F: Verification

### F1. cgov-api build + test

```bash
cd cgov-api
yarn build              # TypeScript compilation — no errors
yarn test               # All tests pass
```

Manually test the SQL fix:

```bash
curl -H "X-API-Key: $KEY" "http://localhost:3001/development/languages?compare=previous" | jq '.languages | length'
```

### F2. cgov build + lint

```bash
cd cgov
npm run build           # Next.js production build — no errors
npm run lint            # ESLint clean
```

### F3. Manual browser checks

1. **Neural theme**: Switch to neural — verify font, header, cards, charts all render
2. **Governance dashboard**: Switch to light/dark — verify focus rings on chart elements
3. **Network graph**: Change range to 7d — verify graph data changes
4. **Layout migration**: In DevTools console, set legacy key, reload, verify migration
5. **Font loading**: In Network tab, verify Space Mono only loads on neural theme

---

## Handover Notes

### What this PR adds (for reviewers)
- **Development Activity tab**: 11 widgets tracking GitHub ecosystem activity (commits, PRs,
  issues, contributors, languages, org breakdown, network graph)
- **Neural Spike theme**: B/W monospace architectural theme inspired by neural42.io
- **DashboardProvider refactor**: Shared dashboard infrastructure now supports multiple
  dashboards via `dashboardId`, `chartRegistry`, `defaultLayouts` props

### What changed in shared infrastructure
- `DashboardProvider.tsx`: Now takes props instead of hardcoding governance. Backward-compatible.
- `DashboardChartCard.tsx` / `DashboardTextElement.tsx`: Uses `transform: translate()` instead
  of `left/top` for better performance. Adds smooth resize/reflow animations.
- `chartTheme.ts`: Added neural theme colors and card class. Additive only.
- `ChartSkeleton.tsx`: Moved from governance-specific to shared. Re-exported from old location.
- `dashboard.ts` (types): `ChartId` union widened, `ChartLayoutMap` became `Partial`.
- `store/index.ts`: Added `development` reducer alongside `governance`.
- `_app.tsx`: Wrapped in `TooltipProvider` (standard shadcn/ui pattern).

### Backend (cgov-api)
- 6 new Prisma models (GitHub repos, activity, developers, snapshots)
- 5 cron jobs (discovery weekly, sync 30min, aggregation daily, backfill hourly, snapshot daily)
- 9 public endpoints (`/development/*`) + 4 admin triggers (`/data/github/*`)
- GitHub GraphQL API with rate limit management

### Key architectural decisions
- Two-tier storage: `activity_recent` (7-day rolling) + `activity_historical` (daily aggregates)
- Network graph pre-computed and cached (30min TTL)
- All development endpoints cached in-process (5min-1hr TTL)
- Font self-hosted to avoid external dependency (matches game theme pattern)
- Neural theme CSS lives in `themes/neural/tokens.css` (matches dark/game pattern)

### Known limitations
- `DEFAULT_CHART_LAYOUTS` is a single flat map containing both governance and dev-activity layouts
- `!` non-null assertions in `governance/charts/index.tsx` (safe since keys exist in flat map)
- Backfill is still in progress for some repos (running via `scripts/backfill-loop.sh`)
