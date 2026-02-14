# DRep Picker Feature

**Date**: 2026-02-14
**Branch**: frontend-v2

## Summary

Built the "DRep Picker" tab on the DRep dashboard — a multi-filter interface for discovering DReps by their on-chain behavior. Users adjust dual-handle range sliders for Voting Activity, Rationales Provided, Delegators, and Voting Power. Filtered results display in a scrollable table. Also added a chart card placeholder above the filters for future visualization.

## What Was Done

1. **Renamed "Analytics" tab to "DRep Picker"** — updated tab values, translation keys across 7 locales
2. **Created `dual-range-slider.tsx`** — shadcn/ui-style wrapper for `@radix-ui/react-slider` with dual thumbs and `data-part` attributes for CSS targeting
3. **Extended rationale-stats API** — passed through `proposalParticipationPercent` from backend (already fetched, was discarded)
4. **Built 3 new components**: `DRepPicker.tsx` (orchestrator with data joins + filter state), `DRepPickerFilters.tsx` (slider controls + presets), `DRepPickerResults.tsx` (scrollable results table)
5. **Quadratic slider scaling** — delegators and voting power use `value = max * (pos/1000)²` for better resolution at the low end where most DReps cluster
6. **Preset chips** (Low/Medium/High) with fixed hand-picked ranges tuned to real data distribution
7. **Game theme slider styling** — grey palette matching game UI (required `data-part` attributes since Radix doesn't emit `data-radix-slider-*`)
8. **Layout: chart card + filters + results** — left column (chart placeholder + filters) defines row height, right column (results table) fills via absolute positioning
9. **Removed `forceMount`** from picker tab to avoid crashing page with 3 heavy components mounting simultaneously

## Key Learnings

### Radix UI doesn't emit `data-radix-*` on sub-elements
The Radix Slider's Track, Range, and Thumb do NOT get `data-radix-slider-track` etc. attributes. CSS selectors targeting those attributes silently match nothing. **Fix**: Add custom `data-part="track|range|thumb"` attributes to each sub-element and target those in CSS.

### `forceMount` on 3 heavy tabs = browser crash
With `forceMount`, all 3 tabs (two DRepSunburstChart instances + DRepPicker) mount on page load, each running expensive hooks that process 1500+ DReps. This caused `STATUS_ACCESS_VIOLATION` browser crash. **Fix**: Remove `forceMount` from the least critical tab (picker), accepting filter state reset on tab switch.

### Flex `items-stretch` follows the tallest child
When using `items-stretch` to make columns equal height, the row height matches the TALLEST column. A 1500-row table will always be tallest. **Fix**: Use `position: relative` on the wrapper + `position: absolute; inset: 0` on the content. The absolute child doesn't contribute to height calculation, so the other column defines the row height.

### Quadratic scale for right-skewed data
Linear sliders waste 90%+ of range on values that contain <5% of DReps. Quadratic mapping `value = max * t²` gives much more resolution in the low end. Use `pos = sqrt(fraction) * STEPS` for the reverse conversion.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dreps/DRepPicker.tsx` | **New** — Orchestrator: joins 3 hooks, owns filter state, chart card + layout |
| `src/components/dreps/DRepPickerFilters.tsx` | **New** — 4 slider controls, preset chips, match count, reset |
| `src/components/dreps/DRepPickerResults.tsx` | **New** — Scrollable results table with 7 columns |
| `src/components/ui/dual-range-slider.tsx` | **New** — Radix UI dual-thumb slider wrapper with `data-part` attrs |
| `src/pages/drep/index.tsx` | Replaced Analytics placeholder with DRepPicker tab |
| `src/pages/api/dreps/rationale-stats.ts` | Added `proposalParticipationPercent` passthrough |
| `src/hooks/useDRepData.ts` | Added field to `DRepRationaleStatsResponse`, improved abort handling |
| `src/themes/game/tokens.css` | Game theme slider overrides using `[data-part]` selectors |
| `src/messages/{en,de,es,fr,ja,pt,zh}.json` | ~20 new translation keys for picker UI |
| `package.json` | Added `@radix-ui/react-slider` dependency |

## Patterns Discovered

### Absolute positioning for height-constrained flex children
```tsx
{/* Left column defines height naturally */}
<div className="flex lg:flex-row lg:items-stretch gap-4">
  <div className="lg:w-[320px] flex flex-col gap-4">
    <ChartCard />
    <Filters />
  </div>
  {/* Right column matches left, scrolls internally */}
  <div className="flex-1 min-w-0 relative">
    <div className="absolute inset-0">
      <ScrollableTable />  {/* h-full + overflow-hidden */}
    </div>
  </div>
</div>
```

### Custom data attributes for Radix sub-element CSS
```tsx
// Component: add data-part to each sub-element
<SliderPrimitive.Track data-part="track" className="...">
  <SliderPrimitive.Range data-part="range" className="..." />
</SliderPrimitive.Track>
<SliderPrimitive.Thumb data-part="thumb" className="..." />

// CSS: target via [data-part]
[data-theme="game"] .game-picker-slider [data-part="track"] { ... }
[data-theme="game"] .game-picker-slider [data-part="range"] { ... }
[data-theme="game"] .game-picker-slider [data-part="thumb"] { ... }
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Quadratic (not log) slider scale | Simpler math, sufficient resolution for DRep data distribution |
| Fixed preset ranges instead of percentile-based | More intuitive for users ("1-100 delegators" vs "bottom 33%"), stable across data changes |
| Removed `forceMount` from picker tab | Browser crashed with 3 heavy tabs mounting at once; filter reset is acceptable tradeoff |
| `data-part` attributes vs class names | Clean CSS selectors, doesn't pollute className, self-documenting |
| Removed vote flexibility filter from sidebar | Too niche (most DReps are 0-2%), still visible in table for reference |

## Skills Evolved

| Skill | Changes |
|-------|---------|
| `_patterns.md` | Added Radix data-part pattern, absolute-position height constraint, forceMount warning |
| `MEMORY.md` | Added Radix slider `data-part` pattern, forceMount crash note |
