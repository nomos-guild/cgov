# Documentation Reorganization & Comprehensive Update

**Date:** 2026-02-12
**Branch:** frontend-v2

## Summary

Major documentation overhaul. Separated external Cardano reference material from platform documentation into a new `sources/` directory, then systematically reviewed and updated all 12 docs files to reflect the current state of cgov after 75 PRs of evolution. Also created a comprehensive project evolution document tracing cgov's development from Nov 2025 through Feb 2026.

## What Was Done

1. **Created `sources/` directory** — moved 4 external Cardano reference files out of `docs/`:
   - `cardano-constitution.md`, `cardano-governance-reference.md`, `cip1694.md`, `conway-ledger.pdf`
   - Fixed 3 code references pointing to old paths

2. **Studied project evolution** — analyzed all 75 closed PRs via `gh pr list` to understand how cgov grew, identified 9 distinct phases, 5 contributors, and key architectural decisions

3. **Created `docs/project-evolution.md`** — comprehensive timeline from mock-data prototype to DRep dashboard

4. **Fully rewrote 4 docs** (significantly outdated):
   - `01-project-description.md` — added DRep dashboard, analytics, i18n, ISR+SWR, current file structure
   - `03-architecture-decisions.md` — new data flow diagram with ISR+SWR+Redux hybrid, all new patterns
   - `dashboard.md` — updated from 5→7 charts, old flat→multi-dashboard structure, new features
   - `theming-guide.md` — added game theme (was only Fancy/Nerd), CSS specificity notes

5. **Targeted updates to 6 docs**:
   - `voting-stuff.md` — fixed HardFork eligibility, added DRep/analytics endpoints, SWR hooks, MCP servers
   - `voting-calculation-audit.md` — corrected eligibility table and code sample
   - `drep-vote-frontend-integration.md` — marked IMPLEMENTED, added Mesh SDK notes
   - `02-database-schema.md` — fixed stale cross-reference
   - `ideas/drep-dashboard.md` — marked IMPLEMENTED
   - `ideas/plugin-ecosystem.md` — marked NOT YET IMPLEMENTED

## Key Learnings

1. **docs/ vs sources/ separation matters for coding agents** — agents need clear signal on what's platform knowledge vs external reference. External specs (CIP-1694, Conway ledger) don't change and aren't about "how cgov works" — they belong in `sources/`.

2. **PR descriptions are the best history** — many PRs had no body but the title + file list gave enough context. The file change lists were more useful than PR descriptions for understanding scope.

3. **Documentation drift is invisible** — the eligibility table in `voting-stuff.md` still showed HardFork DRep as ✗ even though the code was fixed months ago. Three different docs had the same wrong table. Always update docs when fixing code.

4. **Cross-references break on file moves** — moving files from `docs/` to `sources/` required updating references in both docs and source code (3 files referenced `docs/conway-ledger.pdf`).

## Files Changed

| File | Change |
|------|--------|
| `sources/cardano-constitution.md` | Moved from docs/ |
| `sources/cardano-governance-reference.md` | Moved from docs/ |
| `sources/cip1694.md` | Moved from docs/ |
| `sources/conway-ledger.pdf` | Moved from docs/ |
| `docs/project-evolution.md` | New: comprehensive project history |
| `docs/01-project-description.md` | Rewritten: current features, structure, data flow |
| `docs/02-database-schema.md` | Fixed cross-reference |
| `docs/03-architecture-decisions.md` | Rewritten: ISR+SWR, multi-dashboard, DRep, i18n |
| `docs/dashboard.md` | Rewritten: 7 charts, multi-dashboard, new features |
| `docs/theming-guide.md` | Rewritten: 3 themes, game theme, CSS specificity |
| `docs/voting-stuff.md` | Updated: HardFork fix, DRep endpoints, SWR hooks, MCP |
| `docs/voting-calculation-audit.md` | Fixed eligibility tables |
| `docs/drep-vote-frontend-integration.md` | Marked IMPLEMENTED |
| `docs/ideas/drep-dashboard.md` | Marked IMPLEMENTED |
| `docs/ideas/plugin-ecosystem.md` | Marked NOT YET IMPLEMENTED |
| `.claude/mcp/cardano-governance/README.md` | Fixed source path reference |
| `.claude/mcp/cardano-governance/src/knowledge/governance-rules.ts` | Fixed source path reference |
| `src/lib/governanceVotingEligibility.ts` | Fixed source path comment |

## Patterns Discovered

**Documentation update protocol for file moves:**
1. `git mv` the files
2. `grep` all docs + source code for references to old paths
3. Update each reference to the new path
4. Verify no stale references remain

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `docs/` for platform docs, `sources/` for external references | Clear separation helps coding agents understand what's about cgov vs what's Cardano reference material |
| Keep analytics-table.md as-is | It's a KPI catalogue/spec — still relevant as-is |
| Keep spo-percentage-bug-investigation.md as-is | Historical investigation, still accurate |
| Mark ideas/ docs with status rather than moving them | They contain useful design context even when implemented |
| Don't change 02-database-schema.md content | It documents logical data models — still accurate for backend understanding |

## Skills Evolved

No skill changes this session — work was documentation-focused, no new technical patterns discovered. Existing skills and `_patterns.md` remain accurate.
