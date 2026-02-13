# Phase 2: Discovery + Sync Services
Status: Complete
Prerequisite: Phase 1 (database + GraphQL client)

## Scope
Implement repo discovery (multi-strategy search), activity sync with tiered scheduling, and register cron jobs.

## Steps
5. Implement `github-discovery.ts` (multi-strategy search, deduplication)
6. Implement `github-activity.ts` (recent activity sync with tiered scheduling)
   - Also populates `github_developer` table (upsert on each author seen)
   - Also takes daily repo snapshot (stars, forks, issues) into `repo_daily_snapshot`
   - Computes `avgPrMergeHours` from PR mergedAt - createdAt
7. Register jobs in `src/jobs/index.ts`
8. Run discovery manually -> verify repos populate in DB

---

## Discovery: Overcoming the 1,000 Result Limit

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

## Sync Budget Math (every 30 minutes)

Available: ~2,500 points per 30-min window

| Phase | Repos | Queries | Points | Notes |
|-------|-------|---------|--------|-------|
| Active repos (~100) | 100 | 10 batched | ~100 | 10 repos per query, 100 commits each |
| Moderate repos (~200) | 200 | 20 batched | ~200 | Daily sync, spread across windows |
| Dormant repos (~700+) | 0 | 0 | 0 | Weekly only |
| PR/Issue updates | ~100 | 10 batched | ~100 | Only for active repos |
| **Total per window** | | | **~400** | Leaves ~2,100 points headroom |

---

## Tiered Sync Strategy

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

## Files to Create
- `src/services/ingestion/github-discovery.ts` — multi-strategy search, dedup, upsert
- `src/services/ingestion/github-activity.ts` — fetch recent commits/PRs, upsert activity_recent, developer upsert, snapshot
- `src/jobs/sync-github-activity.job.ts` — cron every 30 min, syncs active tier
- `src/jobs/discover-github.job.ts` — cron weekly, runs all discovery strategies

Follows existing patterns: `startXxxJob()`, `withRetry()`, `processInParallel()`, `{ total, success, failed, errors[] }`.

## Verification
- Run discovery -> verify `github_repository` rows in Prisma Studio
- Run sync -> verify `activity_recent` has events
- Verify `github_developer` rows populated
- Verify `repo_daily_snapshot` rows created
- Verify `avgPrMergeHours` computed on PR merge events
- Verify `lastActivityAt` and `syncTier` updated on repos after sync
- Verify deduplication: run discovery twice, confirm no duplicate repos (by `githubId`)
