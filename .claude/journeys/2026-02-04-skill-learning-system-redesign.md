# Journey: Skill Learning System Redesign

**Date:** 2026-02-04
**Tags:** #meta #tooling #refactor

## Summary

Redesigned the entire skill evolution system based on how learning actually works in nature. Removed the formal ceremony layer (evolve-skill, skill-feedback, YAML feedback pipeline, CHANGELOGs, semantic versioning) and replaced it with a natural learning loop: inline learning notes during work, wrap-up consolidation at session end, and periodic deep reflection via `/reflect`.

## What Was Done

1. **Philosophical analysis of learning patterns**
   - Analyzed natural learning (experiential, error-driven, consolidation during rest, forgetting, transfer)
   - Mapped current system against these patterns
   - Identified that the formal feedback pipeline was used only 2x while wrap-up did 6/8 real evolutions

2. **Created shared patterns file** (`_patterns.md`)
   - Extracted cross-cutting knowledge from individual skills
   - Covers: theming rules, Recharts gotchas, i18n conventions, import order, data conventions, dashboard integration

3. **Rewrote wrap-up as the sole learning engine**
   - 7-step workflow: gather → journey → process learning notes → evolve skills → cross-pollinate → prune → update journey
   - Added inline learning note processing (`<!-- LEARNING -->` comments)
   - Added cross-pollination to `_patterns.md`
   - Added pruning step for stale content

4. **Simplified all skill metadata**
   - Reduced from 7 frontmatter fields to 3 (`name`, `updated`, `description`)
   - Dropped: `version`, `created`, `last-evolved`, `evolution-count`, `feedback-count`

5. **Removed ceremony infrastructure**
   - Deleted `evolve-skill/` skill entirely
   - Deleted `skill-feedback/` skill entirely
   - Deleted `.feedback/` directory (2 YAML files)
   - Deleted 11 CHANGELOG.md files
   - Kept `.versions/` directories for human reference

6. **Created `/reflect` meta-skill**
   - Periodic deep-thinking about the learning system itself
   - 6-step workflow: gather → analyze through learning lens → check drift → assess loop → present findings → implement
   - Designed for ~every 10 sessions, not every session

7. **Updated CLAUDE.md documentation**
   - Rewrote Skill Evolution System section to document new approach
   - Added `_patterns.md`, `reflect`, and inline learning notes

## Key Learnings

- **The formal feedback pipeline was dead weight** — Only 2 feedback files ever created. 6/8 add-chart evolutions happened through wrap-up, not the formal pipeline. The system naturally gravitated toward learning-through-doing.

- **Ceremony creates friction that prevents learning** — The 4-step process (use → feedback form → analyze → evolve) was too heavy. Most real learning happened organically through wrap-up.

- **Semantic versioning is meaningless for instruction files** — Nobody depends on "add-chart v1.7.0" semantically. A date is more useful than a version number.

- **`.versions/` directories duplicate git but have human value** — They're easy to browse without git archaeology. Kept them despite the redundancy.

- **Nature's learning loop is: experience → awareness → consolidation** — Map to: work → inline notes → wrap-up. Three phases, not four ceremonies.

- **Shared patterns enable transfer learning** — Knowledge discovered in one skill (e.g., theme border rules in add-chart) now propagates to all skills via `_patterns.md`.

## Files Changed

| File | Change |
|------|--------|
| `.claude/skills/_patterns.md` | **Created** — shared cross-cutting knowledge |
| `.claude/skills/reflect/SKILL.md` | **Created** — meta-skill for system self-improvement |
| `.claude/skills/wrap-up/SKILL.md` | **Rewritten** — sole learning engine with 7 steps |
| `.claude/skills/*/SKILL.md` (9 files) | Simplified metadata to 3 fields |
| `.claude/skills/evolve-skill/` | **Deleted** — replaced by wrap-up + direct edits |
| `.claude/skills/skill-feedback/` | **Deleted** — replaced by inline learning notes |
| `.claude/skills/.feedback/` | **Deleted** — no longer needed |
| `.claude/skills/*/CHANGELOG.md` (11 files) | **Deleted** — git log is the changelog |
| `CLAUDE.md` | Updated skill learning system documentation |

## Patterns Discovered

### The Natural Learning Loop
```
Experience (work) → Awareness (learning notes) → Consolidation (wrap-up)
```
Maps to nature: doing → noticing → sleeping (brain consolidation).

### Inline Learning Notes
```markdown
### Some Section
Existing instruction text...

<!-- LEARNING 2026-02-04: Discovered that X needs Y because Z -->
```
Zero-ceremony learning during work. Processed by wrap-up into proper skill text.

### Shared Patterns for Transfer Learning
Cross-cutting knowledge lives in `_patterns.md` instead of being duplicated across skills. When one skill discovers a pattern, all skills benefit.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Remove evolve-skill entirely | Wrap-up + direct edits handle all evolution; formal pipeline used only 2x |
| Remove skill-feedback entirely | Inline learning notes are zero-ceremony alternative |
| Keep .versions/ directories | Human value for browsing history without git |
| Delete CHANGELOGs | Git log is the changelog; separate files are duplicate work |
| Drop semantic versioning | Dates are more meaningful than version numbers for instruction files |
| Create _patterns.md | Enables transfer learning — knowledge flows between skills |
| Create /reflect | Periodic meta-improvement; replaces formal evolve-skill with deeper analysis |
| 3-field metadata only | name, updated, description — everything else is vanity metrics |

## Connected To

- All skill SKILL.md files (metadata simplified)
- Future `/reflect` sessions will evaluate this new system
- Future `/wrap-up` sessions will use the new learning note processing
