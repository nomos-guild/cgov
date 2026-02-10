---
name: add-dashboard
updated: 2026-02-04
description: Create a new customizable dashboard with its own chart registry, provider, and page. Use when adding dashboards like DRep or SPO dashboard.
argument-hint: [DashboardName]
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Add New Dashboard

Create a complete new dashboard instance with its own charts, state management, and page.

## Arguments

- `$0` - Dashboard name in PascalCase (e.g., `DRep`, `SPO`, `Voter`)

## Architecture Overview

Each dashboard is a self-contained module with these features:
- **Charts**: Lazy-loaded chart components in a registry
- **Side Panel**: Tabbed panel for Charts, Elements, Layout, Share
- **Text Elements**: User-addable text labels
- **Page Margins**: Draggable margin handles for width control
- **Multi-Select**: Box selection and Ctrl+click for multiple elements
- **localStorage**: All settings persist per-dashboard

```
src/
├── components/dashboards/
│   ├── shared/                    # Reused across all dashboards
│   │   ├── DashboardProvider.tsx  # State + localStorage (COPY & MODIFY)
│   │   ├── DashboardGrid.tsx      # Canvas with selection (COPY & MODIFY)
│   │   ├── DashboardChartCard.tsx # Chart wrapper (REUSE AS-IS)
│   │   ├── DashboardTextElement.tsx # Text labels (REUSE AS-IS)
│   │   ├── DashboardSidePanel.tsx # Customization panel (COPY & MODIFY)
│   │   ├── DashboardMarginHandles.tsx # Margin controls (REUSE AS-IS)
│   │   └── chartTheme.ts          # Theme colors (REUSE AS-IS)
│   │
│   ├── governance/                # Reference implementation
│   │   └── charts/
│   │       ├── index.tsx          # CHART_REGISTRY
│   │       └── *.tsx              # Chart components
│   │
│   └── ${lowercase}/              # YOUR NEW DASHBOARD
│       ├── charts/
│       │   ├── index.tsx          # CHART_REGISTRY for this dashboard
│       │   └── *.tsx              # Chart components
│       ├── ${$0}DashboardProvider.tsx
│       ├── ${$0}DashboardGrid.tsx
│       ├── ${$0}DashboardSidePanel.tsx
│       └── index.ts               # Barrel export
│
├── pages/
│   ├── dashboard.tsx              # Governance dashboard page
│   └── ${lowercase}-dashboard.tsx # YOUR NEW DASHBOARD PAGE
│
└── types/
    └── ${lowercase}-dashboard.ts  # Dashboard-specific types
```

---

## Step 1: Create Dashboard Directory Structure

```bash
mkdir -p src/components/dashboards/${lowercase}/charts
```

---

## Step 2: Create Chart Registry

Create `src/components/dashboards/${lowercase}/charts/index.tsx`:

```typescript
import dynamic from "next/dynamic";
import { BarChart3 } from "lucide-react";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import type { ChartDefinition } from "@/types/dashboard";
import { DEFAULT_${UPPERCASE}_CHART_LAYOUTS } from "@/types/${lowercase}-dashboard";

// Lazy load chart components
const Example${$0}Chart = dynamic(
  () => import("./Example${$0}Chart").then((mod) => mod.Example${$0}Chart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const ${UPPERCASE}_CHART_REGISTRY: ChartDefinition[] = [
  {
    id: "example-chart",
    title: "Example Chart",
    description: "Description of what this chart shows",
    component: Example${$0}Chart,
    defaultVisible: true,
    defaultLayout: DEFAULT_${UPPERCASE}_CHART_LAYOUTS["example-chart"],
    icon: BarChart3,
  },
];

export function get${$0}ChartById(id: string): ChartDefinition | undefined {
  return ${UPPERCASE}_CHART_REGISTRY.find((chart) => chart.id === id);
}

export { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
export { Example${$0}Chart };
```

---

## Step 3: Create Dashboard Types

Create `src/types/${lowercase}-dashboard.ts`:

```typescript
import type { ChartLayout, TextElement, PageMargins } from "./dashboard";
import { PAGE_MARGIN_CONSTRAINTS, DEFAULT_PAGE_MARGINS } from "./dashboard";

/**
 * Chart IDs for the ${$0} dashboard
 */
export type ${$0}ChartId = "example-chart";

/**
 * All ${$0} chart IDs
 */
export const ALL_${UPPERCASE}_CHART_IDS: ${$0}ChartId[] = ["example-chart"];

/**
 * Default layouts for ${$0} dashboard charts
 */
export const DEFAULT_${UPPERCASE}_CHART_LAYOUTS: Record<${$0}ChartId, ChartLayout> = {
  "example-chart": { x: 0, y: 0, width: 380, height: 320 },
};

/**
 * ${$0} dashboard configuration
 */
export interface ${$0}DashboardConfig {
  visibleCharts: ${$0}ChartId[];
  chartOrder: ${$0}ChartId[];
  layouts: Record<${$0}ChartId, ChartLayout>;
  textElements: TextElement[];
  pageMargins: PageMargins;
  version: number;
}

export const DEFAULT_${UPPERCASE}_DASHBOARD_CONFIG: ${$0}DashboardConfig = {
  visibleCharts: ALL_${UPPERCASE}_CHART_IDS,
  chartOrder: ALL_${UPPERCASE}_CHART_IDS,
  layouts: DEFAULT_${UPPERCASE}_CHART_LAYOUTS,
  textElements: [],
  pageMargins: DEFAULT_PAGE_MARGINS,
  version: 1,
};

// Re-export shared constraints
export { PAGE_MARGIN_CONSTRAINTS };
```

---

## Step 4: Create Dashboard Provider

Create `src/components/dashboards/${lowercase}/${$0}DashboardProvider.tsx`:

Copy from `shared/DashboardProvider.tsx` and modify:

1. Change `STORAGE_KEY` to `"${lowercase}-dashboard-config"`
2. Update imports to use `${$0}ChartId`, `${$0}DashboardConfig`, etc.
3. Update default config imports
4. Rename context and hook

Key changes:

```typescript
const STORAGE_KEY = "${lowercase}-dashboard-config";

// Update all type references
import type {
  ${$0}ChartId,
  ${$0}DashboardConfig,
} from "@/types/${lowercase}-dashboard";
import {
  DEFAULT_${UPPERCASE}_DASHBOARD_CONFIG,
  DEFAULT_${UPPERCASE}_CHART_LAYOUTS,
  ALL_${UPPERCASE}_CHART_IDS,
  PAGE_MARGIN_CONSTRAINTS,
} from "@/types/${lowercase}-dashboard";

// Context value includes all these methods:
interface ${$0}DashboardContextValue {
  config: ${$0}DashboardConfig;
  mounted: boolean;
  isChartVisible: (chartId: ${$0}ChartId) => boolean;
  toggleChartVisibility: (chartId: ${$0}ChartId) => void;
  setVisibleCharts: (chartIds: ${$0}ChartId[]) => void;
  getLayout: (chartId: ${$0}ChartId) => ChartLayout;
  updateLayout: (chartId: ${$0}ChartId, layout: Partial<ChartLayout>) => void;
  reorderCharts: (fromIndex: number, toIndex: number) => void;
  resetToDefaults: () => void;
  addTextElement: () => void;
  updateTextElement: (id: string, updates: Partial<TextElement>) => void;
  removeTextElement: (id: string) => void;
  updatePageMargins: (margins: Partial<PageMargins>) => void;
  exportConfig: () => string;
  importConfig: (code: string) => { success: boolean; error?: string };
}

// Rename exports
export function ${$0}DashboardProvider({ children }) { ... }
export function use${$0}Dashboard() { ... }
```

---

## Step 5: Create Dashboard Grid

Create `src/components/dashboards/${lowercase}/${$0}DashboardGrid.tsx`:

Copy from `shared/DashboardGrid.tsx` and modify:

1. Import from your chart registry: `${UPPERCASE}_CHART_REGISTRY, get${$0}ChartById`
2. Use your dashboard hook: `use${$0}Dashboard`
3. Update type references to `${$0}ChartId`

### Key Features to Preserve

**Data Attributes** (required for selection exclusion):
```typescript
// Charts use data-chart-card
<DashboardChartCard data-chart-card ... />

// Text elements use data-text-element
<DashboardTextElement data-text-element ... />
```

**Document-Level Selection Handler**:
```typescript
useEffect(() => {
  const handleMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Exclude interactive elements from starting selection
    if (target.closest("[data-chart-card], [data-text-element], [data-margin-handle], button, [role='button'], input, textarea, a")) {
      return;
    }
    // Start selection box...
  };
  document.addEventListener("mousedown", handleMouseDown);
  return () => document.removeEventListener("mousedown", handleMouseDown);
}, []);
```

**Card Position Constraints** (when margins change):
```typescript
useEffect(() => {
  if (!mounted || containerWidth < 400) return;
  for (const chartId of config.visibleCharts) {
    const layout = getLayout(chartId);
    const maxX = Math.max(0, containerWidth - layout.width);
    if (layout.x > maxX) {
      updateLayout(chartId, { x: snapToGrid(maxX) });
    }
  }
}, [containerWidth, mounted, ...]);
```

---

## Step 6: Create Side Panel

Create `src/components/dashboards/${lowercase}/${$0}DashboardSidePanel.tsx`:

Copy from `shared/DashboardSidePanel.tsx` and modify:

1. Import your chart registry: `get${$0}ChartById`
2. Use your dashboard hook: `use${$0}Dashboard`

### Side Panel Tabs

The panel has 4 tabs:

| Tab | Purpose |
|-----|---------|
| **Charts** | Toggle visibility, reorder via drag |
| **Elements** | Add/manage text labels |
| **Layout** | Page margin sliders |
| **Share** | Export/import config as base64 |

---

## Step 7: Create Dashboard Page

Create `src/pages/${lowercase}-dashboard.tsx`:

```typescript
import { useRef } from "react";
import Head from "next/head";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import {
  ${$0}DashboardProvider,
  ${$0}DashboardGrid,
  ${$0}DashboardSidePanel,
  use${$0}Dashboard,
} from "@/components/dashboards/${lowercase}";
import { DashboardMarginHandles } from "@/components/dashboards/shared";

// Add your data loading hook
// import { use${$0}DataLoader } from "@/hooks/use${$0}Data";

function ${$0}DashboardContent() {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const { config, mounted } = use${$0}Dashboard();
  const gridAreaRef = useRef<HTMLDivElement>(null);

  // Replace with your data loader
  const isLoading = false;
  const error = null;
  const hasData = true;

  // Calculate padding based on margins
  const minPadding = 24;
  const leftPadding = Math.max(minPadding, config.pageMargins.left);
  const rightPadding = Math.max(minPadding, config.pageMargins.right);

  return (
    <>
      <Head>
        <title>${$0} Dashboard - CGOV</title>
        <meta name="description" content="${$0} Dashboard" />
      </Head>
      <div className="min-h-screen bg-background">
        {/* Margin handles - only show when mounted */}
        {mounted && <DashboardMarginHandles containerRef={gridAreaRef} />}

        {/* Full-width container with dynamic padding */}
        <div
          className="py-4 sm:py-6 md:py-8 transition-[padding] duration-75"
          style={{
            paddingLeft: leftPadding,
            paddingRight: rightPadding,
          }}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
            <div className="text-left">
              <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 md:mb-4 text-black dark:text-foreground">
                ${$0} Dashboard
              </h1>
              <p className="landing-subtitle text-muted-foreground text-sm sm:text-base md:text-lg">
                Your customizable ${$0} overview
              </p>
            </div>
            <${$0}DashboardSidePanel />
          </div>

          {/* Loading state */}
          {isLoading && !hasData && (
            isGame ? (
              <div className="flex items-center justify-center py-24">
                <GameLoader />
              </div>
            ) : (
              <Card className="p-12 mb-6">
                <div className="flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              </Card>
            )
          )}

          {/* Error state - inline warning, doesn't block content */}
          {error && (
            <Card className="p-3 sm:p-4 mb-4 sm:mb-6 border-destructive/50 bg-destructive/5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            </Card>
          )}

          {/* Dashboard Grid - show even if some data fails */}
          {(hasData || (!isLoading && error)) && (
            <div ref={gridAreaRef}>
              <${$0}DashboardGrid isLoading={isLoading} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function ${$0}Dashboard() {
  return (
    <${$0}DashboardProvider>
      <${$0}DashboardContent />
    </${$0}DashboardProvider>
  );
}
```

---

## Step 8: Create First Chart

Create `src/components/dashboards/${lowercase}/charts/Example${$0}Chart.tsx`:

Use the `/add-chart` skill patterns but place in your dashboard's charts folder.

---

## Step 9: Create Barrel Export

Create `src/components/dashboards/${lowercase}/index.ts`:

```typescript
export { ${$0}DashboardProvider, use${$0}Dashboard } from "./${$0}DashboardProvider";
export { ${$0}DashboardGrid } from "./${$0}DashboardGrid";
export { ${$0}DashboardSidePanel } from "./${$0}DashboardSidePanel";
export { ${UPPERCASE}_CHART_REGISTRY, get${$0}ChartById } from "./charts";
```

---

## Step 10: Add Navigation Link (Optional)

Update header navigation to include link to new dashboard.

---

## Data Attributes Reference

These data attributes are used for selection box exclusion:

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-chart-card` | Chart wrapper | Exclude from selection start |
| `data-text-element` | Text label | Exclude from selection start |
| `data-margin-handle` | Margin lines | Exclude from selection start |

When dragging starts on elements with these attributes, the selection box won't activate.

---

## Files Created Summary

| File | Purpose |
|------|---------|
| `components/dashboards/${lowercase}/charts/index.tsx` | Chart registry |
| `components/dashboards/${lowercase}/charts/Example${$0}Chart.tsx` | First chart |
| `components/dashboards/${lowercase}/${$0}DashboardProvider.tsx` | State management |
| `components/dashboards/${lowercase}/${$0}DashboardGrid.tsx` | Grid canvas with selection |
| `components/dashboards/${lowercase}/${$0}DashboardSidePanel.tsx` | Customization panel |
| `components/dashboards/${lowercase}/index.ts` | Barrel export |
| `types/${lowercase}-dashboard.ts` | Dashboard-specific types |
| `pages/${lowercase}-dashboard.tsx` | Dashboard page |

---

## Gotchas: Graceful Degradation

**Never gate all page content behind a single data endpoint's success.** When a page uses multiple independent API endpoints, each section should handle errors independently:

- Stats/summary cards: Show "--" when their endpoint fails
- Lists/tables from separate endpoints: Render even if stats fail
- Charts: Show empty state, not a full-page error
- Use inline warnings instead of full-page blocking error cards

**Anti-pattern:**
```tsx
{error && <FullPageError />}
{data && !error && <AllContent />}
```

**Correct pattern:**
```tsx
{!isLoading && (
  <>
    {error && <InlineWarning />}
    {data && <DataDependentSection />}
    <IndependentSection /> {/* always renders */}
  </>
)}
```

---

## Verification Checklist

1. [ ] Dashboard page renders at `/${lowercase}-dashboard`
2. [ ] Charts display with correct theming (all 3 themes)
3. [ ] Drag and resize work correctly
4. [ ] Layout persists to localStorage (separate from governance)
5. [ ] Side panel opens with all 4 tabs working
6. [ ] Text elements can be added and edited
7. [ ] Page margins can be adjusted via handles and sliders
8. [ ] Box selection works for multi-select
9. [ ] Export/import config works
10. [ ] Page degrades gracefully when backend endpoints fail (no full-page errors)
11. [ ] Run `npm run build` - no TypeScript errors
