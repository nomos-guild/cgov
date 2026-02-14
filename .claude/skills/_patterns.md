# Shared Patterns

Cross-cutting knowledge that applies across multiple skills. When a pattern is learned in one context, it lives here so all skills benefit.

---

## Theming

Three distinct themes — never treat dark and game as the same.

| Theme | Background | Accent | Borders | Corners |
|-------|-----------|--------|---------|---------|
| **Light** | `bg-white` / `#faf9f6` | Black | None on cards (shadow only) | Rounded |
| **Dark** | `#1a1a2e` / `#131320` | Cyan `#0bd1a2` | Cyan borders | Rounded |
| **Game** | `bg-black` / `#080808` | Neon green `#00ff66` | None on cards (subtle white borders on charts) | Sharp (`rounded-none` / `rounded-[2px]`) |

**Critical rules:**
- `isDark` is true for BOTH dark AND game — always check `isGame` first
- Light theme cards: pure white, NO borders, shadow only
- Game theme cards: NO colored borders, NO colored elements
- Game theme donut strokes: `rgba(255,255,255,${0.6 + index * 0.1})` — high base opacity needed for visible white borders even with few slices
- Game theme rank-based fills: `rgba(shade,shade,shade,0.7)` where shade = `20 + ratio * 35` (20→55 range, darker for higher rank)
- Dark theme: cyan for almost everything
- Dark theme rank-based fills: `rgba(11,209,162, 0.6 - ratio * 0.5)` (brighter for higher rank, fading to 0.10)
- **CSS specificity vs Tailwind**: Game theme CSS classes like `game-nav-btn` use `[data-theme="game"]` selectors with higher specificity than Tailwind utilities. You cannot override `height: 40px` from `game-nav-btn` with Tailwind `h-8`. Create a variant class (e.g., `game-nav-btn-sm`) instead.
- **Radix sub-element CSS targeting**: Radix UI does NOT emit `data-radix-*` attributes on sub-elements (Track, Range, Thumb, etc.). Selectors like `[data-radix-slider-track]` match nothing. Add custom `data-part="track|range|thumb"` attributes to sub-elements and target those in theme CSS.
- **Game theme slider palette**: Use the standard grey palette for game sliders — track `#1b1c1c` with `#292929` border, range `#292929→#3a3a3a` gradient, thumbs `#2c2c2c→#3a3a3a` with `#4a4a4a` border. No green/teal accents.

**3-way theme check (always use this order):**
```tsx
isGame ? "game-classes" : isDark ? "dark-classes" : "light-classes"
```

---

## Recharts

- **Tooltip**: Never use `contentStyle` prop — always use the custom `ChartTooltip` component from `shared/chartTheme`
- **Overflow clipping**: Recharts wraps charts in `overflow: hidden`. For pie/donut charts with shadows, apply the 3-layer fix:
  1. Outer div: `overflow-visible`
  2. Tailwind override: `[&_.recharts-wrapper]:!overflow-visible`
  3. PieChart SVG: `style={{ overflow: "visible" }}`
- **Tick lines**: Always `tickLine={false}` for cleaner look
- **Pie animation defaults**: For dashboard charts, set `animationDuration={500}` and `animationEasing="ease-in-out"` on `<Pie>`. For standalone page donuts, use `isAnimationActive={false}` on both `<Pie>` and `<Tooltip>` to disable all animation
- **Responsive sizing**: Chart container needs `flex-1 min-h-0`, then `<ResponsiveContainer width="100%" height="100%">`
- **Height-constrained flex child**: When one flex column should define the row height and another should fill it (scrollable content), use `position: relative` on the filler wrapper + `position: absolute; inset: 0` on the content. The absolute child doesn't contribute to cross-axis height, so the defining column wins. Inner content uses `h-full overflow-hidden`.
- **Pie exit animation**: Recharts instantly removes slices from DOM. For smooth removal, use the two-phase pattern: keep removed slices at `value: 0` during animation, clean up after `setTimeout(ANIM_MS + 50)`. See `add-chart` skill for full pattern.
- **Table legends**: Use `table-fixed` with `<colgroup>` for stable column widths when data changes

---

## i18n

- **7 locales**: `en`, `de`, `fr`, `es`, `pt`, `ja`, `zh` — all must be updated in sync
- **Hooks in components**: `useTranslations("namespace")`
- **Pure utility functions**: Can't use hooks — use typed `ExportLabels` interface pattern
- **Styling logic**: Always use original English values for className conditions, only translate the displayed text
- **CSV exports**: Prepend UTF-8 BOM (`\uFEFF`) for non-ASCII character support in Excel
- **Landing page convention**: Filter dropdowns and action type/status on proposal cards stay English

---

## Imports

Always follow this order:
```typescript
// 1. React
import { useState, useMemo } from "react";
// 2. Third-party
import { useAppSelector } from "@/store/hooks";
// 3. Types
import type { GovernanceAction } from "@/types/governance";
// 4. Components
import { Card } from "@/components/ui/card";
// 5. Utils
import { cn } from "@/lib/utils";
```

---

## React Hooks Gotchas

- **Self-canceling useEffect**: Never set state that's in the dependency array inside the effect — it re-triggers cleanup, aborting async work. Use `useRef` for in-progress guards instead of `useState`.
- **Unstable array references**: `data?.items.map(fn) || []` creates a new array every render. Derive a stable key with `useMemo(() => items.map(i => i.id).join(","), [items])` when used as a dependency.
- **SWR for chart data**: DRep/non-Redux data uses SWR hooks in `src/hooks/useDRepData.ts`. Match `dedupingInterval` to server cache duration.
- **SWR fallbackData on key change**: `fallbackData` only seeds data for the initial SWR key. When the key changes (e.g., navigating between proposals), use `useRef` + `mutate(newFallback, false)` to seed the cache for the new key.
- **Module-level cache for paginated hooks**: `useAllDReps` uses raw `fetch` (not SWR) for multi-page accumulation. Radix TabsContent unmounts children on tab switch, causing remount and re-fetch. Fix: module-level `Map<string, { data, timestamp }>` with TTL, checked in state initializer and effect.
- **`forceMount` with heavy tabs**: Using `forceMount` on multiple Radix TabsContent instances that each run expensive hooks (1500+ DRep processing) can crash the browser with `STATUS_ACCESS_VIOLATION`. Only `forceMount` tabs that truly need state preservation; accept remount for others.
- **Mesh SDK lazy import**: `@meshsdk/web3-sdk` throws at module evaluation time if Web Crypto API is unavailable (HTTP, not localhost). `next/dynamic` with `ssr: false` only prevents SSR — the chunk still crashes client-side. Use runtime conditional `import()` inside `useEffect` gated by `window.crypto?.subtle`:
  ```tsx
  function LazyComponent() {
    const [Comp, setComp] = useState<ComponentType | null>(null);
    useEffect(() => {
      if (!(window.crypto && window.crypto.subtle)) return;
      import("@/components/wallet/SomeComponent")
        .then((mod) => setComp(() => mod.SomeComponent))
        .catch(() => {});
    }, []);
    if (!Comp) return null;
    return <Comp />;
  }
  ```

---

## ISR + SWR Page Pattern

The landing page (`/`), proposal detail (`/governance/[hash]`), and DRep dashboard (`/drep`) all use this pattern for fast page loads:

1. **ISR** (`getStaticProps` + `revalidate: 60`) pre-renders pages server-side and caches them
2. **SWR hook** receives ISR data as `fallbackData` for instant hydration, skips initial fetch
3. **Redux sync** in the SWR hook's `useEffect` keeps backward compat with components reading from Redux
4. For dynamic routes with many possible values, use `getStaticPaths` with `paths: []` and `fallback: 'blocking'`
5. Use `revalidate: 10` on error for faster retry, `60` on success

**Module-level cache seeding**: When a hook uses its own module-level cache (like `useAllDReps`), ISR data must be seeded into that cache too — SWR `fallbackData` alone won't populate it:
```tsx
if (!isCacheValid && initialData?.length && !moduleCache.has(cacheKey)) {
  moduleCache.set(cacheKey, { data: initialData, timestamp: Date.now() });
}
```

**Server-side fetch functions**: Live in `src/lib/serverFetch.ts`. Use `fetchBackend<T>()` for typed API calls with auth headers.

---

## Data Conventions

- **Lovelace to ADA**: Transform in `services/api.ts`, never in components (1 ADA = 1,000,000 lovelace)
- **Proposal IDs**: Full = `{txHash}#{index}`, Display = first 8 + last 4 chars
- **Chart colors**: Always use `getChartColors(activeTheme.id)` from `shared/chartTheme`, never hardcode colors
- **Server-side aggregation**: When charts need N+1 API calls, create a server-side endpoint (see `add-api-route` skill). Cache aggressively (5 min for expensive endpoints).
- **Backend vote format**: Votes come as uppercase strings ("YES", "NO", "ABSTAIN"). Normalize at the transform layer (`normalizeVote()` in `useDRepData.ts`), not in components.
- **Backend proposal types**: Come as SCREAMING_SNAKE_CASE ("TREASURY_WITHDRAWALS"). Use `formatProposalType()` in `useDRepData.ts` for display.
- **Optional fields**: `votingPowerAda` may be absent on vote records — fall back to `votingPower` (lovelace) / 1_000_000.

---

## D3 Custom Visualizations

For charts beyond Recharts (bubble maps, treemaps, force layouts), use D3 directly with SVG.

### Semantic Zoom Pattern
When adding zoom/pan to D3 SVG visualizations:
- Use `d3.zoom()` on the SVG element, track transform in React state
- Wrap all visual elements in `<g transform={translate(tx,ty) scale(k)}>`
- **Stroke width**: Adapt inversely — `baseStroke / k` keeps lines visually constant
- **Label font size**: Proportional to element radius — `Math.min(radius * 0.35, 14 / k)` ensures text never overflows
- **Character count**: Derive from available width — `radius * 1.6 / (fontSize * 0.6)`
- **Pack padding**: Keep minimal (1-2px) since padding scales with zoom level (4px becomes 240px at 60x)
- **Zoom extent**: `[1, 60]` works well for circle-packing where small elements need deep zoom
- **Tooltip**: Dismiss on zoom/pan events to avoid stale positioning
- **Container mouse leave**: Always add `onMouseLeave={handleMouseLeave}` on the container div, not just individual SVG elements — fast cursor exits miss element-level handlers

### Conditional Zoom Toggle
Zoom can be enabled/disabled via a prop by depending on it in the zoom `useEffect`:
- **Disable**: `d3.select(svg).on(".zoom", null)` + reset transform to identity
- **Enable**: Create and attach fresh zoom behavior
- Swap cursor class: `cursor-grab active:cursor-grabbing` when enabled, empty when disabled

### Programmatic Zoom-to-Target
To smoothly zoom to a specific element (e.g., from a search result):
```tsx
const k = Math.min(Math.max((SVG_HEIGHT * 0.3) / target.radius, 2), 30);
const tx = SVG_WIDTH / 2 - target.x * k;
const ty = SVG_HEIGHT / 2 - target.y * k;
const newTransform = d3.zoomIdentity.translate(tx, ty).scale(k);
d3.select(svg).transition().duration(1400).ease(d3.easeCubicInOut)
  .call(zoom.transform, newTransform);
```

### SVG Hover Z-Ordering
SVG has no `z-index` — elements paint in document order. To ensure hovered items render on top:
```tsx
(hoveredId ? [...items].sort((a, b) =>
  a.id === hoveredId ? 1 : b.id === hoveredId ? -1 : 0
) : items).map(...)
```

### Opacity Crossfade for Chart Switching
When switching between chart types or metrics:
1. Set opacity to 0 (CSS `transition: opacity 300ms`)
2. Wait 350ms via setTimeout (300ms transition + 50ms buffer)
3. Swap content (update state)
4. Set opacity back to 1

### React `key` Prop for Animation Reset
If a component has CSS hover transitions (e.g., `transition: transform 0.3s`) and D3 recalculates positions on data change, add `key={dataKey}` to force full remount. This prevents all elements from animating between old→new positions.

### Top-N Filter Pattern for Multi-Chart Views
When multiple chart types share a top-N filter, pass `topN?: number | null` as a prop and let each chart handle emphasis differently:
- **BubbleMap**: Enhanced shadow filters for top-N bubbles, labels only on top-N
- **TreeMap**: Full opacity + border for top-N tiles, dimmed for rest
- **Donut**: Top-N as individual slices, remainder aggregated into "Others"

All charts receive the full dataset — each applies the filter internally for consistent layout.

### D3 Donut Animation (without D3 transitions)
For fine-grained animation control in React, use `requestAnimationFrame` with a custom easing function instead of D3's transition system:
```tsx
function animateIn(slices: Slice[]) {
  const startTime = performance.now();
  function tick() {
    const t = easeInOutCubic(Math.min((performance.now() - startTime) / ANIM_MS, 1));
    setAnimatedSlices(slices.map(s => ({
      ...s, startAngle: s.startAngle * t, endAngle: s.endAngle * t,
    })));
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
```

### SVG Shadow Filters (Three-Theme)
```tsx
{isGame ? (
  // Game: white glow on hover, no persistent shadow
  <filter id="game-glow"><feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
    <feFlood floodColor="rgba(255,255,255,0.18)" result="color"/><feComposite in="color" in2="blur" operator="in" result="glow"/>
    <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
) : isDark ? (
  <filter id="shadow"><feGaussianBlur in="SourceAlpha" stdDeviation="4" />
    <feFlood floodColor="#0bd1a2" floodOpacity="0.3" /><feComposite ... /></filter>
) : (
  <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.25" /></filter>
)}
```
Game theme hover glow is applied conditionally: `filter={isGame && isHovered ? "url(#game-glow)" : getShadowFilter()}`

---

## Tab Styling with `data-state` Attributes

For proposal-detail-style tabs (pill buttons, not border-bottom), use `data-state` HTML attributes on plain `<button>` elements. This enables both Tailwind `data-[state=active]:` variants and game theme CSS `[data-state="active"]` selectors without Radix UI.

```tsx
<button
  data-state={isActive ? "active" : "inactive"}
  className="rounded-md border border-white/8 bg-white text-black px-3 py-1.5 text-xs font-semibold uppercase tracking-wide
    data-[state=active]:bg-black data-[state=active]:text-white
    dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2]
    dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black
    btn-neon"
>
  {label}
</button>
```

Game theme uses CSS class `game-tab-btn` / `game-tab-btn-active` with `[data-state="active"]` selectors.

---

## Dashboard Integration

- Charts receive `ChartProps` (`isLoading`, `className`)
- Card styling: use `chartCardClassName` + `chartCardGameClassName` from `shared/chartTheme`
- Grid snaps to 20px — all layout values must be multiples of 20
- `data-chart-card` attribute on wrappers prevents box-selection conflicts

---

## Context Window Conservation

**Critical**: Large files eat context fast when read repeatedly. Follow these rules to stay within limits:

- **Grep first, read second**: Use `Grep` with `-n` to find exact line numbers before reading. Never read 100+ lines to find a 3-line block.
- **Narrow reads**: Always pass `offset` and `limit` to `Read`. Aim for 10-20 lines around the target, not 100+.
- **One read per edit**: Read the target area once, make the edit, move on. Don't re-read to verify — trust the tool output.
- **Use `replace_all`**: When the same pattern repeats across a file (e.g., 3 identical chart configs), use `replace_all: true` on the shared string instead of reading and editing each instance separately.
- **Grep for context**: If you need to check if something exists or count occurrences, use `Grep` with `count` or `files_with_matches` mode — never read the whole file.
- **Batch related edits**: If changing colors in 3 const objects, read the range covering all 3 once (not 3 separate reads).
- **Skip verification reads**: After an edit, don't read the file to confirm — the Edit tool reports success/failure.
- **Subagents for exploration**: Use `Explore` agent for broad codebase research so findings don't bloat the main context.
