# DRep Dashboard Donut Charts

**Date**: 2026-02-12
**Branch**: frontend-v2

## Summary

Replaced the 3 placeholder circles in the DRep dashboard "DREP LIST" section with fully functional Recharts donut charts. Also improved the DRep profile page donut charts (more prominent game theme borders, disabled animations).

## What Was Done

1. **DRepActivityDonut** — 3-segment donut showing DRep activity breakdown: Active (has voting power + votes cast), Zero Voting Power, Zero Votes Cast. Legend with colored dots and counts.
2. **DRepDelegatorsDonut** — Concentration donut for top DReps by delegator count with 10/20/50 tab switcher. Legend shows cumulative concentration percentages (All, Top 10, Top 20, Top 50) with values.
3. **DRepDelegatedAdaDonut** — Same as delegators but measuring delegated ADA. Uses `formatAda()` helper (K/M/B suffixes) for legend values.
4. **Theme matching** — All charts match the DRep profile page donut styling across light, dark, and game themes (SVG shadow filters, per-Cell stroke patterns, fill opacity, corner radius, padding angle).
5. **Profile page improvements** — Updated game theme stroke from `0.4 + index * 0.08` to `0.6 + index * 0.1` for more visible white borders. Added `isAnimationActive={false}` to all 3 profile page Pie charts.
6. **i18n** — Added 9 new translation keys across all 7 locale files.
7. **Layout refinement** — Moved 10/20/50 tab buttons to vertical stack on left of chart, centered titles above charts.

## Key Learnings

- **Use raw `dreps` not `filteredDreps`**: The activity chart needs to count DReps with 0 voting power, but `filteredDreps` excludes those. Always consider what the filter removes vs. what the chart needs.
- **Game theme stroke visibility**: With few slices (3), the stroke formula `0.4 + index * 0.08` produces barely visible borders. Bumping to `0.6 + index * 0.1` gives much better visibility regardless of slice count.
- **Rank-based shade variation in game theme**: Uniform `rgba(20,20,20,0.7)` makes slices indistinguishable. Use `gameShade = Math.round(20 + ratio * 35)` for shade from 20 to 55.
- **Rank-based teal opacity in dark theme**: Instead of rainbow `generateColor()`, use `rgba(11,209,162, 0.6 - ratio * 0.5)` for consistent teal that fades from 0.60 to 0.10.
- **Dedicated i18n keys for chart titles**: Don't reuse column header keys (e.g., `columnDelegators`) as chart titles — create specific keys like `delegatorConcentrationTitle` to avoid conflicts.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dreps/DRepActivityDonut.tsx` | **New** — Activity status donut (3 segments + legend) |
| `src/components/dreps/DRepDelegatorsDonut.tsx` | **New** — Delegator concentration donut with top-N switcher |
| `src/components/dreps/DRepDelegatedAdaDonut.tsx` | **New** — Delegation ADA concentration donut with top-N switcher |
| `src/components/dreps/DRepSunburstChart.tsx` | Replaced 3 placeholder cards with real donut components |
| `src/pages/drep/[drepId].tsx` | Game theme stroke update + `isAnimationActive={false}` on 3 Pie charts |
| `src/messages/{en,de,es,fr,ja,pt,zh}.json` | Added 9 i18n keys each |

## Patterns Discovered

### Concentration Donut Pattern
Reusable pattern for showing top-N concentration with tab switcher:
```tsx
// Vertical tabs on left, chart on right, centered title above
<h4 className="text-center">Title</h4>
<div className="flex items-center">
  <div className="flex flex-col gap-0.5">
    {[10, 20, 50].map(n => <button onClick={() => setTopN(n)}>{n}</button>)}
  </div>
  <div className="relative flex-1" style={{ height: 150 }}>
    <ResponsiveContainer><PieChart>...</PieChart></ResponsiveContainer>
  </div>
</div>
// Legend: label | value | percentage
```

### Three-Theme Donut Fill Pattern
```tsx
// Rank-based fills for multi-slice donuts:
const ratio = i / Math.max(top.length - 1, 1);
const fill = isLight ? "#ffffff"
  : isGame ? `rgba(${Math.round(20 + ratio * 35)},${...},${...},0.7)`
  : `rgba(11,209,162,${(0.6 - ratio * 0.5).toFixed(2)})`;
// Others slice:
const othersFill = isLight ? "#94a3b8" : isGame ? "rgba(60,60,60,0.7)" : "rgba(11,209,162,0.08)";
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Use unfiltered `dreps` array | Activity chart needs 0-power DReps; `filteredDreps` excludes them |
| `isAnimationActive={false}` on all donuts | User preference for instant rendering without loading animation |
| Stroke formula `0.6 + index * 0.1` | Higher base opacity makes white borders visible even with few slices |
| Vertical tab buttons left of chart | Keeps title centered; horizontal tabs pushed title off-center |
| `formatAda()` with K/M/B suffixes | Fits in tight legend column; `toLocaleString()` would overflow |

## Skills Evolved

| Skill | Changes |
|-------|---------|
| `_patterns.md` | Added game theme donut stroke formula note, standalone donut animation disable note |
