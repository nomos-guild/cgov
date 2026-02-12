# DRep Dashboard Implementation Plan

**Status: IMPLEMENTED** (PRs #49-#52, #62, #68, #71-#75, Feb 2026)

The DRep dashboard is live at `/drep` with overview page, individual profile pages at `/drep/[drepId]`, D3 visualizations (bubble map, treemap, donut chart), voting history, and rationale analysis. Uses SWR hooks (`useDRepData.ts`) with ISR + server-side fetching (`serverFetch.ts`).

## Original Plan

Add a DRep Dashboard to the cgov app with:
1. **DRep Overview Page** - Aggregate metrics and searchable DRep listing
2. **Individual DRep Profile Pages** - Detailed view for each DRep with full voting history

## Scope Decisions
- **Frontend only** - Backend API endpoints will be added to cgov-api separately
- **Omit delegator count** - Not available in current DB schema, skip for MVP
- **Full voting history** - Show all votes with pagination on profile pages

---

## Backend API Endpoints (to be implemented separately in cgov-api)

The frontend will expect these endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /dreps` | List DReps with aggregate stats, pagination, sorting |
| `GET /dreps/stats` | Lightweight aggregate stats only |
| `GET /drep/:drepId` | Individual DRep detail with vote breakdown |
| `GET /drep/:drepId/votes` | Paginated voting history for a DRep |

---

## Phase 1: Types & API Layer

### New File: `src/types/drep.ts`

```typescript
export interface DRepSummary {
  drepId: string;
  name: string | null;
  iconUrl: string | null;
  votingPower: string;        // Lovelace string
  votingPowerAda: number;
  totalVotes: number;
}

export interface DRepStats {
  totalDReps: number;
  totalDelegatedAda: number;
  totalVotesCast: number;
  activeVotingDReps: number;
}

export interface DRepDetail extends DRepSummary {
  paymentAddr: string | null;
  voteBreakdown: { yes: number; no: number; abstain: number };
  rationalesProvided: number;
  proposalParticipationPercent: number;
}

export interface DRepVoteRecord {
  proposalId: string;
  proposalTitle: string;
  proposalType: string;
  vote: "Yes" | "No" | "Abstain";
  votingPower: string;
  votingPowerAda: number;
  rationale: string | null;
  anchorUrl: string | null;
  votedAt: string;
  txHash?: string;
}

export interface DRepListResponse {
  dreps: DRepSummary[];
  pagination: Pagination;
  aggregateStats: DRepStats;
}

export interface DRepVotesResponse {
  votes: DRepVoteRecord[];
  pagination: Pagination;
}

interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

### New API Routes (proxy to backend)
- `src/pages/api/dreps/index.ts` - `GET /api/dreps`
- `src/pages/api/dreps/stats.ts` - `GET /api/dreps/stats`
- `src/pages/api/dreps/[drepId]/index.ts` - `GET /api/dreps/:id`
- `src/pages/api/dreps/[drepId]/votes.ts` - `GET /api/dreps/:id/votes`

### Modifications
- `src/config/api.ts` - Add drep endpoints
- `src/services/api.ts` - Add:
  - `fetchDRepStats(): Promise<DRepStats>`
  - `fetchDRepList(page?, pageSize?, sortBy?, sortOrder?): Promise<DRepListResponse>`
  - `fetchDRepDetail(drepId): Promise<DRepDetail | null>`
  - `fetchDRepVotes(drepId, page?, pageSize?): Promise<DRepVotesResponse>`

---

## Phase 2: Redux State Management

### New File: `src/store/drepSlice.ts`

```typescript
interface DRepState {
  // Data
  stats: DRepStats | null;
  dreps: DRepSummary[];
  selectedDRep: DRepDetail | null;
  selectedDRepVotes: DRepVoteRecord[];

  // Pagination
  listPagination: { page: number; pageSize: number; total: number };
  votesPagination: { page: number; pageSize: number; total: number };

  // Filters
  searchQuery: string;
  sortBy: "votingPower" | "totalVotes" | "name";
  sortOrder: "asc" | "desc";

  // Loading states
  isLoadingStats: boolean;
  isLoadingList: boolean;
  isLoadingDetail: boolean;
  isLoadingVotes: boolean;

  // Errors
  statsError: string | null;
  listError: string | null;
  detailError: string | null;
  votesError: string | null;
}
```

Async thunks: `loadDRepStats`, `loadDRepList`, `loadDRepDetail`, `loadDRepVotes`

### Modification: `src/store/index.ts`
- Add `drep: drepReducer` to store configuration

---

## Phase 3: DRep Listing Page

### New Page: `src/pages/dreps/index.tsx`

**Layout:**
```
+------------------------------------------+
|  DRep Overview                           |
+------------------------------------------+
|  [Total DReps] [Total ADA] [Total Votes] |
|     1,234        45.2B         8,721     |
+------------------------------------------+
|  [Search: DRep name or ID...]  [Sort: v] |
+------------------------------------------+
|  | Name        | Voting Power | Votes |  |
|  |-------------|--------------|-------|  |
|  | DRep Alpha  | 125.4M ADA   |    47 |  |
|  | DRep Beta   |  89.2M ADA   |    35 |  |
|  | ...         |              |       |  |
+------------------------------------------+
|  [< Prev]  Page 1 of 25  [Next >]        |
+------------------------------------------+
```

### New Components: `src/components/dreps/`

**DRepStatsCards.tsx**
- Three stat cards using existing Card component pattern
- Display: Total DReps, Total Delegated ADA, Total Votes Cast

**DRepTable.tsx**
- Columns: Avatar+Name, DRep ID (truncated), Voting Power, Votes Cast
- Search filter by name/ID
- Sortable columns
- Pagination controls
- Click row → navigate to `/dreps/[drepId]`

---

## Phase 4: DRep Profile Page

### New Page: `src/pages/dreps/[drepId].tsx`

**Layout:**
```
+------------------------------------------+
|  [<- Back to DReps]                      |
+------------------------------------------+
|  [Avatar]  DRep Name                     |
|            drep1q8z9...xyz               |
+------------------------------------------+
|  Voting Power  |  Total Votes  |  Part.  |
|  125.4M ADA    |      47       |   85%   |
+------------------------------------------+
|  Vote Breakdown     |  Rationales        |
|  +-----------+      |  42 / 47 votes     |
|  |  [Donut]  |      |  (89%)             |
|  +-----------+      |                    |
|  Yes: 30 | No: 10   |                    |
|  Abstain: 7         |                    |
+------------------------------------------+
|  Voting History                          |
|  +--------------------------------------+|
|  | Proposal      | Type  | Vote | Date  ||
|  |---------------|-------|------|-------||
|  | Treasury #123 | Treas | Yes  | Jan 5 ||
|  | HardFork #45  | HF    | No   | Jan 3 ||
|  +--------------------------------------+|
|  [< Prev]  Page 1 of 5  [Next >]         |
+------------------------------------------+
```

### New Components: `src/components/dreps/`

**DRepProfileHeader.tsx**
- Avatar (from iconUrl or placeholder)
- DRep name (or "Anonymous DRep")
- Full DRep ID with copy button

**DRepVotingMetrics.tsx**
- Stats cards: Voting Power, Total Votes, Participation %, Rationales Provided

**DRepVoteBreakdownChart.tsx**
- Recharts PieChart (donut style)
- Yes/No/Abstain segments with colors from chartTheme.ts
- Legend with counts

**DRepVotingHistory.tsx**
- Paginated table of all votes
- Columns: Proposal title (link), Type, Vote, Date
- Expandable rows to show rationale if available
- Filter by vote type (All/Yes/No/Abstain)

---

## Phase 5: Navigation & Polish

### Modification: `src/components/layout/Header.tsx`
- Add "DReps" link in main navigation

### Theme Support
- All components use `useTheme()` hook
- Support light, dark, and game themes
- Charts use `getChartColors()` from chartTheme.ts

### Responsive Design
- Stats cards stack on mobile
- Table becomes scrollable horizontally on small screens
- Pagination simplified on mobile

---

## File Structure Summary

```
src/
├── types/
│   └── drep.ts                           # NEW
├── config/
│   └── api.ts                            # MODIFY
├── services/
│   └── api.ts                            # MODIFY
├── store/
│   ├── index.ts                          # MODIFY
│   └── drepSlice.ts                      # NEW
├── pages/
│   ├── api/dreps/
│   │   ├── index.ts                      # NEW
│   │   ├── stats.ts                      # NEW
│   │   └── [drepId]/
│   │       ├── index.ts                  # NEW
│   │       └── votes.ts                  # NEW
│   └── dreps/
│       ├── index.tsx                     # NEW
│       └── [drepId].tsx                  # NEW
├── components/
│   ├── dreps/
│   │   ├── DRepStatsCards.tsx            # NEW
│   │   ├── DRepTable.tsx                 # NEW
│   │   ├── DRepProfileHeader.tsx         # NEW
│   │   ├── DRepVotingMetrics.tsx         # NEW
│   │   ├── DRepVoteBreakdownChart.tsx    # NEW
│   │   └── DRepVotingHistory.tsx         # NEW
│   └── layout/
│       └── Header.tsx                    # MODIFY
```

---

## Verification Plan

1. **API routes work** - Call `/api/dreps/stats` locally, verify proxy returns data (once backend ready)
2. **DRep listing page** - Navigate to `/dreps`, confirm:
   - Stats cards show correct totals
   - Table loads and paginates
   - Search filters by name/ID
   - Sorting works
   - Click navigates to profile
3. **DRep profile page** - Navigate to `/dreps/[drepId]`, confirm:
   - Header shows correct DRep info
   - Voting metrics display correctly
   - Donut chart renders with correct proportions
   - Voting history paginates
   - Links to proposals work
4. **Theme support** - Switch between light/dark/game themes, verify styling
5. **Responsive** - Test on mobile viewport sizes
