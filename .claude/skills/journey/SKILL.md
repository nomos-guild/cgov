---
name: journey
version: 1.0.0
created: 2026-02-02
last-evolved: null
evolution-count: 0
feedback-count: 0
description: Save a session summary capturing what was done, learned, and discovered. Creates institutional memory for future sessions.
argument-hint: [title] or [--list] or [--read filename]
allowed-tools: Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# Journey - Session Learning Log

Save a summary of what was accomplished and learned during a coding session. These journey files persist across sessions, allowing future AI sessions to learn from past work.

## Arguments

- `$0` - Journey title (e.g., "Theme Border Fixes", "API Refactoring")
- Or special commands:
  - `--list` - List all journey files
  - `--read {filename}` - Read a specific journey
  - `--recent` - Show most recent journeys

---

## Mode 1: Save a Journey

### Step 1: Gather Information

Use `AskUserQuestion` to collect:

1. **What was accomplished?** - Main tasks completed
2. **Key learnings?** - Patterns discovered, gotchas found
3. **Any decisions made?** - Architectural choices, trade-offs

Or infer from the conversation context if the information is clear.

### Step 2: Create Journey File

Create file at `.claude/journeys/{YYYY-MM-DD}-{kebab-case-title}.md`:

```markdown
# Journey: {Title}

**Date:** {YYYY-MM-DD}
**Duration:** {approximate time if known}
**Tags:** {relevant tags like #theming #bugfix #feature}

## Summary

{1-3 sentence overview of what was accomplished}

## What Was Done

- {Task 1}
- {Task 2}
- {Task 3}

## Key Learnings

- **{Learning 1 title}**: {explanation}
- **{Learning 2 title}**: {explanation}

## Files Changed

| File | Change |
|------|--------|
| `{path}` | {brief description} |

## Patterns Discovered

{Any reusable patterns or conventions discovered}

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| {Decision} | {Why} |

## Connected To

- {Related skills, previous journeys, or documentation}

## Open Questions / Next Steps

- {Any unresolved items for future sessions}
```

### Step 3: Confirm

Tell the user:
- Journey saved at `{path}`
- Remind them it will be available for future sessions

---

## Mode 2: List Journeys

### `--list`

```bash
# List all journey files
ls -la .claude/journeys/*.md
```

Output format:
```
Available Journeys:
  2026-02-02-skill-evolution-system.md - Skill Evolution System
  2026-02-02-theme-border-fixes.md - Theme Border Fixes
  ...
```

---

## Mode 3: Read Journey

### `--read {filename}`

1. Read the specified journey file
2. Display formatted content to user
3. Highlight key learnings and patterns

---

## Mode 4: Recent Journeys

### `--recent`

1. List the 5 most recent journey files
2. Show title, date, and summary for each
3. Useful for quick context at session start

---

## Journey File Guidelines

### Good Journey Titles
- Specific: "Theme Border System Fixes"
- Action-oriented: "Implementing Skill Evolution"
- Descriptive: "API Authentication Refactoring"

### Bad Journey Titles
- Vague: "Bug fixes"
- Too broad: "Code changes"
- Undescriptive: "Session 1"

### Tags to Use
- `#bugfix` - Bug fixes
- `#feature` - New features
- `#refactor` - Code refactoring
- `#theming` - Theme-related work
- `#performance` - Performance improvements
- `#tooling` - Developer tooling
- `#documentation` - Documentation updates

---

## How Future Sessions Use Journeys

At the start of a new session, AI can:

1. Read recent journeys to understand project context
2. Search journeys for relevant patterns
3. Avoid re-learning documented gotchas
4. Build on previous decisions

Example prompt for new session:
```
"Check .claude/journeys/ for recent work on theming"
```

---

## Verification Checklist

After saving a journey:

1. [ ] File created in `.claude/journeys/`
2. [ ] Filename follows `{date}-{kebab-title}.md` format
3. [ ] Summary is concise but complete
4. [ ] Key learnings are actionable
5. [ ] Files changed are listed
6. [ ] Connected resources are linked
