# Dashboard Feature Documentation

## Overview

The Dashboard page (`/dashboard`) provides a fully customizable overview of Cardano governance data through interactive charts. Users can freely position, resize, show/hide charts, customize colors, add text elements, and share dashboard configurations. All settings persist to localStorage.

## File Structure

```
src/
├── pages/
│   └── dashboard.tsx                           # Dashboard page component
├── components/dashboards/
│   ├── index.ts                                # Dashboard barrel exports
│   ├── shared/                                 # Shared dashboard infrastructure
│   │   ├── index.ts                            # Barrel exports
│   │   ├── DashboardProvider.tsx               # Context + localStorage persistence
│   │   ├── DashboardGrid.tsx                   # Free-form canvas container
│   │   ├── DashboardChartCard.tsx              # Draggable/resizable card wrapper
│   │   ├── DashboardSidePanel.tsx              # Chart settings side panel
│   │   ├── DashboardTextElement.tsx            # Custom text items on canvas
│   │   ├── DashboardMarginHandles.tsx          # Page margin adjusters
│   │   ├── ChartCard.tsx                       # Card styling wrapper
│   │   ├── ChartVisibilityDropdown.tsx         # Show/hide chart selector
│   │   ├── ChartColorPicker.tsx                # Chart color customization
│   │   ├── SidePanelColorPicker.tsx            # Side panel color picker UI
│   │   ├── ChartColorsContext.tsx              # Color customization context
│   │   └── chartTheme.tsx                      # Chart theme utilities
│   ├── governance/                             # Governance dashboard
│   │   ├── index.ts                            # Barrel exports
│   │   └── charts/
│   │       ├── index.tsx                       # CHART_REGISTRY (7 charts)
│   │       ├── ChartSkeleton.tsx               # Loading placeholder
│   │       ├── ProposalStatusChart.tsx          # Active/Ratified/Enacted counts
│   │       ├── ProposalTypeChart.tsx            # Pie chart by action type
│   │       ├── NCLProgressChart.tsx             # Treasury NCL gauges
│   │       ├── ProposalSubmissionChart.tsx      # Proposals submitted per month
│   │       ├── DRepVotingPowerChart.tsx         # Top DRep voting power distribution
│   │       ├── DRepRationaleChart.tsx           # Votes with/without rationale
│   │       └── DRepMetricsCard.tsx              # Key DRep statistics card
│   ├── drep/charts/index.ts                    # DRep dashboard (placeholder)
│   └── phil/charts/index.ts                    # Phil's dashboard (placeholder)
└── types/
    └── dashboard.ts                            # TypeScript types + constants
```

## Key Types

### ChartId
```typescript
type ChartId =
  | "proposal-status"
  | "proposal-type"
  | "ncl-progress"
  | "proposal-submission"
  | "drep-voting-power"
  | "drep-rationale"
  | "drep-metrics";
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
  chartOrder: ChartId[];                 // Order in customize menu
  layouts: Record<ChartId, ChartLayout>; // Position/size of each chart
  textElements: TextElement[];           // Custom text items
  pageMargins: PageMargins;             // Page margin settings
  version: number;                       // Schema version for migrations
}
```

## Architecture

### Multi-Dashboard System

The dashboard uses a shared infrastructure that supports multiple dashboard types:

- **`dashboards/shared/`** — DashboardProvider, DashboardGrid, DashboardChartCard, etc.
- **`dashboards/governance/`** — Governance dashboard with 7 charts
- **`dashboards/drep/`** — DRep dashboard (placeholder for future)
- **`dashboards/phil/`** — Phil's dashboard (placeholder for future)

Each dashboard has its own `CHART_REGISTRY` in `charts/index.ts`.

### State Management

**DashboardProvider** (`src/components/dashboards/shared/DashboardProvider.tsx`)
- React Context for dashboard state
- Persists to localStorage
- Handles schema migrations from older config versions
- SSR-safe with `mounted` state pattern

Key context values:
- `config` — Current dashboard configuration
- `mounted` — Whether client-side hydration is complete
- `getLayout(chartId)` — Get layout for a chart
- `updateLayout(chartId, partial)` — Update chart position/size
- `toggleChartVisibility(chartId)` — Show/hide a chart
- `reorderCharts(from, to)` — Reorder charts in menu
- `addTextElement()` / `updateTextElement()` / `removeTextElement()` — Manage text items
- `updatePageMargins(margins)` — Adjust page margins
- `exportConfig()` / `importConfig(code)` — Share dashboard configurations
- `resetToDefaults()` — Reset all settings

### Layout System

**DashboardGrid** — Free-form canvas using `position: relative` container with absolute-positioned cards. No grid snapping. Overlapping is allowed.

**DashboardChartCard** — Handles drag-to-move via grip handle, resize from all 8 directions, click-to-front z-index management.

### Z-Index Layers
- `z-index: 1` — Inactive cards
- `z-index: 50` — Active/clicked card
- `z-index: 100` — Customize dropdown menu

## Chart Registry

Charts are registered in `src/components/dashboards/governance/charts/index.tsx`. All chart components are lazy-loaded with `dynamic()` and `ssr: false` to reduce initial bundle size.

| Chart | ID | Default Visible | Data Source |
|-------|----|:---:|-------------|
| Proposal Status | `proposal-status` | yes | Redux (governance actions) |
| Proposal Types | `proposal-type` | yes | Redux (governance actions) |
| NCL Progress | `ncl-progress` | yes | Redux (NCL data) |
| Proposal Submission | `proposal-submission` | yes | Redux (governance actions) |
| DRep Voting Power | `drep-voting-power` | no | SWR (useDRepData hooks) |
| DRep Rationales | `drep-rationale` | no | SWR (useDRepRationaleStats) |
| DRep Metrics | `drep-metrics` | no | SWR (useDRepStats) |

DRep charts use `defaultVisible: false` to avoid overwhelming existing users and because they require separate DRep API calls.

## Adding a New Chart

1. Create chart component in `src/components/dashboards/governance/charts/`:
```typescript
import type { ChartProps } from "@/types/dashboard";
export function MyNewChart({ isLoading, className }: ChartProps) { ... }
```

2. Add ChartId to `src/types/dashboard.ts`:
```typescript
export type ChartId = ... | "my-new-chart";
```

3. Add default layout to `DEFAULT_CHART_LAYOUTS` in `types/dashboard.ts`.

4. Add to `ALL_CHART_IDS` array in `types/dashboard.ts`.

5. Lazy-load and register in `src/components/dashboards/governance/charts/index.tsx`:
```typescript
const MyNewChart = dynamic(
  () => import("./MyNewChart").then((mod) => mod.MyNewChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

// Add to CHART_REGISTRY array
{ id: "my-new-chart", title: "My Chart", ..., defaultVisible: false }
```

6. Bump config `version` in `types/dashboard.ts` to trigger migration for existing users.

## User Interactions

### Moving a Card
Hover → grip handle appears (top-right) → drag to any position → release

### Resizing a Card
Hover over edges/corners → resize handles appear → drag → release

### Showing/Hiding Charts
Click "Customize" → toggle checkboxes → "Reset" restores defaults

### Text Elements
Add custom text labels anywhere on the dashboard canvas

### Sharing
Export → generates shareable config code → Import on another browser

### Color Customization
Click chart settings → color picker → customize per-chart colors via side panel

## localStorage Schema

Key: `"dashboard-config"`

```json
{
  "visibleCharts": ["proposal-status", "proposal-type", ...],
  "chartOrder": ["proposal-status", "proposal-type", ...],
  "layouts": {
    "proposal-status": { "x": 0, "y": 0, "width": 380, "height": 320 },
    ...
  },
  "textElements": [],
  "pageMargins": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
  "version": 10
}
```

Config version bumps trigger migration logic in DashboardProvider, preserving user customizations while adding new chart defaults.
