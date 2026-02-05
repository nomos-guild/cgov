# DRep Dashboard Charts — Phase 2

**Date:** 2026-02-05
**Branch:** frontend-v2

## Summary

Built three new DRep dashboard charts (Metrics Card, Voting Power donut, Rationale donut) and solved a cascade of data-fetching challenges — from infinite API call loops to N+1 query problems — culminating in a server-side aggregation endpoint that replaced hundreds of client-side calls with a single cached request.

## What Was Done

1. **Created DRepMetricsCard** — summary card showing Total DReps, Votes Cast, Total Delegated ADA using `useDRepStats()` SWR hook
2. **Created DRepVotingPowerChart** — donut chart with Top 10/20/50 filter, table legend, clickable color customization, two-phase exit animation for smooth slice removal
3. **Created DRepRationaleChart** — donut chart showing rationale provision rates with Top 10/20/50/All filter
4. **Created `/api/dreps/rationale-stats` endpoint** — server-side aggregation that fetches all DRep list pages + detail endpoints, returns pre-computed rationale stats cached for 5 minutes
5. **Added `useDRepRationaleStats()` SWR hook** — single API call replaces hundreds of individual detail fetches
6. **Added `useAllDReps()` hook** — auto-paginating hook that fetches all DRep pages for full-list scenarios
7. **Fixed infinite useEffect loop** caused by unstable array references from SWR hooks
8. **Fixed self-canceling useEffect** where state in the dependency array caused cleanup to abort in-progress fetches
9. **Added table-fixed layout** with `<colgroup>` to prevent column width shifts in chart legends
10. **Added two-phase exit animation** for Recharts Pie — removed slices animate to `value: 0` before cleanup

## Key Learnings

### 1. Server-Side Aggregation for Expensive Data
When a chart needs data from N+1 API calls (list all items, then detail for each), move the aggregation to a server-side API route with aggressive caching. One cached server call replaces hundreds of client-side calls. This is critical for multi-user scenarios.

**Pattern:** `pages/api/dreps/rationale-stats.ts` — fetches all DRep pages, then all details in batches of 20, returns aggregated results with 5-minute cache.

### 2. Self-Canceling useEffect Anti-Pattern
Setting state that appears in the dependency array inside a `useEffect` causes React to re-render, which re-runs the effect, which triggers cleanup (aborting the fetch), which re-runs the effect. The fetch never completes.

**Fix:** Use `useRef` for in-progress guards instead of state. Refs don't trigger re-renders.

```typescript
// BAD — fullListLoading in deps causes infinite loop
const [fullListLoading, setFullListLoading] = useState(false);
useEffect(() => {
  if (fullListLoading) return; // guard never works because setting it re-triggers
  setFullListLoading(true);
  fetchData().finally(() => setFullListLoading(false));
}, [fullListLoading, ...otherDeps]); // self-canceling!

// GOOD — ref doesn't trigger re-renders
const fetchingRef = useRef(false);
useEffect(() => {
  if (fetchingRef.current) return;
  fetchingRef.current = true;
  fetchData().finally(() => { fetchingRef.current = false; });
}, [otherDeps]);
```

### 3. Unstable Array References from SWR/Map
`data?.items.map(transform) || []` creates a new array every render. When used as a useEffect dependency, it causes infinite re-triggers.

**Fix:** Derive a stable string key: `const itemIds = useMemo(() => items.map(i => i.id).join(","), [items])`

### 4. Two-Phase Exit Animation for Recharts Pie
Recharts instantly removes slices from DOM when they leave the data array. To animate removals:
1. Detect removed keys via `prevKeysRef`
2. Keep removed slices in `displayData` with `value: 0` (triggers Recharts animation)
3. Clean up after animation via `setTimeout(ANIM_MS + 50)`

### 5. Table Column Stability
Auto-sized table columns shift when content changes. Fix with `table-fixed` layout and `<colgroup>` defining explicit column widths.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dashboards/governance/charts/DRepMetricsCard.tsx` | **NEW** — Summary metrics card |
| `src/components/dashboards/governance/charts/DRepVotingPowerChart.tsx` | **NEW** — Voting power donut chart |
| `src/components/dashboards/governance/charts/DRepRationaleChart.tsx` | **NEW** — Rationale provision donut chart |
| `src/pages/api/dreps/rationale-stats.ts` | **NEW** — Server-side aggregation endpoint |
| `src/hooks/useDRepData.ts` | Added `useAllDReps()`, `useDRepRationaleStats()` hooks |
| `src/config/api.ts` | Added `drepRationaleStats` endpoint |
| `src/components/dashboards/governance/charts/index.tsx` | Updated chart registry with 3 new charts |
| `src/types/dashboard.ts` | Added 3 new ChartId values and default layouts |
| `src/styles/globals.css` | Added `scrollbar-on-hover` utility |
| `src/lib/serverFetch.ts` | Modified (other changes) |
| `src/pages/governance/[hash].tsx` | Modified (other changes) |
| `src/components/dashboards/governance/charts/ParticipationChart.tsx` | **DELETED** — Replaced by new charts |
| `src/components/dashboards/governance/charts/VotingPowerChart.tsx` | **DELETED** — Replaced by DRepVotingPowerChart |

## Patterns Discovered

### Server-Side Aggregation Endpoint
```typescript
// pages/api/dreps/rationale-stats.ts
// Fetches all pages + all details server-side, caches aggressively
const batchSize = 20;
for (let i = 0; i < allDreps.length; i += batchSize) {
  const batch = allDreps.slice(i, i + batchSize);
  const details = await Promise.all(batch.map(async (drep) => {
    const r = await callApi({ endpoint: `/dreps/${drep.drepId}` });
    const d = await r.json();
    return { drepId: drep.drepId, totalVotesCast: d.totalVotesCast ?? 0, rationalesProvided: d.rationalesProvided ?? 0 };
  }));
  results.push(...details);
}
res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
```

### SWR Hook for Server-Aggregated Data
```typescript
export function useDRepRationaleStats() {
  const { data, error, isLoading, mutate } = useSWR<DRepRationaleStatsResponse>(
    API_ENDPOINTS.drepRationaleStats, fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );
  return { dreps: data?.dreps || [], isLoading, error: error?.message || null, refresh: () => mutate() };
}
```

### Two-Phase Pie Exit Animation
```typescript
const ANIM_MS = 500;
const prevKeysRef = useRef<Set<string>>(new Set());
const [exitingKeys, setExitingKeys] = useState<Set<string>>(new Set());

useEffect(() => {
  const targetKeys = new Set(data.map((d) => d.key));
  const removed = new Set<string>();
  for (const key of prevKeysRef.current) {
    if (!targetKeys.has(key)) removed.add(key);
  }
  prevKeysRef.current = targetKeys;
  if (removed.size === 0) return;
  setExitingKeys(removed);
  const timer = setTimeout(() => setExitingKeys(new Set()), ANIM_MS + 50);
  return () => clearTimeout(timer);
}, [data]);

// displayData includes ghost slices with value: 0 for animation
const displayData = useMemo(() => {
  if (exitingKeys.size === 0) return data;
  // ... add exiting slices with value: 0
}, [data, exitingKeys]);
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Server-side aggregation over client-side N+1 | Hundreds of concurrent users would overwhelm the API |
| SWR hooks over Redux for DRep data | DRep data is self-contained, doesn't need global state coordination |
| 5-minute cache on rationale-stats | Balance between freshness and API load |
| Batch size 20 for server-side detail fetches | Prevents overwhelming backend while maintaining speed |
| `table-fixed` with `<colgroup>` | More reliable than percentage widths for stable columns |
| Two-phase animation over CSS transitions | Recharts controls SVG directly; CSS can't animate slice removal |
| `useRef` for fetch guards over `useState` | Avoids self-canceling useEffect dependency cycle |

## Skills Evolved

| Skill | Changes |
|-------|---------|
| add-chart | Added SWR hooks pattern for non-Redux data, two-phase exit animation for Pie charts, table-fixed legend pattern |
| add-api-route | Added server-side aggregation pattern (N+1 → single cached endpoint with batching) |
| _patterns | Added React Hooks Gotchas section (self-canceling useEffect, unstable array refs, SWR pattern), Recharts pie exit animation, table legends, server-side aggregation convention |
