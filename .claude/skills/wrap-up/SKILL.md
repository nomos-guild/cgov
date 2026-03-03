---
name: wrap-up
updated: 2026-03-03
description: End-of-session automation. Creates a journey and evolves skills based on session learnings.
argument-hint: [title]
user-invocable: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Session Wrap-Up

Captures what was learned and feeds it back into the skill system.

## Usage

```
/wrap-up {session title}
```

## Arguments

- `$0` - Session title describing the main work done (e.g., "DRep Dashboard Charts")

---

## Step 1: Gather Changes

Run git commands to capture ALL session changes:

```bash
git status
git diff HEAD
git ls-files --others --exclude-standard
```

Build a list of modified/created/deleted files and the nature of changes.

**Do not proceed until git output is reviewed.**

---

## Step 2: Create Journey

Create `.claude/journeys/{date}-{slug}.md` with:

- **Summary**: What was accomplished and why
- **What Was Done**: Numbered list of major items
- **Key Learnings**: Insights that prevent future mistakes
- **Files Changed**: Table of files and changes
- **Patterns Discovered**: Reusable code patterns found
- **Decisions Made**: Key choices and rationale

---

## Step 3: Evolve Skills

Read skills from `.claude/skills/*/SKILL.md` and compare against journey learnings.

For each skill, check:
- Does the journey contain patterns the skill should document?
- Were there edge cases or gotchas the skill should warn about?
- Did we discover something that contradicts current skill instructions?

Update affected skills and bump their `updated` date.

---

## Step 4: Cross-Pollinate Patterns

Check if any learnings apply across multiple skills.

1. Read `.claude/skills/_patterns.md`
2. If a learning is cross-cutting (theming, Recharts, i18n, data conventions), add to `_patterns.md`
3. If a pattern is outdated based on session work, update it

---

## Step 5: Update Journey

Add a "Skills Evolved" section to the journey:

```markdown
## Skills Evolved

| Skill | Changes |
|-------|---------|
| add-chart | Added overflow clipping pattern |
| _patterns | Updated theming rules |
```

---

## Skill Evolution Guidelines

| Session Content | Action |
|-----------------|--------|
| New component pattern | Add to relevant skill |
| Bug fix with root cause | Add to gotchas/checklist |
| Theme styling learned | `_patterns.md` Theming |
| New data convention | `_patterns.md` Data Conventions |
| Recharts gotcha | `_patterns.md` Recharts |
| i18n pattern | `_patterns.md` i18n |
