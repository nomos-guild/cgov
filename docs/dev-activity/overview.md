# Development Activity — Overview

> Branch: `dev-activity-phil` | Status: All phases complete + metrics enrichment | Full doc: [../dev-activity-architecture.md](../dev-activity-architecture.md)

## What

A "Development Activity" tab on the cgov dashboard tracking GitHub activity across the
entire Cardano ecosystem (~2,200+ repos). 11 widgets, ~40 metrics, D3.js mycelium network graph.

## Data Flow

```
GitHub GraphQL API (5k pts/hr)
        |
        v
   cgov-api (Express + Prisma)
   ├── Discovery job (weekly) --> github_repository (~2.2k repos)
   ├── Sync job (30min)       --> activity_recent (7-day rolling)
   ├── Backfill job (once)    --> activity_historical (5yr aggregates)
   ├── Aggregation job (daily)--> recent -> historical rollup
   └── Snapshot job (daily)   --> repo_daily_snapshot + github_developer
        |
        v
   cgov frontend (Next.js + Redux)
   └── Dashboard > Dev Activity tab (Radix Tabs)
       └── 11 widgets via DashboardProvider (registry-agnostic refactor)
```

## Key Decisions

- **6 Prisma models**: GithubRepository, ActivityRecent, ActivityHistorical, RepoDailySnapshot, GithubDeveloper, DeveloperRepoActivity
- **Two-tier storage**: 7-day rolling detail + 5-year immutable daily aggregates
- **Tiered sync**: active (30min), moderate (daily), dormant (weekly)
- **Backfill priority**: Stars >10 first, meaningful charts in ~2 hours
- **In-memory cache**: Per-endpoint TTL (1min-1hr), no Redis needed
- **Backward-compatible dashboard refactor**: ~30 lines across 3 shared files, governance untouched
- **D3.js network graph**: Force-directed, expand/collapse, 500-node cap
- **Health metrics**: 9 computed from existing data (ghosting, abandonment, retention, velocity, etc.)
- **Org contributions**: Derived from network graph nodes/edges (no extra queries)

## Phases

| Phase | Description | Detail Doc | Status |
|-------|-------------|------------|--------|
| 1 | Database schema + GraphQL client | [phase-1-database-graphql.md](phases/phase-1-database-graphql.md) | Done |
| 2 | Discovery + Sync services | [phase-2-discovery-sync.md](phases/phase-2-discovery-sync.md) | Done |
| 3 | Backfill + Aggregation | [phase-3-backfill-aggregation.md](phases/phase-3-backfill-aggregation.md) | Done |
| 4 | API Endpoints | [phase-4-api-endpoints.md](phases/phase-4-api-endpoints.md) | Done |
| 5 | Frontend dashboard refactor | [phase-5-frontend-refactor.md](phases/phase-5-frontend-refactor.md) | Done |
| 6 | Frontend widgets (10 charts) | [phase-6-frontend-widgets.md](phases/phase-6-frontend-widgets.md) | Done |
| 7 | Metrics enrichment (9 health + chart enhancements + OrgContributionChart) | — | Done |

Cross-cutting concerns (testing, principles, verification): [cross-cutting.md](cross-cutting.md)

## Constraints

- GitHub rate limit: 5,000 points/hour (shared across all tokens on the account)
- GitHub search: max 1,000 results per query (need partitioned discovery)
- DB size: ~150-250 MB total, grows ~30 MB/year
- Backfill: ~10 hours for full 2,200-repo ecosystem
