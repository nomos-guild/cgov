# Cgov Voting Data & Governance Rules Reference

This document provides a complete reference for how the cgov application handles onchain voting data and Cardano governance rules. Use this as a foundation for building an MCP server to assist with AI-powered development.

---

## Table of Contents

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
│  │   (Cgov API) │    │  Routes          │    │  (api.ts)          │    │
│  │              │    │  /api/*          │    │                    │    │
│  └──────────────┘    └──────────────────┘    └─────────┬──────────┘    │
│                                                        │               │
│                                                        ▼               │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                      Redux Store                                 │  │
│  │                   (governanceSlice.ts)                          │  │
│  │                                                                  │  │
│  │  • actions: GovernanceAction[]                                  │  │
│  │  • selectedAction: GovernanceActionDetail                       │  │
│  │  • overview: OverviewSummary                                    │  │
│  │  • nclDataList: NCLDisplayData[]                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                       │
│                                ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                      UI Components                                │ │
│  │  • GovernanceTable      • VoteProgress       • VotingRecords     │ │
│  │  • GovernanceStats      • BubbleMap          • VotingSummary     │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Request Flow
1. **Frontend** calls local Next.js API route (e.g., `/api/overview/proposals`)
2. **API Route** (`src/pages/api/*`) uses `apiHelper.ts` to add API key and call backend
3. **Backend Response** is proxied back to frontend
4. **Frontend Service** (`src/services/api.ts`) transforms data (lovelace → ADA)
5. **Redux Store** (`governanceSlice.ts`) manages state
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
  overview: "/api/overview",
  proposals: "/api/overview/proposals",
  ncl: "/api/overview/ncl",
  nclByYear: (year: number) => `/api/overview/ncl/${year}`,
  proposalDetail: (proposalId: string) => `/api/proposal/${encodeURIComponent(proposalId)}`,
}
```

### Environment Variables

```
BACKEND_API_URL=http://localhost:3001  # Backend base URL
BACKEND_API_KEY=<secret>               # API authentication key
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
Raw voting power from API by voter group.

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
| Hard Fork Initiation | ✗ | ✓ | ✓ |
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

### UI Components

| File | Purpose |
|------|---------|
| `src/components/GovernanceTable.tsx` | Main proposals table with filtering |
| `src/components/GovernanceStats.tsx` | Dashboard statistics display |
| `src/components/ui/vote-progress.tsx` | Donut chart voting visualization |
| `src/components/VotingRecords.tsx` | Detailed voting records table |
| `src/components/VotingSummary.tsx` | Vote count statistics grid |
| `src/components/BubbleMap.tsx` | D3.js force-directed voter visualization |

### Utility Files

| File | Purpose |
|------|---------|
| `src/lib/voteMath.ts` | Numeric utilities for vote calculations |
| `src/lib/exportRationales.ts` | Vote export (JSON/MD/CSV) and rationale parsing |

---

## MCP Server Recommendations

When building an MCP server for AI-assisted development on this codebase:

### Key Data to Expose

1. **Type Definitions**: Full governance types for code generation
2. **Eligibility Matrix**: Voter eligibility rules for validation
3. **Vote Calculation Formulas**: Epoch-dependent calculation logic
4. **API Endpoints**: Available data fetching routes
5. **Constants**: Epoch thresholds, colors, status values

### Useful MCP Resources

- `governance-types`: Return full type definitions
- `eligibility-matrix`: Return voter eligibility rules
- `vote-calculations`: Explain vote calculation logic for a given action type
- `api-schema`: Return API endpoint documentation
- `component-map`: Return which components handle what data

### Sample MCP Tools

- `get_voter_eligibility(proposal_type, voter_type)`: Check if voter can vote
- `calculate_vote_totals(breakdown, action_type, epoch)`: Compute legend totals
- `get_action_type_code(type_string)`: Normalize type string to code
- `lovelace_to_ada(lovelace)`: Convert currency units

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
