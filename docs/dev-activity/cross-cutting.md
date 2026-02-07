# Cross-Cutting Concerns

Content referenced by 2+ phases. Load when needed, not by default.

---

## Two-Tier Storage Architecture

### Tier 1: `activity_recent` (rolling 7-day window)
- Individual events with full detail (commit messages, PR titles, authors)
- Powers the "Recent Activity" feed on the frontend
- Refreshed every 30 minutes for active repos
- Rows older than 7 days get aggregated into tier 2, then deleted

### Tier 2: `activity_historical` (immutable daily aggregates)
- One row per repo per day. Counts only, no individual events
- Powers trend charts (commit activity over time, top repos, etc.)
- Write-once: once a day is aggregated, it never changes
- Backfilled 5 years on initial setup

---

## Metrics Framework

These are the metrics the system must ultimately produce. Understanding them ensures
each phase collects the right data.

### Ecosystem KPI Cards (top of dashboard)
- **Total Active Repos** — repos with activity in last 30d, with MoM trend
- **Total Contributors** — unique developers active in last 30d
- **Commits This Month** — with MoM % change and sparkline
- **PRs Merged This Month** — with MoM % change
- **Avg PR Merge Time** — hours from open to merge
- **Ecosystem Growth Rate** — new repos discovered per month

### Health & Lifecycle Rates

| Metric | Formula | Source |
|--------|---------|--------|
| Developer Growth Rate | New devs (firstSeenAt in period) / total | `github_developer` |
| Developer Retention Rate | Active 3+ consecutive months / total active | `github_developer.lastSeenAt` |
| Developer Ghosting Rate | Active in prior year, none in last 6 months | `github_developer.lastSeenAt` |
| Repo Maintenance Rate | Repos with activity in last 90d / total non-archived | `github_repository.lastActivityAt` |
| Code Velocity | Commits per active developer per month | `activity_historical` / developer count |
| PR Merge Velocity | Average time from PR open to merge (hours) | `activity_historical.avgPrMergeHours` |
| Release Cadence | Releases per quarter per major project | `activity_historical.releasesPublished` |

### Star & Fork Activity
- **Star Velocity** — diff stars day-over-day from `repo_daily_snapshot`
- **Fork Activity Rate** — % of forks with commits after fork date
- **Trending Repos** — highest star gain in last 7/30 days

### Cross-Organization Insights (feeds mycelium graph)
- **Cross-org developers**: `orgCount >= 2` in `github_developer`
- **Collaboration bridges**: top developers connecting separate orgs
- **Org contribution share**: which orgs drive what % of commits

### Language Trends
- **Language distribution over time**: from `github_repository.language` + `activity_historical`
- **Language growth**: which languages are gaining repos/commits YoY

### Widget Registry (10 widgets)

| Widget | Type | Metrics |
|--------|------|---------|
| EcosystemKPICards | KPI card row | Active repos, contributors, commits, PRs, merge time, growth |
| EcosystemActivityChart | Area/Line | Commits/PRs/issues over time + comparison |
| TopReposChart | Horizontal Bar | Most active repos by commits |
| ContributorChart | Bar | Top contributors + new vs returning |
| PRStatusChart | Donut | Open/merged/closed PRs + merge velocity |
| HealthRatesChart | Multi-stat card | Maintenance, ghosting, retention, velocity |
| StarForkTrendsChart | Dual-axis Line | Star velocity + fork activity |
| LanguageTrendsChart | Stacked Area | Language distribution evolution |
| EcosystemNetworkGraph | Force-directed D3.js | Mycelium map: orgs->repos->devs |
| RecentActivityFeed | List | Latest events from tier 1 |

---

## Dashboard Config Migration

The governance dashboard originally stored its config under the key `"dashboard-config"`.
After the multi-dashboard refactor (Phase 5), each dashboard uses `"<id>-dashboard-config"`.

`DashboardProvider.tsx` includes a one-time migration: on mount, if `dashboardId === "governance"`,
it checks for the legacy key, copies it to the new namespaced key, and removes the legacy key.
The dev-activity dashboard never used the old key, so no migration needed.

---

## Theme CSS Organization

All 4 themes follow the same pattern — tokens + component overrides live in `themes/<name>/tokens.css`:

| Theme  | File                       | Tokens                     | Component overrides          |
| ------ | -------------------------- | -------------------------- | ---------------------------- |
| Light  | `themes/light/tokens.css`  | CSS variables              | None (base in globals.css)   |
| Dark   | `themes/dark/tokens.css`   | CSS variables              | ~86 lines                    |
| Game   | `themes/game/tokens.css`   | CSS variables + @font-face | ~1332 lines                  |
| Neural | `themes/neural/tokens.css` | CSS variables + @font-face | ~590 lines                   |

`globals.css` imports all 4 and contains only shared styles (animations, scrollbar, utilities, light theme overrides).

Space Mono font is self-hosted in `public/fonts/` and loaded via `@font-face` in neural/tokens.css
(only downloaded when neural theme is active, matching the game theme pattern for "Tw Cen MT").

---

## Cache

In-process `Map<string, { data, expiresAt }>` in `services/cache.ts`.

- **TTL-based**: Each endpoint sets its own TTL (1min for recent, 10min for repos, 1hr for health/languages)
- **Lazy eviction**: Expired entries deleted on read (`cacheGet`)
- **Overflow cleanup**: When store exceeds 500 entries, all expired entries are purged on `cacheSet`
- **Manual invalidation**: `cacheInvalidatePrefix("dev:")` called after sync triggers
- **No persistence**: Cache lost on container restart (acceptable — data rebuilds from DB)

---

## Monitoring & Silent Failure Detection

**1. Health fields in `/data/github/status` endpoint:**
- `sync.lastSyncAt` — if >1 hour old, sync is stuck or failing
- `rateLimit.remaining` — if consistently near 0, budget is exhausted
- `backfill.isRunning` + `backfill.percentComplete` — detect stalled backfills

**2. Staleness detection in each job result:**
Every job returns `{ total, success, failed, errors[] }`. After each run:
- If `failed / total > 0.5` → log `[WARN]` with summary
- If `success === 0` for 3 consecutive runs → log `[CRITICAL]`
- Track consecutive failure count in a simple in-memory counter per job

**3. Frontend staleness indicator:**
`/development/overview` includes `lastSyncAt`. If >2 hours old, show "Data may be stale"
badge on KPI cards. No polling — just compare timestamp on each page load.

---

## Environment Variables

```env
GITHUB_TOKEN=ghp_xxx                              # Already in cgov-api/.env
GITHUB_SYNC_SCHEDULE=*/30 * * * *
GITHUB_DISCOVERY_SCHEDULE=0 3 * * 0               # Weekly Sunday 3am
GITHUB_AGGREGATION_SCHEDULE=0 1 * * *             # Daily 1am
ENABLE_DEV_ACTIVITY=true                          # Feature flag for frontend tab
```

---

## All Files (project scope reference)

### Backend (cgov-api)
```
prisma/schema.prisma                              # ADD 5 models (Phase 1)
src/services/github-graphql.ts                    # GraphQL client (Phase 1)
src/services/ingestion/github-discovery.ts        # Repo discovery (Phase 2)
src/services/ingestion/github-activity.ts         # Activity sync (Phase 2)
src/services/ingestion/github-backfill.ts         # Historical backfill (Phase 3)
src/services/ingestion/github-aggregation.ts      # Daily rollup (Phase 3)
src/jobs/sync-github-activity.job.ts              # Cron: every 30 min (Phase 2)
src/jobs/discover-github.job.ts                   # Cron: weekly (Phase 2)
src/jobs/aggregate-github.job.ts                  # Cron: daily (Phase 3)
src/controllers/development/index.ts              # Endpoint handlers (Phase 4)
src/routes/development.route.ts                   # Route registration (Phase 4)
src/responses/development.response.ts             # Response types (Phase 4)
```

### Frontend (cgov)
```
src/pages/api/development/[...path].ts            # Proxy to cgov-api (Phase 4)
src/store/developmentSlice.ts                     # Redux slice (Phase 6)
src/hooks/useDevelopmentData.ts                   # SWR hook (Phase 6)
src/types/development.ts                          # API response types (Phase 6)
src/components/dashboards/development_activity/   # Renamed from phil/ (Phase 5)
  charts/index.ts                                 # DEV_ACTIVITY_REGISTRY (Phase 6)
  charts/*.tsx                                    # 10 widgets (Phase 6)
```

---

## Testing Strategy

### Backend Tests (cgov-api)

**Unit tests** (`yarn test`):
- `github-graphql.ts`: mock fetch, verify query construction, rate limit tracking, retry logic
- `github-discovery.ts`: mock GraphQL responses, verify deduplication, upsert logic
- `github-activity.ts`: mock responses, verify event parsing, developer upsert, snapshot creation
- `github-aggregation.ts`: seed `activity_recent` with test data, verify aggregation output
- Each controller: verify response shapes match TypeScript types

**Integration tests** (`yarn test:endpoints`):
- `GET /development/overview` -> 200 with expected KPI shape
- `GET /development/activity?range=30d` -> 200 with time series array
- `GET /development/health` -> 200 with rate percentages
- `GET /development/network` -> 200 with nodes + edges arrays
- `GET /data/github/status` -> 200 with backfill progress
- Auth: all endpoints return 401 without X-API-Key

### Frontend Tests
- Build passes: `npm run build`
- Lint passes: `npm run lint`
- Manual: governance tab regression check (drag/drop, visibility, localStorage)
- Manual: dev activity tab — all 10 widgets render, tab switching works

---

## Development Principles

### Data Integrity
- **UTC everywhere**: All dates stored and compared in UTC
- **Idempotency**: Every job safe to re-run. Use `upsert` not `create`. Unique constraints as safety net.
- **Repo renames**: Upsert by `githubId` (immutable). Update string ID on rename.
- **Partial backfill**: Resume from last cursor. Don't mark `backfilledAt` until fully complete.

### Development Flow
- **Start narrow**: Core loop first (discovery->sync->1 chart with real data), then add widgets.
- **Incremental rollout**: Sync 10-20 manually, verify in Prisma Studio, then enable cron, then backfill.
- **Feature flag**: `ENABLE_DEV_ACTIVITY=true`. Tab only shows when enabled.
- **Update docs after each phase**: Sync START-HERE.md and plan.md after every phase.

### Code Quality
- **Configuration, not magic numbers**: All tunables in constants file or env vars.
- **Single responsibility**: Each service file does one thing.
- **Structured logging**: `[github-sync] [IntersectMBO/cardano-node] Synced 47 commits`
- **Token health**: Log clear errors on token failure. Expose in `/data/github/status`.
- **Shared types**: API response TypeScript interfaces defined once. Frontend + backend must agree.

---

## Final Verification Checklist

### Backend
- `npx prisma studio` -> 5 tables with data
- `curl /development/overview` -> KPI stats with trend %
- `curl /development/activity?range=30d&compare=previous` -> current + previous period
- `curl /development/health` -> maintenance, ghosting, retention rates
- `curl /development/network?range=90d` -> nodes + edges
- GitHub rate limit not exceeded

### Frontend
- Two tabs (Governance / Development Activity)
- Each tab has independent canvas with drag/drop/visibility
- All 10 widgets render with real data
- Mycelium graph: compact -> expand -> collapse
- Period comparison toggle works
- localStorage: separate keys per dashboard
- Governance tab unchanged (regression)
- `npm run build` passes

### Data Integrity
- Recent: events from last 7 days with full detail
- Historical: daily aggregates for backfilled repos
- Aggregation: recent rows move to historical after 7 days
- Forks excluded from ecosystem-wide aggregates
- Developer metrics populated correctly
- Repo snapshots: daily values present, trend lines show real data
