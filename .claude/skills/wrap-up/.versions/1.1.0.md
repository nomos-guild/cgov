---
name: wrap-up
version: 1.1.0
created: 2026-02-02
last-evolved: 2026-02-03
evolution-count: 1
feedback-count: 0
description: End-of-session automation that creates a journey, evolves skills based on learnings, and updates the journey with evolutions.
argument-hint: [title]
user-invocable: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Session Wrap-Up

Automated end-of-session workflow that:
1. **Gathers all file changes** from git to ensure nothing is missed
2. Creates a journey documenting what was done and learned
3. Analyzes skills to identify evolution opportunities
4. Evolves skills based on journey learnings
5. Updates the journey to include skill evolutions

## Usage

```
/wrap-up {session title}
```

## Arguments

- `$0` - Session title describing the main work done (e.g., "Page Margins Feature")

---

## Workflow Steps

### Step 1: Gather All File Changes (CRITICAL)

**IMPORTANT**: Before creating the journey, ALWAYS run these git commands to capture ALL changes from the session. In long sessions, relying on memory alone will miss changes.

Run these commands:

```bash
# Show all changed files (staged and unstaged)
git status

# Show detailed diff of all changes (staged and unstaged)
git diff HEAD

# If there are new untracked files, list them
git ls-files --others --exclude-standard
```

From this output, create a comprehensive list of:
- All modified files and what changed in each
- All new files that were created
- All deleted files
- The nature of changes (bug fix, feature, refactor, etc.)

**DO NOT proceed to Step 2 until you have reviewed the git output.** This ensures the journey captures everything, not just what's fresh in conversation context.

---

### Step 2: Create Journey

Using the file changes from Step 1 AND the conversation context, create a journey file at `.claude/journeys/{date}-{slug}.md`.

Include:
- **Summary**: What was accomplished and why it matters
- **What Was Done**: Numbered list of major items
- **Key Learnings**: Insights that prevent future mistakes, patterns discovered
- **Files Changed**: Table of files and their changes
- **Patterns Discovered**: Code examples of reusable patterns
- **Decisions Made**: Table of decisions and rationale

Use today's date: `YYYY-MM-DD`
Slug: lowercase, hyphenated version of title

---

### Step 3: Analyze Skills for Evolution

Read all skills from `.claude/skills/*/SKILL.md` and compare against the journey learnings.

For each skill, check:
- Does the journey contain patterns/learnings the skill should document?
- Are there new features/components the skill should reference?
- Did we discover edge cases or gotchas the skill should warn about?
- Are there new verification checklist items?

Create a list of skills that need updates with specific changes.

---

### Step 4: Evolve Skills

For each skill identified in Step 3:

1. **Read current skill** from `SKILL.md`
2. **Increment version** (patch for docs, minor for features, major for breaking)
3. **Apply changes** based on journey learnings
4. **Update CHANGELOG.md** with:
   - Version number and date
   - What was added/changed/fixed
   - "Journey-driven" note referencing the journey
5. **Save version backup** to `.versions/{version}.md`

---

### Step 5: Update Journey

Add a new section to the journey documenting the skill evolutions:

```markdown
## Skills Evolved

Based on learnings from this session, the following skills were updated:

| Skill | Version | Changes |
|-------|---------|---------|
| add-chart | 1.2.0 → 1.3.0 | Added data attributes documentation |
| theming | 1.0.0 → 1.1.0 | Added handle styling patterns |
```

---

## Example Output

After running `/wrap-up Page Margins Feature`:

```
✓ Gathered file changes from git:
  - 12 files modified
  - 3 files created
  - 1 file deleted
✓ Created journey: .claude/journeys/2026-02-02-page-margins-feature.md
✓ Analyzed 9 skills for evolution opportunities
✓ Evolved 3 skills:
  - add-dashboard: 1.0.0 → 2.0.0 (major - full feature parity)
  - add-chart: 1.2.0 → 1.3.0 (minor - data attributes)
  - theming: 1.0.0 → 1.1.0 (minor - handle styling)
✓ Updated journey with skill evolutions
```

---

## Skill Evolution Guidelines

### When to evolve a skill:

| Journey Content | Skill Action |
|-----------------|--------------|
| New component pattern | Add to architecture/patterns section |
| Bug fix with root cause | Add to gotchas/checklist |
| New feature implemented | Update feature documentation |
| Theme styling learned | Update theming patterns |
| New data attribute | Document in relevant skills |

### Version increments:

- **Patch** (1.0.0 → 1.0.1): Typo fixes, clarifications
- **Minor** (1.0.0 → 1.1.0): New patterns, features, checklist items
- **Major** (1.0.0 → 2.0.0): Significant restructuring, new sections

---

## Files Created/Modified

| File | Action |
|------|--------|
| `.claude/journeys/{date}-{slug}.md` | Created |
| `.claude/skills/*/SKILL.md` | Modified (evolved skills) |
| `.claude/skills/*/CHANGELOG.md` | Modified |
| `.claude/skills/*/.versions/{version}.md` | Created |

---

## Notes

- If no skills need evolution, still create the journey
- Always create version backups before modifying skills
- Reference the journey in changelog entries
- Keep journey and skill updates consistent
