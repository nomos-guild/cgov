# Phase 5: Frontend - Dashboard Refactor
Status: Complete
Prerequisite: Phase 4

## Scope
Make shared dashboard components registry-agnostic (~30 lines across 3 files). Zero changes to governance page.

The shared dashboard components hard-code governance. We add optional props with defaults
so governance works identically (zero changes to governance page) while development_activity
can pass its own registry.

## Steps
18. `DashboardProvider.tsx`: add optional `dashboardId`, `chartRegistry`, `defaultLayouts` props
    - Defaults to governance values -> governance page needs zero changes
    - Namespace localStorage key: `${dashboardId}-dashboard-config`
    - Pass chartRegistry through context
19. `DashboardGrid.tsx` line 5: remove governance import, read registry from context
20. `ChartVisibilityDropdown.tsx` line 5: remove governance import, read from context
21. Extend `ChartId` type with dev activity chart IDs (GovernanceChartId | DevActivityChartId)
22. Rename `dashboards/phil/` -> `dashboards/development_activity/`
23. **Regression test**: open governance dashboard, verify it looks and behaves identically

---

## DashboardGrid Refactor (detail)

Three shared components hard-code governance chart imports. Must be made registry-agnostic:

**`DashboardGrid.tsx` line 5:**
```typescript
// BEFORE: import { CHART_REGISTRY, getChartById } from "@/components/dashboards/governance/charts";
// AFTER:  receive registry via DashboardProvider context
```

**`ChartVisibilityDropdown.tsx` line 5:**
```typescript
// BEFORE: import { getChartById } from "@/components/dashboards/governance/charts";
// AFTER:  receive getChartById via DashboardProvider context
```

**`DashboardProvider.tsx` line 19:**
```typescript
// BEFORE: const STORAGE_KEY = "dashboard-config";
// AFTER:  const STORAGE_KEY = `${dashboardId}-dashboard-config`;
```

**`DashboardProvider.tsx` lines 35-46:**
```typescript
// BEFORE: filters visibleCharts through ALL_CHART_IDS (governance-only)
// AFTER:  filters through validChartIds from the registry prop
```

**Approach:** Add props to `DashboardProvider`:
```typescript
interface DashboardProviderProps {
  dashboardId: string;              // localStorage namespace: "governance" | "development_activity"
  chartRegistry: ChartDefinition[]; // the charts for this dashboard
  defaultLayouts: ChartLayoutMap;   // default positions
  children: React.ReactNode;
}
```

DashboardGrid and ChartVisibilityDropdown read registry from context instead of imports.

---

## ChartId Type (types/dashboard.ts)

Extend the existing union with development activity chart IDs:
```typescript
export type GovernanceChartId =
  | "proposal-status" | "proposal-type" | "ncl-progress"
  | "voting-power" | "participation" | "proposal-submission";

export type DevActivityChartId =
  | "ecosystem-kpis" | "ecosystem-activity" | "top-repos"
  | "contributors" | "pr-status" | "health-rates"
  | "star-fork-trends" | "language-trends"
  | "ecosystem-network" | "recent-activity";

export type ChartId = GovernanceChartId | DevActivityChartId;
```

---

## Files to Modify
- `DashboardProvider.tsx`
- `DashboardGrid.tsx`
- `ChartVisibilityDropdown.tsx`
- `types/dashboard.ts`
- Rename `dashboards/phil/` -> `dashboards/development_activity/`
