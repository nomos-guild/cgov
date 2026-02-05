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

---

## Data Conventions

- **Lovelace to ADA**: Transform in `services/api.ts`, never in components (1 ADA = 1,000,000 lovelace)
- **Proposal IDs**: Full = `{txHash}#{index}`, Display = first 8 + last 4 chars
- **Chart colors**: Always use `getChartColors(activeTheme.id)` from `shared/chartTheme`, never hardcode colors
- **Server-side aggregation**: When charts need N+1 API calls, create a server-side endpoint (see `add-api-route` skill). Cache aggressively (5 min for expensive endpoints).

---

## Dashboard Integration

- Charts receive `ChartProps` (`isLoading`, `className`)
- Card styling: use `chartCardClassName` + `chartCardGameClassName` from `shared/chartTheme`
- Grid snaps to 20px — all layout values must be multiples of 20
- `data-chart-card` attribute on wrappers prevents box-selection conflicts
