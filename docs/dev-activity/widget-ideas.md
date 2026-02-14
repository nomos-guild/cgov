# Development Activity - Widget Ideas & Deferred Work

## Top Contributors (hidden - range-scoping broken)

**Status**: Hidden from dashboard. Component file kept at `charts/ContributorChart.tsx`.

### Problem

The `getContributors` endpoint accepts a range parameter (7d/30d/90d/1y/5y) but returns **all-time** commit/PR totals. The range only filters which developers appear (by `lastSeenAt`), not the actual counts. Every range shows the same numbers.

**Root cause**: The daily aggregation job rolls up `activity_recent` events into:

- `activity_historical` — repo-date level, **loses developer attribution**
- `developer_repo_activity` — developer-repo all-time, **loses date scoping**

Per-developer date-scoped data only exists in `activity_recent` (~7 days). After rollup, the per-developer per-date granularity is destroyed.

### Fix: New `developer_daily_activity` Table

Preserve per-developer daily counts during the aggregation rollup.

**Schema** (add to `cgov-api/prisma/schema.prisma`):

```prisma
model DeveloperDailyActivity {
  id             String   @id @default(cuid())
  developerLogin String   @map("developer_login")
  date           DateTime @db.Date
  commits        Int      @default(0)
  prs            Int      @default(0)
  createdAt      DateTime @default(now()) @map("created_at")

  developer GithubDeveloper @relation(fields: [developerLogin], references: [id])

  @@unique([developerLogin, date])
  @@index([date])
  @@index([developerLogin])
  @@map("developer_daily_activity")
}
```

### Implementation Steps

1. **Schema migration** — Add model above + back-relation on `GithubDeveloper`

2. **Aggregation writes** (`cgov-api/src/services/ingestion/github-aggregation.ts`)
   - In `aggregateRecentToHistorical()`, between the `activity_historical` upsert loop and `updateDeveloperRepoActivity()`, add a second grouping by `(authorLogin, date)` and upsert into `developer_daily_activity`
   - Follow the same upsert-with-increment pattern used for `activity_historical` (lines 133-161)

3. **Controller rewrite** (`cgov-api/src/controllers/development/getContributors.ts`)
   - Replace the `GithubDeveloper.findMany` query with the dual-table pattern from `getActivity.ts`:
     - Query `developer_daily_activity WHERE date >= since` for historical counts
     - Query `activity_recent WHERE event_date >= since GROUP BY author_login` for recent counts
     - Merge, sort by commits DESC, take top N
     - Fetch `GithubDeveloper` profiles for avatar/isActive metadata
   - Response shape stays identical — no frontend changes needed

4. **Backfill writes** (`cgov-api/src/services/ingestion/github-backfill.ts`)
   - Add a `devDailyStats` Map alongside existing `devStats` tracking
   - Populate it in `paginateCommits` and `paginatePRs`
   - Upsert into `developer_daily_activity` after the `developerRepoActivity` loop

5. **Re-run backfill** for important repos to populate historical data, or accept the gap and let it build up naturally

### Key Files

| File | Role |
| ---- | ---- |
| `cgov-api/prisma/schema.prisma` | Add new model |
| `cgov-api/src/services/ingestion/github-aggregation.ts` | Populate during daily rollup |
| `cgov-api/src/controllers/development/getContributors.ts` | Rewrite to dual-table query |
| `cgov-api/src/services/ingestion/github-backfill.ts` | Populate during backfill |
| `cgov-api/src/controllers/development/getActivity.ts` | Reference for dual-table merge pattern |
| `cgov/src/components/dashboards/development_activity/charts/ContributorChart.tsx` | Frontend component (no changes needed) |
| `cgov/src/components/dashboards/development_activity/charts/index.tsx` | Re-add registry entry when ready |

### Data Volume

~1 row per developer per active day. With ~500 developers over 5 years: ~900K rows max. Trivial for PostgreSQL.

### No Double-Counting Risk

The aggregation job deletes events from `activity_recent` after rollup (line 167-169 of `github-aggregation.ts`). The 7-day cutoff means `activity_recent` holds recent data and `developer_daily_activity` holds everything older. Date-range queries naturally avoid overlap.
