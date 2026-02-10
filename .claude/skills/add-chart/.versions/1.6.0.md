---
name: add-chart
version: 1.6.0
created: 2026-02-02
last-evolved: 2026-02-03
evolution-count: 6
feedback-count: 2
description: Scaffold a new dashboard chart component with registry, types, and proper theme integration. Use when adding charts to the governance dashboard.
argument-hint: [ChartName] [chartType]
allowed-tools: Read, Edit, Write, Glob, Grep
---

# Add Dashboard Chart

Create a new chart for the governance dashboard with proper theme integration for all 3 themes (light, dark, game).

## Arguments

- `$0` - Chart name in PascalCase (e.g., `VoterTurnout`)
- `$1` - Chart type: `bar`, `pie`, `line`, `area` (default: `bar`)

## Theme System Overview

The app has 3 themes with distinct visual styles:

| Theme | Primary Color | Style |
|-------|---------------|-------|
| **Light** | Multi-color palette | Rounded corners, shadows, **pure white cards** |
| **Dark** | Cyan (#0bd1a2) | Sharp corners, cyan borders, transparent background |
| **Game** | White/grayscale | Retro pixel-art style, no borders |

**Key principles:**
- **Light theme cards: pure white (`bg-white`), NO borders, shadow only**
- Dark theme uses cyan (#0bd1a2) for almost everything, including borders
- Game theme uses white/grayscale only
- **Game theme cards have NO borders** - use `border-none` for game theme

---

## Step 1: Create Chart Component

Create file at `src/components/dashboards/governance/charts/${$0}Chart.tsx`:

```typescript
import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
// Import Recharts components based on chart type - see "Recharts Imports" section below
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import {
  getChartColors,
  ChartTooltip,
  chartCardClassName,
  chartCardGameClassName,
} from "@/components/dashboards/shared/chartTheme";

export function ${$0}Chart({ isLoading, className }: ChartProps) {
  // Redux state
  const { actions } = useAppSelector((state) => state.governance);

  // Theme hooks - REQUIRED for all charts
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  // Memoized data transformation
  const data = useMemo(() => {
    // TODO: Transform governance data for this chart
    return [];
  }, [actions]);

  // Loading state
  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        chartCardClassName,        // Base styles for all themes
        isGame && chartCardGameClassName,  // Game theme overrides
        className
      )}
    >
      {/* Title - theme-aware */}
      <h3
        className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]"
        style={isGame ? { color: chartColors.tooltipText } : undefined}
      >
        Chart Title
      </h3>

      {/* Chart container - always use flex-1 min-h-0 for proper sizing */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {/* Chart implementation - see styling guide below */}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

---

## Theme-Aware Styling Guide

### Available Chart Colors (`chartColors`)

```typescript
// Status colors (use for proposal status)
chartColors.active    // green (light) | cyan (dark) | white (game)
chartColors.ratified  // blue (light)  | cyan (dark) | gray (game)
chartColors.enacted   // purple (light)| cyan (dark) | gray (game)
chartColors.expired   // orange (light)| cyan (dark) | gray (game)

// Vote colors (use for yes/no/abstain)
chartColors.yes      // green | cyan | green
chartColors.no       // red   | red  | red
chartColors.abstain  // gray  | gray | gray

// Participation levels
chartColors.participationLow     // red (light) | cyan (dark) | dark gray (game)
chartColors.participationMedLow  // orange      | cyan        | gray
chartColors.participationMedHigh // yellow      | cyan        | light gray
chartColors.participationHigh    // green       | cyan        | white

// Categorical palette (for pie charts, multiple series)
chartColors.palette[0..6]  // 7 distinct colors per theme

// Chart chrome
chartColors.axisLine      // axis stroke color
chartColors.axisText      // tick label color
chartColors.gridLine      // grid line color (use with opacity)
chartColors.tooltipBg     // tooltip background
chartColors.tooltipBorder // tooltip border
chartColors.tooltipText   // tooltip text color

// Primary accent
chartColors.primary       // main accent color
chartColors.primaryMuted  // faded accent
```

### XAxis / YAxis Styling

```typescript
<XAxis
  dataKey="name"
  tick={{ fontSize: 11, fill: chartColors.axisText }}
  axisLine={{ stroke: chartColors.axisLine }}
  tickLine={false}  // Always hide tick lines for cleaner look
/>

<YAxis
  tick={{ fontSize: 11, fill: chartColors.axisText }}
  axisLine={{ stroke: chartColors.axisLine }}
  tickLine={false}
  width={40}  // Adjust based on label length
/>
```

### Tooltip Styling

**IMPORTANT:** Recharts `contentStyle` prop is unreliable. Always use the custom `ChartTooltip` component:

```typescript
import { ChartTooltip } from "@/components/dashboards/shared/chartTheme";

// Basic usage - theme-aware styling handled automatically
<Tooltip content={<ChartTooltip themeId={activeTheme.id} />} />

// With custom formatters
<Tooltip
  content={
    <ChartTooltip
      themeId={activeTheme.id}
      valueFormatter={(value) => `${value} proposals`}
      labelFormatter={(label) => `Category: ${label}`}
    />
  }
/>
```

The `ChartTooltip` component provides:
- White background with shadow (light theme)
- Dark background with cyan border (dark theme)
- Black background with white border (game theme)
- Proper text colors for readability

### Legend Styling

```typescript
<Legend
  wrapperStyle={{
    fontSize: "11px",
    color: chartColors.axisText,
  }}
/>
```

### Bar Chart

```typescript
<Bar
  dataKey="value"
  fill={chartColors.primary}  // Or use palette: chartColors.palette[0]
  radius={0}  // Always 0 for sharp corners (matches dark theme)
/>
```

### Pie Chart

```typescript
<Pie
  data={data}
  dataKey="count"
  nameKey="label"
  cx="50%"
  cy="45%"
  innerRadius="30%"  // Donut style
  outerRadius="55%"
  paddingAngle={2}
>
  {data.map((entry, index) => (
    <Cell
      key={`cell-${index}`}
      fill={entry.fill}  // Pre-assign from chartColors.palette
      stroke={chartColors.tooltipBg}
      strokeWidth={2}
    />
  ))}
</Pie>
```

### Light Theme Donut Chart Pattern

For light theme, use white primary slices with grey graduated colors for negative/neutral items. This creates an elegant, minimal aesthetic.

**Color pattern:**
- Primary (positive): `#ffffff` (pure white)
- Neutral: `#e2e8f0` (slate-200)
- Negative: `#94a3b8` (slate-400)

**SVG shadow filter for white slices:**

```typescript
const CHART_COLORS = {
  game: { positive: "#22c55e", neutral: "#6b7280", negative: "#ef4444" },
  light: { positive: "#ffffff", neutral: "#e2e8f0", negative: "#94a3b8" },
};

// In component:
const isLight = activeTheme.id === "light";
const colors = isGame ? CHART_COLORS.game : (isLight ? CHART_COLORS.light : CHART_COLORS.game);

<PieChart>
  <defs>
    {isLight && (
      <filter id="pieShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.25" />
      </filter>
    )}
  </defs>
  <Pie
    style={isLight ? { filter: "url(#pieShadow)" } : undefined}
  >
    {data.map((entry, index) => (
      <Cell
        key={`cell-${index}`}
        fill={entry.color}
        stroke={isLight ? "rgba(15, 23, 42, 0.15)" : "none"}
        strokeWidth={isLight ? 2 : 0}
      />
    ))}
  </Pie>
</PieChart>
```

### Custom Legend with Square Indicators

For inline legends below charts, use pure squares (not rounded) with borders for white items:

```tsx
{/* Legend */}
<div className="flex justify-center gap-4 mt-2">
  {data.map((item) => {
    const isWhite = isLight && item.color === "#ffffff";
    return (
      <div key={item.name} className="flex items-center gap-1.5 text-xs">
        <div
          className="w-2.5 h-2.5"  // Pure square, no rounded-*
          style={{
            backgroundColor: item.color,
            border: isWhite ? "1.5px solid rgba(15, 23, 42, 0.3)" : undefined,
            boxShadow: isLight ? "0 1px 3px rgba(15,23,42,0.2)" : undefined,
          }}
        />
        <span className={isGame ? "text-white/70" : "text-muted-foreground"}>
          {item.name}: {item.value}
        </span>
      </div>
    );
  })}
</div>
```

### Line/Area Chart

```typescript
<Line
  type="monotone"
  dataKey="value"
  stroke={chartColors.primary}
  strokeWidth={2}
  dot={false}  // Cleaner look without dots
  activeDot={{ r: 5, cursor: "pointer" }}  // Shows dot only on hover
/>

<Area
  type="monotone"
  dataKey="value"
  stroke={chartColors.primary}
  fill={chartColors.primaryMuted}
/>
```

### Making Line Clickable for Color Picker

```typescript
<Line
  onClick={handleLineClick}  // Opens color picker
  style={{ cursor: "pointer" }}
  dot={false}
  activeDot={{
    r: 5,
    cursor: "pointer",
    onClick: handleLineClick,  // Also opens on dot click
  }}
/>
```

### CartesianGrid (use sparingly)

```typescript
<CartesianGrid
  strokeDasharray="3 3"
  stroke={chartColors.gridLine}
  vertical={false}  // Usually only show horizontal lines
/>
```

---

## Chart Element Color Customization

Allow users to click on chart elements (bars, pie slices, lines, progress bars) to customize their colors via the side panel color picker.

### Required Imports

```typescript
import { useChartColors } from "@/components/dashboards/shared/ChartColorsContext";
import { useDashboard } from "@/components/dashboards/shared/DashboardProvider";
```

### Setup in Component

```typescript
const CHART_ID = "my-chart";  // kebab-case, unique per chart

export function MyChart({ isLoading, className }: ChartProps) {
  const { getColor } = useChartColors();
  const { setColorPickerTarget } = useDashboard();

  // Click handler to open color picker
  const handleElementClick = useCallback(
    (elementKey: string, elementLabel: string) => {
      setColorPickerTarget({
        chartId: CHART_ID,
        chartTitle: "My Chart",
        elementKey,      // Unique key for this element (e.g., "Active", "line")
        elementLabel,    // Human-readable label
      });
    },
    [setColorPickerTarget]
  );

  // Get color with fallback to default
  const barColor = getColor(CHART_ID, "Active", chartColors.active);
  // ...
}
```

### Pie/Donut Chart with Clickable Cells

```typescript
<Cell
  fill={getColor(CHART_ID, entry.status, entry.defaultFill)}
  style={{ cursor: "pointer" }}
  onClick={() => handleElementClick(entry.status, entry.status)}
/>
```

### Table Legend with Clickable Color Swatches

For donut charts, add a table legend below with clickable color indicators:

```tsx
<div className="flex-1 min-h-0" style={{ maxHeight: "55%" }}>
  <ResponsiveContainer>
    <PieChart>
      <Pie innerRadius="35%" outerRadius="70%" paddingAngle={3}>
        {data.map((entry) => (
          <Cell
            fill={getColor(CHART_ID, entry.key, entry.defaultFill)}
            onClick={() => handleClick(entry.key)}
            style={{ cursor: "pointer" }}
          />
        ))}
      </Pie>
    </PieChart>
  </ResponsiveContainer>
</div>

{/* Table Legend */}
<div className="mt-2 overflow-auto" style={{ maxHeight: "45%" }}>
  <table className="w-full text-xs" style={{ color: chartColors.axisText }}>
    <thead>
      <tr className="border-b border-current/20">
        <th className="text-left py-1 font-medium">Type</th>
        <th className="text-right py-1 font-medium w-16">Count</th>
        <th className="text-right py-1 font-medium w-14">%</th>
      </tr>
    </thead>
    <tbody>
      {data.map((item) => (
        <tr key={item.key} className="border-b border-current/10 last:border-0">
          <td className="py-1 flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm cursor-pointer hover:ring-2 hover:ring-blue-400"
              style={{ backgroundColor: getColor(CHART_ID, item.key, item.defaultFill) }}
              onClick={() => handleClick(item.key)}
              title="Click to change color"
            />
            <span className="truncate">{item.label}</span>
          </td>
          <td className="text-right py-1 tabular-nums">{item.count}</td>
          <td className="text-right py-1 tabular-nums">
            {((item.count / total) * 100).toFixed(0)}%
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Progress Bar Color Customization

For progress bars (like NCL chart), extend the Progress component:

```typescript
// In Progress component - add indicatorStyle prop
<Progress
  value={progress}
  onClick={onBarClick}
  className="cursor-pointer hover:ring-2 hover:ring-blue-400"
  indicatorClassName={cn("rounded-full", !customColor && "bg-white")}
  indicatorStyle={customColor ? { backgroundColor: customColor } : undefined}
/>
```

---

## Recharts Imports by Chart Type

### Bar Chart
```typescript
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  // Optional: CartesianGrid, Cell
} from "recharts";
```

### Pie Chart
```typescript
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
```

### Line Chart
```typescript
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  // Optional: CartesianGrid
} from "recharts";
```

### Area Chart
```typescript
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  // Optional: CartesianGrid
} from "recharts";
```

---

## Step 2: Update CHART_REGISTRY

Edit `src/components/dashboards/governance/charts/index.tsx`:

1. Add dynamic import (after existing imports, before CHART_REGISTRY):
```typescript
const ${$0}Chart = dynamic(
  () => import("./${$0}Chart").then((mod) => mod.${$0}Chart),
  { loading: () => <ChartSkeleton />, ssr: false }
);
```

2. Add to `CHART_REGISTRY` array:
```typescript
{
  id: "${kebab-case}",
  title: "${Human Title}",
  description: "${Description of what the chart shows}",
  component: ${$0}Chart,
  defaultVisible: true,
  defaultLayout: DEFAULT_CHART_LAYOUTS["${kebab-case}"],
  icon: BarChart3,  // Choose: BarChart3, PieChart, TrendingUp, Users, Vote, Gauge
},
```

3. Add to exports at bottom:
```typescript
export { ${$0}Chart };
```

---

## Step 3: Update types/dashboard.ts

Edit `src/types/dashboard.ts`:

1. Add to `ChartId` type:
```typescript
| "${kebab-case}"
```

2. Add to `ALL_CHART_IDS`:
```typescript
"${kebab-case}",
```

3. Add to `DEFAULT_CHART_LAYOUTS`:
```typescript
"${kebab-case}": { x: 0, y: 1000, width: 380, height: 320 },
```

Note: All values must be multiples of 20 (grid snap). Standard sizes:
- Small: 380×320
- Medium: 580×320
- Large: 780×320

---

## Empty State Pattern

Always handle empty data gracefully:

```typescript
const hasData = data.length > 0;

return (
  <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
    <h3 ...>Title</h3>

    {!hasData ? (
      <p className="text-sm text-muted-foreground">No data available</p>
    ) : (
      <div className="flex-1 min-h-0">
        <ResponsiveContainer>...</ResponsiveContainer>
      </div>
    )}
  </div>
);
```

---

---

## Dashboard Integration

Charts automatically integrate with the dashboard system. Here's how it works:

### Architecture Overview

```
DashboardProvider (state + localStorage)
  └── DashboardGrid (canvas with 20px grid)
        └── DashboardChartCard (drag/resize wrapper)
              └── YourChart (renders inside)
```

### What You DON'T Need to Handle

The dashboard infrastructure handles these automatically:
- **Drag & drop** - `DashboardChartCard` provides the drag handle
- **Resize** - 8 resize handles (corners + edges) on hover
- **Grid snapping** - All positions snap to 20px grid
- **Z-index/layering** - Active card comes to front
- **Selection** - Box selection + Ctrl+click multi-select
- **Persistence** - Layout saved to localStorage automatically
- **Visibility toggle** - `ChartVisibilityDropdown` controls this

### What Your Chart MUST Handle

1. **Accept `ChartProps`** - `isLoading` and `className` props
2. **Fill available space** - Use `h-full w-full` via className prop
3. **Self-contained styling** - Use `chartCardClassName` for card appearance
4. **Theme awareness** - All 3 themes must look correct

### Layout Constraints (from `types/dashboard.ts`)

```typescript
// Grid snapping
GRID_CONFIG.cellSize = 20;  // All values snap to 20px

// Size limits
LAYOUT_CONSTRAINTS = {
  minWidth: 280,   // 14 cells
  minHeight: 200,  // 10 cells
  maxWidth: 1200,  // 60 cells
  maxHeight: 800,  // 40 cells
};
```

### Default Layout Positioning

When adding `DEFAULT_CHART_LAYOUTS`, follow this grid:

```
Row 1 (y=0):    Small charts side-by-side (380×320 each)
Row 2 (y=340):  Medium charts (580×320)
Row 3 (y=680):  Large/wide charts (780×320)
```

**All x, y, width, height values must be multiples of 20.**

### Z-Index Layers

| Layer | Z-Index | Purpose |
|-------|---------|---------|
| Default card | 1 | Normal state |
| Selected card | 10 | Multi-selected |
| Active card | 50 | Being dragged/resized |
| Resize handles | 30 | Visible on hover |
| Selection box | 50 | Drag-select overlay |

### How DashboardChartCard Wraps Your Chart

```tsx
// DashboardChartCard provides outer positioning + controls
<div
  data-chart-card  // Used for selection box exclusion
  style={{ left, top, width, height, zIndex }}
>
  {/* Drag handle (top-right, visible on hover) */}
  {/* Hide button (X icon, visible on hover) */}
  {/* 8 resize handles (visible on hover) */}

  {/* Inner wrapper with theme-aware styling */}
  <div className={cn(
    "h-full w-full overflow-hidden",
    isGame
      ? "rounded-sm border-none bg-transparent"      // Game: NO borders
      : isDark
        ? "rounded-2xl border border-[#0bd1a2] bg-transparent"  // Dark: cyan border
        : "rounded-2xl border-none bg-white shadow-[0_12px_30px_rgba(15,23,42,0.25)]"  // Light: NO border, white + shadow
  )}>
    {/* YOUR CHART RENDERS HERE */}
    <ChartComponent isLoading={isLoading} className="h-full w-full" />
  </div>
</div>
```

### DashboardChartCard Props

| Prop | Type | Purpose |
|------|------|---------|
| `chart` | `ChartDefinition` | Chart from registry |
| `isLoading` | `boolean` | Passed to your chart |
| `isSelected` | `boolean` | True when multi-selected |
| `onHide` | `() => void` | Called when X button clicked |
| `onSelect` | `(id, additive) => void` | Called on click for selection |
| `onDragStart` | `() => void` | Notifies grid of drag |

**Important:** Game theme must NOT have colored borders. Always use a 3-way check: `isGame ? ... : isDark ? ... : ...`

Your chart receives `className="h-full w-full"` and should fill that space.

### Data Attributes

The `data-chart-card` attribute on the wrapper is used by the selection system. When a user clicks on an element with this attribute, the box selection won't start - allowing normal drag/resize behavior instead.

---

## Verification Checklist

After creating the chart:

1. [ ] Component uses `useTheme()` and `getChartColors()`
2. [ ] Card wrapper uses `chartCardClassName` and `chartCardGameClassName`
3. [ ] Title has `dark:text-[#0bd1a2]` and game style override
4. [ ] Tooltip uses theme-aware `borderRadius` (0 for dark themes)
5. [ ] All colors come from `chartColors`, not hardcoded
6. [ ] Chart container has `flex-1 min-h-0` for proper sizing
7. [ ] Loading state uses `<ChartSkeleton />`
8. [ ] Empty state handled gracefully
9. [ ] Run `npm run build` - no TypeScript errors
10. [ ] Test all 3 themes visually
11. [ ] **Verify game theme has NO colored borders on cards**
12. [ ] Test drag/resize in dashboard view
13. [ ] Verify chart appears in visibility dropdown
14. [ ] **Color customization**: Chart elements are clickable to open color picker
15. [ ] **Color customization**: Uses `getColor()` with fallback for all element colors
