---
name: add-dashboard
description: Create a new customizable dashboard with its own chart registry, provider, and page. Use when adding dashboards like DRep or SPO dashboard.
argument-hint: [DashboardName]
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Add New Dashboard

Create a complete new dashboard instance with its own charts, state management, and page.

## Arguments

- `$0` - Dashboard name in PascalCase (e.g., `DRep`, `SPO`, `Voter`)

## Architecture Overview

Each dashboard is a self-contained module:

```
src/
├── components/dashboards/
│   ├── shared/                    # Reused across all dashboards
│   │   ├── DashboardProvider.tsx  # State + localStorage (COPY & MODIFY)
│   │   ├── DashboardGrid.tsx      # Canvas (REUSE AS-IS or COPY)
│   │   ├── DashboardChartCard.tsx # Chart wrapper (REUSE AS-IS)
│   │   └── chartTheme.ts          # Theme colors (REUSE AS-IS)
│   │
│   ├── governance/                # Existing governance dashboard
│   │   └── charts/
│   │       ├── index.tsx          # CHART_REGISTRY
│   │       └── *.tsx              # Chart components
│   │
│   └── ${lowercase}/              # YOUR NEW DASHBOARD
│       └── charts/
│           ├── index.tsx          # CHART_REGISTRY for this dashboard
│           └── *.tsx              # Chart components
│
├── pages/
│   ├── dashboard.tsx              # Governance dashboard page
│   └── ${lowercase}-dashboard.tsx # YOUR NEW DASHBOARD PAGE
│
└── types/
    └── dashboard.ts               # Shared types (may need dashboard-specific types)
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
import type { ChartLayout } from "./dashboard";

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
  version: number;
}

export const DEFAULT_${UPPERCASE}_DASHBOARD_CONFIG: ${$0}DashboardConfig = {
  visibleCharts: ALL_${UPPERCASE}_CHART_IDS,
  chartOrder: ALL_${UPPERCASE}_CHART_IDS,
  layouts: DEFAULT_${UPPERCASE}_CHART_LAYOUTS,
  version: 1,
};
```

---

## Step 4: Create Dashboard Provider

Create `src/components/dashboards/${lowercase}/${$0}DashboardProvider.tsx`:

Copy from `shared/DashboardProvider.tsx` and modify:

1. Change `STORAGE_KEY` to `"${lowercase}-dashboard-config"`
2. Update imports to use `${$0}ChartId`, `${$0}DashboardConfig`, etc.
3. Update default config import
4. Rename context and hook:
   - `${$0}DashboardContext`
   - `${$0}DashboardProvider`
   - `use${$0}Dashboard`

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
} from "@/types/${lowercase}-dashboard";

// Rename exports
export function ${$0}DashboardProvider({ children }) { ... }
export function use${$0}Dashboard() { ... }
```

---

## Step 5: Create Dashboard Grid (Optional)

If using the same grid behavior, you can reuse `DashboardGrid` by making it generic.

Or create `src/components/dashboards/${lowercase}/${$0}DashboardGrid.tsx`:

Copy from `shared/DashboardGrid.tsx` and modify:
1. Import from your chart registry: `${UPPERCASE}_CHART_REGISTRY, get${$0}ChartById`
2. Use your dashboard hook: `use${$0}Dashboard`
3. Update type references to `${$0}ChartId`

---

## Step 6: Create Dashboard Page

Create `src/pages/${lowercase}-dashboard.tsx`:

```typescript
import Head from "next/head";
import { Card } from "@/components/ui/card";
import { GameLoader } from "@/components/ui/game-loader";
import { useTheme } from "@/lib/theme";
import {
  ${$0}DashboardProvider,
  ${$0}DashboardGrid,
  ${$0}ChartVisibilityDropdown,
} from "@/components/dashboards/${lowercase}";

// Add your data loading hook
// import { use${$0}DataLoader } from "@/hooks/use${$0}Data";

function ${$0}DashboardContent() {
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  // Replace with your data loader
  const isLoading = false;
  const error = null;
  const hasData = true;

  return (
    <>
      <Head>
        <title>${$0} Dashboard - CGOV</title>
        <meta name="description" content="${$0} Dashboard" />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
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
            <${$0}ChartVisibilityDropdown />
          </div>

          {/* Error state */}
          {error && (
            <Card className="p-4 sm:p-6 mb-4 sm:mb-6 border-destructive bg-destructive/10">
              <p className="text-destructive font-medium text-center">{error}</p>
            </Card>
          )}

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

          {/* Dashboard Grid */}
          {hasData && <${$0}DashboardGrid isLoading={isLoading} />}
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

## Step 7: Create First Chart

Create `src/components/dashboards/${lowercase}/charts/Example${$0}Chart.tsx`:

Use the `/add-chart` skill patterns but place in your dashboard's charts folder.

---

## Step 8: Create Barrel Export

Create `src/components/dashboards/${lowercase}/index.ts`:

```typescript
export { ${$0}DashboardProvider, use${$0}Dashboard } from "./${$0}DashboardProvider";
export { ${$0}DashboardGrid } from "./${$0}DashboardGrid";
export { ${$0}ChartVisibilityDropdown } from "./${$0}ChartVisibilityDropdown";
export { ${UPPERCASE}_CHART_REGISTRY, get${$0}ChartById } from "./charts";
```

---

## Step 9: Add Navigation Link (Optional)

Update header navigation to include link to new dashboard.

---

## Files Created Summary

| File | Purpose |
|------|---------|
| `components/dashboards/${lowercase}/charts/index.tsx` | Chart registry |
| `components/dashboards/${lowercase}/charts/Example${$0}Chart.tsx` | First chart |
| `components/dashboards/${lowercase}/${$0}DashboardProvider.tsx` | State management |
| `components/dashboards/${lowercase}/${$0}DashboardGrid.tsx` | Grid canvas |
| `components/dashboards/${lowercase}/${$0}ChartVisibilityDropdown.tsx` | Visibility toggle |
| `components/dashboards/${lowercase}/index.ts` | Barrel export |
| `types/${lowercase}-dashboard.ts` | Dashboard-specific types |
| `pages/${lowercase}-dashboard.tsx` | Dashboard page |

---

## Verification Checklist

1. [ ] Dashboard page renders at `/${lowercase}-dashboard`
2. [ ] Charts display with correct theming (all 3 themes)
3. [ ] Drag and resize work correctly
4. [ ] Layout persists to localStorage (separate from governance)
5. [ ] Chart visibility dropdown works
6. [ ] Run `npm run build` - no TypeScript errors
