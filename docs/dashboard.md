# Dashboard Feature Documentation

## Overview

The Dashboard page (`/dashboard`) provides a fully customizable overview of Cardano governance data through interactive charts. Users can freely position, resize, show/hide charts, with all settings persisted to localStorage.

## File Structure

```
src/
├── pages/
│   └── dashboard.tsx                    # Dashboard page component
├── components/dashboard/
│   ├── index.ts                         # Barrel exports
│   ├── DashboardProvider.tsx            # Context + localStorage persistence
│   ├── DashboardGrid.tsx                # Free-form canvas container
│   ├── DashboardChartCard.tsx           # Draggable/resizable card wrapper
│   ├── ChartVisibilityDropdown.tsx      # Show/hide chart selector
│   └── charts/
│       ├── index.ts                     # Chart registry
│       ├── ChartSkeleton.tsx            # Loading placeholder
│       ├── ProposalStatusChart.tsx      # Active/Ratified/Enacted counts
│       ├── ProposalTypeChart.tsx        # Pie chart by action type
│       ├── NCLProgressChart.tsx         # Treasury NCL gauges
│       ├── VotingPowerChart.tsx         # DRep/SPO voting breakdown
│       └── ParticipationChart.tsx       # Vote participation rates
└── types/
    └── dashboard.ts                     # TypeScript types + constants
```

## Key Types

### ChartId
```typescript
type ChartId =
  | "proposal-status"
  | "proposal-type"
  | "ncl-progress"
  | "voting-power"
  | "participation";
```

### ChartLayout (Pixel-based positioning)
```typescript
interface ChartLayout {
  x: number;      // X position in pixels from left
  y: number;      // Y position in pixels from top
  width: number;  // Width in pixels
  height: number; // Height in pixels
}
```

### DashboardConfig (Persisted to localStorage)
```typescript
interface DashboardConfig {
  visibleCharts: ChartId[];              // Which charts are shown
  layouts: Record<ChartId, ChartLayout>; // Position/size of each chart
  version: number;                       // Schema version for migrations
}
```

## Architecture

### State Management

**DashboardProvider** (`src/components/dashboard/DashboardProvider.tsx`)
- React Context for dashboard state
- Persists to localStorage under key `"dashboard-config"`
- Handles schema migrations from older versions
- SSR-safe with `mounted` state pattern

Key context values:
- `config` - Current dashboard configuration
- `mounted` - Whether client-side hydration is complete
- `getLayout(chartId)` - Get layout for a chart
- `updateLayout(chartId, partial)` - Update chart position/size
- `toggleChartVisibility(chartId)` - Show/hide a chart
- `resetToDefaults()` - Reset all settings

### Layout System

**DashboardGrid** (`src/components/dashboard/DashboardGrid.tsx`)
- Free-form canvas using CSS `position: relative` container
- Cards use `position: absolute` with pixel coordinates
- No grid snapping - cards can be placed anywhere
- Overlapping is allowed for flexible repositioning
- Container height auto-expands based on card positions

**DashboardChartCard** (`src/components/dashboard/DashboardChartCard.tsx`)
- Handles drag-to-move via grip handle icon
- Handles resize from all 8 directions (4 edges + 4 corners)
- Click/drag/resize brings card to front (z-index management)
- Resize handles appear on hover

### Z-Index Layers
- `z-index: 1` - Inactive cards
- `z-index: 50` - Active/clicked card
- `z-index: 100` - Customize dropdown menu

## Layout Constraints

Defined in `src/types/dashboard.ts`:
```typescript
const LAYOUT_CONSTRAINTS = {
  minWidth: 280,
  minHeight: 200,
  maxWidth: 1200,
  maxHeight: 800,
  gap: 16,  // Reference only, not enforced
};
```

## Default Chart Layouts

```typescript
const DEFAULT_CHART_LAYOUTS = {
  "proposal-status": { x: 0, y: 0, width: 380, height: 320 },
  "proposal-type": { x: 396, y: 0, width: 380, height: 320 },
  "ncl-progress": { x: 792, y: 0, width: 380, height: 320 },
  "voting-power": { x: 0, y: 336, width: 580, height: 320 },
  "participation": { x: 596, y: 336, width: 580, height: 320 },
};
```

## Chart Registry

Charts are registered in `src/components/dashboard/charts/index.ts`:

```typescript
interface ChartDefinition {
  id: ChartId;
  title: string;
  description: string;
  component: ComponentType<ChartProps>;
  defaultVisible: boolean;
  defaultLayout: ChartLayout;
  icon?: ComponentType<{ className?: string }>;
}
```

## Adding a New Chart

1. Create chart component in `src/components/dashboard/charts/`:
```typescript
import type { ChartProps } from "@/types/dashboard";

export function MyNewChart({ isLoading, className }: ChartProps) {
  // Use Redux selectors for data
  // Use useTheme() for dark/light styling
  // Return chart wrapped in card styling
}
```

2. Add ChartId to `src/types/dashboard.ts`:
```typescript
export type ChartId = ... | "my-new-chart";
```

3. Add default layout to `DEFAULT_CHART_LAYOUTS`:
```typescript
"my-new-chart": { x: 0, y: 672, width: 380, height: 320 },
```

4. Register in `src/components/dashboard/charts/index.ts`:
```typescript
import { MyNewChart } from "./MyNewChart";

export const CHART_REGISTRY: ChartDefinition[] = [
  // ... existing charts
  {
    id: "my-new-chart",
    title: "My New Chart",
    description: "Description shown in customize dropdown",
    component: MyNewChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["my-new-chart"],
    icon: SomeIcon,
  },
];
```

5. Export from `src/components/dashboard/charts/index.ts`:
```typescript
export { MyNewChart } from "./MyNewChart";
```

## Chart Component Pattern

All charts follow this pattern:
```typescript
export function ExampleChart({ isLoading, className }: ChartProps) {
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;

  // Get data from Redux
  const data = useSelector(selectSomeData);

  if (isLoading || !data) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <div className={cn(
      "rounded-2xl p-4 h-full",
      isDark ? "bg-[#1a1a2e] border border-[#0bd1a2]" : "bg-white border shadow-sm",
      className
    )}>
      <h3 className={cn("text-lg font-semibold mb-4", isDark ? "text-[#0bd1a2]" : "text-gray-900")}>
        Chart Title
      </h3>
      {/* Chart content using Recharts */}
    </div>
  );
}
```

## User Interactions

### Moving a Card
1. Hover over card to reveal grip handle (top-right)
2. Click and drag the grip handle
3. Card moves freely to any position
4. Release to place

### Resizing a Card
1. Hover over card edges/corners to reveal resize handles
2. Drag any edge or corner
3. Card resizes within min/max constraints
4. Release to confirm size

### Showing/Hiding Charts
1. Click "Customize" button
2. Toggle checkboxes for each chart
3. Click "Reset" to restore defaults

### Bringing Card to Front
- Click anywhere on a card to bring it to front
- Dragging or resizing also brings card to front

## localStorage Schema

Key: `"dashboard-config"`

```json
{
  "visibleCharts": ["proposal-status", "proposal-type", ...],
  "layouts": {
    "proposal-status": { "x": 0, "y": 0, "width": 380, "height": 320 },
    ...
  },
  "version": 6
}
```

## SSR Safety

The dashboard uses the mounted state pattern for SSR compatibility:
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

if (!mounted) {
  return <LoadingSkeleton />;
}
```

This prevents hydration mismatches when localStorage values differ from server-rendered defaults.
