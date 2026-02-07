# Phase 6: Frontend - Dev Activity Tab (10 Widgets)
Status: Pending
Prerequisite: Phase 5

## Scope
Add Radix Tabs to dashboard, create Redux slice, build all 10 widgets including D3.js mycelium network graph.

## Steps
24. Add Radix Tabs to `dashboard.tsx`
25. Create `developmentSlice.ts` + `useDevelopmentData.ts`
26. Populate `development_activity/charts/index.ts` with CHART_REGISTRY
27. Build Recharts widgets: KPI cards, activity chart, top repos, contributors, PR status
28. Build Recharts trend widgets: health rates, star/fork trends, language trends
29. Build D3.js mycelium network graph (with expand/collapse)
30. Build recent activity feed
31. Wire everything together

---

## Dashboard Page with Tabs

Modify `src/pages/dashboard.tsx`:
```typescript
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="governance">Governance</TabsTrigger>
    <TabsTrigger value="development">Development Activity</TabsTrigger>
  </TabsList>

  <TabsContent value="governance">
    <DashboardProvider dashboardId="governance" chartRegistry={GOV_REGISTRY} ...>
      <DashboardContent />
    </DashboardProvider>
  </TabsContent>

  <TabsContent value="development">
    <DashboardProvider dashboardId="development_activity" chartRegistry={DEV_ACTIVITY_REGISTRY} ...>
      <DashboardContent />
    </DashboardProvider>
  </TabsContent>
</Tabs>
```

Uses existing `@/components/ui/tabs.tsx` (Radix Tabs). Same pattern as `governance/[hash].tsx:941-999`.

---

## Widget Registry (10 widgets)

| Widget | Type | Metrics it shows |
|--------|------|-----------------|
| `EcosystemKPICards` | KPI card row | Active repos, contributors, commits, PRs, merge time, growth rate |
| `EcosystemActivityChart` | Area/Line (Recharts) | Commits/PRs/issues over time with period comparison overlay |
| `TopReposChart` | Horizontal Bar (Recharts) | Most active repos by commits, with star count badge |
| `ContributorChart` | Bar (Recharts) | Top contributors + new vs returning indicator |
| `PRStatusChart` | Donut (Recharts) | Open/merged/closed PRs + merge velocity stat |
| `HealthRatesChart` | Multi-stat card | Maintenance rate, ghosting rate, retention rate, velocity |
| `StarForkTrendsChart` | Dual-axis Line (Recharts) | Star velocity + fork activity over time |
| `LanguageTrendsChart` | Stacked Area (Recharts) | Language distribution evolution |
| `EcosystemNetworkGraph` | Force-directed (D3.js) | Mycelium map: orgs -> repos -> developers |
| `RecentActivityFeed` | List | Latest events from tier 1 |

Summary:
- 4 Recharts charts (activity, repos, contributors, PRs)
- 2 Recharts trend charts (star/fork, language)
- 1 D3.js force-directed graph (mycelium network)
- 2 stat/card widgets (KPI cards, health rates)
- 1 list widget (recent activity feed)

Each chart follows existing pattern:
- Accept `ChartProps` (`isLoading`, `className`)
- Data from Redux via `useAppSelector`
- Theme from `chartTheme.ts` via `getChartColors(activeTheme.id)`
- Lazy-loaded with `next/dynamic`

---

## EcosystemNetworkGraph (Mycelium Map) -- Special Widget

**Concept**: A force-directed network graph showing how developers, repos, and orgs
are interconnected. Looks like a mycelium network -- dense clusters around active orgs,
thin threads where a developer bridges two otherwise unrelated projects.

**Nodes** (3 types, visually distinct):
- **Organization** (large, e.g. IntersectMBO) -- color-coded, prominent
- **Repository** (medium) -- grouped near their org
- **Developer** (small) -- positioned by contribution gravity

**Edges**:
- Developer -> Repo: "contributed to" (thickness = number of contributions)
- Repo -> Org: "belongs to" (structural, always present)
- Cross-links naturally emerge when a developer contributes to repos across orgs

**Data source**: New API endpoint `GET /development/network` that returns:
```json
{
  "nodes": [
    { "id": "org:IntersectMBO", "type": "org", "label": "IntersectMBO", "size": 342 },
    { "id": "repo:IntersectMBO/cardano-node", "type": "repo", "label": "cardano-node", "size": 89 },
    { "id": "dev:disassembler", "type": "dev", "label": "disassembler", "size": 45 }
  ],
  "edges": [
    { "source": "dev:disassembler", "target": "repo:IntersectMBO/cardano-node", "weight": 45 },
    { "source": "repo:IntersectMBO/cardano-node", "target": "org:IntersectMBO", "weight": 1 }
  ]
}
```

**Expand/Collapse behavior**:
- Default: standard draggable widget size on canvas (shows a compact preview of the graph)
- Click: expands to full-width overlay within the dashboard (not a new page)
- Full-width view has a collapse icon (top-right) to shrink back to widget size
- Implementation: a boolean `isExpanded` state in the chart component, toggling between
  compact CSS (widget size from canvas layout) and fixed full-width CSS (overlay/modal style)

**Technology**: D3.js force simulation (`d3-force`), rendered into an SVG inside a React
component. D3.js skill installed at `~/.agents/skills/d3-viz` for implementation guidance.
D3 handles the physics simulation; React handles the component lifecycle and state.

---

## Redux State Shape

```typescript
interface DevelopmentState {
  // Loading states per endpoint (independent -- one failing doesn't block others)
  loading: {
    overview: boolean;
    activity: boolean;
    repos: boolean;
    contributors: boolean;
    health: boolean;
    stars: boolean;
    languages: boolean;
    network: boolean;
    recent: boolean;
  };

  // Error states per endpoint
  errors: {
    [key: string]: string | null;
  };

  // Data (null = not yet fetched, populated after first successful fetch)
  overview: DevelopmentOverview | null;        // KPI card data
  activity: TimeSeriesData | null;            // chart time series + optional comparison
  repos: RepoRanking[] | null;                // top repos list
  contributors: ContributorRanking[] | null;  // top contributors
  health: HealthRates | null;                 // maintenance, ghosting, retention rates
  stars: StarForkTrends | null;               // star/fork trend lines
  languages: LanguageTrends | null;           // language distribution over time
  network: NetworkGraphData | null;           // nodes + edges for D3
  recent: RecentEvent[] | null;               // activity feed

  // UI state
  selectedRange: '7d' | '30d' | '90d' | '1y' | '5y';
  compareEnabled: boolean;                    // toggle period comparison overlay
}
```

Each widget reads only its own slice of state via `useAppSelector`. The `useDevelopmentData`
hook (SWR-based, follows `useGovernanceData.ts` pattern) fetches all endpoints on mount
and re-fetches on `selectedRange` change.

Thunks: one per endpoint (`fetchDevelopmentOverview`, `fetchDevelopmentActivity`, etc.).
Dispatched in parallel on dashboard tab activation -- no waterfall.

---

## Frontend Performance

### Lazy Loading
All 10 widgets loaded via `next/dynamic` with `{ ssr: false }`:
```typescript
const EcosystemNetworkGraph = dynamic(
  () => import('./charts/EcosystemNetworkGraph'),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
```
D3.js bundle (~250 KB) only loads when the dev activity tab is active.

### Render Strategy
- Tab content uses `forceMount={false}` on Radix `TabsContent` -- inactive tab doesn't render
- KPI cards and Recharts widgets are lightweight (<50ms render each)
- Network graph: renders after other widgets via `requestIdleCallback` or lower priority
- Recent activity feed: virtual scrolling if >50 items (reuse existing list pattern)

### Bundle Impact
- Recharts: already in the bundle (governance tab uses it)
- D3.js: ~250 KB gzipped -- loaded only on dev activity tab via dynamic import
- No new heavy dependencies needed

### Network Graph Specifics
- Cap node count at ~500 (server-side, see phase 3 network graph precomputation) to keep SVG performant
- Use `requestAnimationFrame` for force simulation -- doesn't block main thread
- Compact preview: freeze simulation after initial layout (static SVG, no tick loop)
- Expanded view: re-enable simulation for interactive exploration
- Canvas fallback: if >500 nodes, switch from SVG to Canvas renderer for performance

---

## Files to Create
```
src/store/developmentSlice.ts                           # Redux slice for dev activity data
src/hooks/useDevelopmentData.ts                         # SWR hook (follows useGovernanceData.ts pattern)
src/types/development.ts                                # API response types
src/services/api.ts                                     # ADD: fetchDevelopmentOverview, fetchActivity, etc.
src/pages/api/development/[...path].ts                  # Proxy to cgov-api (adds X-API-Key)
src/components/dashboards/development_activity/         # Renamed from phil/
  ├── charts/
  │   ├── index.ts                                      # DEV_ACTIVITY_REGISTRY (10 widgets)
  │   ├── EcosystemKPICards.tsx                         # KPI card row with sparklines
  │   ├── EcosystemActivityChart.tsx                    # Area/Line: commits/PRs/issues over time
  │   ├── TopReposChart.tsx                             # Horizontal bar: most active repos
  │   ├── ContributorChart.tsx                          # Bar: top contributors
  │   ├── PRStatusChart.tsx                             # Donut: PR status + merge velocity
  │   ├── HealthRatesChart.tsx                          # Multi-stat: maintenance, ghosting, retention
  │   ├── StarForkTrendsChart.tsx                       # Dual-axis line: star/fork trends
  │   ├── LanguageTrendsChart.tsx                       # Stacked area: language evolution
  │   ├── EcosystemNetworkGraph.tsx                     # D3.js force-directed mycelium map
  │   └── RecentActivityFeed.tsx                        # List: latest events
  └── index.ts
```
