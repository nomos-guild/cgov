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
├── .claude/                  # Claude Code tooling
│   ├── mcp/                  # MCP servers for AI assistance
│   │   ├── cardano-governance/  # CIP-1694 governance rules
│   │   └── cgov-project/        # Project-specific knowledge
│   └── skills/               # Reusable task templates
├── src/
│   ├── components/
│   │   ├── dashboards/           # Dashboard system
│   │   │   ├── shared/           # Shared infrastructure (DashboardProvider, DashboardGrid, etc.)
│   │   │   ├── governance/       # Governance dashboard charts
│   │   │   ├── drep/             # DRep dashboard (placeholder)
│   │   │   └── phil/             # Phil's dashboard (placeholder)
│   │   ├── ui/                   # shadcn/ui base components
│   │   ├── layout/               # Header, Footer
│   │   ├── governance/           # Voting components
│   │   └── wallet/               # Wallet connection
│   ├── pages/
│   │   ├── api/                  # Server-side API routes (proxy to backend)
│   │   ├── governance/[hash].tsx # Proposal detail
│   │   ├── dashboard.tsx         # Customizable dashboard
│   │   └── index.tsx             # Landing page
│   ├── store/
│   │   ├── governanceSlice.ts    # Redux state + async thunks
│   │   └── hooks.ts              # useAppDispatch, useAppSelector
│   ├── services/
│   │   └── api.ts                # API client with lovelace→ADA transforms
│   ├── types/
│   │   ├── governance.ts         # GovernanceAction, VoteRecord, etc.
│   │   └── dashboard.ts          # ChartId, ChartLayout, DashboardConfig
│   ├── lib/
│   │   ├── theme.tsx             # Theme provider (light/dark/game)
│   │   ├── voteBreakdownCalculator.ts  # Vote calculation by action type
│   │   └── governanceVotingEligibility.ts  # Voter eligibility matrix
│   └── config/
│       └── api.ts                # Backend endpoint config
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

## Claude Code Tooling

### MCP Servers (`.claude/mcp/`)

Two MCP servers provide AI-assisted knowledge:

- **`mcp__cgov-project__*`** - Project structure, types, conventions, component info
- **`mcp__cardano-governance__*`** - CIP-1694 governance rules, thresholds, voter eligibility

To rebuild MCP servers after changes:
```bash
cd .claude/mcp/cardano-governance && npm run build
cd .claude/mcp/cgov-project && npm run build
```

### Skills (`.claude/skills/`)

Reusable task templates for common operations:
- `add-chart` - Add a new dashboard chart
- `add-dashboard` - Create a new dashboard with chart registry
- `add-api-route` - Add a new API endpoint
- `add-thunk` - Add a Redux async thunk
- `cgov-build` - Build and validate the project
- `skill-feedback` - Collect feedback after using a skill
- `evolve-skill` - Evolve skills based on feedback

### Skill Evolution System

Skills can evolve and improve through feedback. This mimics how humans learn through practice.

**Workflow:**
```
Use skill → /skill-feedback {skill} → Feedback accumulates → /evolve-skill {skill} → Skill improves
```

**Skill Structure:**
```
.claude/skills/{skill-name}/
├── SKILL.md           # Current skill definition
├── CHANGELOG.md       # Evolution history
└── .versions/         # Previous versions for rollback
    ├── 1.0.0.md
    └── 1.1.0.md
```

**Skill Metadata** (in SKILL.md frontmatter):
```yaml
version: 1.0.0
created: 2026-02-02
last-evolved: null
evolution-count: 0
feedback-count: 0
```

**Commands:**
- `/skill-feedback {skill}` - Record feedback after using a skill
- `/evolve-skill {skill}` - Analyze feedback and propose improvements
- `/evolve-skill --all` - Show evolution status for all skills
- `/evolve-skill rollback {skill}` - Revert to previous version
- `/evolve-skill versions {skill}` - List available versions

**Feedback Storage:**
Feedback files are stored in `.claude/skills/.feedback/{skill-name}/` as YAML files and tracked in git for team sharing.

### Journeys (`.claude/journeys/`)

Session learning logs that persist across sessions, creating institutional memory.

**Purpose:** Capture what was done, learned, and discovered during coding sessions so future sessions can build on past work.

**Structure:**
```
.claude/journeys/
├── 2026-02-02-skill-evolution-system.md
├── 2026-02-02-theme-fixes.md
└── ...
```

**Commands:**
- `/journey {title}` - Save a session summary
- `/journey --list` - List all journeys
- `/journey --read {file}` - Read a specific journey
- `/journey --recent` - Show recent journeys

**When to create a journey:**
- After significant bug fixes with learnings
- After implementing new features
- When discovering important patterns
- After making architectural decisions

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
