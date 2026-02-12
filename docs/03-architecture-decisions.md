# cgov: Architecture Decisions

Documentation of architectural decisions and implementation patterns in the cgov codebase.

## Current Stack

| Category | Technology | Status |
|----------|------------|--------|
| Framework | Next.js 15 + React 18 + TypeScript 5 (strict) | Implemented |
| Routing | Next.js Pages Router | Implemented |
| State Management | Redux Toolkit + SWR | Implemented |
| Data Fetching | ISR (`getStaticProps`) + SWR (client-side) | Implemented |
| UI Components | Radix UI + Tailwind CSS (shadcn/ui) | Implemented |
| Charts | Recharts (bar/line/pie) + D3.js (bubble map, treemap, donut) | Implemented |
| Internationalization | NextJS i18n + DeepL API (7 languages) | Implemented |
| Blockchain | Mesh SDK (wallet connection + vote submission) | Implemented |
| Markdown | react-markdown + remark-gfm + DOMPurify | Implemented |

## Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                    │
│                           (Cgov API)                                    │
│                    BACKEND_API_URL + BACKEND_API_KEY                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES                                   │
│                      (Server-side proxy)                                │
├─────────────────────────────────────────────────────────────────────────┤
│  src/pages/api/                                                         │
│  ├── overview/               → /api/overview, /proposals, /ncl          │
│  ├── proposal/[id].ts        → /api/proposal/:id                        │
│  ├── dreps/                  → /api/dreps, /stats, /:id, /:id/votes    │
│  ├── analytics/              → 25+ analytics endpoints                  │
│  ├── translate.ts            → DeepL translation proxy                  │
│  └── tx-timestamp.ts         → Transaction timestamp lookup             │
│                                                                         │
│  Uses: src/utils/apiHelper.ts (adds X-API-Key header)                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    ┌────────────┼──────────────┐
                    │            │              │
                    ▼            ▼              ▼
┌──────────────────────┐ ┌─────────────┐ ┌─────────────────────┐
│   ISR (SSG)          │ │ SWR Hooks   │ │ Server-side Fetch   │
│   getStaticProps     │ │ (client)    │ │ (lib/serverFetch.ts)│
│   revalidate: 60     │ │ fallbackData│ │ DRep data seeding   │
└──────────┬───────────┘ └──────┬──────┘ └──────────┬──────────┘
           │                    │                    │
           └────────────────────┼────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      REDUX STORE (backward compat)                      │
│                src/store/governanceSlice.ts                             │
├─────────────────────────────────────────────────────────────────────────┤
│  SWR hooks sync data to Redux for components that still use selectors   │
│  State: actions, selectedAction, overview, nclDataList, filters         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        UI COMPONENTS                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Implementation Patterns

### 1. ISR + SWR Hybrid Rendering

All main pages use Incremental Static Regeneration with SWR client-side revalidation:

```typescript
// src/pages/index.tsx (and /governance/[hash], /drep, /drep/[drepId])
export async function getStaticProps() {
  const data = await fetchFromBackend();
  return { props: { fallbackData: data }, revalidate: 60 };
}

// In component:
const { data } = useSWR(key, fetcher, { fallbackData: props.fallbackData });
```

- `getStaticProps` with `revalidate: 60` provides fast initial render
- SWR hooks use `fallbackData` from ISR for seamless hydration
- For dynamic routes: `getStaticPaths` with `paths: []`, `fallback: 'blocking'`
- Module-level caches (e.g., `useAllDReps`) need ISR data seeded into the module cache, not just SWR fallback

### 2. API Authentication (Server-side)

API keys are kept server-side only, never exposed to the browser.

```typescript
// src/utils/apiHelper.ts
export async function callApi(args: CallApiArgs) {
  const res = await fetch(backendApiUrl + args.endpoint, {
    headers: {
      "Content-Type": "application/json",
      ...(backendApiKey && { "X-API-Key": backendApiKey }),
    },
  });
}
```

### 3. Data Transformations

Lovelace to ADA conversion happens in the frontend service layer.

```typescript
// src/services/api.ts
function lovelaceToAdaNumber(lovelace: string | undefined): number {
  if (!lovelace) return 0;
  return Number(lovelace) / 1_000_000;
}
```

### 4. Vote Calculation Logic

Vote calculations vary by action type and epoch. Logic is centralized in `voteBreakdownCalculator.ts`.

- Epoch 534 threshold: different SPO formulas before/after
- NO_CONFIDENCE: `alwaysNoConfidence` counts as Yes
- HARD_FORK_INITIATION: `alwaysAbstain + notVoted` count as No
- All other actions: `alwaysNoConfidence + notVoted` count as No

See [voting-calculation-audit.md](voting-calculation-audit.md) for the full audit.

### 5. Voter Eligibility

```typescript
// src/lib/governanceVotingEligibility.ts
const ELIGIBILITY: Record<ProposalType, RoleEligibility> = {
  NoConfidence: { SPO: true, DRep: true, CC: false },
  UpdateCommittee: { SPO: true, DRep: true, CC: false },
  NewConstitution: { SPO: false, DRep: true, CC: true },
  HardForkInitiation: { SPO: true, DRep: true, CC: true },
  ParameterChange: { SPO: false, DRep: true, CC: true },
  Treasury: { SPO: false, DRep: true, CC: true },
  InfoAction: { SPO: true, DRep: true, CC: true },
};
```

### 6. Wallet Integration (Mesh SDK)

Mesh SDK crashes at module eval if Web Crypto is unavailable (HTTP, not localhost). Solution:

```typescript
// Runtime import() gated by Web Crypto availability
useEffect(() => {
  if (window.crypto?.subtle) {
    import("@meshsdk/web3-sdk").then(setMeshModule);
  }
}, []);
```

Components using Mesh SDK (`LazyWalletButton`, `LazyVoteOnProposal`) use this pattern. This reduced `_app.js` bundle from 2.72 MB to 84 KB.

### 7. Theme System

Three themes with CSS custom properties:

```typescript
// src/lib/theme.tsx — sets data-theme on <html>, toggles .dark class
// Themes: light, dark, game
// Tokens: src/themes/*/tokens.css
// Per-theme React overrides via useTheme().components
```

See [theming-guide.md](theming-guide.md) for full details.

### 8. Multi-Dashboard Architecture

```
src/components/dashboards/
├── shared/              # DashboardProvider, DashboardGrid, ChartCard, etc.
├── governance/charts/   # 7 governance charts + CHART_REGISTRY
├── drep/charts/         # DRep dashboard (placeholder)
└── phil/charts/         # Phil's dashboard (placeholder)
```

Each dashboard has its own chart registry. Shared infrastructure handles drag/resize/persist via DashboardProvider + localStorage.

### 9. DRep Data Layer

DRep data uses SWR hooks (not Redux) with module-level caching:

```typescript
// src/hooks/useDRepData.ts
useDRepStats()          // Aggregate DRep statistics
useDRepList()           // Paginated DRep listing
useDRepDetail(drepId)   // Individual DRep profile
useAllDReps()           // All DReps (module-level 60s TTL cache)
useDRepRationaleStats() // Rationale statistics (server-side aggregation)
```

Server-side fetching for ISR: `fetchDRepStatsServer()`, `fetchAllDRepsServer()` in `src/lib/serverFetch.ts`.

Backend data normalization:
- Votes come as uppercase (`"YES"`) → normalized to `"Yes"` via `normalizeVote()`
- Proposal types come as SCREAMING_SNAKE_CASE → formatted via `formatProposalType()`

### 10. Internationalization

7 languages via NextJS i18n + DeepL API:

```
src/messages/{en,de,es,fr,ja,pt,zh}.json  # Translation files
src/lib/i18n.ts                            # i18n configuration
src/hooks/useContentTranslation.ts         # Content translation hook
src/components/TranslatedText.tsx          # i18n text wrapper
src/pages/api/translate.ts                 # DeepL proxy
```

## Environment Configuration

```bash
# .env.local
BACKEND_API_URL=<backend-url>
BACKEND_API_KEY=<api-key>              # Server-side only
```

## File Organization

```
src/
├── components/
│   ├── ui/                     # Reusable UI components (shadcn/ui style)
│   ├── layout/                 # Layout components (Header, Footer)
│   ├── governance/             # Vote submission (VoteOnProposal, VoteButtons)
│   ├── wallet/                 # Wallet connection (ConnectWalletButton, Modal)
│   ├── dreps/                  # D3 visualizations (BubbleMap, TreeMap, Donut, Sunburst)
│   ├── dashboards/             # Multi-dashboard system (shared infra + per-dashboard charts)
│   ├── analytics/              # Analytics test panel
│   └── *.tsx                   # Feature components (GovernanceTable, VotingRecords, etc.)
├── pages/
│   ├── api/                    # Next.js API routes (server-side proxy)
│   ├── governance/             # Proposal detail pages
│   ├── drep/                   # DRep listing and profile pages
│   └── *.tsx                   # Page components (landing, dashboard, 404)
├── hooks/                      # SWR data hooks (governance, DRep, i18n)
├── store/                      # Redux store and slices
├── services/                   # API service layer (api.ts, analyticsApi.ts)
├── lib/                        # Core utilities and business logic
├── utils/                      # Helper utilities (apiHelper)
├── types/                      # TypeScript types (governance, drep, dashboard, analytics)
├── config/                     # API endpoint configuration
├── messages/                   # i18n translation files (7 languages)
└── themes/                     # Theme CSS tokens (light, dark, game)
```

## Known Issues & Considerations

### Resolved

1. **HardFork DRep Eligibility** — Fixed: DReps DO vote on Hard Forks with 60% threshold per Conway Ledger spec (Fig. 42)
2. **UpdateCommittee CC State** — Documented: Threshold varies based on CC state (67% normal, 60% no-confidence). Backend provides CC confidence state
3. **SPO Percentage Bug** — Backend bug confirmed (see [spo-percentage-bug-investigation.md](spo-percentage-bug-investigation.md))
4. **Mesh SDK Bundle Crash** — Fixed: Runtime `import()` gated by Web Crypto availability

### Low Priority

1. **Threshold Validation** — Frontend trusts backend thresholds without validation
2. **Protocol Parameter Subgroups** — No distinction between governance group (75%) and other groups (67%)

## Related Documentation

- [01-project-description.md](01-project-description.md) - Project overview and features
- [02-database-schema.md](02-database-schema.md) - Data models
- [voting-stuff.md](voting-stuff.md) - Complete API and type reference
- [voting-calculation-audit.md](voting-calculation-audit.md) - Implementation audit
- [theming-guide.md](theming-guide.md) - Theme system documentation
- [dashboard.md](dashboard.md) - Dashboard feature documentation
- [project-evolution.md](project-evolution.md) - Platform evolution history
