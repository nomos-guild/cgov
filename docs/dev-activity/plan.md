# Plan — Development Activity Tab
Status: Phase 7 complete (metrics enrichment done)
Overview: [overview.md](overview.md)
Full architecture: [../dev-activity-architecture.md](../dev-activity-architecture.md)

## Phases
- [x] Phase 1: Database + GraphQL Client ([phase-1](phases/phase-1-database-graphql.md))
  - [x] Add 6 Prisma models to schema.prisma (incl. DeveloperRepoActivity)
  - [x] Run migration
  - [x] Implement github-graphql.ts (client + rate limiting + batching)
  - [x] Test with simple GitHub API query
- [x] Phase 2: Discovery + Sync ([phase-2](phases/phase-2-discovery-sync.md))
  - [x] github-discovery.ts (multi-strategy search, dedup)
  - [x] github-activity.ts (sync + developer upsert + snapshots)
  - [x] Register jobs in src/jobs/index.ts
  - [x] Manual discovery test -> verify repos in DB
- [x] Phase 3: Backfill + Aggregation ([phase-3](phases/phase-3-backfill-aggregation.md))
  - [x] github-backfill.ts (resumable, writes to historical + developer_repo_activity)
  - [x] github-aggregation.ts (rollup + developer recompute via UNION ALL)
  - [x] DeveloperRepoActivity join table for all-time developer stats
  - [x] Run backfill for a few repos, verify
  - [x] Start full backfill (stars >10 first)
- [x] Phase 4: API Endpoints ([phase-4](phases/phase-4-api-endpoints.md))
  - [x] 9 /development/* routes + controllers
  - [x] Response merging (recent + historical)
  - [x] ?compare=previous period comparison
  - [x] Proxy route in cgov + test all endpoints
  - [x] 4 admin endpoints (status, discover, sync, backfill)
  - [x] In-process cache with per-endpoint TTL
- [x] Phase 5: Frontend Refactor ([phase-5](phases/phase-5-frontend-refactor.md))
  - [x] DashboardProvider: registry-agnostic props (dashboardId, chartRegistry, defaultLayouts)
  - [x] DashboardGrid + ChartVisibilityDropdown: read from context
  - [x] Extend ChartId type (GovernanceChartId | DevActivityChartId)
  - [x] Rename dashboards/phil/ -> development_activity/
  - [x] Regression test governance dashboard (build passes)
- [x] Phase 6: Frontend Widgets ([phase-6](phases/phase-6-frontend-widgets.md))
  - [x] Radix Tabs on dashboard.tsx
  - [x] developmentSlice.ts + useDevelopmentData.ts
  - [x] 7 Recharts widgets
  - [x] D3.js ecosystem network graph (compact + expanded with full interactivity)
  - [x] Recent activity feed
  - [x] Wire everything together
  - [x] Network graph visual redesign (meta enrichment, tooltips, info panel, search, filters)
- [x] Phase 7: Metrics Enrichment
  - [x] Schema migration: avgIssueResolutionHours on ActivityHistorical
  - [x] Backfill update: compute issue resolution time (closedAt - createdAt)
  - [x] getHealth.ts: 9 new computed metrics (retention, ghosting, abandonment, velocity, resolution, releases, growth, forks, star concentration)
  - [x] getRepos.ts: trending sort by star gain (repo_daily_snapshot delta)
  - [x] getStars.ts: topReposByStars (top 5 repos with % share)
  - [x] getLanguages.ts: compare=previous (YoY language delta)
  - [x] getNetwork.ts: orgBreakdown (derived from graph nodes/edges)
  - [x] Frontend types expanded for all new response fields
  - [x] HealthRatesChart: 3x3 grid with 9 metrics
  - [x] EcosystemKPICards: 7 KPIs (added Releases + Growth Rate)
  - [x] TopReposChart: Most Active / Trending toggle
  - [x] StarForkTrendsChart: Pareto stat bar
  - [x] LanguageTrendsChart: YoY delta badges
  - [x] OrgContributionChart: NEW widget (horizontal bar, org commit share)
  - [x] Chart registry: 11 entries, dashboard config version 12

## Workflow Rules

- **Architecture doc updates**: After completing each phase, use a dedicated agent (Task tool) to update `docs/dev-activity-architecture.md` with the changes made. Do not read the full doc yourself — the agent handles it.
- **Uncertainty / knowledge gaps**: When unsure about how a current task connects to future work, read the relevant later phase doc(s) before making decisions. Don't guess — check the plan.

## Decisions
- 2026-02-06: 5 tables (added RepoDailySnapshot + GithubDeveloper for trends + retention)
- 2026-02-06: In-memory cache over Redis (sufficient for ~10 concurrent users)
- 2026-02-06: Backfill stars >10 first (meaningful charts in ~2hrs)
- 2026-02-06: 500-node cap on network graph (server-side, SVG->Canvas fallback)
- 2026-02-07: Daily recompute of GithubDeveloper denormalized fields (prevent drift)
- 2026-02-07: 3-layer monitoring (status endpoint + job failure counter + frontend staleness)
- 2026-02-07: DeveloperRepoActivity join table for all-time per-dev-per-repo stats (survives rollup cycle)
- 2026-02-07: Network graph dev meta sourced from activity_recent (not GithubDeveloper denormalized fields, which require backfill)
- 2026-02-07: Tooltip rendered via createPortal to document.body (DashboardChartCard CSS transform breaks position:fixed)
- 2026-02-07: Sync trigger endpoint supports ?tier=all|active|moderate|dormant (was active-only)
- 2026-02-07: Docker deployment for cgov-api (not local nodemon) — rebuild required for backend changes
- 2026-02-07: Backfill cron job (hourly at :15, batch 10, respects shared rate limiter, stops early if remaining < 200)
- 2026-02-07: Dashboard tab content constrained to max-w-[1220px] (aligns Customize button with chart edges)
- 2026-02-07: Unified range support: ALL 9 /development/* endpoints accept 7d/30d/90d/1y/5y (was inconsistent across controllers)
- 2026-02-07: getHealth queries BOTH activity_recent + activity_historical (was historical-only → 7d returned zeros)
- 2026-02-07: ResponsiveContainer minWidth={0} on all 6 Recharts charts (fixes width(-1) console warnings)
- 2026-02-07: Backfill script (scripts/backfill-loop.sh): batch=10, 1hr curl timeout, auto rate-limit cooldown
- 2026-02-07: avgIssueResolutionHours computed in backfill only (aggregation can't pair open/close events)
- 2026-02-07: 9 health metrics computed from existing DB data (only avgIssueResolutionHours needed schema change)
- 2026-02-07: Star concentration via SQL CTE with ROW_NUMBER for Pareto (top 10% share)
- 2026-02-07: Org contribution breakdown derived from network graph nodes/edges (no extra DB queries)
- 2026-02-07: OrgContributionChart placed between LanguageTrends and EcosystemNetwork in grid
