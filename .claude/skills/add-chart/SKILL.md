---
name: add-chart
updated: 2026-03-03
description: Scaffold a new dashboard chart component with registry, types, and proper theme integration.
argument-hint: [ChartName] [chartType]
allowed-tools: Read, Edit, Write, Glob, Grep
---

# Add Dashboard Chart

Create a new chart for a dashboard with proper theme integration for all 3 themes (light, dark, game).

For theming rules, Recharts gotchas, and i18n conventions, see `_patterns.md`.

## Arguments

- `$0` - Chart name in PascalCase (e.g., `VoterTurnout`)
- `$1` - Chart type: `bar`, `pie`, `line`, `area` (default: `bar`)

---

## Step 1: Create Chart Component

Create file at `src/components/dashboards/{dashboard}/charts/${$0}Chart.tsx`:

```typescript
import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import type { ChartProps } from "@/types/dashboard";
import {
  getChartColors,
  ChartTooltip,
  chartCardClassName,
  chartCardGameClassName,
} from "@/components/dashboards/shared/chartTheme";
// Import Recharts components based on chart type
// Bar: BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
// Pie: PieChart, Pie, Cell, Tooltip, ResponsiveContainer
// Line: LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer

export function ${$0}Chart({ isLoading, className }: ChartProps) {
  const { actions } = useAppSelector((state) => state.governance);
  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);
  const isGame = activeTheme.id === "game";

  const data = useMemo(() => {
    // TODO: Transform data for this chart
    return [];
  }, [actions]);

  if (isLoading) return <ChartSkeleton className={className} />;

  return (
    <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
      <h3
        className="text-sm font-semibold mb-4 dark:text-[#0bd1a2]"
        style={isGame ? { color: chartColors.tooltipText } : undefined}
      >
        Chart Title
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {/* Chart implementation */}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

---

## Styling Quick Reference

### Axes
```typescript
<XAxis
  dataKey="name"
  tick={{ fontSize: 11, fill: chartColors.axisText }}
  axisLine={{ stroke: chartColors.axisLine }}
  tickLine={false}
/>
```

### Tooltip — always use ChartTooltip (never `contentStyle`)
```typescript
<Tooltip content={<ChartTooltip themeId={activeTheme.id} />} />
// With formatters:
<Tooltip content={<ChartTooltip themeId={activeTheme.id} valueFormatter={(v) => `${v} proposals`} />} />
```

### Bar
```typescript
<Bar dataKey="value" fill={chartColors.primary} radius={0} />
```

### Pie/Donut
```typescript
<Pie data={data} dataKey="count" innerRadius="30%" outerRadius="55%" paddingAngle={2}
  animationDuration={500} animationEasing="ease-in-out">
  {data.map((entry, i) => (
    <Cell key={i} fill={entry.fill} stroke={chartColors.tooltipBg} strokeWidth={2} />
  ))}
</Pie>
```

**Pie overflow clipping**: See `_patterns.md` Recharts section for the 3-layer fix.

### Line/Area
```typescript
<Line type="monotone" dataKey="value" stroke={chartColors.primary} strokeWidth={2}
  dot={false} activeDot={{ r: 5, cursor: "pointer" }} />
```

### Empty State
```typescript
{data.length === 0 ? (
  <p className="text-sm text-muted-foreground">No data available</p>
) : (
  <div className="flex-1 min-h-0"><ResponsiveContainer>...</ResponsiveContainer></div>
)}
```

---

## Available Chart Colors (`chartColors`)

```typescript
// Status: .active, .ratified, .enacted, .expired
// Votes: .yes, .no, .abstain
// Participation: .participationLow/MedLow/MedHigh/High
// Categorical: .palette[0..6] (7 colors per theme)
// Chrome: .axisLine, .axisText, .gridLine, .tooltipBg, .tooltipBorder, .tooltipText
// Accent: .primary, .primaryMuted
```

---

## Step 2: Update CHART_REGISTRY

Edit `src/components/dashboards/{dashboard}/charts/index.tsx`:

```typescript
// Add dynamic import
const ${$0}Chart = dynamic(
  () => import("./${$0}Chart").then((mod) => mod.${$0}Chart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

// Add to CHART_REGISTRY array
{
  id: "${kebab-case}",
  title: "${Human Title}",
  description: "${Description}",
  component: ${$0}Chart,
  defaultVisible: true,
  defaultLayout: DEFAULT_CHART_LAYOUTS["${kebab-case}"],
  icon: BarChart3,  // Options: BarChart3, PieChart, TrendingUp, Users, Vote, Gauge
},

// Add to exports
export { ${$0}Chart };
```

---

## Step 3: Update types/dashboard.ts

1. Add `"${kebab-case}"` to the relevant `ChartId` union type
2. Add to `ALL_CHART_IDS` array
3. Add to `DEFAULT_CHART_LAYOUTS`:
```typescript
"${kebab-case}": { x: 0, y: 1000, width: 380, height: 320 },
// All values must be multiples of 20. Sizes: Small 380x320, Medium 580x320, Large 780x320
```

---

## Color Customization (optional)

Allow users to click chart elements to customize colors via side panel:

```typescript
import { useChartColors } from "@/components/dashboards/shared/ChartColorsContext";
import { useDashboard } from "@/components/dashboards/shared/DashboardProvider";

const CHART_ID = "my-chart";
const { getColor } = useChartColors();
const { setColorPickerTarget } = useDashboard();

// Get color with fallback
const barColor = getColor(CHART_ID, "Active", chartColors.active);

// Click handler
const handleClick = (key: string, label: string) =>
  setColorPickerTarget({ chartId: CHART_ID, chartTitle: "My Chart", elementKey: key, elementLabel: label });

// On elements
<Cell fill={getColor(CHART_ID, entry.key, entry.defaultFill)} onClick={() => handleClick(entry.key, entry.key)} style={{ cursor: "pointer" }} />
```

---

## i18n

```typescript
import { useTranslations } from "next-intl";
const t = useTranslations("charts");
<h3>{t("myChart.title")}</h3>
```

Add entries to all 7 locale files under `src/messages/{locale}.json` → `"charts"` namespace.

---

## SWR Hooks for Non-Redux Data

For charts fetching their own data (e.g., DRep charts), use SWR hooks from `src/hooks/useDRepData.ts`:

```typescript
const { dreps, isLoading: drepsLoading } = useDRepList({ pageSize: 50 });
```

When data requires N+1 calls, create a server-side API route instead (see `add-api-route` skill).

---

## Verification Checklist

1. [ ] Uses `useTheme()` and `getChartColors()`
2. [ ] Card wrapper uses `chartCardClassName` / `chartCardGameClassName`
3. [ ] Tooltip uses `ChartTooltip` (not `contentStyle`)
4. [ ] All colors from `chartColors`, not hardcoded
5. [ ] Loading state uses `<ChartSkeleton />`
6. [ ] Empty state handled
7. [ ] Game theme has NO colored borders on cards
8. [ ] `npm run build` passes
9. [ ] Test all 3 themes visually
10. [ ] Pie/donut: 3-layer overflow fix applied (see `_patterns.md`)
