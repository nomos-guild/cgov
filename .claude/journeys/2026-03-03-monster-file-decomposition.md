# Monster File Decomposition — Phase 1

**Date**: 2026-03-03
**Branch**: frontend-v2

## Summary

Decomposed `governance/[hash].tsx` from **3,062 → 1,365 lines** (55% reduction) to reduce context window token consumption during editing sessions. A single edit cycle on this file previously cost ~24K tokens (~25% of context). Now, targeted edits only read the relevant 100-200 line component file.

Also performed a skill system reflection (`/reflect`): trimmed `add-chart` from 866→243 lines, simplified the learning loop by removing unused inline LEARNING notes mechanism, archived 6 stale Feb-02 journeys, and fixed 5 stale references in CLAUDE.md.

## What Was Done

1. **Skill system reflection** — identified and fixed stale references in CLAUDE.md (`dashboard.tsx`→`adadev.tsx`, `phil/`→`development_activity/`, `charts/index.ts`→`charts/index.tsx`), trimmed bloated `add-chart` skill, simplified `wrap-up` from 7→5 steps
2. **Context window diagnosis** — measured the 3 monster files: `[hash].tsx` (3062), `GovernanceTable.tsx` (1263), `[drepId].tsx` (1392). Identified that 40+ MCP tool definitions consume ~10K tokens baseline
3. **Phase 1 Step 1-2: Inline components + utilities** — extracted VoteTrendTooltip, RoleLegend, ExcludedBreakdownDisplay, RolePlaceholder, LazyVoteOnProposal + epochUtils, formatters, voteColors, governanceEligibilityOverrides
4. **Phase 1 Step 4-6: Tabs + shared chart + expiry card** — extracted ProposalExpiryCard, VoteTrendLineChart (deduplicated from 2 copies), LiveVotingTab, ProposalDetailsTab, ThresholdsTab
5. **Incremental verification** — build checked after every 2-3 extractions, fixed unused import errors immediately

## Key Learnings

- **Move local-only state into extracted components**: `copiedId` only matters in ProposalDetailsTab, excluded-expanded state only matters in LiveVotingTab. Moving state closer to usage reduces the parent's cognitive load and prop count.
- **Deduplication during extraction**: The vote trend chart was rendered identically in the curves tab and sidebar. Extracting to VoteTrendLineChart with configurable `height`, `showLegend`, `tickFontSize` eliminated ~140 lines of duplication.
- **Use `sed -i` for large block deletions**: The Edit tool's `old_string` gets unwieldy for 200+ line replacements. `sed -i '1199,1447c\...'` is faster and more reliable for bulk removal.
- **Skip the monolithic hook extraction (Step 3)**: The `useProposalDetailViewModel` hook was too intertwined with 6 translation hooks and derived values. Pragmatic choice: extract the JSX tabs with explicit props instead. Same line savings, much lower risk.
- **ThresholdsTab internal helpers**: Extracted local `PowerCard` and `ThresholdBar` components within the file to DRY the 3 repeated threshold progress bar blocks. These are too specific to warrant separate files.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/governance/[hash].tsx` | 3062→1365 lines (removed inline components, tabs, chart, expiry card) |
| `src/components/governance/ProposalExpiryCard.tsx` | **NEW** 172 lines — epoch expiry card with progress bar |
| `src/components/governance/VoteTrendLineChart.tsx` | **NEW** 177 lines — shared Recharts line chart |
| `src/components/governance/LiveVotingTab.tsx` | **NEW** 220 lines — donut charts + legends |
| `src/components/governance/ProposalDetailsTab.tsx` | **NEW** 154 lines — voting participation + copyable IDs |
| `src/components/governance/ThresholdsTab.tsx` | **NEW** 193 lines — threshold progress bars |
| `src/components/governance/VoteTrendTooltip.tsx` | **NEW** 92 lines — custom Recharts tooltip |
| `src/components/governance/RoleLegend.tsx` | **NEW** 150 lines — vote segment legend |
| `src/components/governance/ExcludedBreakdownDisplay.tsx` | **NEW** 126 lines — collapsible excluded breakdown |
| `src/components/governance/RolePlaceholder.tsx` | **NEW** 98 lines — not-eligible/no-data placeholder |
| `src/components/governance/LazyVoteOnProposal.tsx` | **NEW** 24 lines — crypto-gated lazy loader |
| `src/lib/epochUtils.ts` | **NEW** 24 lines — epoch calculation utilities |
| `src/lib/formatters.ts` | **NEW** 13 lines — ADA value formatting |
| `src/lib/voteColors.ts` | **NEW** 33 lines — vote color constants |
| `src/lib/governanceEligibilityOverrides.ts` | **NEW** 119 lines — legacy eligibility rules |
| `CLAUDE.md` | Fixed 5 stale references, simplified learning loop |
| `.claude/skills/add-chart/SKILL.md` | 866→243 lines (removed _patterns.md duplicates) |
| `.claude/skills/wrap-up/SKILL.md` | 184→95 lines (simplified to 5 steps) |
| `.claude/skills/reflect/SKILL.md` | Removed LEARNING notes reference |
| `.claude/skills/add-dashboard/SKILL.md` | Updated file refs |

## Patterns Discovered

- **File decomposition extraction order**: (1) pure utility functions, (2) inline components with typed props, (3) shared/duplicated rendering code, (4) tab content, (5) complex page sections. This order minimizes risk — each step is mechanical and independently verifiable.
- **Props vs internal state**: When extracting a tab component, if state is only used within that tab (like collapsed/expanded toggles), make it internal state rather than passing it as props. Reduces parent complexity.
- **Shared chart component pattern**: When the same Recharts chart appears in multiple locations with minor config differences, extract with props like `height`, `showLegend`, `tickFontSize`, `margin`. The chart owns all Recharts imports internally.

## Decisions Made

- **Skipped useProposalDetailViewModel hook (Step 3)**: Too deeply intertwined with translation hooks and derived data flow. Would save ~500 lines but high risk of subtle bugs. The tab extractions (Steps 4-6) achieved similar line savings with zero behavioral changes.
- **Kept curves tab controls inline**: The role filter buttons and mode dropdown in the curves tab are tightly coupled with parent state (`curveRoleFilter`, `chartMode`) that's shared with the sidebar. Extracting just the chart (not the controls) via VoteTrendLineChart was the clean boundary.
- **Phase 2 & 3 deferred**: `[drepId].tsx` (1392 lines) and `GovernanceTable.tsx` (1263 lines) still need decomposition. Plan exists in `C:\Users\felix\.claude\plans\resilient-sleeping-nygaard.md`.
