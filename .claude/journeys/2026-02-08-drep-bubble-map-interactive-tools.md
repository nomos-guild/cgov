# DRep Bubble Map Interactive Tools & Refinements

**Date:** 2026-02-08 (session 2)
**Branch:** frontend-v2

## Summary

Extended the DRep bubble map with interactive tooling: a sidebar Tools section with zoom toggle and DRep search-to-zoom, module-level caching for `useAllDReps` to prevent redundant API calls on tab switch, and multiple UX polish items (hover z-ordering, tooltip dismissal, light theme styling, zoom snap-back).

## What Was Done

1. **Filtered 0-voting-power DReps** from bubble map and treemap visualizations
2. **Restyled light theme bubbles** — white fill, no borders, card-matching SVG shadow filters
3. **Restructured layout** — side panel card (metric tabs) + chart area card in a flex row
4. **Improved zoom UX** — zoom out snaps back to identity view when at k≤1 with pan offset
5. **Fixed metric switch re-rendering** — moved opacity transition to inner wrapper div, not the card itself
6. **Removed treemap entirely** — simplified to bubble map only (treemap was redundant)
7. **Added module-level cache to `useAllDReps`** — prevents redundant API calls when Radix TabsContent unmounts/remounts children
8. **Added sidebar Tools section** with zoom toggle button (icon-only, circular)
9. **Added DRep search-to-zoom** — search input with suggestion dropdown in sidebar, selecting a DRep smoothly zooms the bubble map to it
10. **Hover z-ordering** — hovered bubble renders last in SVG to paint on top of neighbors
11. **Container-level mouse leave** — fixes tooltip sticking when cursor exits quickly
12. **Smooth focus-zoom animation** — 1400ms with `easeCubicInOut` for search-triggered zoom

## Key Learnings

### Module-Level Cache for Non-SWR Paginated Hooks
`useAllDReps` uses raw `fetch` in `useEffect` (not SWR) because it auto-paginates across multiple pages. When Radix TabsContent unmounts children, the hook remounts and re-fetches. Solution: module-level `Map` cache with TTL, checked in both state initializer and effect.

### SVG Hover Z-Ordering
SVG paints in document order — no `z-index`. To ensure a hovered element renders on top, sort the array so the hovered item is last:
```tsx
(hoveredId ? [...bubbles].sort((a, b) =>
  a.id === hoveredId ? 1 : b.id === hoveredId ? -1 : 0
) : bubbles).map(...)
```

### D3 Programmatic Zoom-to-Target
To smoothly zoom to a specific element in a D3 zoom-enabled SVG:
```tsx
const k = Math.min(Math.max((SVG_HEIGHT * 0.3) / target.radius, 2), 30);
const tx = SVG_WIDTH / 2 - target.x * k;
const ty = SVG_HEIGHT / 2 - target.y * k;
const newTransform = d3.zoomIdentity.translate(tx, ty).scale(k);
d3.select(svg).transition().duration(1400).ease(d3.easeCubicInOut)
  .call(zoom.transform, newTransform);
```

### Conditional D3 Zoom Attach/Detach
Zoom can be toggled by depending on `zoomEnabled` in the zoom `useEffect`:
- When disabled: detach listeners via `d3.select(svg).on(".zoom", null)`, reset transform to identity
- When enabled: create and attach fresh zoom behavior
- SVG cursor dynamically switches between `cursor-grab` and default

### Container-Level Mouse Leave for Tooltip Dismissal
Individual SVG element `onMouseLeave` can miss fast cursor movements. Adding `onMouseLeave` on the container div ensures tooltip always clears.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dreps/DRepBubbleMap.tsx` | **NEW** — 416-line D3 bubble map with zoom/pan, semantic zoom, theme-aware shadows, `zoomEnabled` toggle, `focusDRepId` zoom-to-target, hover z-ordering, container mouse leave |
| `src/components/dreps/DRepSunburstChart.tsx` | Major rewrite: removed treemap/RadialBarChart, added side panel layout, metric tabs, Tools section (zoom toggle + DRep search), opacity crossfade, rationale stats integration |
| `src/hooks/useDRepData.ts` | Added module-level cache to `useAllDReps` (Map + 1min TTL), added `delegatorCount` to API response/transform |
| `src/pages/drep/index.tsx` | Restructured tabs — TabsList in its own card, TabsContent outside for independent rendering |
| `src/types/drep.ts` | Added `delegatorCount: number \| null` to `DRepSummary` |

## Patterns Discovered

### Search-to-Zoom Pattern for D3 Visualizations
Sidebar search input → suggestion dropdown → select → set `focusDRepId` prop → BubbleMap `useEffect` finds bubble, calculates zoom transform, animates with `d3.easeCubicInOut`. Auto-enables zoom when selecting from search.

### Module-Level Cache for Paginated Fetch Hooks
```tsx
const cache = new Map<string, { data: T[]; timestamp: number }>();
const TTL = 60000;

function useAllItems() {
  const cacheKey = `${sortBy}:${sortOrder}`;
  const cached = cache.get(cacheKey);
  const isValid = cached && Date.now() - cached.timestamp < TTL;

  const [items, setItems] = useState(() => isValid ? cached.data : []);
  const [loading, setLoading] = useState(() => !isValid);

  useEffect(() => {
    const entry = cache.get(cacheKey);
    if (entry && Date.now() - entry.timestamp < TTL) { /* serve cache */ return; }
    // ... fetch and cache.set(key, { data, timestamp: Date.now() })
  }, [cacheKey]);
}
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Zoom disabled by default, toggle in sidebar | Prevents accidental zoom when scrolling; intentional UX |
| Search auto-enables zoom on DRep select | User intent is clear — they want to see the DRep up close |
| 1400ms easeCubicInOut for search-zoom | Smooth cinematic feel vs jarring 300ms snap |
| Module-level Map cache (not SWR) for useAllDReps | SWR doesn't handle multi-page accumulation; raw fetch needs manual caching |
| Remove treemap, keep bubble map only | Bubble map is more visually interesting and sufficient |
| Container onMouseLeave for tooltip | Individual circle onMouseLeave misses fast mouse exits |

## Skills Evolved

| Skill | Changes |
|-------|---------|
| _patterns.md | Added D3 programmatic zoom-to-target, conditional zoom attach/detach, SVG hover z-ordering, module-level cache pattern, container mouse leave |
