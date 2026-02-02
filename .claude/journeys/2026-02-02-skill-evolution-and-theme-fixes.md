# Journey: Skill Evolution System & Theme Border Fixes

**Date:** 2026-02-02
**Tags:** #tooling #theming #bugfix #meta

## Summary

Created a complete skill evolution system that allows skills to improve through feedback, mimicking how humans learn through practice. Also fixed dashboard chart card borders across all three themes (light, dark, game).

## What Was Done

1. **Created Skill Evolution System**
   - `/skill-feedback` skill - collects structured feedback after skill use
   - `/evolve-skill` skill - analyzes feedback and proposes improvements
   - Version tracking with `.versions/` directories
   - Changelog for each skill
   - Rollback support

2. **Updated All Existing Skills**
   - Added version metadata to 5 existing skills
   - Created CHANGELOG.md for each
   - Created initial version snapshots

3. **Fixed Theme Border Issues**
   - Game theme: removed colored borders (was inheriting cyan from dark)
   - Light theme: removed grey borders (now pure white + shadow)
   - Dark theme: kept cyan borders (correct)

4. **Evolved add-chart Skill**
   - 1.0.0 → 1.1.0: Fixed game theme border documentation
   - 1.1.0 → 1.2.0: Fixed light theme border documentation

5. **Created Journey System**
   - `/journey` skill for session summaries
   - `.claude/journeys/` directory for persistence

## Key Learnings

- **`isDark` is true for BOTH dark AND game themes**: Always use a 3-way check `isGame ? ... : isDark ? ... : ...` when styling for themes
- **Light theme cards have NO borders**: Pure white (`bg-white`) with shadow only
- **Game theme has NO colored elements**: Everything is white/grayscale, no borders
- **Dark theme uses cyan borders**: `border-[#0bd1a2]`
- **Skills can learn from mistakes**: The feedback → evolve cycle creates institutional memory

## Files Changed

| File | Change |
|------|--------|
| `DashboardChartCard.tsx` | Added `isGame` check, fixed borders for all themes |
| `chartTheme.ts` | Removed grey border from light theme `chartCardClassName` |
| `.claude/skills/skill-feedback/` | New skill for collecting feedback |
| `.claude/skills/evolve-skill/` | New skill for evolving skills based on feedback |
| `.claude/skills/journey/` | New skill for session summaries |
| `.claude/skills/*/SKILL.md` | Added version metadata to all skills |

## Patterns Discovered

### 3-Way Theme Check Pattern
```typescript
const { activeTheme } = useTheme();
const isDark = activeTheme.isDark;
const isGame = activeTheme.id === "game";

// Styling
className={cn(
  isGame ? "game-styles"
    : isDark ? "dark-styles"
    : "light-styles"
)}
```

### Skill Evolution Workflow
```
Use skill → /skill-feedback {skill} → feedback accumulates →
/evolve-skill {skill} → review proposals → approve → skill improves
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Track feedback in git | Allows team sharing of learnings |
| Built-in rollback with `.versions/` | Easy recovery without git archaeology |
| YAML for feedback files | Human-readable, easy to parse |
| Semantic versioning for skills | Clear indication of change magnitude |

## Connected To

- `add-chart` skill (evolved twice based on feedback)
- `CLAUDE.md` updated with evolution system docs
- Future: All skills can now evolve through this system


