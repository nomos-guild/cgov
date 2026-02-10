# DRep Bubble Map & Tab Styling

**Date:** 2026-02-08
**Branch:** frontend-v2

## Summary

Added a D3-powered zoomable bubble map visualization to the DRep dashboard page, with chart-type tabs (Treemap/Bubble Map) and metric tabs (Voting Power/Delegators/Votes Cast/Rationale %), all styled to match the proposal detail page tab pattern. The bubble map supports deep zoom (up to 60x) with semantic zoom behavior — stroke width, label sizing, and inter-bubble spacing all adapt to the zoom level.

## What Was Done

1. **Restyled metric tab buttons** to match proposal detail page tabs (using `data-state` attributes, game theme classes, dark/light/game mode variants)
2. **Added chart type tabs row** (Treemap | Bubble Map) above existing metric tabs
3. **Created DRepBubbleMap component** — full D3 circle-packing visualization adapted from the existing BubbleMap used on proposal detail pages
4. **Removed nested box styling** from bubble map for cleaner integration
5. **Fixed buggy transition animations** when switching metrics on bubble map (React `key` prop to force remount)
6. **Smoothed fade timing** by syncing CSS transition duration (300ms) with setTimeout (350ms)
7. **Added D3 zoom/pan** with mouse wheel, drag, and +/-/reset controls
8. **Implemented semantic zoom** — stroke width adapts inversely (`baseStroke / k`), labels scale proportionally to bubble radius (`radius * 0.35`)
9. **Increased max zoom to 60x** for exploring tiny bubbles
10. **Reduced D3 pack padding** from 4 to 1 for tighter packing when zoomed
11. **Constrained label text** to always fit inside bubbles at any zoom level
12. **Added `delegatorCount`** to DRepSummary type and SWR transform

## Key Learnings

### D3 Semantic Zoom Pattern
When combining D3 zoom with SVG circle packing:
- Use `d3.zoom()` on the SVG element, track transform via React state
- Wrap all visual elements in a single `<g transform={...}>` group
- **Adapt stroke width inversely**: `baseStroke / k` (where k = zoom scale)
- **Adapt label font size proportionally to radius**: `Math.min(radius * 0.35, 14 / k)` — never let font exceed what fits in the bubble
- **Derive character count from available width**: `radius * 1.6 / (fontSize * 0.6)` for reliable text clipping
- **Keep D3 pack padding minimal** (1-2px) since padding scales with zoom

### React `key` Prop for Animation Reset
When a component has CSS transitions for hover effects (e.g., `transition: transform 0.3s`) and D3 recalculates positions on metric change, all elements animate between old→new positions creating visual chaos. Solution: add `key={metric}` to force full remount, bypassing stale CSS transitions.

### Tab Styling with `data-state` Attributes
Using `data-state="active"/"inactive"` on plain `<button>` elements enables both:
- Tailwind `data-[state=active]:` variant selectors
- Game theme CSS selectors `[data-state="active"]`
This avoids needing Radix UI TabsTrigger while maintaining full theme compatibility.

### Opacity Crossfade Pattern
For smooth chart switching:
1. Set opacity to 0 (triggers CSS `transition: opacity 300ms`)
2. Wait 350ms (300ms + 50ms buffer) via setTimeout
3. Swap content
4. Set opacity back to 1

## Files Changed

| File | Change |
|------|--------|
| `src/components/dreps/DRepBubbleMap.tsx` | **NEW** — D3 bubble map with zoom/pan, semantic zoom, theme-aware styling |
| `src/components/dreps/DRepSunburstChart.tsx` | Added chart type tabs, metric tab restyling, bubble map integration, fade transitions |
| `src/pages/drep/index.tsx` | Restructured layout — tabs in own card, chart content below without wrapper |
| `src/types/drep.ts` | Added `delegatorCount` to `DRepSummary` |
| `src/hooks/useDRepData.ts` | Added `delegatorCount` to API response interface and transform |

## Patterns Discovered

### D3 Zoom Controls Matching Tab Styling
Zoom control buttons (+/-/reset) reuse the same `data-state` button pattern as tabs for visual consistency, placed in a flex row with the same border/shadow/color treatment.

### SVG Shadow Filters for Light/Dark/Game
Three distinct SVG `<filter>` definitions for bubble shadows:
- **Light**: `feDropShadow` with dark opacity
- **Dark**: `feGaussianBlur` + `feFlood` with cyan
- **Game**: `feGaussianBlur` + `feFlood` with green (#00ff66)

### HSL Color Generation for DRep Bubbles
Matches the treemap color pattern: `hsl(${hue}, ${saturation}%, ${lightness}%)` where hue varies by index, with theme-specific saturation/lightness ranges.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Use `key={metric}` for remount instead of animating position changes | D3 position recalculation + CSS hover transitions conflict; remount is cleaner |
| D3 pack padding of 1 (not 4) | Padding scales with zoom — 4px becomes 240px at 60x zoom |
| Max zoom 60x (not 8x) | Small DReps are tiny at low zoom; 60x allows meaningful inspection |
| Font size = `radius * 0.35` | Proportional to bubble ensures text never overflows regardless of zoom |
| 350ms timeout for transitions | 50ms buffer over 300ms CSS transition prevents content swap during fade |

## Skills Evolved

| Skill | Changes |
|-------|---------|
| _patterns.md | Added "D3 Custom Visualizations" section: semantic zoom, opacity crossfade, React key for animation reset, SVG shadow filters |
| _patterns.md | Added "Tab Styling with data-state Attributes" section: pill-button tabs matching proposal detail page |
