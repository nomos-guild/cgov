# Development Activity Tab - Architecture Plan (v3)

> **Branch**: `dev-activity-phil` (both cgov and cgov-api)
> **Status**: Phase 9 complete — Audit cleanup (SQL injection, font self-hosting, CSS reorganization, error handling)
> **Last updated**: 2026-02-08
> **Plan source**: `~/.claude/plans/polymorphic-hopping-lightning.md`

## Context

Add a "Development Activity" tab to the existing dashboard canvas. Tracks GitHub development
activity across the **entire Cardano ecosystem** (~1000+ repos). Uses GitHub GraphQL API with
auto-discovery. Two-tier storage: rolling 7-day detail + immutable 5-year daily aggregates.

Frontend reuses the existing drag/drop canvas system (`DashboardProvider` + `DashboardGrid` +
`ChartVisibilityDropdown`) inside the `dashboards/development_activity/` scaffold (renamed from
`phil/`). Requires a small refactor to make the shared dashboard components registry-agnostic
(they currently hard-code governance).

---

## 1. Database Schema (cgov-api/prisma/schema.prisma)

### 6 models added alongside existing governance models

```prisma
model GithubRepository {
  id              String   @id                           // "owner/repo" (display + lookup key)
  githubId        Int      @unique @map("github_id")     // immutable numeric ID (survives renames)
  owner           String
  name            String
  description     String?
  language        String?
  stars           Int      @default(0)
  forks           Int      @default(0)
  isFork          Boolean  @default(false) @map("is_fork")
  isArchived      Boolean  @default(false) @map("is_archived")
  isActive        Boolean  @default(true) @map("is_active")
  discoveredVia   String[] @map("discovered_via")        // ["topic:cardano", "org:IntersectMBO"]
  lastActivityAt  DateTime? @map("last_activity_at")     // most recent commit/PR date
  syncTier        String   @default("active") @map("sync_tier") // "active" | "moderate" | "dormant"
  repoCreatedAt   DateTime @map("repo_created_at")
  lastSyncedAt    DateTime? @map("last_synced_at")
  backfilledAt    DateTime? @map("backfilled_at")        // null = not yet backfilled
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  recentActivity     ActivityRecent[]
  historicalActivity ActivityHistorical[]
  dailySnapshots     RepoDailySnapshot[]
  developerActivity  DeveloperRepoActivity[]

  @@map("github_repository")
}

model ActivityRecent {
  id          String   @id @default(cuid())
  repoId      String   @map("repo_id")
  eventType   String   @map("event_type")       // "commit" | "pr_opened" | "pr_merged" | "pr_closed" | "issue_opened" | "issue_closed"
  eventId     String   @map("event_id")          // SHA for commits, "42" for PR/issue #42
  title       String?
  authorLogin String?  @map("author_login")
  additions   Int?     @default(0)
  deletions   Int?     @default(0)
  eventDate   DateTime @map("event_date")
  createdAt   DateTime @default(now()) @map("created_at")

  repository  GithubRepository @relation(fields: [repoId], references: [id])

  @@unique([repoId, eventType, eventId])
  @@index([eventDate])
  @@index([repoId, eventDate])
  @@map("activity_recent")
}

model ActivityHistorical {
  id                  String   @id @default(cuid())
  repoId              String   @map("repo_id")
  date                DateTime @db.Date
  commitCount         Int      @default(0) @map("commit_count")
  prOpened            Int      @default(0) @map("pr_opened")
  prMerged            Int      @default(0) @map("pr_merged")
  prClosed            Int      @default(0) @map("pr_closed")
  issuesOpened        Int      @default(0) @map("issues_opened")
  issuesClosed        Int      @default(0) @map("issues_closed")
  additions           Int      @default(0)
  deletions           Int      @default(0)
  uniqueContributors  Int      @default(0) @map("unique_contributors")
  avgPrMergeHours     Float?   @map("avg_pr_merge_hours")    // average PR merge time in hours
  releasesPublished   Int      @default(0) @map("releases_published")
  avgIssueResolutionHours Float? @map("avg_issue_resolution_hours") // average issue close time in hours
  createdAt           DateTime @default(now()) @map("created_at")

  repository  GithubRepository @relation(fields: [repoId], references: [id])

  @@unique([repoId, date])
  @@index([date])
  @@index([repoId, date])
  @@map("activity_historical")
}

// Daily snapshot of repo metadata (for star/fork trend charts)
model RepoDailySnapshot {
  id          String   @id @default(cuid())
  repoId      String   @map("repo_id")
  date        DateTime @db.Date
  stars       Int      @default(0)
  forks       Int      @default(0)
  openIssues  Int      @default(0) @map("open_issues")
  watchers    Int      @default(0)
  createdAt   DateTime @default(now()) @map("created_at")

  repository  GithubRepository @relation(fields: [repoId], references: [id])

  @@unique([repoId, date])
  @@index([date])
  @@map("repo_daily_snapshot")
}

// Developer-level tracking (for retention, ghosting, network graph)
model GithubDeveloper {
  id              String   @id                              // GitHub login
  avatarUrl       String?  @map("avatar_url")
  firstSeenAt     DateTime @map("first_seen_at")            // first commit/PR in ecosystem
  lastSeenAt      DateTime @map("last_seen_at")             // most recent activity
  totalCommits    Int      @default(0) @map("total_commits")
  totalPRs        Int      @default(0) @map("total_prs")
  repoCount       Int      @default(0) @map("repo_count")   // distinct repos contributed to
  orgCount        Int      @default(0) @map("org_count")     // distinct orgs contributed to
  isActive        Boolean  @default(true) @map("is_active")  // activity in last 90 days
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  repoActivity  DeveloperRepoActivity[]

  @@index([lastSeenAt])
  @@index([isActive])
  @@map("github_developer")
}

// Per-developer-per-repo all-time stats (survives rollup/delete cycle)
model DeveloperRepoActivity {
  id              String   @id @default(cuid())
  developerLogin  String   @map("developer_login")
  repoId          String   @map("repo_id")
  totalCommits    Int      @default(0) @map("total_commits")
  totalPRs        Int      @default(0) @map("total_prs")
  lastActiveAt    DateTime @map("last_active_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  developer  GithubDeveloper  @relation(fields: [developerLogin], references: [id])
  repository GithubRepository @relation(fields: [repoId], references: [id])

  @@unique([developerLogin, repoId])
  @@map("developer_repo_activity")
}
```

### Schema notes

| Model | Purpose | Size estimate |
|-------|---------|---------------|
| `GithubRepository` | Registry of tracked repos | ~1 MB (1-2k repos) |
| `ActivityRecent` | Individual events, 7-day rolling | ~50-70 MB (capped) |
| `ActivityHistorical` | Daily aggregates, 5 years | ~50-100 MB |
| `RepoDailySnapshot` | Star/fork/issue trends | ~20 MB/year |
| `GithubDeveloper` | Developer lifecycle metrics | ~1 MB (few thousand devs) |
| `DeveloperRepoActivity` | Per-developer-per-repo all-time stats | ~2-5 MB (devs x repos) |
| **Total** | | **~150-260 MB**, grows ~30 MB/year |

Key design choices:
- `githubId Int @unique` — survives repo renames/transfers
- `isFork Boolean` — filter forks from ecosystem aggregates to avoid double-counting
- `discoveredVia String[]` — a repo can be found via multiple search strategies
- `syncTier String` — "active"/"moderate"/"dormant" determines sync frequency
- `avgPrMergeHours Float?` — enables PR velocity charts without storing individual PRs
- `avgIssueResolutionHours Float?` — enables issue resolution time metric (weighted avg in getHealth)
- `RepoDailySnapshot` — daily star/fork snapshots enable trend lines (cheap: 1 row/repo/day)
- `GithubDeveloper` — enables retention/ghosting/network metrics without scanning all commits
- `DeveloperRepoActivity` — persists all-time per-developer-per-repo stats that survive the rollup/delete cycle, solving the problem that `activity_historical` lacks per-author attribution

---

## 2. Metrics Framework (see section 2a-2g below)

### 2a. Ecosystem KPI Cards (top of dashboard) — IMPLEMENTED (7 KPIs)
Big numbers with sparklines and % change vs previous period:
- **Total Active Repos** — repos with activity in last 30d, with MoM trend
- **Total Contributors** — unique developers active in last 30d, with trend
- **Commits This Month** — with MoM % change and sparkline
- **PRs Merged This Month** — with MoM % change
- **Avg PR Merge Time** — hours from open to merge, with trend
- **Releases** — SUM(releasesPublished) for current period (added Phase 7)
- **Ecosystem Growth Rate** — repos created in period / total repos (added Phase 7)

Data source: Computed from `activity_historical` + `github_developer` via SQL aggregation.
Cached in a materialized/precomputed response to keep the endpoint fast.

### 2b. Period Comparisons
Available on all time-series charts via toggle:
- This month vs last month
- This quarter vs last quarter
- Year over Year (2026 vs 2025 vs 2024 vs 2023...)
- Week over week

Implementation: The `/development/activity` endpoint already supports `?range=` parameter.
Add `?compare=previous` to return both current and previous period in one response.

### 2c. Health & Lifecycle Rates — IMPLEMENTED (Phase 7: 9 metrics in getHealth.ts)

| Metric | Formula | Source | Status |
|--------|---------|--------|--------|
| **Developer Growth Rate** | New developers (firstSeenAt in period) / total developers | `github_developer` | Phase 6 |
| **Developer Retention Rate** | returning / (returning + new) contributors | `github_developer` | Phase 7 |
| **Developer Ghosting Rate** | devs with firstSeenAt < 1yr ago AND lastSeenAt < 6mo ago | `github_developer` | Phase 7 |
| **Repo Maintenance Rate** | Repos with activity in last 90d / total non-archived repos | `github_repository.lastActivityAt` | Phase 6 |
| **Repo Abandonment Rate** | Repos with lastActivityAt < 1yr ago AND not archived / total | `github_repository` | Phase 7 |
| **Code Velocity** | commits / active devs / months in range | `activity_historical` + dev count | Phase 7 |
| **PR Merge Velocity** | Average time from PR open to merge (hours) | `activity_historical.avgPrMergeHours` | Phase 6 |
| **Avg Issue Resolution Hours** | Weighted avg from activity_historical | `activity_historical.avgIssueResolutionHours` | Phase 7 |
| **Release Cadence** | SUM(releasesPublished) for period | `activity_historical.releasesPublished` | Phase 7 |
| **Ecosystem Growth Rate** | repos created in period / total repos | `github_repository.repoCreatedAt` | Phase 7 |
| **Fork Activity Rate** | fork delta from repo_daily_snapshot / total forks | `repo_daily_snapshot` | Phase 7 |
| **Star Concentration** | top 10% repos' star share (Pareto via SQL CTE) | `github_repository.stars` | Phase 7 |

HealthRatesChart renders these in a 3x3 grid organized into 3 columns: Repos, Developers, Velocity.

### 2d. Star & Fork Activity — IMPLEMENTED

| Metric | Source | Status |
|--------|--------|--------|
| **Star Velocity** | `repo_daily_snapshot` — diff stars day-over-day, sum across ecosystem | Phase 6 |
| **Fork Activity Rate** | fork delta from `repo_daily_snapshot` / total forks | Phase 7 |
| **Star Concentration** | Pareto: top 10% repos' star share via SQL CTE | Phase 7 |
| **Trending Repos** | `getRepos.ts` `?sort=trending` — star_gain from `repo_daily_snapshot` delta | Phase 7 |
| **Top Repos by Stars** | `getStars.ts` returns `topReposByStars` array (top 5 repos with % share) | Phase 7 |

### 2e. Cross-Organization Insights (feeds the mycelium graph) — IMPLEMENTED
- **Cross-org developers**: developers with `orgCount >= 2` in `github_developer`
- **Collaboration bridges**: top developers connecting otherwise separate orgs
- **Org contribution share**: `OrgContributionChart` — horizontal bar chart of org commit share (Phase 7)
- **Org breakdown array**: `getNetwork.ts` returns `orgBreakdown[]` derived from graph nodes/edges (Phase 7)

### 2f. Language & Category Trends
- **Language distribution over time**: from `github_repository.language` + `activity_historical`
- **Language growth**: which languages are gaining repos/commits YoY

### 2g. Chart Widgets (11 total) — IMPLEMENTED

| Widget | Type | Metrics it shows |
|--------|------|-----------------|
| `EcosystemKPICards` | KPI card row | 7 KPIs: active repos, contributors, commits, PRs, merge time, releases, growth rate |
| `EcosystemActivityChart` | Area/Line (Recharts) | Commits/PRs/issues over time with period comparison overlay |
| `TopReposChart` | Horizontal Bar (Recharts) | Most Active / Trending toggle (SWR fetch for `?sort=trending`, starGain field) |
| `ContributorChart` | Bar (Recharts) | Top contributors + new vs returning indicator |
| `PRStatusChart` | Donut (Recharts) | Open/merged/closed PRs + merge velocity stat |
| `HealthRatesChart` | Multi-stat card (3x3 grid) | 9 metrics in 3 columns: Repos, Developers, Velocity |
| `StarForkTrendsChart` | Dual-axis Line (Recharts) | Star velocity + fork activity + Pareto stat bar below chart |
| `LanguageTrendsChart` | Stacked Area (Recharts) | Language distribution evolution + YoY delta badges (+/-N repos) |
| `EcosystemNetworkGraph` | Force-directed (D3.js) | Mycelium map: orgs -> repos -> developers |
| `RecentActivityFeed` | List | Latest events from tier 1 |
| `OrgContributionChart` | Horizontal Bar (Recharts) | Org commit share — derived from network graph orgBreakdown (Phase 7) |

---

## 3. Storage Strategy

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

### Daily Aggregation Job
1. Query `activity_recent WHERE eventDate < now() - 7 days`
2. Group by (repoId, date) -> INSERT into `activity_historical` (ON CONFLICT skip)
3. **Update `developer_repo_activity`**: aggregate events being rolled up per (author, repo) and upsert with incremented commit/PR counts — this preserves per-author attribution before the detail rows are deleted
4. DELETE aggregated rows from `activity_recent`
5. **Recompute `github_developer` denormalized fields:**
   - Uses a `UNION ALL` query combining `developer_repo_activity` (all-time stats) + `activity_recent` (current 7-day window) to get accurate totals
   - `totalCommits` = SUM from `developer_repo_activity` + COUNT commits in `activity_recent`
   - `totalPRs` = same pattern for PR events
   - `repoCount` = COUNT DISTINCT repoId where developer has activity
   - `orgCount` = COUNT DISTINCT repo owner where developer has activity
   - `isActive` = `lastSeenAt > now() - 90 days`
   - Runs as a single SQL query per field using subqueries — no N+1
   - This prevents drift: even if sync misses an event, the daily recompute corrects it
   - Previously these stats could only be computed from the 7-day `activity_recent` window; now `developer_repo_activity` persists all-time stats that survive the rollup/delete cycle

### API Response Merging
For time-range queries (e.g. `/development/activity?range=30d`):
- Last 7 days: aggregate `activity_recent` on-the-fly into daily counts
- Days 8-30: read directly from `activity_historical`
- Merge both into a single time series for the frontend

**Endpoints using dual-table merging**: `getActivity` (time-series) and `getHealth` (PR/issue stats).
Both query `activity_recent` + `activity_historical` and sum the results. This is critical for
7d range queries where `activity_historical` has no data (events haven't been aggregated yet).

---

## 4. GitHub GraphQL API Strategy

### Rate Limit Reality (not what the docs suggest at first glance)

| Limit | Value | Impact |
|-------|-------|--------|
| Primary | 5,000 **points**/hour | Point cost = `max(1, round(total_nodes / 100))` |
| Secondary | 2,000 points/minute | Can't burst entire budget in first minutes |
| Concurrent | 100 requests max | Don't fire parallel requests recklessly |
| Query timeout | 10 seconds | Keep queries focused, don't over-nest |
| Search results | 1,000 per query | Need partitioning for discovery |
| Pagination | max 100 nodes per page | Cursor-based with `after:` |

### Key finding: `additions`/`deletions` ARE available per commit in GraphQL
No separate API call needed. The `Commit` object exposes them directly.

### Batched Queries with Aliases
Query multiple repos in a single request:
```graphql
query {
  repo1: repository(owner: "IntersectMBO", name: "cardano-node") {
    defaultBranchRef { target { ... on Commit {
      history(since: $since, first: 100) {
        nodes { oid message committedDate additions deletions author { user { login } } }
        pageInfo { hasNextPage endCursor }
      }
    }}}
  }
  repo2: repository(owner: "aiken-lang", name: "aiken") {
    # same shape
  }
  rateLimit { cost remaining resetAt }
}
```

- 10 repos x 100 commits = 1,000 nodes -> ~10 points per batched query
- Always include `rateLimit { cost remaining }` to monitor actual costs

### Sync Budget Math (every 30 minutes)

Available: ~2,500 points per 30-min window

| Phase | Repos | Queries | Points | Notes |
|-------|-------|---------|--------|-------|
| Active repos (~100) | 100 | 10 batched | ~100 | 10 repos per query, 100 commits each |
| Moderate repos (~200) | 200 | 20 batched | ~200 | Daily sync, spread across windows |
| Dormant repos (~700+) | 0 | 0 | 0 | Weekly only |
| PR/Issue updates | ~100 | 10 batched | ~100 | Only for active repos |
| **Total per window** | | | **~400** | Leaves ~2,100 points headroom |

### Backfill Estimate (realistic)

Per repo with 5,000 commits over 5 years:
- 50 pages x 1 point = 50 points per repo
- 1,000 repos x 50 points = 50,000 points
- At 5,000 points/hour = **~10 hours**

**Backfill priority order**: Stars >10 first (most impactful repos get data earliest),
then stars 1-10, then zero-star repos last. This means charts look meaningful within
the first ~2 hours while the long tail backfills over 1-2 days.

Track progress via `backfilledAt` field (null = not done, set = complete).
Resumable: if interrupted, picks up where it left off.

### Discovery: Overcoming the 1,000 Result Limit

Partition search queries to stay under 1,000 results each:
```
"topic:cardano stars:>100"          -> top repos first
"topic:cardano stars:10..100"       -> medium repos
"topic:cardano stars:0..10"         -> small repos
"topic:plutus"                      -> Plutus-specific
"topic:aiken"                       -> Aiken-specific
"topic:cardano-blockchain"          -> alternate topic
org:IntersectMBO                    -> all repos from known orgs
org:input-output-hk
org:cardano-foundation
"cardano in:name,description"       -> keyword fallback
```

Deduplicate by `githubId` before inserting into registry.

---

## 5. Tiered Sync Strategy

Instead of syncing all 1000+ repos every 30 minutes (wasteful), tier them:

| Tier | Criteria | Sync Frequency | Expected Count |
|------|----------|----------------|----------------|
| **active** | Commit/PR in last 7 days | Every 30 min | ~100 repos |
| **moderate** | Activity in last 90 days | Once daily | ~200 repos |
| **dormant** | No activity in 90+ days | Once weekly | ~700+ repos |

**Re-tiering job** runs daily:
- Check `lastActivityAt` for each repo
- Update `syncTier` based on recency
- A dormant repo that gets a new commit auto-promotes to "active" on next sync

---

## 6. Backend Implementation (cgov-api)

### Follows existing patterns from proposal/voter sync:
- Job structure: `startXxxJob()` registered in `src/jobs/index.ts`
- In-process guard: boolean flag prevents overlapping runs
- Result types: `{ total, success, failed, errors[] }`
- Error handling: `withRetry()` from `src/services/ingestion/utils.ts`
- Parallel processing: `processInParallel()` from `src/services/ingestion/parallel.ts`
- Env control: `ENABLE_CRON_JOBS`, individual schedule env vars

### Files created

```
prisma/schema.prisma                              # 6 models added (Phase 1)

src/services/github-graphql.ts                    # GraphQL client (Phase 1)
src/services/ingestion/github-discovery.ts        # Repo discovery (Phase 2)
src/services/ingestion/github-activity.ts         # Activity sync (Phase 2)
src/services/ingestion/github-backfill.ts         # Historical backfill (Phase 3)
src/services/ingestion/github-aggregation.ts      # Daily rollup (Phase 3)
src/services/cache.ts                             # In-process Map cache (Phase 4)
  - cacheGet(key), cacheSet(key, data, ttlMs), cacheInvalidatePrefix(prefix)
  - All dev endpoints use "dev:" key prefix

src/jobs/sync-github-activity.job.ts              # Cron: every 30 min (Phase 2)
src/jobs/discover-github.job.ts                   # Cron: weekly (Phase 2)
src/jobs/aggregate-github.job.ts                  # Cron: daily (Phase 3)
src/jobs/backfill-github.job.ts                   # Cron: hourly at :15 (between sync at :00 and :30)
  - Batch size: 10 repos per run (configurable via GITHUB_BACKFILL_BATCH_SIZE env var)
  - Respects shared rate limiter — stops early if remaining < 200 points
  - Resumable: skips repos where backfilledAt is already set
  - Registered in src/jobs/index.ts alongside other GitHub cron jobs

src/controllers/development/                      # 10 handler files (Phase 4, enhanced Phase 7)
  ├── index.ts                                    # Barrel export
  ├── getOverview.ts                              # KPIs + ?compare=previous
  ├── getActivity.ts                              # Time-series with response merging
  ├── getRepos.ts                                 # Top repos, ?sort=, ?limit=
  ├── getContributors.ts                          # Top devs, ?range=
  ├── getHealth.ts                                # Maintenance/merge/retention rates
  ├── getStars.ts                                 # Star/fork trends
  ├── getLanguages.ts                             # Language distribution
  ├── getNetwork.ts                               # Network graph nodes+edges
  ├── getRecent.ts                                # Recent activity feed
  └── getStatus.ts                                # (re-exported for admin routes)
src/controllers/data/triggerGithub.ts             # 3 admin trigger handlers (Phase 4)
  - postTriggerDiscovery, postTriggerGithubSync, postTriggerBackfill
  - postTriggerSync supports ?tier=all|active|moderate|dormant (default: all)
src/routes/development.route.ts                   # 9 public GET routes with OpenAPI JSDoc (Phase 4)
src/responses/development.response.ts             # All response type interfaces (Phase 4)
```

### API Endpoints (implemented in Phase 4)

Route registration: `app.use("/development", apiKeyAuth, developmentRouter)` in `src/index.ts`.
Admin routes added to existing `data.route.ts` under `/data/github/*`.
Controller barrel export added to `controllers/index.ts`.

```bash
# Admin (require X-API-Key) — registered in data.route.ts
GET  /data/github/status                          # Discovery + backfill + rate limit status
POST /data/github/discover                        # Manual discovery trigger
POST /data/github/sync                            # Manual sync trigger (invalidates cache), ?tier=all|active|moderate|dormant
POST /data/github/backfill                        # Manual backfill trigger, ?limit=N&minStars=N

# Public (require X-API-Key) — registered in development.route.ts
GET  /development/overview                        # KPI cards: activeRepos, totalContributors, totalCommits, totalPRs, avgMergeTimeHours
     ?compare=previous                            # returns both current and previous period data
GET  /development/activity                        # Time-series with response merging (recent on-the-fly + historical)
     ?range=7d|30d|90d|1y|5y
     &compare=previous                            # overlay previous period on same chart
GET  /development/repos                           # Top repos by activity
     ?sort=commits|stars|recent|trending           # trending = star_gain from repo_daily_snapshot delta
     &limit=N                                      # Response includes starGain field per repo
GET  /development/contributors                    # Top contributors + new/returning status
     ?range=7d|30d|90d|1y|5y
GET  /development/health                          # 9 metrics: retentionRate, ghostingRate, abandonmentRate, codeVelocity,
                                                   #   avgIssueResolutionHours, releaseCadence, ecosystemGrowthRate,
                                                   #   forkActivityRate, starConcentration (+ existing: maintenanceRate, avgMergeTimeHours, etc.)
     ?range=7d|30d|90d|1y|5y                       # Queries BOTH activity_recent + activity_historical (merged)
     &compare=previous                              # Returns previous{} with 10 range-dependent metrics (Phase 8)
GET  /development/stars                           # Star/fork trend time-series + topReposByStars (top 5 with % share)
     ?range=7d|30d|90d|1y|5y
GET  /development/languages                       # Language distribution with repoCount, totalStars, totalCommits
     ?compare=previous                             # Returns previous[] array for YoY delta badges
GET  /development/network                         # Network graph nodes+edges + orgBreakdown[] (org commit share)
     ?range=7d|30d|90d|1y|5y                       # orgBreakdown derived from graph nodes/edges
GET  /development/recent                          # Recent activity feed (includes eventId for GitHub links)
     ?limit=N&offset=N
```

### Environment Variables

```env
GITHUB_TOKEN=ghp_xxx
GITHUB_SYNC_SCHEDULE=*/30 * * * *
GITHUB_DISCOVERY_SCHEDULE=0 3 * * 0               # Weekly Sunday 3am
GITHUB_AGGREGATION_SCHEDULE=0 1 * * *             # Daily 1am
GITHUB_BACKFILL_SCHEDULE=15 * * * *               # Hourly at :15
GITHUB_BACKFILL_BATCH_SIZE=10                      # Repos per backfill run
```

---

## 7. Frontend Implementation (cgov)

### 7a. DashboardGrid Refactor (prerequisite) -- COMPLETE (Phase 5)

Three shared components previously hard-coded governance chart imports. Now registry-agnostic:

**`DashboardProvider.tsx`**: Accepts required props `dashboardId`, `chartRegistry`, `defaultLayouts`.
localStorage key namespaced as `${dashboardId}-dashboard-config`. `ALL_CHART_IDS` renamed to
`GOVERNANCE_CHART_IDS`. Validates `visibleCharts` against the registry prop instead of a
hard-coded list. `DashboardContextValue` now exposes `chartRegistry` and `getChartById`.

**`DashboardGrid.tsx`**: Removed governance import. Reads `chartRegistry` and `getChartById`
from `DashboardContext`.

**`ChartVisibilityDropdown.tsx`**: Removed governance import. Reads `getChartById` from
`DashboardContext`.

**`governance/dashboard.tsx`**: Passes `CHART_REGISTRY` and `DEFAULT_CHART_LAYOUTS` as props
to `DashboardProvider`. Zero behavior change for the governance tab.

**Props interface (implemented):**
```typescript
interface DashboardProviderProps {
  dashboardId: string;              // localStorage namespace: "governance" | "development_activity"
  chartRegistry: ChartDefinition[]; // the charts for this dashboard
  defaultLayouts: ChartLayoutMap;   // default positions (Partial<Record<ChartId, ChartLayout>>)
  children: React.ReactNode;
}
```

### 7b. ChartId Type (types/dashboard.ts) -- COMPLETE (Phase 5)

`ChartId` split into a union of `GovernanceChartId | DevActivityChartId`.
`ChartLayoutMap` changed to `Partial<Record<ChartId, ChartLayout>>` to support
both dashboard types without requiring every ID in every map.

```typescript
export type GovernanceChartId =
  | "proposal-status" | "proposal-type" | "ncl-progress"
  | "voting-power" | "participation" | "proposal-submission";

export type DevActivityChartId =
  | "ecosystem-kpis" | "ecosystem-activity" | "top-repos"
  | "contributors" | "pr-status" | "health-rates"
  | "star-fork-trends" | "language-trends"
  | "ecosystem-network" | "recent-activity"
  | "org-contributions";

export type ChartId = GovernanceChartId | DevActivityChartId;
```

### 7c. Dashboard Page with Tabs

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

Tab content areas are wrapped in `max-w-[1220px]` in `dashboard.tsx` to align the Customize
button with chart edges (charts max out at 1180px + 20px padding for resize handles on each side).

### 7d. Development Activity Charts

Location: `src/components/dashboards/development_activity/charts/`

See section 2g for the full 11-widget registry table. Summary:
- 4 Recharts charts (activity, repos, contributors, PRs)
- 2 Recharts trend charts (star/fork, language)
- 1 D3.js force-directed graph (mycelium network)
- 2 stat/card widgets (KPI cards, health rates)
- 1 list widget (recent activity feed)
- 1 Recharts horizontal bar (org contribution share — Phase 7)

Each chart follows existing pattern:
- Accept `ChartProps` (`isLoading`, `className`)
- Data from Redux via `useAppSelector`
- Theme from `chartTheme.ts` via `getChartColors(activeTheme.id)`
- Lazy-loaded with `next/dynamic`

### 7d-1. EcosystemNetworkGraph (Mycelium Map) — Special Widget -- IMPLEMENTED

**Concept**: A force-directed network graph showing how developers, repos, and orgs
are interconnected. Looks like a mycelium network — dense clusters around active orgs,
thin threads where a developer bridges two otherwise unrelated projects.

**Nodes** (3 types, visually distinct):
- **Organization** (large, e.g. IntersectMBO) — color-coded, prominent
- **Repository** (medium) — grouped near their org, language-colored ring
- **Developer** (small) — positioned by contribution gravity, GitHub avatar in expanded mode

**Edges**:
- Developer -> Repo: "contributed to" (thickness = number of contributions)
- Repo -> Org: "belongs to" (structural, always present)
- Cross-links naturally emerge when a developer contributes to repos across orgs

**Data source**: `GET /development/network` returns nodes with typed meta:
```json
{
  "nodes": [
    { "id": "org:IntersectMBO", "type": "org", "label": "IntersectMBO", "size": 342,
      "meta": { "repoCount": 42, "totalCommits": 1200, "totalDevs": 85 } },
    { "id": "repo:IntersectMBO/cardano-node", "type": "repo", "label": "cardano-node", "size": 89,
      "meta": { "language": "Haskell", "stars": 3100, "forks": 720, "description": "...", "syncTier": "active", "isArchived": false, "commitCount": 89 } },
    { "id": "dev:disassembler", "type": "dev", "label": "disassembler", "size": 45,
      "meta": { "avatarUrl": "https://...", "commitCount": 30, "prCount": 15, "repoCount": 3, "orgCount": 2, "isBridge": true, "isActive": true, "lastSeenAt": "..." } }
  ],
  "edges": [
    { "source": "dev:disassembler", "target": "repo:IntersectMBO/cardano-node", "weight": 45 },
    { "source": "repo:IntersectMBO/cardano-node", "target": "org:IntersectMBO", "weight": 1 }
  ]
}
```

**Types** (`types/development.ts`): Typed meta interfaces `RepoMeta`, `DevMeta`, `OrgMeta`
replace the generic `Record<string, unknown>`.

**Two display modes**:

- **Compact preview** (default): auto-fit viewBox, org labels only, click anywhere to expand.
  Force simulation pre-settled (200 ticks), static SVG — no tick loop.
- **Expanded inline view**: pushes other widgets down (not a portal/overlay). Full
  zoom/pan, drag (restarts simulation locally), search, filters, info panel.

**Visual features (expanded mode)**:

- Dynamic radius via `d3.scaleSqrt()` per node type (commit-based sizing)
- Layered SVG rendering order: hulls → edges → nodes → labels
- Org cluster convex hulls (`d3-polygon` + `curveCatmullRomClosed`)
- Language-colored repo rings (colors from `lib/languageColors.ts`)
- Activity glow filter (`feGaussianBlur` + `feColorMatrix`) for nodes active in last 14 days
- Bridge developer double-ring + always-visible labels (developers with `orgCount >= 2`)
- GitHub avatars via SVG `clipPath` + `image`

**Interaction (expanded mode)**:

- Rich HTML tooltips via `createPortal` to `document.body` (bypasses `DashboardChartCard`
  CSS transform that would break fixed positioning)
- Click-to-select info panel (right sidebar, 320px) with full metadata + clickable connections
- Search bar with auto-zoom to first match
- Filter controls: node type toggles, language dropdown
- Double-click opens GitHub profile/repo/org in new tab
- Escape key: deselect node or collapse to compact

**Utilities**: `lib/languageColors.ts` — static map of GitHub language → hex color for
top ~25 Cardano ecosystem languages.

**Technology**: D3.js force simulation (`d3-force`), rendered into an SVG inside a React
component. D3 handles the physics simulation; React handles the component lifecycle and state.

### 7e. Other Frontend Files

```
src/store/developmentSlice.ts                           # Redux slice for dev activity data
src/hooks/useDevelopmentData.ts                         # SWR hook (follows useGovernanceData.ts pattern)
src/types/development.ts                                # API response types
src/services/api.ts                                     # ADD: fetchDevelopmentOverview, fetchActivity, etc.
src/pages/api/development/[...path].ts                  # Proxy to cgov-api (adds X-API-Key) — CREATED in Phase 4
src/components/dashboards/development_activity/         # Renamed from phil/
  ├── charts/
  │   ├── index.ts                                      # DEV_ACTIVITY_REGISTRY (11 widgets, config v12)
  │   ├── EcosystemKPICards.tsx                         # 7 KPIs with sparklines (was 5, added releases + growth rate)
  │   ├── EcosystemActivityChart.tsx                    # Area/Line: commits/PRs/issues over time
  │   ├── TopReposChart.tsx                             # Horizontal bar: Most Active / Trending toggle (SWR)
  │   ├── ContributorChart.tsx                          # Bar: top contributors
  │   ├── PRStatusChart.tsx                             # Donut: PR status + merge velocity
  │   ├── HealthRatesChart.tsx                          # 3x3 grid: 9 metrics in 3 columns (Repos, Developers, Velocity)
  │   ├── StarForkTrendsChart.tsx                       # Dual-axis line: star/fork trends + Pareto stat bar
  │   ├── LanguageTrendsChart.tsx                       # Stacked area: language evolution + YoY delta badges
  │   ├── EcosystemNetworkGraph.tsx                     # D3.js force-directed mycelium map
  │   ├── OrgContributionChart.tsx                      # Horizontal bar: org commit share (Phase 7)
  │   └── RecentActivityFeed.tsx                        # List: latest events
  └── index.ts
```

---

## 8. Caching Strategy

Dashboard loads should be fast. Without caching, every page view would run heavy aggregation
queries across millions of rows. Strategy:

### In-Memory TTL Cache (cgov-api) — implemented in Phase 4

File: `src/services/cache.ts` — exports `cacheGet(key)`, `cacheSet(key, data, ttlMs)`, `cacheInvalidatePrefix(prefix)`.
All development endpoints use the `"dev:"` key prefix. Cache key includes query params (e.g. `dev:overview:compare=previous`).

```typescript
const cache = new Map<string, { data: any; expiresAt: number }>();
```

| Endpoint | TTL | Why |
|----------|-----|-----|
| `/development/overview` | 5 min | KPI cards — loaded on every page view |
| `/development/activity` | 10 min | Time-series charts — data changes every 30 min sync |
| `/development/repos` | 10 min | Top repos — same refresh cycle |
| `/development/contributors` | 30 min | Contributor rankings — less volatile |
| `/development/health` | 1 hour | Health rates — change slowly |
| `/development/stars` | 1 hour | Star trends — snapshot once daily |
| `/development/languages` | 1 hour | Language distribution — very stable |
| `/development/network` | 30 min | Network graph — moderate complexity query |
| `/development/recent` | 1 min | Recent feed — users expect freshness |

Cache key includes query params: `dev:overview:compare=previous` is separate from `dev:overview`.
Cache invalidated on manual sync trigger (`POST /data/github/sync`) via `cacheInvalidatePrefix("dev:")`.

### Why not Redis?
Our data volume (~250 MB, ~10 concurrent users max) doesn't justify an external cache.
In-process cache with short TTLs is simpler, zero-dependency, and sufficient. Can upgrade
to Redis later if the user base grows.

---

## 9. Error Handling & Resilience

### GitHub API Failures
```
API down / 502     -> withRetry(3 attempts, exponential backoff) — reuse existing pattern
Rate limited / 403 -> read X-RateLimit-Reset header, sleep until reset, then resume
Token expired      -> log error, skip sync window, alert via job result
Partial failure    -> process what we can, log failed repos, continue batch
```

All jobs use the existing `withRetry()` from `src/services/ingestion/utils.ts` and
`processInParallel()` from `src/services/ingestion/parallel.ts`. Errors are collected in
the standard `{ total, success, failed, errors[] }` result format.

### Backfill Failure Recovery
- `backfilledAt` is only set AFTER full completion for a repo
- If interrupted mid-repo: `backfilledAt` stays null -> next run retries that repo
- If interrupted mid-batch: completed repos are marked, remaining repos picked up next run
- Progress endpoint shows exactly where we are (see section 10)

### Frontend Error States
- Each widget independently handles loading/error states via Redux slice
- If one endpoint fails, other widgets still render — no cascade
- Error state shows "Data unavailable" with retry button, not a blank widget
- Network graph gracefully degrades: if data is partial, renders what it has

### Data Integrity Guards
- `activity_recent` unique constraint prevents duplicate events on re-sync
- `activity_historical` unique constraint prevents double-counting on re-aggregation
- `repo_daily_snapshot` unique constraint prevents duplicate daily entries
- `developer_repo_activity` unique constraint on `[developerLogin, repoId]` prevents duplicate per-dev-per-repo rows
- Aggregation job uses `ON CONFLICT DO NOTHING` — safe to re-run

### Monitoring & Silent Failure Detection
Jobs can fail silently if nothing checks the results. Three layers of defense:

**1. Health fields in `/data/github/status` endpoint (already planned in section 10):**
- `sync.lastSyncAt` — if this is >1 hour old, sync is stuck or failing
- `rateLimit.remaining` — if consistently near 0, budget is exhausted
- `backfill.isRunning` + `backfill.percentComplete` — detect stalled backfills

**2. Staleness detection in each job result:**
Every job already returns `{ total, success, failed, errors[] }`. Add a check after each run:
- If `failed / total > 0.5` (more than half failed), log a `[WARN]` with summary
- If `success === 0` for 3 consecutive runs, log `[CRITICAL]` — likely a token or network issue
- Track consecutive failure count in a simple in-memory counter per job

**3. Frontend staleness indicator:**
The `/development/overview` response includes `lastSyncAt`. If the frontend sees this is
>2 hours old, show a subtle "Data may be stale" badge on the KPI cards. No polling needed —
just compare the timestamp on each page load.

No external monitoring service needed. The status endpoint + structured logs + frontend
indicator give full visibility without adding infrastructure.

---

## 10. Backfill Status & Progress

### Admin Status Endpoint
```
GET /data/github/status -> {
  discovery: {
    totalRepos: 1247,
    activeRepos: 98,
    moderateRepos: 213,
    dormantRepos: 936,
    lastDiscoveryAt: "2026-02-06T03:00:00Z"
  },
  backfill: {
    totalRepos: 1247,
    backfilledRepos: 342,
    pendingRepos: 905,
    percentComplete: 27.4,
    estimatedHoursRemaining: 7.2,
    currentRepo: "IntersectMBO/cardano-node",
    isRunning: true
  },
  sync: {
    lastSyncAt: "2026-02-06T14:30:00Z",
    reposSyncedLastRun: 98,
    nextSyncAt: "2026-02-06T15:00:00Z"
  },
  rateLimit: {
    remaining: 4200,
    limit: 5000,
    resetAt: "2026-02-06T15:00:00Z"
  }
}
```

Backfill progress is computed from: `COUNT(backfilledAt IS NOT NULL) / COUNT(*)` on
`github_repository`. `estimatedHoursRemaining` is derived from average time per repo
so far x remaining repos.

---

## 11. Network Graph Precomputation

The mycelium graph can't be built from raw SQL on every request — it would require
joining `activity_recent` + `activity_historical` across all repos and grouping by
author to find cross-repo/cross-org connections. Too slow for a real-time endpoint.

### Solution: Precomputed graph data stored in cache

**Computation** (`github-aggregation.ts` → `buildNetworkGraph()`):

1. Query distinct (authorLogin, repoId) pairs from `activity_recent` + recent `activity_historical`
2. Group repos by owner -> org nodes
3. Build node list (orgs, repos, developers) with sizes based on activity counts
4. Build edge list (dev->repo from contributions, repo->org from ownership)
5. **Cap at ~500 nodes** (most active), then enrich with metadata:
   - **Repo meta**: queries `githubRepository` for language, stars, forks, description, syncTier, isArchived
   - **Developer meta**: queries `githubDeveloper` for avatarUrl, lastSeenAt, isActive
   - **Developer commit/PR counts**: sourced from `activity_recent` table (not GithubDeveloper
     denormalized fields, which require a backfill cycle to populate)
   - **Developer repoCount/orgCount**: computed from graph edges (not denormalized fields)
   - **Per-repo commit counts**: from `activity_recent WHERE event_type = 'commit'`
   - **Org-level stats**: aggregated from constituent repo data
   - **Bridge developers**: flagged where `orgCount >= 2`
6. Store result in the in-memory cache (TTL 30 min)

**For the `?range=` parameter**: Pre-build 3 graph snapshots (30d, 90d, 1y) since
these cover all realistic use cases. Each is ~50-200 KB of JSON.

**Performance target**: Response time <200ms from cache. Cold computation: <5 seconds
for 1000 repos (runs in background, never blocks the API response).

---

## 12. Redux State Shape (cgov frontend)

```typescript
interface DevelopmentState {
  // Loading states per endpoint (independent — one failing doesn't block others)
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
Dispatched in parallel on dashboard tab activation — no waterfall.

---

## 13. Frontend Performance

### Lazy Loading
All 11 widgets loaded via `next/dynamic` with `{ ssr: false }`:
```typescript
const EcosystemNetworkGraph = dynamic(
  () => import('./charts/EcosystemNetworkGraph'),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
```
D3.js bundle (~250 KB) only loads when the dev activity tab is active.

### Render Strategy
- Tab content uses `forceMount={false}` on Radix `TabsContent` — inactive tab doesn't render
- KPI cards and Recharts widgets are lightweight (<50ms render each)
- Network graph: renders after other widgets via `requestIdleCallback` or lower priority
- Recent activity feed: virtual scrolling if >50 items (reuse existing list pattern)

### Bundle Impact
- Recharts: already in the bundle (governance tab uses it)
- D3.js: ~250 KB gzipped — loaded only on dev activity tab via dynamic import
- No new heavy dependencies needed

### Network Graph Specifics
- Cap node count at ~500 (server-side, see section 11) to keep SVG performant
- Force simulation pre-settled with 200 ticks before render — no visible jitter on load
- Compact preview: static SVG with auto-fit viewBox, org labels only
- Expanded inline view: drag restarts simulation locally, zoom/pan via D3 zoom behavior
- Tooltips rendered via `createPortal` to `document.body` to bypass CSS transform context
- Info panel (320px right sidebar) replaces overlay/modal pattern — stays inline

---

## 14. Testing Strategy

### Backend Tests (cgov-api)
Follow existing patterns in `cgov-api/src/__tests__/`:

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
- Build passes: `npm run build` (catches TypeScript errors, unused imports)
- Lint passes: `npm run lint`
- Manual: governance tab regression check (drag/drop, visibility, localStorage)
- Manual: dev activity tab — all 11 widgets render, tab switching works

### Data Validation
- After discovery: verify `github_repository` rows in Prisma Studio
- After sync: verify `activity_recent` has events, `github_developer` populated
- After aggregation: verify `activity_historical` has daily rows, `activity_recent` cleaned, `developer_repo_activity` has per-dev-per-repo stats
- After backfill: verify historical data goes back 5 years for backfilled repos, `developer_repo_activity` populated with all-time per-developer commit/PR counts

---

## 15. Development Principles (prevent mistakes)

### Data Integrity
- **UTC everywhere**: All dates stored and compared in UTC. Never use local time for aggregation.
- **Idempotency**: Every job safe to re-run. Use `upsert` not `create`. Unique constraints as safety net.
- **Repo renames**: Discovery upserts by `githubId` (immutable). If `owner/repo` changed, update the string ID and migrate activity data references.
- **Partial backfill**: If a large repo (10k+ commits) times out, mark progress and resume from last cursor. Don't mark `backfilledAt` until fully complete.

### Development Flow
- **Start narrow**: Build the core loop first (discovery -> sync -> 1 chart with real data). Once it works end-to-end, add widgets. Don't build frontend on an unverified backend.
- **Incremental rollout**: Discover all repos, but sync only 10-20 manually first. Verify data in Prisma Studio. Then enable cron. Then enable backfill. Each step verified before the next.
- **Feature flag**: `ENABLE_DEV_ACTIVITY=true` in cgov env. Tab only shows when enabled. Merge incrementally without exposing half-built UI.
- **Update docs after each phase**: Sync `cgov/docs/dev-activity-architecture.md` after every phase completes. If context is lost, the doc reflects reality.
- **Team coordination**: Communicate the 6 new Prisma tables before merging. Non-breaking (all new tables), but courtesy matters.

### Code Quality
- **Configuration, not magic numbers**: All tunables (sync interval, batch size, cache TTL, node cap, concurrency) in a constants file or env vars. Never buried in function bodies.
- **Single responsibility**: Each service file does one thing. `github-graphql.ts` is the client, `github-discovery.ts` is discovery logic, etc. Don't let any file become a god module.
- **Structured logging**: Tag every log line with job name + repo context: `[github-sync] [IntersectMBO/cardano-node] Synced 47 commits`. Use the team's existing logger.
- **Token health**: Log clear errors when GitHub token fails. Expose token status in `/data/github/status`. Don't silently stop syncing.
- **Shared types**: Define API response TypeScript interfaces once. Frontend and backend must agree on shapes. Mismatch = runtime errors users see.

---

## 16. Implementation Phases

### Phase 1: Database + GraphQL Client
1. Add 6 Prisma models to `schema.prisma`
2. Run migration: `npx prisma migrate dev --name add-github-activity`
3. Implement `github-graphql.ts` (client with rate limit tracking, retry, batching)
4. Test with a simple query against the GitHub API

### Phase 2: Discovery + Sync Services
5. Implement `github-discovery.ts` (multi-strategy search, deduplication)
6. Implement `github-activity.ts` (recent activity sync with tiered scheduling)
   - Also populates `github_developer` table (upsert on each author seen)
   - Also takes daily repo snapshot (stars, forks, issues) into `repo_daily_snapshot`
   - Computes `avgPrMergeHours` from PR mergedAt - createdAt
7. Register jobs in `src/jobs/index.ts`
8. Run discovery manually -> verify repos populate in DB

### Phase 3: Backfill + Aggregation
9. Implement `github-backfill.ts` (resumable, writes to historical)
10. Implement `github-aggregation.ts` (recent -> historical rollup + developer re-computation)
11. Run backfill for a few repos to verify
12. Start full backfill in background (stars >10 first)

### Phase 4: API Endpoints -- COMPLETE

13. Created `/development/*` routes + controllers (9 public GET endpoints, 10 handler files)
14. Implemented response merging (activity_recent aggregated on-the-fly + activity_historical for time ranges)
15. Implemented `?compare=previous` returning both current and previous period data
16. Created proxy route in cgov (`pages/api/development/[...path].ts` — catch-all proxy)
17. Additional Phase 4 deliverables:
    - Created in-process Map cache (`src/services/cache.ts`) with per-endpoint TTLs
    - Created 4 admin endpoints in `data.route.ts` (`GET /data/github/status`, `POST discover/sync/backfill`)
    - Created response type interfaces (`src/responses/development.response.ts`)
    - Registered `developmentRouter` in `src/index.ts`, controller barrel in `controllers/index.ts`

**Verified**: 2,230 repos, 164 developers, 72 languages, 311 active repos.
401 without auth, 400 for invalid params. Response merging and `?compare=previous` confirmed working.

### Phase 5: Frontend - Backward-Compatible Dashboard Refactor -- COMPLETE

18. `DashboardProvider.tsx`: accepts required props `dashboardId`, `chartRegistry`, `defaultLayouts`
    - localStorage key namespaced: `${dashboardId}-dashboard-config`
    - `DashboardContextValue` exposes `chartRegistry` and `getChartById`
    - `ALL_CHART_IDS` renamed to `GOVERNANCE_CHART_IDS`
19. `DashboardGrid.tsx`: removed governance import, reads registry from `DashboardContext`
20. `ChartVisibilityDropdown.tsx`: removed governance import, reads from `DashboardContext`
21. `ChartId` type split into `GovernanceChartId | DevActivityChartId` union; `ChartLayoutMap` changed to `Partial<Record<ChartId, ChartLayout>>`
22. `dashboards/phil/` renamed to `dashboards/development_activity/`; barrel export updated in `dashboards/index.ts`
23. `governance/dashboard.tsx` passes `CHART_REGISTRY` and `DEFAULT_CHART_LAYOUTS` as props
24. **Regression verified**: governance dashboard unchanged, `npm run build` clean

### Phase 6: Frontend - Dev Activity Tab (10 base widgets) -- COMPLETE

24. Added Radix Tabs to `dashboard.tsx` (Governance / Development Activity)
25. Created `developmentSlice.ts` + `useDevelopmentData.ts` (SWR hook, parallel thunk dispatch)
26. Populated `development_activity/charts/index.ts` with `DEV_ACTIVITY_REGISTRY` (10 widgets)
27. Built Recharts widgets: KPI cards, activity chart, top repos, contributors, PR status
28. Built Recharts trend widgets: health rates, star/fork trends, language trends
29. Built D3.js EcosystemNetworkGraph with full visual redesign (see section 7d-1):
    - Compact preview + expanded inline view (not portal/overlay)
    - Org cluster hulls, language-colored repo rings, activity glow, bridge developer markers
    - GitHub avatars, search, filters, info panel, tooltips via createPortal
    - Added `lib/languageColors.ts` for GitHub language → hex color mapping
    - Added typed meta interfaces (`RepoMeta`, `DevMeta`, `OrgMeta`) in `types/development.ts`
30. Built recent activity feed
31. All 10 widgets rendering with real data, `npm run build` clean

**Verified**: Tab switching, independent drag/drop/visibility per tab, separate localStorage
configs, governance regression check passed.

### Phase 7: Metrics Enrichment (9 new health metrics, 11th widget) -- COMPLETE

32. Added `avgIssueResolutionHours Float?` to `ActivityHistorical` model
33. Enhanced `getHealth.ts` with 9 new metrics: retentionRate, ghostingRate, abandonmentRate,
    codeVelocity, avgIssueResolutionHours, releaseCadence, ecosystemGrowthRate, forkActivityRate,
    starConcentration (Pareto via SQL CTE)
34. Enhanced `getRepos.ts`: `?sort=trending` uses star_gain from `repo_daily_snapshot` delta, added `starGain` field
35. Enhanced `getStars.ts`: added `topReposByStars` array (top 5 repos with % share)
36. Enhanced `getLanguages.ts`: `?compare=previous` returns `previous[]` for YoY delta
37. Enhanced `getNetwork.ts`: added `orgBreakdown[]` derived from graph nodes/edges
38. Updated `HealthRatesChart`: 3x3 grid (was 2x2) with 9 metrics in 3 columns (Repos, Developers, Velocity)
39. Updated `EcosystemKPICards`: 7 KPIs (was 5) — added Releases and Growth Rate
40. Updated `TopReposChart`: Most Active / Trending toggle (SWR fetch for trending sort)
41. Updated `StarForkTrendsChart`: Pareto stat bar below chart
42. Updated `LanguageTrendsChart`: YoY delta badges (+/-N repos per language)
43. Created `OrgContributionChart`: 11th widget — horizontal bar chart of org commit share
44. Updated types: `DevelopmentHealth` (9 new fields), `RepoSummary` (starGain), `DevelopmentStars`
    (topReposByStars), `DevelopmentLanguages` (previous?), `NetworkGraphData` (orgBreakdown),
    new types `StarRepoShare`, `OrgBreakdown`
45. Chart registry: 11 entries, config version 12 (was 11), `DEFAULT_CHART_LAYOUTS` updated

**Verified**: All 11 widgets rendering with enriched data, `npm run build` clean.

### Phase 8: UI Polish (widget reorder, health trends, clickable links, network search) -- COMPLETE

46. Widget reorder: Ecosystem Health promoted to row 2, all widgets in 2-column 580px layout
47. Health change indicators: `?compare=previous` on `getHealth` endpoint, extracted shared `TrendIndicator` component (used by both KPI and Health widgets)
48. Clickable contributors: Bar click → GitHub profile in `ContributorChart`
49. Clickable recent activity: `eventId` added to `getRecent` response, `buildGitHubUrl()` for commit/PR/issue/release URLs
50. Network graph: removed language filter, added search preview dropdown (max 8 results, click zooms to node)
51. Network sidebar enrichment: Org panel computes stars, forks, active devs, top language from connected nodes (client-side). Repo panel shows "Active" badge.
52. Chart registry reordered, config version 13 (was 12)

**Verified**: `npm run build` clean. Docker rebuild required for backend changes.

---

## 17. Verification

### Backend
- `npx prisma studio` -> verify 6 tables exist with data
- `curl /development/overview` -> returns KPI stats with trend %
- `curl /development/activity?range=30d&compare=previous` -> returns current + previous period
- `curl /development/health?range=30d&compare=previous` -> returns current + previous health metrics (Phase 8)
- `curl /development/stars?range=1y` -> returns star/fork trend data + topReposByStars
- `curl /development/network?range=90d` -> returns nodes + edges + orgBreakdown
- `curl /development/repos?sort=trending` -> returns repos sorted by star_gain
- `curl /development/languages?compare=previous` -> returns current + previous arrays
- Check GitHub rate limit not exceeded: include `rateLimit{}` in all queries

### Frontend
- Dashboard page shows two tabs (Governance / Development Activity)
- Switching tabs loads different chart sets
- Each tab has its own canvas with independent drag/drop/visibility
- All 11 widgets render with real data (including OrgContributionChart)
- Mycelium graph: compact preview -> click -> full-width -> collapse works
- Period comparison toggle works on activity chart
- localStorage: `governance-dashboard-config` and `development_activity-dashboard-config` (separate)
- Governance tab still works exactly as before (regression check)
- Widget order: KPIs → Health → Activity → Repos → Contributors → PR → Stars → Org → Languages → Feed → Network
- Contributor bars clickable → GitHub profile opens in new tab
- Activity feed items clickable → correct GitHub URLs (commit/PR/issue/release)
- Network search shows dropdown preview (max 8 results), click zooms to node
- Network sidebar: Org panel shows stars, forks, active devs, top language; Repo panel shows "Active" badge
- `npm run build` passes

### Data Integrity
- Recent activity: events from last 7 days present with full detail
- Historical: daily aggregates for backfilled repos
- Aggregation: after 7+ days, recent rows move to historical
- Fork repos excluded from ecosystem-wide aggregates
- Developer metrics: firstSeenAt/lastSeenAt populated, retention/ghosting rates compute correctly
- Repo snapshots: daily star/fork values present, trend lines show real movement

---

## 18. Docker Deployment

cgov-api runs in Docker using a pre-built JS bundle.

| Container  | Image                  | Entry point      | Purpose                                  |
|------------|------------------------|------------------|------------------------------------------|
| `cgov_api` | cgov-api               | `.build/index.js` | API server                               |
| `cgov_cron`| cgov-api (same image)  | `.build/index.js` | Cron jobs (discovery, sync, aggregation) |

**Deploying source changes:**

```bash
docker compose build cgov-api && docker compose up -d cgov-api
```

Both containers use the same image — rebuilding once updates both on next `up -d`.

### Manual Backfill Script

`scripts/backfill-loop.sh` — fire-and-forget shell script for bulk backfill:
- Batch size: 10 repos per curl call
- Curl timeout: 1 hour (backfill endpoint processes repos synchronously)
- Auto rate-limit cooldown: sleeps 60 min if rate limit is hit, then retries
- Stops when the API returns `"processed": 0` (all repos backfilled)
