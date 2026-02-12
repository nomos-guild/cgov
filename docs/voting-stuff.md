# Cgov Voting Data & Governance Rules Reference

This document provides a complete reference for how the cgov application handles onchain voting data and Cardano governance rules. Use this as a foundation for building an MCP server to assist with AI-powered development.

---

## Table of Content

1. [Architecture Overview](#architecture-overview)
2. [Data Flow](#data-flow)
3. [API Endpoints](#api-endpoints)
4. [Type Definitions](#type-definitions)
5. [Governance Rules](#governance-rules)
6. [Vote Calculation Logic](#vote-calculation-logic)
7. [Key Constants](#key-constants)
8. [File Reference](#file-reference)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CGOV APPLICATION                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────────┐    │
│  │   Backend    │───▶│  Next.js API     │───▶│  Frontend Service  │    │
│  │   (Cgov API) │    │  Routes (/api/*) │    │  (api.ts)          │    │
│  └──────────────┘    └──────────────────┘    └─────────┬──────────┘    │
│                                                        │               │
│                              ┌──────────────────────────┤               │
│                              │                          │               │
│                              ▼                          ▼               │
│  ┌───────────────────────────────┐  ┌──────────────────────────────┐  │
│  │   ISR + SWR Hooks             │  │   Redux Store (backward compat)│ │
│  │   useGovernanceData.ts        │  │   governanceSlice.ts          │  │
│  │   useDRepData.ts              │──▶│   SWR hooks sync to Redux    │  │
│  │   useContentTranslation.ts    │  │                               │  │
│  └───────────────────┬───────────┘  └──────────────────────────────┘  │
│                      │                                                  │
│                      ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                      UI Components                                │ │
│  │  • GovernanceTable    • VoteProgress      • VotingRecords        │ │
│  │  • GovernanceStats    • Dashboard charts   • DRep pages          │ │
│  │  • D3 Visualizations  • LanguageSelector  • VoteOnProposal       │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Request Flow
1. **ISR** (`getStaticProps`, `revalidate: 60`) pre-renders pages with server-side data
2. **SWR Hooks** (`useGovernanceData.ts`, `useDRepData.ts`) revalidate client-side with `fallbackData` from ISR
3. **API Routes** (`src/pages/api/*`) use `apiHelper.ts` to add API key and proxy to backend
4. **Frontend Service** (`src/services/api.ts`) transforms data (lovelace → ADA)
5. **SWR hooks sync to Redux** for backward compatibility with components using selectors
6. **Components** render data with vote calculations from `voteBreakdownCalculator.ts`

### Data Transformations
- **Lovelace to ADA**: `lovelaceValue / 1_000_000`
- **Percentages**: Calculated from raw vote power values
- **Vote Breakdowns**: Derived from `rawVotingPowerValues` or `drep.breakdown`/`spo.breakdown`

---

## API Endpoints

### Internal API Routes (Next.js)

| Route | File | Backend Endpoint | Purpose |
|-------|------|------------------|---------|
| `GET /api/overview` | `src/pages/api/overview/index.ts` | `/overview` | Overview statistics |
| `GET /api/overview/proposals` | `src/pages/api/overview/proposals.ts` | `/overview/proposals` | All governance actions |
| `GET /api/overview/ncl` | `src/pages/api/overview/ncl/index.ts` | `/overview/ncl` | NCL data all years |
| `GET /api/overview/ncl/[year]` | `src/pages/api/overview/ncl/[year].ts` | `/overview/ncl/{year}` | NCL data for year |
| `GET /api/proposal/[id]` | `src/pages/api/proposal/[id].ts` | `/proposal/{id}` | Proposal detail |

### Frontend API Config (`src/config/api.ts`)

```typescript
export const API_ENDPOINTS = {
  // Overview
  overview: "/api/overview",
  proposals: "/api/overview/proposals",
  ncl: "/api/overview/ncl",
  nclByYear: (year: number) => `/api/overview/ncl/${year}`,
  proposalDetail: (proposalId: string) => `/api/proposal/${encodeURIComponent(proposalId)}`,

  // DReps
  drepStats: "/api/dreps/stats",
  dreps: "/api/dreps",
  drepDetail: (drepId: string) => `/api/dreps/${encodeURIComponent(drepId)}`,
  drepVotes: (drepId: string) => `/api/dreps/${encodeURIComponent(drepId)}/votes`,
  drepRationaleStats: "/api/dreps/rationale-stats",
  drepVoteChanges: "/api/dreps/vote-changes",

  // Analytics (25+ endpoints across 6 categories)
  // See src/config/api.ts for full list
}
```

### SWR Data Hooks

```typescript
// src/hooks/useGovernanceData.ts — governance data with Redux sync
useGovernanceActions()          // All governance actions
useOverviewSummary()            // Dashboard statistics
useNCLData()                    // NCL (Net Change Limit) data
useGovernanceActionDetail(id)   // Single proposal detail

// src/hooks/useDRepData.ts — DRep data (no Redux, module-level cache)
useDRepStats()                  // Aggregate DRep statistics
useDRepList(params)             // Paginated DRep listing
useDRepDetail(drepId)           // Individual DRep profile
useAllDReps()                   // All DReps (60s TTL module cache)
useDRepRationaleStats()         // Rationale statistics (server-side aggregation)
```

### Server-Side Fetching (`src/lib/serverFetch.ts`)

```typescript
fetchDRepStatsServer()          // DRep stats for ISR
fetchAllDRepsServer()           // All DReps for ISR
```

### Environment Variables

```
BACKEND_API_URL=<backend-url>   # Backend base URL
BACKEND_API_KEY=<secret>        # API authentication key (server-side only)
```

---

## Type Definitions

### Core Types (`src/types/governance.ts`)

#### GovernanceAction
Main proposal object returned from `/overview/proposals`.

```typescript
interface GovernanceAction {
  // Identifiers
  hash: string;                    // txHash:certIndex (used for routing)
  proposalId?: string;             // Cardano gov_action bech32 format
  txHash?: string;                 // Transaction hash

  // Content
  title: string;
  type: string;                    // Human-readable type label
  status: ProposalStatus;
  constitutionality: string;

  // DRep voting (ADA-weighted)
  drepYesPercent: number;
  drepNoPercent: number;
  drepAbstainPercent?: number;
  drepYesAda: number;
  drepNoAda: number;
  drepAbstainAda?: number;

  // SPO voting (ADA-weighted, optional)
  spoYesPercent?: number;
  spoNoPercent?: number;
  spoAbstainPercent?: number;
  spoYesAda?: number;
  spoNoAda?: number;
  spoAbstainAda?: number;

  // CC voting (count-based, optional)
  ccYesPercent?: number;
  ccNoPercent?: number;
  ccAbstainPercent?: number;
  ccYesCount?: number;
  ccNoCount?: number;
  ccAbstainCount?: number;

  // Vote totals
  totalYes: number;
  totalNo: number;
  totalAbstain: number;

  // Epoch info
  submissionEpoch: number;
  expiryEpoch: number;

  // Backend-computed thresholds
  threshold?: {
    ccThreshold: number | null;
    drepThreshold: number | null;
    spoThreshold: number | null;
  };

  // Backend-computed pass/fail status
  votingStatus?: {
    ccPassing: boolean | null;
    drepPassing: boolean | null;
    spoPassing: boolean | null;
  };

  // Raw nested objects
  drep?: GovernanceActionVoteInfo;
  spo?: GovernanceActionVoteInfo;
  cc?: CCGovernanceActionVoteInfo;

  // Detailed breakdowns
  rawVotingPowerValues?: RawVotingPowerValues;
  drepBreakdown?: VoteBreakdown;
  spoBreakdown?: VoteBreakdown;
  governanceActionType?: string;
}
```

#### GovernanceActionVoteInfo
Vote tallies for DRep/SPO (ADA-weighted).

```typescript
interface GovernanceActionVoteInfo {
  yesPercent: number;
  noPercent: number;
  abstainPercent: number;
  // Raw lovelace from API
  yesLovelace?: string;
  noLovelace?: string;
  abstainLovelace?: string;
  // Converted to ADA for display
  yesAda?: number;
  noAda?: number;
  abstainAda?: number;
}
```

#### CCGovernanceActionVoteInfo
Vote tallies for Constitutional Committee (count-based).

```typescript
interface CCGovernanceActionVoteInfo {
  yesPercent: number;
  noPercent: number;
  abstainPercent: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  notVotedCount?: number;
  notVotedPercent?: number;
}
```

#### VoteBreakdown
Detailed breakdown by delegation status.

```typescript
interface VoteBreakdown {
  activeYes: string;           // Lovelace string
  activeNo: string;            // Lovelace string
  activeAbstain: string;       // Lovelace string
  alwaysAbstain: string;       // Lovelace string
  alwaysNoConfidence: string;  // Lovelace string
  inactive: string;            // DRep only (SPO doesn't have inactive)
  notVoted: string;            // Lovelace string
}
```

#### RawVotingPowerValues
Raw voting power from API by voter group. Field names use snake_case as returned by the API.

```typescript
interface RawVotingPowerValues {
  // DRep values
  drep_active_abstain_vote_power?: string;
  drep_active_no_vote_power?: string;
  drep_active_yes_vote_power?: string;
  drep_always_abstain_vote_power?: string;
  drep_always_no_confidence_power?: string;
  drep_inactive_vote_power?: string;
  drep_total_vote_power?: string;

  // SPO values
  spo_active_abstain_vote_power?: string;
  spo_active_no_vote_power?: string;
  spo_active_yes_vote_power?: string;
  spo_always_abstain_vote_power?: string;
  spo_always_no_confidence_power?: string;
  spo_total_vote_power?: string;
}
```

#### VoteRecord
Individual vote record from proposal detail.

```typescript
interface VoteRecord {
  voterType?: "DRep" | "SPO" | "CC";
  voterId?: string;
  voterName?: string;

  // Legacy fields (backwards compatibility)
  drepId: string;
  drepName: string;

  vote: "Yes" | "No" | "Abstain";
  votingPower: string;         // Lovelace string
  votingPowerAda: number;      // Converted ADA

  anchorUrl?: string;
  anchorHash?: string;
  rationale?: string;          // May be plain text or CIP-100/CIP-136 JSON

  votedAt: string;             // ISO timestamp
  txHash?: string;             // Vote transaction hash
}
```

#### GovernanceActionDetail
Extended proposal with full details.

```typescript
interface GovernanceActionDetail extends GovernanceAction {
  description?: string;
  rationale?: string;
  references?: ProposalReferenceObject[];
  votes?: VoteRecord[];      // DRep and SPO votes
  ccVotes?: VoteRecord[];    // Constitutional Committee votes
}
```

#### OverviewSummary
Dashboard statistics.

```typescript
interface OverviewSummary {
  year: number;
  currentValue: number;        // Active proposals
  targetValue: number;         // Total proposals
  totalProposals: number;
  activeProposals: number;
  ratifiedProposals: number;
  enactedProposals: number;
  expiredProposals: number;
  closedProposals: number;
}
```

#### NCL Data Types
Net Change Limit (Treasury withdrawal tracking).

```typescript
interface NCLYearData {
  year: number;
  currentValue: string;        // Lovelace string
  targetValue: string;         // Lovelace string
  epoch: number;
  updatedAt: string;
}

interface NCLDisplayData {
  year: number;
  currentValueAda: number;     // Converted ADA
  targetValueAda: number;      // Converted ADA
  percentUsed: number;
  epoch: number;
  updatedAt: string;
}
```

### Enums and Union Types

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

type GovernanceActionType =
  | "All"
  | "Info Action"
  | "Treasury Withdrawals"
  | "New Constitution"
  | "Hard Fork Initiation"
  | "Protocol Parameter Change"
  | "No Confidence"
  | "Update Committee";

type VoteType = "All" | "Yes" | "No" | "Abstain";

type VoterType = "DRep" | "SPO" | "CC";

type GovernanceActionTypeCode = "NO_CONFIDENCE" | "HARD_FORK_INITIATION" | "OTHER";
```

---

## Governance Rules

### Voter Eligibility Matrix (`src/lib/governanceVotingEligibility.ts`)

Determines which voter types can vote on each proposal type.

| Proposal Type | DRep | SPO | CC |
|---------------|:----:|:---:|:---:|
| No Confidence | ✓ | ✓ | ✗ |
| Update Committee | ✓ | ✓ | ✗ |
| New Constitution | ✓ | ✗ | ✓ |
| Hard Fork Initiation | ✓ (60%) | ✓ | ✓ |
| Protocol Parameter Change | ✓ | ✗ | ✓ |
| Treasury Withdrawals | ✓ | ✗ | ✓ |
| Info Action | ✓ | ✓ | ✓ |

```typescript
// Check if a role can vote on action type
canRoleVoteOnAction(type: ProposalType | string, role: VoterType): boolean

// Get all eligible voter types for action
getEligibleRoles(type: ProposalType | string): VoterType[]
```

### Label to Type Mapping

```typescript
const LABEL_TO_PROPOSAL_TYPE = {
  "Info Action": "InfoAction",
  "Treasury Withdrawals": "Treasury",
  "New Constitution": "NewConstitution",
  "Hard Fork Initiation": "HardForkInitiation",
  "Protocol Parameter Change": "ParameterChange",
  "No Confidence": "NoConfidence",
  "Update Committee": "UpdateCommittee",
}
```

### Proposal Status Meanings

| Status | Description |
|--------|-------------|
| **Active** | Voting is ongoing |
| **Ratified** | Passed voting, waiting for enactment |
| **Enacted** | Applied to the chain |
| **Expired** | Voting ended without ratification |
| **Closed** | Expired/dropped (Info actions only) |

---

## Vote Calculation Logic

### Core File: `src/lib/voteBreakdownCalculator.ts`

### Epoch 534 Threshold

Governance rules changed at epoch 534. Different calculation formulas apply before/after.

```typescript
const EPOCH_534_THRESHOLD = 534;
```

### DRep Legend Totals

```typescript
function calculateDrepLegendTotals(breakdown: VoteBreakdown, actionType: GovernanceActionTypeCode): CalculatedVoteTotals

// For NO_CONFIDENCE actions:
// yes = activeYes + alwaysNoConfidence
// no = activeNo + notVoted
// abstain = activeAbstain + alwaysAbstain
// inactive = inactive

// For OTHER actions:
// yes = activeYes
// no = activeNo + alwaysNoConfidence + notVoted
// abstain = activeAbstain + alwaysAbstain
// inactive = inactive
```

### SPO Legend Totals

```typescript
function calculateSpoLegendTotals(breakdown: VoteBreakdown, actionType: GovernanceActionTypeCode, submissionEpoch: number): CalculatedVoteTotals

// Epoch < 534 (old formula):
// yes = activeYes
// no = activeNo + alwaysNoConfidence
// abstain = activeAbstain + alwaysAbstain
// notCounted = notVoted (excluded)

// Epoch >= 534, HARD_FORK_INITIATION:
// yes = activeYes
// no = activeNo + alwaysNoConfidence + alwaysAbstain + notVoted
// abstain = activeAbstain (explicit only)

// Epoch >= 534, NO_CONFIDENCE:
// yes = activeYes + alwaysNoConfidence
// no = activeNo + notVoted
// abstain = activeAbstain + alwaysAbstain

// Epoch >= 534, OTHER:
// yes = activeYes
// no = activeNo + alwaysNoConfidence + notVoted
// abstain = activeAbstain + alwaysAbstain
```

### Donut Chart Segments

```typescript
function calculateDonutSegments(breakdown: VoteBreakdown, includeInactive: boolean): DonutSegmentValues

// Returns:
// yes = activeYes
// no = activeNo
// alwaysNoConfidence = alwaysNoConfidence
// notVoted = notVoted
// excluded = activeAbstain + alwaysAbstain + inactive

// Total for ratification = yes + no + alwaysNoConfidence + notVoted
// (excluded does NOT impact ratification)
```

### Always No Confidence Coloring

```typescript
function getAlwaysNoConfidenceColor(actionType: GovernanceActionTypeCode): string

// NO_CONFIDENCE: "#22C55E" (green - counts as Yes)
// OTHER: "#000000" (black - counts as No)
```

### Segment Colors

```typescript
const SEGMENT_COLORS = {
  yes: "#22C55E",                    // Green
  no: "#8C200B",                     // Brown
  alwaysNoConfidenceYes: "#22C55E", // Green (NO_CONFIDENCE)
  alwaysNoConfidenceNo: "#000000",  // Black (other actions)
  notVoted: "#D1D5DB",              // Gray
  excluded: "#9CA3AF",              // Dark gray
}
```

### Action Type Code Resolution

```typescript
function getGovernanceActionTypeCode(type: string | undefined): GovernanceActionTypeCode

// Normalizes type string to code:
// "no confidence" variants → "NO_CONFIDENCE"
// "hard fork" variants → "HARD_FORK_INITIATION"
// everything else → "OTHER"
```

---

## Key Constants

### Cardano Epoch Constants (from `src/pages/governance/[hash].tsx`)

```typescript
const SHELLEY_START_EPOCH = 208;                              // July 29, 2020
const SHELLEY_START_TIME = new Date("2020-07-29T21:44:51Z");
const EPOCH_DURATION_MS = 5 * 24 * 60 * 60 * 1000;           // 5 days
```

### Proposal Type List

```typescript
const PROPOSAL_TYPES: ProposalType[] = [
  "NoConfidence",
  "UpdateCommittee",
  "NewConstitution",
  "HardForkInitiation",
  "ParameterChange",
  "Treasury",
  "InfoAction",
];
```

### Status Options

```typescript
const STATUS_OPTIONS: ProposalStatus[] = [
  "Active",
  "Ratified",
  "Enacted",
  "Expired",
  "Closed",
];
```

---

## File Reference

### Core Files

| File | Purpose |
|------|---------|
| `src/types/governance.ts` | All TypeScript type definitions |
| `src/services/api.ts` | API service layer with data transformations |
| `src/lib/voteBreakdownCalculator.ts` | Vote calculation and chart segment logic |
| `src/lib/governanceVotingEligibility.ts` | Voter eligibility rules matrix |
| `src/store/governanceSlice.ts` | Redux state management |
| `src/config/api.ts` | API endpoint configuration |
| `src/utils/apiHelper.ts` | Server-side API authentication wrapper |

### API Routes

| File | Route |
|------|-------|
| `src/pages/api/overview/index.ts` | `/api/overview` |
| `src/pages/api/overview/proposals.ts` | `/api/overview/proposals` |
| `src/pages/api/overview/ncl/index.ts` | `/api/overview/ncl` |
| `src/pages/api/overview/ncl/[year].ts` | `/api/overview/ncl/:year` |
| `src/pages/api/proposal/[id].ts` | `/api/proposal/:id` |
| `src/pages/api/dreps/index.ts` | `/api/dreps` |
| `src/pages/api/dreps/stats.ts` | `/api/dreps/stats` |
| `src/pages/api/dreps/rationale-stats.ts` | `/api/dreps/rationale-stats` |
| `src/pages/api/dreps/vote-changes.ts` | `/api/dreps/vote-changes` |
| `src/pages/api/dreps/[drepId]/index.ts` | `/api/dreps/:drepId` |
| `src/pages/api/dreps/[drepId]/votes.ts` | `/api/dreps/:drepId/votes` |
| `src/pages/api/analytics/*` | 25+ analytics endpoints (see `src/config/api.ts`) |
| `src/pages/api/translate.ts` | `/api/translate` (DeepL proxy) |
| `src/pages/api/tx-timestamp.ts` | `/api/tx-timestamp` |

### UI Components

| File | Purpose |
|------|---------|
| `src/components/GovernanceTable.tsx` | Main proposals table with filtering |
| `src/components/GovernanceStats.tsx` | Dashboard statistics display |
| `src/components/ui/vote-progress.tsx` | Donut chart voting visualization |
| `src/components/VotingRecords.tsx` | Detailed voting records table |
| `src/components/VotingSummary.tsx` | Vote count statistics grid |
| `src/components/BubbleMap.tsx` | D3.js force-directed voter visualization (legacy) |
| `src/components/dreps/DRepBubbleMap.tsx` | D3 circle-packing DRep visualization |
| `src/components/dreps/DRepTreeMap.tsx` | D3 treemap DRep visualization |
| `src/components/dreps/DRepDonutChart.tsx` | D3 animated donut chart |
| `src/components/dreps/DRepSunburstChart.tsx` | Chart type switcher with crossfade |
| `src/components/governance/VoteOnProposal.tsx` | On-chain vote submission |
| `src/components/LanguageSelector.tsx` | Language picker dropdown |

### Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useGovernanceData.ts` | SWR hooks for governance data + Redux sync |
| `src/hooks/useDRepData.ts` | SWR hooks for DRep data + normalization |
| `src/hooks/useContentTranslation.ts` | i18n content translation hook |

### Utility Files

| File | Purpose |
|------|---------|
| `src/lib/voteMath.ts` | Numeric utilities for vote calculations |
| `src/lib/exportRationales.ts` | Vote export (JSON/MD/CSV) and rationale parsing |
| `src/lib/serverFetch.ts` | Server-side data fetching for ISR |
| `src/lib/gini.ts` | Gini coefficient calculation |
| `src/lib/i18n.ts` | i18n configuration |
| `src/services/analyticsApi.ts` | Analytics-specific API calls |

---

## MCP Servers (Implemented)

Two MCP servers provide AI-assisted knowledge for coding agents:

### `mcp__cardano-governance__*` (`.claude/mcp/cardano-governance/`)
CIP-1694 governance rules extracted from the Conway Ledger formal specification.
- `get_governance_action_info`, `get_voter_eligibility`, `get_voting_thresholds`
- `get_vote_calculation_formula`, `get_ratification_rules`, `get_cc_rules`
- `search_governance_rules`, `get_protocol_parameter_groups`
- Reference: `sources/conway-ledger.pdf`

### `mcp__cgov-project__*` (`.claude/mcp/cgov-project/`)
Project-specific knowledge for the cgov codebase.
- `get_project_overview`, `get_file_structure`, `get_type_info`
- `get_voter_eligibility`, `check_can_vote`, `get_vote_calculation_rules`
- `get_api_architecture`, `get_component_info`, `get_coding_conventions`
- `get_dashboard_info`, `get_theming_info`, `search_project_knowledge`

---

## Rationale Format Parsing

Vote rationales may be in multiple formats:

```typescript
// Plain text
"I support this proposal because..."

// CIP-100 JSON
{ "body": { "comment": "My rationale..." } }

// CIP-136 JSON
{ "body": { "rationaleStatement": "...", "conclusion": "..." } }

// Legacy
{ "comment": "My rationale..." }
```

Parser in `src/lib/exportRationales.ts`:

```typescript
function getRationale(raw: string | undefined): string
```
