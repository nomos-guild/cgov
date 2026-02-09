# Shared Patterns

Cross-cutting knowledge that applies across multiple skills. When a pattern is learned in one context, it lives here so all skills benefit.

---

## Theming

Three distinct themes — never treat dark and game as the same.

| Theme | Background | Accent | Borders | Corners |
|-------|-----------|--------|---------|---------|
| **Light** | `bg-white` / `#faf9f6` | Black | None on cards (shadow only) | Rounded |
| **Dark** | `#1a1a2e` / `#131320` | Cyan `#0bd1a2` | Cyan borders | Rounded |
| **Game** | `bg-black` / `#080808` | Neon green `#00ff66` | None on cards | Sharp (`rounded-none`) |

**Critical rules:**
- `isDark` is true for BOTH dark AND game — always check `isGame` first
- Light theme cards: pure white, NO borders, shadow only
- Game theme cards: NO colored borders, NO colored elements
- Dark theme: cyan for almost everything
- **CSS specificity vs Tailwind**: Game theme CSS classes like `game-nav-btn` use `[data-theme="game"]` selectors with higher specificity than Tailwind utilities. You cannot override `height: 40px` from `game-nav-btn` with Tailwind `h-8`. Create a variant class (e.g., `game-nav-btn-sm`) instead.

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
- **Responsive sizing**: Chart container needs `flex-1 min-h-0`, then `<ResponsiveContainer width="100%" height="100%">`
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

Both the landing page (`/`) and proposal detail page (`/governance/[hash]`) use this pattern for fast page loads:

1. **ISR** (`getStaticProps` + `revalidate: 60`) pre-renders pages server-side and caches them
2. **SWR hook** receives ISR data as `fallbackData` for instant hydration, skips initial fetch
3. **Redux sync** in the SWR hook's `useEffect` keeps backward compat with components reading from Redux
4. For dynamic routes with many possible values, use `getStaticPaths` with `paths: []` and `fallback: 'blocking'`
5. Use `revalidate: 10` on error for faster retry, `60` on success

---

## Data Conventions

- **Lovelace to ADA**: Transform in `services/api.ts`, never in components (1 ADA = 1,000,000 lovelace)
- **Proposal IDs**: Full = `{txHash}#{index}`, Display = first 8 + last 4 chars
- **Chart colors**: Always use `getChartColors(activeTheme.id)` from `shared/chartTheme`, never hardcode colors
- **Server-side aggregation**: When charts need N+1 API calls, create a server-side endpoint (see `add-api-route` skill). Cache aggressively (5 min for expensive endpoints).

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

### SVG Shadow Filters (Three-Theme)
```tsx
{isGame ? (
  <filter id="shadow"><feGaussianBlur in="SourceAlpha" stdDeviation="3" />
    <feFlood floodColor="#00ff66" floodOpacity="0.4" /><feComposite ... /></filter>
) : isDark ? (
  <filter id="shadow"><feGaussianBlur in="SourceAlpha" stdDeviation="4" />
    <feFlood floodColor="#0bd1a2" floodOpacity="0.3" /><feComposite ... /></filter>
) : (
  <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.25" /></filter>
)}
```

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
