# cgov: Project Description

## Overview

Cardano Governance Tracking Dashboard built with Next.js/TypeScript to monitor on-chain governance actions, voting records, and DRep activity. Implements CIP-1694 governance visualization for the Conway era.

## Features

### Governance Tracking
- Aggregate governance statistics dashboard with NCL (Net Change Limit) tracking
- Filterable governance actions table (by type and status)
- Detailed governance action pages with voting records
- Three voter types: DRep (stake-weighted), SPO (stake-weighted), CC (count-based)
- Vote breakdown visualization with donut charts
- Search and filter voting records by voter name/ID, vote type, and rationale
- Export voting rationales (JSON, Markdown, CSV)
- Threshold progress indicators per voter type
- On-chain vote submission via wallet (Mesh SDK)

### DRep Dashboard
- DRep listing page with search, sorting, and pagination
- Individual DRep profile pages with full voting history
- D3 visualizations: bubble map, treemap, donut chart with animated transitions
- Voting power distribution analysis
- Rationale statistics and DRep activity tracking

### Customizable Dashboard
- Drag-and-drop chart positioning with resize support
- 7 governance charts (proposal status, types, NCL progress, DRep metrics, etc.)
- Chart visibility toggles, color customization, and dashboard sharing
- localStorage persistence with schema migration

### Analytics
- 25+ API endpoint proxies organized across 6 categories:
  - Ada Holder Participation (voting turnout, delegation rates, etc.)
  - DRep Insights (Gini coefficient, activity rates, rationale rates, etc.)
  - SPO Governance Participation (silent stake, default stance, etc.)
  - Governance Action Health (contention rate, time-to-enactment, etc.)
  - Constitutional Committee Activity (participation, abstain rates, etc.)
  - Tooling & UX (info availability)

### Platform
- Three themes: Light, Dark, Game
- 7-language support (EN, DE, ES, FR, JA, PT, ZH) via NextJS i18n + DeepL
- ISR + SWR hybrid rendering for fast page loads with 60s background revalidation
- Wallet connection for vote submission (Mesh SDK)

## Tech Stack

- Next.js 15 + React 18 + TypeScript 5 (strict mode)
- Next.js Pages Router
- Redux Toolkit (global state) + SWR (data fetching with ISR fallback)
- Radix UI + Tailwind CSS (shadcn/ui style components)
- Recharts (bar/line/pie charts) + D3.js (bubble map, treemap, donut visualizations)
- Mesh SDK (Cardano wallet integration)
- date-fns, lucide-react

## Project Structure

```text
src/
├── components/
│   ├── ui/                           # shadcn-ui base components
│   ├── layout/                       # Header, Footer
│   ├── governance/                   # VoteOnProposal, VoteButtons
│   ├── wallet/                       # ConnectWalletButton, ConnectWalletModal
│   ├── dreps/                        # D3 visualizations (BubbleMap, TreeMap, Donut, Sunburst)
│   ├── dashboards/
│   │   ├── shared/                   # DashboardProvider, DashboardGrid, ChartCard, etc.
│   │   ├── governance/charts/        # Governance dashboard charts (7 charts)
│   │   ├── drep/charts/              # DRep dashboard (placeholder)
│   │   └── phil/charts/              # Phil's dashboard (placeholder)
│   ├── analytics/                    # AnalyticsTestPanel
│   ├── GovernanceStats.tsx           # Statistics cards with NCL progress
│   ├── GovernanceTable.tsx           # Actions table with filtering
│   ├── VotingRecords.tsx             # Votes table with search/filter/export
│   ├── VotingSummary.tsx             # Vote count statistics
│   ├── BubbleMap.tsx                 # D3.js voter visualization (legacy)
│   ├── LanguageSelector.tsx          # Language picker dropdown
│   └── TranslatedText.tsx            # i18n text wrapper
├── pages/
│   ├── index.tsx                     # Landing page (ISR + SWR)
│   ├── dashboard.tsx                 # Customizable governance dashboard
│   ├── governance/[hash].tsx         # Proposal detail (ISR + SWR)
│   ├── drep/index.tsx                # DRep listing page (ISR + SWR)
│   ├── drep/[drepId].tsx             # DRep profile page (ISR + SWR)
│   ├── analytics-test.tsx            # Analytics test panel
│   ├── 404.tsx                       # 404 page
│   ├── _app.tsx                      # App wrapper (Redux, Theme, i18n)
│   ├── _document.tsx                 # Document wrapper
│   └── api/                          # API routes (server-side proxy)
│       ├── overview/                 # Overview, proposals, NCL
│       ├── proposal/[id].ts          # Proposal detail
│       ├── dreps/                    # DRep list, stats, detail, votes, rationale-stats
│       ├── analytics/                # 25+ analytics endpoints
│       ├── translate.ts              # DeepL translation proxy
│       └── tx-timestamp.ts           # Transaction timestamp lookup
├── hooks/
│   ├── useGovernanceData.ts          # SWR hooks: governance actions, overview, NCL, detail
│   ├── useDRepData.ts               # SWR hooks: DRep stats, list, detail, rationale stats
│   └── useContentTranslation.ts     # i18n content translation hook
├── store/
│   ├── index.ts                      # Redux store
│   ├── governanceSlice.ts            # Governance state + async thunks
│   └── hooks.ts                      # useAppDispatch, useAppSelector
├── services/
│   ├── api.ts                        # API client with lovelace→ADA transforms
│   └── analyticsApi.ts               # Analytics-specific API calls
├── types/
│   ├── governance.ts                 # GovernanceAction, VoteRecord, etc.
│   ├── dashboard.ts                  # ChartId, ChartLayout, DashboardConfig
│   ├── drep.ts                       # DRepSummary, DRepDetail, DRepVoteRecord
│   └── analytics.ts                  # Analytics response types
├── lib/
│   ├── theme.tsx                     # Theme provider (light/dark/game)
│   ├── voteBreakdownCalculator.ts    # Vote calculation logic by action type
│   ├── governanceVotingEligibility.ts # Voter eligibility matrix
│   ├── i18n.ts                       # i18n configuration
│   ├── serverFetch.ts                # Server-side DRep/governance data fetching
│   ├── gini.ts                       # Gini coefficient calculation
│   ├── exportRationales.ts           # Vote export functions (JSON/MD/CSV)
│   ├── voteMath.ts                   # Numeric utilities
│   └── utils.ts                      # General utilities (cn, etc.)
├── utils/
│   └── apiHelper.ts                  # Server-side API authentication
├── config/
│   └── api.ts                        # API endpoint configuration
├── messages/                         # i18n translation files (7 languages)
│   ├── en.json, de.json, es.json
│   ├── fr.json, ja.json, pt.json, zh.json
└── themes/                           # Theme definitions
    ├── light/tokens.css
    ├── dark/tokens.css
    └── game/tokens.css
```

## Data Models

See [voting-stuff.md](voting-stuff.md) for complete type definitions.

### Core Types

```typescript
type ProposalStatus = "Active" | "Ratified" | "Enacted" | "Expired" | "Closed";

type ProposalType =
  | "InfoAction"
  | "HardForkInitiation"
  | "ParameterChange"
  | "NoConfidence"
  | "UpdateCommittee"
  | "NewConstitution"
  | "Treasury";

type VoterType = "DRep" | "SPO" | "CC";
type Vote = "Yes" | "No" | "Abstain";
```

## API Architecture

### Data Flow

```
Backend API (Cgov API)
    ↓
Next.js API Routes (/api/*)          ← adds X-API-Key via apiHelper.ts
    ↓
ISR (getStaticProps, revalidate: 60) ← server-side data for initial render
    ↓
SWR Hooks (useGovernanceData, etc.)  ← client-side revalidation with fallbackData
    ↓
Redux Store (backward compat sync)   ← SWR hooks sync data to Redux
    ↓
UI Components
```

### Environment Variables

```bash
BACKEND_API_URL=<backend-url>        # Backend base URL
BACKEND_API_KEY=<secret>             # API authentication key (server-side only)
```

## Governance Rules

See [../sources/cardano-governance-reference.md](../sources/cardano-governance-reference.md) for complete CIP-1694 reference.

### Voter Eligibility Matrix

| Proposal Type | DRep | SPO | CC |
|---------------|:----:|:---:|:---:|
| No Confidence | yes | yes | no |
| Update Committee (normal) | yes (67%) | yes | no |
| Update Committee (no-confidence state) | yes (60%) | yes | no |
| New Constitution | yes | no | yes |
| Hard Fork Initiation | yes (60%) | yes | yes |
| Protocol Parameter Change (network/economic/technical) | yes (67%) | no | yes |
| Protocol Parameter Change (governance) | yes (75%) | no | yes |
| Treasury Withdrawals | yes | no | yes |
| Info Action | yes | yes | yes |

### Status Meanings

| Status | Description |
|--------|-------------|
| Active | Voting ongoing |
| Ratified | Passed voting, awaiting enactment |
| Enacted | Applied to chain |
| Expired | Voting ended without ratification |
| Closed | Expired/dropped Info actions |

## User Flows

**Landing Page**: View statistics → Filter by type/status → Click action → Navigate to detail

**Proposal Detail**: Read description → View vote breakdown charts → Search/filter votes → Export rationales → Submit vote (with wallet)

**DRep Dashboard**: Browse DRep list → Search/sort → Click DRep → View profile with voting history and D3 visualizations

**Custom Dashboard**: Toggle chart visibility → Drag/resize charts → Customize colors → Share configuration

## Related Documentation

- [voting-stuff.md](voting-stuff.md) - Complete type definitions and API reference
- [voting-calculation-audit.md](voting-calculation-audit.md) - Audit of voting calculation implementation
- [dashboard.md](dashboard.md) - Dashboard feature documentation
- [theming-guide.md](theming-guide.md) - Theme system documentation
- [analytics-table.md](analytics-table.md) - Analytics KPI catalogue
- [project-evolution.md](project-evolution.md) - Full platform evolution history
