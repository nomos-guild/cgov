# CGOV - Cardano Governance Dashboard

## Project Overview

Cardano Governance Tracking Dashboard for monitoring on-chain governance actions and voting records. Implements CIP-1694 governance visualization for the Conway era.

## Tech Stack

- **Framework**: Next.js 15 (Pages Router)
- **Language**: TypeScript 5 (strict mode)
- **State**: Redux Toolkit
- **UI**: React 18, Radix UI, Tailwind CSS, shadcn/ui
- **Charts**: Recharts, D3.js
- **Wallet**: Mesh SDK

## Project Structure

```
src/
├── components/
│   ├── dashboards/           # Dashboard system
│   │   ├── shared/           # Shared infrastructure (DashboardProvider, DashboardGrid, etc.)
│   │   ├── governance/       # Governance dashboard charts
│   │   ├── drep/             # DRep dashboard (placeholder)
│   │   └── phil/             # Phil's dashboard (placeholder)
│   ├── ui/                   # shadcn/ui base components
│   ├── layout/               # Header, Footer
│   ├── governance/           # Voting components
│   └── wallet/               # Wallet connection
├── pages/
│   ├── api/                  # Server-side API routes (proxy to backend)
│   ├── governance/[hash].tsx # Proposal detail
│   ├── dashboard.tsx         # Customizable dashboard
│   └── index.tsx             # Landing page
├── store/
│   ├── governanceSlice.ts    # Redux state + async thunks
│   └── hooks.ts              # useAppDispatch, useAppSelector
├── services/
│   └── api.ts                # API client with lovelace→ADA transforms
├── types/
│   ├── governance.ts         # GovernanceAction, VoteRecord, etc.
│   └── dashboard.ts          # ChartId, ChartLayout, DashboardConfig
├── lib/
│   ├── theme.tsx             # Theme provider (light/dark/game)
│   ├── voteBreakdownCalculator.ts  # Vote calculation by action type
│   └── governanceVotingEligibility.ts  # Voter eligibility matrix
└── config/
    └── api.ts                # Backend endpoint config
```

## Key Patterns

### Dashboard System
- `DashboardProvider`: Context + localStorage for chart visibility/layout
- `DashboardGrid`: Grid-snapping canvas (20px grid)
- `DashboardChartCard`: Draggable/resizable wrapper
- Each dashboard (governance, drep, phil) has its own `charts/index.ts` with `CHART_REGISTRY`

### Data Flow
```
Backend API → Next.js API Routes (adds X-API-Key) → services/api.ts (transforms) → Redux → Components
```

### Vote Calculation
Three voter types with different stake calculations:
- **DRep**: Stake-weighted (lovelace)
- **SPO**: Stake-weighted (lovelace)
- **CC**: Count-based (1 vote per member)

Eligibility varies by action type - use `lib/governanceVotingEligibility.ts`.

## Coding Conventions

### TypeScript
- Strict mode enabled
- Use `interface` for objects, `type` for unions
- String literal unions over enums
- Optional chaining (`?.`) and nullish coalescing (`??`)

### React
- Functional components with hooks
- Destructure props in function signature
- Redux for global state, useState for local

### Naming
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Types: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Props: `ComponentNameProps`

### Imports
```typescript
// Order: React → Third-party → Types → Components → Utils
import { useState } from "react";
import { useAppSelector } from "@/store/hooks";
import type { GovernanceAction } from "@/types/governance";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
```

### Path Aliases
- `@/` maps to `src/`
- Always use absolute imports: `@/components/...`

## Data Conventions

### Lovelace to ADA
- Backend returns values in lovelace (1 ADA = 1,000,000 lovelace)
- Frontend displays in ADA
- Transform in `services/api.ts`, not components

### Proposal IDs
- Full ID: `{txHash}#{index}` (e.g., `abc123...#0`)
- Short display: First 8 + last 4 chars

## Themes

Three themes: `light`, `dark`, `game`
- Access via `useTheme()` hook
- `activeTheme.id` for conditional styling
- `activeTheme.isDark` for dark mode checks

## MCP Servers Available

Use these tools for project-specific queries:
- `mcp__cgov-project__*` - Project structure, types, conventions
- `mcp__cardano-governance__*` - CIP-1694 governance rules, thresholds, eligibility

## Common Tasks

### Add a new chart
1. Create chart component in `dashboards/{dashboard}/charts/`
2. Add to `CHART_REGISTRY` in `charts/index.ts`
3. Add `ChartId` to `types/dashboard.ts`

### Add API endpoint
1. Create route in `pages/api/`
2. Use `callApi()` from `utils/apiHelper.ts` for auth
3. Add service function in `services/api.ts`
4. Add Redux thunk if needed

## Build & Dev

```bash
npm run dev    # Development server
npm run build  # Production build
npm run lint   # ESLint
```

## Environment Variables

```
BACKEND_API_URL=<backend-url>
BACKEND_API_KEY=<api-key>  # Server-side only
```
