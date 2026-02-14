# Phase 3: Backfill + Aggregation
Status: Complete
Prerequisite: Phase 2

## Scope
Implement resumable historical backfill (5 years, stars>10 priority) and daily aggregation (recent->historical rollup + developer recompute).

## Steps
9. Implement github-backfill.ts (resumable, writes to historical)
10. Implement github-aggregation.ts (recent->historical rollup + developer re-computation)
11. Run backfill for a few repos to verify
12. Start full backfill in background (stars >10 first)

---

## Backfill Status & Progress

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

### Backfill Failure Recovery
- `backfilledAt` is only set AFTER full completion for a repo
- If interrupted mid-repo: `backfilledAt` stays null -> next run retries that repo
- If interrupted mid-batch: completed repos are marked, remaining repos picked up next run
- Progress endpoint shows exactly where we are

---

## Network Graph Precomputation

The mycelium graph can't be built from raw SQL on every request -- it would require
joining `activity_recent` + `activity_historical` across all repos and grouping by
author to find cross-repo/cross-org connections. Too slow for a real-time endpoint.

### Solution: Precomputed graph data stored in cache

**Computation job** (runs after each sync or daily):
1. Query distinct (authorLogin, repoId) pairs from `activity_recent` + recent `activity_historical`
2. Group repos by owner -> org nodes
3. Build node list (orgs, repos, developers) with sizes based on activity counts
4. Build edge list (dev->repo from contributions, repo->org from ownership)
5. Store result in the in-memory cache (TTL 30 min)

**For the `?range=` parameter**: Pre-build 3 graph snapshots (30d, 90d, 1y) since
these cover all realistic use cases. Each is ~50-200 KB of JSON.

**Performance target**: Response time <200ms from cache. Cold computation: <5 seconds
for 1000 repos (runs in background, never blocks the API response).

**Node limits**: Cap at ~500 most active nodes to keep the frontend performant.
Less active developers/repos are grouped into "other" aggregate nodes.

---

## Daily Aggregation Job

1. Query `activity_recent WHERE eventDate < now() - 7 days`
2. Group by (repoId, date) -> INSERT into `activity_historical` (ON CONFLICT skip)
3. DELETE aggregated rows from `activity_recent`
4. **Recompute `github_developer` denormalized fields:**
   - `totalCommits` = COUNT commits across `activity_recent` + SUM `commitCount` from `activity_historical`
   - `totalPRs` = same pattern for PR events
   - `repoCount` = COUNT DISTINCT repoId where developer has activity
   - `orgCount` = COUNT DISTINCT repo owner where developer has activity
   - `isActive` = `lastSeenAt > now() - 90 days`
   - Runs as a single SQL query per field using subqueries -- no N+1
   - This prevents drift: even if sync misses an event, the daily recompute corrects it

---

## Files Created
- `src/services/ingestion/github-backfill.ts` — resumable, rate-limit aware, tracks developer_repo_activity
- `src/services/ingestion/github-aggregation.ts` — rollup + UNION ALL developer recompute + network graph cache
- `src/jobs/aggregate-github.job.ts` — daily 5am UTC cron

## Post-Phase Fix: DeveloperRepoActivity
- Added `DeveloperRepoActivity` Prisma model (migration: `20260207014651_add_developer_repo_activity`)
- Backfill now tracks per-developer-per-repo commit/PR counts during pagination
- Aggregation uses `UNION ALL` across `developer_repo_activity + activity_recent` for all-time accuracy
- Solves: activity_historical lacks per-author attribution, so developer stats now survive the 7-day rollup cycle
