# cgov: Project Description

## Overview

Cardano Governance Tracking Dashboard built with Next.js/TypeScript to monitor on-chain governance actions and voting records. Implements CIP-1694 governance visualization for the Conway era.

## Features

- Aggregate governance statistics dashboard with NCL (Net Change Limit) tracking
- Filterable governance actions table (by type and status)
- Detailed governance action pages with voting records
- Three voter types: DRep (stake-weighted), SPO (stake-weighted), CC (count-based)
- Vote breakdown visualization with donut charts
- Search and filter voting records by voter name/ID, vote type, and rationale
- Export voting rationales (JSON, Markdown, CSV)
- Threshold progress indicators per voter type
- Dark/Light/Game theme support
- Wallet connection for vote submission (Mesh SDK)

## Tech Stack

- Next.js 15.0.3 + React 18 + TypeScript 5
- Next.js Pages Router (/, /governance/[hash], /404)
- Redux Toolkit (state management)
- Radix UI + Tailwind CSS (shadcn/ui style components)
- Recharts (donut charts, line charts)
- D3.js (bubble map visualization)
- date-fns, lucide-react
- Mesh SDK (Cardano wallet integration)

## Project Structure

```text
src/
├── components/
│   ├── ui/                           # shadcn-ui components (button, card, table, vote-progress, etc.)
│   ├── layout/                       # Layout components (Header, Footer)
│   ├── governance/                   # Governance-specific components (VoteOnProposal, VoteButtons)
│   ├── GovernanceStats.tsx           # Statistics cards with NCL progress
│   ├── GovernanceTable.tsx           # Actions table with filtering
│   ├── VotingRecords.tsx             # Votes table with search/filter/export
│   ├── VotingSummary.tsx             # Vote count statistics
│   ├── BubbleMap.tsx                 # D3.js voter visualization
│   └── ProposalContent.tsx           # Markdown content renderer
├── pages/
│   ├── index.tsx                     # Dashboard
│   ├── governance/[hash].tsx         # Detail view
│   ├── 404.tsx                       # 404 page
│   ├── _app.tsx                      # Next.js app wrapper
│   ├── _document.tsx                 # Next.js document wrapper
│   └── api/                          # API routes
│       ├── overview/
│       │   ├── index.ts              # GET /api/overview
│       │   ├── proposals.ts          # GET /api/overview/proposals
│       │   └── ncl/
│       │       ├── index.ts          # GET /api/overview/ncl
│       │       └── [year].ts         # GET /api/overview/ncl/:year
│       └── proposal/
│           └── [id].ts               # GET /api/proposal/:id
├── store/
│   ├── index.ts                      # Redux store
│   ├── governanceSlice.ts            # Governance state slice
│   └── hooks.ts                      # Redux hooks
├── services/
│   └── api.ts                        # API service layer with data transformations
├── types/
│   └── governance.ts                 # TypeScript types (339 lines)
├── lib/
│   ├── utils.ts                      # General utilities
│   ├── theme.tsx                     # Theme provider
│   ├── voteBreakdownCalculator.ts    # Vote calculation logic
│   ├── governanceVotingEligibility.ts # Voter eligibility matrix
│   ├── voteMath.ts                   # Numeric utilities
│   └── exportRationales.ts           # Vote export functions
├── utils/
│   └── apiHelper.ts                  # Server-side API authentication
├── config/
│   └── api.ts                        # API endpoint configuration
└── themes/                           # Theme definitions (light, dark, game)
```

## Data Models

See [voting-stuff.md](voting-stuff.md) for complete type definitions.

### Core Types

```typescript
// Proposal status values
type ProposalStatus = "Active" | "Ratified" | "Enacted" | "Expired" | "Closed";

// Proposal type values
type ProposalType =
  | "InfoAction"
  | "HardForkInitiation"
  | "ParameterChange"
  | "NoConfidence"
  | "UpdateCommittee"
  | "NewConstitution"
  | "Treasury";

// Voter types
type VoterType = "DRep" | "SPO" | "CC";

// Vote options
type Vote = "Yes" | "No" | "Abstain";
```

### GovernanceAction (Summary)

```typescript
interface GovernanceAction {
  // Identifiers
  hash: string;                    // txHash:certIndex for routing
  proposalId?: string;             // gov_action bech32 format
  txHash?: string;

  // Content
  title: string;
  type: string;
  status: ProposalStatus;
  constitutionality: string;

  // DRep voting (ADA-weighted)
  drepYesPercent: number;
  drepNoPercent: number;
  drepAbstainPercent?: number;
  drepYesAda: number;
  drepNoAda: number;
  drepAbstainAda?: number;

  // SPO voting (ADA-weighted, optional by action type)
  spoYesPercent?: number;
  spoNoPercent?: number;
  spoAbstainPercent?: number;
  spoYesAda?: number;
  spoNoAda?: number;
  spoAbstainAda?: number;

  // CC voting (count-based, optional by action type)
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

  // Backend-provided thresholds
  threshold?: {
    ccThreshold: number | null;
    drepThreshold: number | null;
    spoThreshold: number | null;
  };

  // Backend-provided pass/fail status
  votingStatus?: {
    ccPassing: boolean | null;
    drepPassing: boolean | null;
    spoPassing: boolean | null;
  };

  // Detailed vote breakdowns
  drepBreakdown?: VoteBreakdown;
  spoBreakdown?: VoteBreakdown;
  rawVotingPowerValues?: RawVotingPowerValues;
}
```

### VoteRecord

```typescript
interface VoteRecord {
  voterType?: "DRep" | "SPO" | "CC";
  voterId?: string;
  voterName?: string;
  vote: "Yes" | "No" | "Abstain";
  votingPower: string;           // Lovelace string
  votingPowerAda: number;        // Converted ADA
  anchorUrl?: string;
  anchorHash?: string;
  rationale?: string;            // Plain text or CIP-100/CIP-136 JSON
  votedAt: string;
  txHash?: string;
}
```

### VoteBreakdown

```typescript
interface VoteBreakdown {
  activeYes: string;           // Lovelace
  activeNo: string;
  activeAbstain: string;
  alwaysAbstain: string;
  alwaysNoConfidence: string;
  inactive: string;            // DRep only
  notVoted: string;
}
```

## API Architecture

### Data Flow

```
Backend API (Cgov API)
    ↓
Next.js API Routes (/api/*)
    ↓ apiHelper.ts adds API key
Frontend Service (api.ts)
    ↓ transforms lovelace → ADA
Redux Store (governanceSlice.ts)
    ↓
UI Components
```

### Environment Variables

```bash
BACKEND_API_URL=http://localhost:3001  # Backend base URL
BACKEND_API_KEY=<secret>               # API authentication key
```

## Governance Rules

See [cardano-governance-reference.md](cardano-governance-reference.md) for complete CIP-1694 reference.

### Voter Eligibility Matrix

| Proposal Type | DRep | SPO | CC |
|---------------|:----:|:---:|:---:|
| No Confidence | ✓ | ✓ | ✗ |
| Update Committee (normal) | ✓ (67%) | ✓ | ✗ |
| Update Committee (no-confidence state) | ✓ (60%) | ✓ | ✗ |
| New Constitution | ✓ | ✗ | ✓ |
| Hard Fork Initiation | ✓ (60%) | ✓ | ✓ |
| Protocol Parameter Change (network/economic/technical) | ✓ (67%) | ✗ | ✓ |
| Protocol Parameter Change (governance) | ✓ (75%) | ✗ | ✓ |
| Treasury Withdrawals | ✓ | ✗ | ✓ |
| Info Action | ✓ | ✓ | ✓ |

> **Note:** UpdateCommittee threshold varies based on CC state per Conway Ledger spec (Sec 12.2).

### Status Meanings

| Status | Description | Color |
|--------|-------------|-------|
| Active | Voting ongoing | Green |
| Ratified | Passed voting, awaiting enactment | Blue |
| Enacted | Applied to chain | Blue |
| Expired | Voting ended without ratification | Gray |
| Closed | Expired/dropped Info actions | Gray |

## User Flows

**Dashboard**: View statistics → Filter by type/status → Click action → Navigate to detail

**Detail View**: Read description → View vote breakdown charts → Search/filter votes → Export rationales → Submit vote (with wallet)

## Related Documentation

- [voting-stuff.md](voting-stuff.md) - Complete type definitions and API reference for MCP server
- [cardano-governance-reference.md](cardano-governance-reference.md) - Official CIP-1694 governance rules
- [voting-calculation-audit.md](voting-calculation-audit.md) - Audit of voting calculation implementation
- [theming-guide.md](theming-guide.md) - Theme system documentation
