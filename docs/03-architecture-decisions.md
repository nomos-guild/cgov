# cgov: Architecture Decisions

Documentation of architectural decisions and implementation patterns in the cgov codebase.

## Current Stack

| Category | Technology | Status |
|----------|------------|--------|
| Framework | Next.js 15.0.3 + React 18 + TypeScript 5 | ✅ Implemented |
| Routing | Next.js Pages Router | ✅ Implemented |
| State Management | Redux Toolkit | ✅ Implemented |
| UI Components | Radix UI + Tailwind CSS (shadcn/ui) | ✅ Implemented |
| Charts | Recharts (pie/line), D3.js (bubble map) | ✅ Implemented |
| Date Handling | date-fns | ✅ Implemented |
| Icons | lucide-react | ✅ Implemented |
| Blockchain | Mesh SDK (wallet connection) | ✅ Implemented |
| Markdown | react-markdown + remark-gfm + DOMPurify | ✅ Implemented |

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
│                      (Server-side)                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  src/pages/api/                                                         │
│  ├── overview/index.ts        → GET /api/overview                       │
│  ├── overview/proposals.ts    → GET /api/overview/proposals             │
│  ├── overview/ncl/index.ts    → GET /api/overview/ncl                   │
│  ├── overview/ncl/[year].ts   → GET /api/overview/ncl/:year             │
│  └── proposal/[id].ts         → GET /api/proposal/:id                   │
│                                                                         │
│  Uses: src/utils/apiHelper.ts (adds X-API-Key header)                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND API SERVICE                                 │
│                   src/services/api.ts                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  • fetchOverviewSummary()                                               │
│  • fetchGovernanceActions()                                             │
│  • fetchGovernanceActionDetail(id)                                      │
│  • fetchNCLData()                                                       │
│                                                                         │
│  Transformations:                                                       │
│  • Lovelace → ADA conversion                                            │
│  • Reference normalization (CIP-100/CIP-136)                            │
│  • Vote record mapping                                                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      REDUX STORE                                        │
│                src/store/governanceSlice.ts                             │
├─────────────────────────────────────────────────────────────────────────┤
│  State:                                                                 │
│  • actions: GovernanceAction[]                                          │
│  • selectedAction: GovernanceActionDetail | null                        │
│  • overview: OverviewSummary | null                                     │
│  • nclDataList: NCLDisplayData[]                                        │
│  • filters: { selectedTypes, selectedStatuses, searchQuery, ... }       │
│  • loading/error states                                                 │
│                                                                         │
│  Async Thunks:                                                          │
│  • loadGovernanceActions()                                              │
│  • loadGovernanceActionDetail(id)                                       │
│  • loadOverviewSummary()                                                │
│  • loadNCLData()                                                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        UI COMPONENTS                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Implementation Patterns

### 1. API Authentication (Server-side)

API keys are kept server-side only, never exposed to the browser.

```typescript
// src/utils/apiHelper.ts
export async function callApi(args: CallApiArgs) {
  const backendApiUrl = process.env.BACKEND_API_URL || "http://localhost:3001";
  const backendApiKey = process.env.BACKEND_API_KEY || "";

  const res = await fetch(backendApiUrl + args.endpoint, {
    method: args.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(backendApiKey && { "X-API-Key": backendApiKey }),
      ...args.headers,
    },
    body: args.body,
    cache: "no-cache",
  });

  // ...
}
```

### 2. Data Transformations

Lovelace to ADA conversion happens in the frontend service layer.

```typescript
// src/services/api.ts
function lovelaceToAdaNumber(lovelace: string | undefined): number {
  if (!lovelace) return 0;
  const adaValue = Number(lovelace) / 1_000_000;
  return Number.isFinite(adaValue) ? adaValue : 0;
}

function transformGovernanceAction(action: GovernanceAction): GovernanceAction {
  // Convert lovelace to ADA for DRep
  const drepYesAda = lovelaceToAdaNumber(action.drep?.yesLovelace);
  const drepNoAda = lovelaceToAdaNumber(action.drep?.noLovelace);
  // ...
}
```

### 3. Vote Calculation Logic

Vote calculations vary by action type and epoch. Logic is centralized in `voteBreakdownCalculator.ts`.

```typescript
// src/lib/voteBreakdownCalculator.ts
const EPOCH_534_THRESHOLD = 534;

export function calculateDrepLegendTotals(
  breakdown: VoteBreakdown,
  actionType: GovernanceActionTypeCode
): CalculatedVoteTotals {
  if (actionType === "NO_CONFIDENCE") {
    return {
      yes: activeYes + alwaysNoConfidence,
      no: activeNo + notVoted,
      abstain: activeAbstain + alwaysAbstain,
      inactive: inactive,
    };
  }
  // Other actions...
}

export function calculateSpoLegendTotals(
  breakdown: VoteBreakdown,
  actionType: GovernanceActionTypeCode,
  submissionEpoch: number
): CalculatedVoteTotals {
  // Different formulas for pre/post epoch 534
  if (submissionEpoch < EPOCH_534_THRESHOLD) {
    // Old formula
  }
  // New formula with action type variations
}
```

### 4. Voter Eligibility

Eligibility matrix determines which voter types can vote on each action type.

```typescript
// src/lib/governanceVotingEligibility.ts
const ELIGIBILITY: Record<ProposalType, RoleEligibility> = {
  NoConfidence: { SPO: true, DRep: true, CC: false },
  UpdateCommittee: { SPO: true, DRep: true, CC: false },
  NewConstitution: { SPO: false, DRep: true, CC: true },
  HardForkInitiation: { SPO: true, DRep: true, CC: true },  // DRep votes with 60% threshold
  ParameterChange: { SPO: false, DRep: true, CC: true },
  Treasury: { SPO: false, DRep: true, CC: true },
  InfoAction: { SPO: true, DRep: true, CC: true },
};

export function canRoleVoteOnAction(type: ProposalType | string, role: VoterType): boolean {
  const matrix = getRoleMatrixForType(type);
  return matrix[role];
}
```

> **Note:** Per Conway Ledger formal specification (Fig. 42):
> - Hard Fork Initiation requires ALL THREE bodies: CC (2/3), DRep (60%), SPO (51%)
> - UpdateCommittee DRep threshold varies: 67% (normal state) vs 60% (CC no-confidence state)

### 5. Epoch Calculations

Cardano epoch timing for date displays.

```typescript
// src/pages/governance/[hash].tsx
const SHELLEY_START_EPOCH = 208;
const SHELLEY_START_TIME = new Date("2020-07-29T21:44:51Z").getTime();
const EPOCH_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

function getCurrentEpoch(): number {
  const now = Date.now();
  const epochsSinceShelley = Math.floor((now - SHELLEY_START_TIME) / EPOCH_DURATION_MS);
  return SHELLEY_START_EPOCH + epochsSinceShelley;
}

function epochToTimestamp(epoch: number): number {
  const epochsSinceShelley = epoch - SHELLEY_START_EPOCH;
  return SHELLEY_START_TIME + (epochsSinceShelley * EPOCH_DURATION_MS);
}
```

### 6. IPFS Gateway Conversion

```typescript
// src/pages/governance/[hash].tsx
function convertIpfsToGateway(uri: string): string {
  if (!uri) return uri;

  // Check if it's an IPFS URI
  const ipfsMatch = uri.match(/^(?:ipfs:\/\/|ipfs:)(.+)$/i);
  if (ipfsMatch) {
    const cid = ipfsMatch[1];
    return `https://ipfs.io/ipfs/${cid}`;
  }

  // Check if it's a raw CID
  if (/^(Qm[a-zA-Z0-9]{44}|b[a-z2-7]{58})/.test(uri)) {
    return `https://ipfs.io/ipfs/${uri}`;
  }

  return uri;
}
```

### 7. Rationale Parsing

Vote rationales can be plain text or CIP-100/CIP-136 JSON.

```typescript
// src/lib/exportRationales.ts
function getRationale(raw: string | undefined): string {
  if (!raw || raw.trim().length === 0) return "No rationale data provided.";

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      // CIP-100: { body: { comment } }
      if (parsed.body?.comment) return parsed.body.comment;

      // CIP-136: { body: { rationaleStatement, conclusion } }
      if (parsed.body?.rationaleStatement) {
        const statement = parsed.body.rationaleStatement;
        const conclusion = parsed.body.conclusion ? `\n\n${parsed.body.conclusion}` : "";
        return `${statement}${conclusion}`.trim();
      }

      // Legacy: { comment }
      if (parsed.comment) return parsed.comment;
    }
  } catch {
    // Not JSON, return as-is
  }

  return raw;
}
```

### 8. Markdown Rendering with Sanitization

```typescript
// src/components/ProposalContent.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DOMPurify from "dompurify";

export const ProposalContent = ({ content }: { content: string }) => {
  const sanitizedContent = DOMPurify.sanitize(content);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Custom component mappings...
      }}
    >
      {sanitizedContent}
    </ReactMarkdown>
  );
};
```

### 9. Theme System

Multi-theme support with CSS custom properties.

```typescript
// src/lib/theme.tsx
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Sets data-theme attribute on document.documentElement
  // Toggles .dark class for dark themes
  // Writes color-scheme meta
}

// Themes defined in src/themes/index.ts
// Token CSS in src/themes/*/tokens.css
```

### 10. Export Functionality

Vote data can be exported in multiple formats.

```typescript
// src/lib/exportRationales.ts
export function exportToJSON(votes: Vote[], proposalTitle: string): string;
export function exportToMarkdown(votes: Vote[], proposalTitle: string): string;
export function exportToCSV(votes: Vote[], proposalTitle: string): string;
export function downloadFile(content: string, filename: string, mimeType: string);
```

## Environment Configuration

```bash
# .env.local

# Backend API (required)
BACKEND_API_URL=http://localhost:3001
BACKEND_API_KEY=your_api_key_here

# Optional: Blockfrost for additional chain queries
NEXT_PUBLIC_BLOCKFROST_API_KEY=your_blockfrost_key
NEXT_PUBLIC_NETWORK=mainnet
```

## File Organization

```
src/
├── components/
│   ├── ui/                     # Reusable UI components (shadcn/ui style)
│   ├── layout/                 # Layout components (Header, Footer)
│   ├── governance/             # Governance-specific components
│   └── *.tsx                   # Feature components
├── pages/
│   ├── api/                    # Next.js API routes (server-side)
│   ├── governance/             # Governance detail pages
│   └── *.tsx                   # Page components
├── store/                      # Redux store and slices
├── services/                   # API service layer
├── lib/                        # Core utilities and business logic
├── utils/                      # Helper utilities
├── types/                      # TypeScript type definitions
├── config/                     # Configuration files
└── themes/                     # Theme definitions
```

## Testing Considerations

### Unit Testing Candidates

- `src/lib/voteBreakdownCalculator.ts` - Vote calculation functions
- `src/lib/governanceVotingEligibility.ts` - Eligibility matrix
- `src/lib/exportRationales.ts` - Export and parsing functions
- `src/services/api.ts` - Data transformation functions

### Integration Testing Candidates

- API routes (`src/pages/api/*`)
- Redux thunks and state updates
- Component rendering with mock data

## Known Issues & Considerations

See [voting-calculation-audit.md](voting-calculation-audit.md) for detailed analysis.

### Resolved Issues

1. **HardFork DRep Eligibility** - ✅ RESOLVED: DReps DO vote on Hard Forks with 60% threshold per Conway Ledger spec (Fig. 42). Code updated.

2. **UpdateCommittee CC State** - ✅ DOCUMENTED: Threshold varies based on CC state (67% normal, 60% no-confidence). Backend should provide CC confidence state.

### Low Priority

1. **Threshold Validation** - Frontend trusts backend thresholds without validation
2. **Protocol Parameter Subgroups** - No distinction between governance group (75%) and other groups (67%)

## Related Documentation

- [01-project-description.md](01-project-description.md) - Project overview
- [02-database-schema.md](02-database-schema.md) - Data models
- [voting-stuff.md](voting-stuff.md) - Complete API and type reference
- [cardano-governance-reference.md](cardano-governance-reference.md) - CIP-1694 governance rules
- [voting-calculation-audit.md](voting-calculation-audit.md) - Implementation audit
- [theming-guide.md](theming-guide.md) - Theme system documentation
