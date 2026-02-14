# Phase 1: Database + GraphQL Client
Status: Complete
Prerequisite: None

## Scope
Add 5 Prisma models and implement the GitHub GraphQL client with rate limit tracking and batched queries.

## Steps
1. Add 5 Prisma models to `schema.prisma`
2. Run migration: `npx prisma migrate dev --name add-github-activity`
3. Implement `github-graphql.ts`
4. Test with a simple query against GitHub API

---

## Database Schema (cgov-api/prisma/schema.prisma)

### 5 models added alongside existing governance models

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
  avgPrMergeHours     Float?   @map("avg_pr_merge_hours")
  releasesPublished   Int      @default(0) @map("releases_published")
  createdAt           DateTime @default(now()) @map("created_at")

  repository  GithubRepository @relation(fields: [repoId], references: [id])

  @@unique([repoId, date])
  @@index([date])
  @@index([repoId, date])
  @@map("activity_historical")
}

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

model GithubDeveloper {
  id              String   @id                              // GitHub login
  avatarUrl       String?  @map("avatar_url")
  firstSeenAt     DateTime @map("first_seen_at")
  lastSeenAt      DateTime @map("last_seen_at")
  totalCommits    Int      @default(0) @map("total_commits")
  totalPRs        Int      @default(0) @map("total_prs")
  repoCount       Int      @default(0) @map("repo_count")
  orgCount        Int      @default(0) @map("org_count")
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@index([lastSeenAt])
  @@index([isActive])
  @@map("github_developer")
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
| **Total** | | **~150-250 MB**, grows ~30 MB/year |

Key design choices:
- `githubId Int @unique` — survives repo renames/transfers
- `isFork Boolean` — filter forks from ecosystem aggregates to avoid double-counting
- `discoveredVia String[]` — a repo can be found via multiple search strategies
- `syncTier String` — "active"/"moderate"/"dormant" determines sync frequency
- `avgPrMergeHours Float?` — enables PR velocity charts without storing individual PRs
- `RepoDailySnapshot` — daily star/fork snapshots enable trend lines (cheap: 1 row/repo/day)
- `GithubDeveloper` — enables retention/ghosting/network metrics without scanning all commits

---

## GitHub GraphQL Client (github-graphql.ts)

### Rate Limit Reality

| Limit | Value | Impact |
|-------|-------|--------|
| Primary | 5,000 **points**/hour | Point cost = `max(1, round(total_nodes / 100))` |
| Secondary | 2,000 points/minute | Can't burst entire budget in first minutes |
| Concurrent | 100 requests max | Don't fire parallel requests recklessly |
| Query timeout | 10 seconds | Keep queries focused, don't over-nest |
| Search results | 1,000 per query | Need partitioning for discovery (phase 2) |
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

---

## Files to Create/Modify
- `cgov-api/prisma/schema.prisma` — ADD 5 models
- `cgov-api/src/services/github-graphql.ts` — NEW: GraphQL client
  - authenticated fetch with GITHUB_TOKEN
  - rate limit tracking (include rateLimit{} in every query)
  - withRetry() for 429/502 errors (reuse existing pattern)
  - query builder for aliased batching

## Verification
- `npx prisma studio` -> verify 5 tables exist
- Run a test query against GitHub API -> verify rate limit tracking works

## Environment Variables
```
GITHUB_TOKEN=ghp_xxx  (already in cgov-api/.env)
```
