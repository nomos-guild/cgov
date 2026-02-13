# Phase 4: API Endpoints
Status: Complete
Prerequisite: Phase 3

## Scope
Create 9 /development/* endpoints + 3 admin endpoints, with caching, response merging, and error handling.

## Steps
13. Create /development/* routes + controllers (9 endpoints)
14. Implement response merging (recent + historical for time ranges)
15. Implement ?compare=previous for period comparison
16. Create proxy route in cgov (`pages/api/development/[...path].ts`)
17. Test all endpoints via curl / Prisma Studio

---

## API Endpoints

```
# Admin (require X-API-Key)
POST /data/github/discover                        # Manual discovery trigger
POST /data/github/sync                            # Manual activity sync
POST /data/github/backfill                        # Manual backfill trigger

# Public (require X-API-Key)
GET  /development/overview                        # KPI cards: active repos, contributors, commits, PRs, merge time
     ?compare=previous                            # optional: include previous period for % change
GET  /development/activity                        # Time-series: commits/PRs/issues over time
     ?range=7d|30d|90d|1y|5y
     &metric=commits|prs|issues|all
     &compare=previous                            # overlay previous period on same chart
GET  /development/repos                           # Top repos by activity
     ?sort=commits|stars|recent|trending
     &limit=50
GET  /development/contributors                    # Top contributors + new/returning status
     ?range=30d|90d|1y
GET  /development/health                          # Health rates: maintenance, ghosting, retention, velocity
     ?range=30d|90d|1y
GET  /development/stars                           # Star/fork trends over time
     ?range=30d|90d|1y|5y
GET  /development/languages                       # Language distribution + trends
     ?range=1y|5y
GET  /development/network                         # Network graph nodes + edges
     ?range=30d|90d|1y
GET  /development/recent                          # Recent activity feed
     ?limit=50&offset=0
```

### API Response Merging

For time-range queries (e.g. `/development/activity?range=30d`):
- Last 7 days: aggregate `activity_recent` on-the-fly into daily counts
- Days 8-30: read directly from `activity_historical`
- Merge both into a single time series for the frontend

---

## Caching Strategy

Use a simple in-process Map with TTL (no Redis needed for our scale):
```
const cache = new Map<string, { data: any; expiresAt: number }>();
```

| Endpoint | TTL | Why |
|----------|-----|-----|
| `/development/overview` | 5 min | KPI cards -- loaded on every page view |
| `/development/activity` | 10 min | Time-series charts -- data changes every 30 min sync |
| `/development/repos` | 10 min | Top repos -- same refresh cycle |
| `/development/contributors` | 30 min | Contributor rankings -- less volatile |
| `/development/health` | 1 hour | Health rates -- change slowly |
| `/development/stars` | 1 hour | Star trends -- snapshot once daily |
| `/development/languages` | 1 hour | Language distribution -- very stable |
| `/development/network` | 30 min | Network graph -- moderate complexity query |
| `/development/recent` | 1 min | Recent feed -- users expect freshness |

Cache key includes query params: `overview:compare=previous` is separate from `overview`.
Cache invalidated on manual sync trigger (`POST /data/github/sync`).

---

## Error Handling

### GitHub API Failures
```
API down / 502     -> withRetry(3 attempts, exponential backoff)
Rate limited / 403 -> read X-RateLimit-Reset header, sleep until reset
Token expired      -> log error, skip sync window, alert via job result
Partial failure    -> process what we can, log failed repos, continue
```

### Frontend Error States
- Each widget independently handles loading/error states via Redux slice
- If one endpoint fails, other widgets still render -- no cascade
- Error state shows "Data unavailable" with retry button, not a blank widget
- Network graph gracefully degrades: if data is partial, renders what it has

### Data Integrity Guards
- `activity_recent` unique constraint prevents duplicate events on re-sync
- `activity_historical` unique constraint prevents double-counting on re-aggregation
- `repo_daily_snapshot` unique constraint prevents duplicate daily entries
- Aggregation job uses `ON CONFLICT DO NOTHING` -- safe to re-run

---

## Files Created
- `src/controllers/development/` — 10 handler files (getOverview, getActivity, getRepos, getContributors, getHealth, getStars, getLanguages, getNetwork, getRecent, getStatus)
- `src/controllers/data/triggerGithub.ts` — 3 admin triggers (discover, sync, backfill)
- `src/routes/development.route.ts` — 9 public GET routes
- `src/responses/development.response.ts` — all response types
- `src/services/cache.ts` — in-process Map cache with TTL
- `cgov/src/pages/api/development/[...path].ts` — proxy to cgov-api

## Verification (all passed)
- `curl /development/overview` -> 311 active repos, 74 contributors, 237 commits, 156 PRs
- `curl /development/overview?compare=previous` -> includes previous period comparison
- `curl /development/activity?range=30d` -> 29 data points
- `curl /development/activity?range=7d&compare=previous` -> current=6, previous=7 points
- `curl /development/repos?sort=stars&limit=5` -> top 5 repos by stars (2,230 total)
- `curl /development/contributors?range=90d` -> 164 contributors
- `curl /development/health?range=90d` -> maintenanceRate, prCloseRate, etc.
- `curl /development/languages` -> 72 languages (TypeScript, Haskell, JS top 3)
- `curl /development/network?range=90d` -> 19 nodes, 17 edges
- `curl /development/recent?limit=5` -> 126 total events
- `curl /development/stars?range=30d` -> star/fork trend data
- `curl /data/github/status` -> discovery + backfill + rate limit status
- All endpoints return 401 without X-API-Key
- Invalid params return 400 with helpful message
