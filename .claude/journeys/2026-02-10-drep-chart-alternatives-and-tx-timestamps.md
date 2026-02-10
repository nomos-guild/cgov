# DRep Chart Alternatives & Tx Timestamps

**Date**: 2026-02-10
**Branch**: frontend-v2

## Summary

Added TreeMap and Donut chart alternatives to the DRep visualization page, simplified the BubbleMap by removing zoom/pan/search in favor of a static top-N highlight approach, and added precise transaction timestamp lookup via Koios for governance action submission dates.

## What Was Done

1. **New DRepDonutChart component** — D3-based animated donut chart with top-N slice highlighting, "Others" aggregation (max 50 slices), and custom easing animation
2. **New DRepTreeMap component** — D3 treemap layout with top-N tile emphasis, hover tooltips, and three-theme styling
3. **Chart type switcher** — Added Bubble Map / Tree Map / Donut tabs to the DRep analytics sidebar
4. **BubbleMap simplification** — Removed D3 zoom/pan behavior, zoom controls UI, and bubble search/focus features; replaced with static top-N shadow emphasis via SVG filter variants
5. **Selection summary stats** — Replaced tools sidebar section with a summary table showing voting power, delegators, and votes for the current top-N selection with percentages
6. **Recharts animation polish** — Standardized `animationDuration={500}` and `animationEasing="ease-in-out"` across all 4 dashboard pie charts
7. **Tx timestamp API route** — New `/api/tx-timestamp` endpoint that queries Koios `tx_info` for precise block timestamps (immutable, cached 1 hour)
8. **Proposal detail date fix** — Uses tx timestamp API to show precise submission date instead of epoch-derived approximation
9. **DRep page tab label** — Shortened "DRep List" → "DRep"

## Key Learnings

- **Zoom/pan adds complexity with limited value for overview charts**: When the primary use case is comparing relative sizes, static rendering with visual emphasis (shadows, opacity) on a subset is more effective than interactive zoom. Zoom is better suited for detail-on-demand workflows with a search panel.
- **D3 donut custom animation**: Using `requestAnimationFrame` with a cubic easing function and `d3.arc()` generator allows smooth animated transitions without D3's transition system, keeping control in React.
- **Top-N as a cross-chart filter**: Passing `topN` as a prop and letting each chart handle emphasis differently (BubbleMap: shadow filters, TreeMap: opacity/border, Donut: slice separation) creates consistent UX across visualizations.
- **Koios tx_info for precise timestamps**: Cardano's block timestamps are immutable, making them perfect for aggressive caching. The Koios API accepts POST with `_tx_hashes` array.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dreps/DRepDonutChart.tsx` | **NEW** — D3 donut chart (464 lines) |
| `src/components/dreps/DRepTreeMap.tsx` | **NEW** — D3 treemap chart (331 lines) |
| `src/pages/api/tx-timestamp.ts` | **NEW** — Koios tx timestamp lookup (60 lines) |
| `src/components/dreps/DRepSunburstChart.tsx` | Added chart type tabs, selection stats, removed zoom/search UI |
| `src/components/dreps/DRepBubbleMap.tsx` | Removed zoom/pan/focus, added topN shadow emphasis |
| `src/pages/governance/[hash].tsx` | Added precise tx timestamp fetch for submission date |
| `src/pages/drep/index.tsx` | Tab label "DRep List" → "DRep", padding adjustments |
| `src/components/dashboards/.../DRepRationaleChart.tsx` | Added `animationEasing` |
| `src/components/dashboards/.../DRepVotingPowerChart.tsx` | Added `animationDuration` + `animationEasing` |
| `src/components/dashboards/.../ProposalStatusChart.tsx` | Added `animationDuration` + `animationEasing` |
| `src/components/dashboards/.../ProposalTypeChart.tsx` | Added `animationDuration` + `animationEasing` |

## Patterns Discovered

### Top-N Filter Prop Pattern
Charts accept `topN?: number | null` and handle emphasis internally:
```tsx
// BubbleMap: emphasized shadow for top-N bubbles
const hasTopNFilter = topN != null;
const isInTopN = !hasTopNFilter || bubble.rank <= topN;
const showLabel = bubble.radius > 12 && isInTopN;
```

### D3 Donut Animation Pattern (without D3 transitions)
```tsx
function animateIn(slices: Slice[]) {
  const startTime = performance.now();
  function tick() {
    const t = easeInOutCubic(Math.min((performance.now() - startTime) / ANIM_MS, 1));
    setAnimatedSlices(slices.map(s => ({
      ...s,
      startAngle: s.startAngle * t,
      endAngle: s.endAngle * t,
    })));
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
```

### Koios API Pattern
```tsx
// Server-side only — POST with tx hash array
const response = await fetch("https://api.koios.rest/api/v1/tx_info", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
  body: JSON.stringify({ _tx_hashes: [txHash] }),
});
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Remove zoom/pan from BubbleMap | Overview charts benefit more from static emphasis than interactive exploration; reduces code complexity by ~100 lines |
| Max 50 slices in donut chart | Beyond 50, slices become too thin to distinguish; remaining DReps aggregated into "Others" |
| Koios for timestamps instead of backend | Backend doesn't expose per-tx timestamps; Koios is a free public API with the exact data needed |
| Cache tx timestamps 1 hour + stale-while-revalidate 24h | Block timestamps are immutable — aggressive caching is safe |

## Skills Evolved

| Skill | Changes |
|-------|---------|
| add-chart | Updated date; added `animationDuration={500}` + `animationEasing="ease-in-out"` to Pie chart template |
| add-api-route | Updated date; added immutable data cache guideline (3600s + stale-while-revalidate) |
| _patterns | Added Recharts pie animation defaults, top-N filter pattern for multi-chart views, D3 donut animation without transitions |
