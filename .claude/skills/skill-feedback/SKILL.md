---
name: skill-feedback
version: 1.0.0
created: 2026-02-02
last-evolved: null
evolution-count: 0
feedback-count: 0
description: Collect structured feedback after using a skill to enable evolution and improvement.
argument-hint: [skill-name]
allowed-tools: Read, Write, Edit, Glob, AskUserQuestion
---

# Skill Feedback Collection

Collect structured feedback after using a skill. This feedback powers the skill evolution system.

## Arguments

- `$0` - Name of the skill you just used (e.g., `add-chart`, `add-api-route`)

## Instructions

### Step 1: Verify Skill Exists

Check that the skill exists in `.claude/skills/`:

```bash
# The skill directory should exist
.claude/skills/${$0}/SKILL.md
```

If the skill doesn't exist, inform the user and list available skills.

### Step 2: Collect Feedback

Use `AskUserQuestion` to gather structured feedback:

**Question 1: Outcome**
- "How did the skill execution go?"
- Options: Success (worked perfectly), Partial (worked but needed fixes), Failed (didn't work)

**Question 2: Strengths** (if not Failed)
- "What worked well?"
- Free text response

**Question 3: Corrections** (if Partial or Failed)
- "What did you have to fix or change manually?"
- Free text response

**Question 4: Suggestions**
- "What improvements would you suggest for this skill?"
- Free text response

### Step 3: Create Feedback File

Generate a unique filename and create the feedback YAML file:

**Filename format:** `.claude/skills/.feedback/${$0}/{YYYY-MM-DD}-{random-id}.yaml`

```yaml
skill: ${$0}
timestamp: {ISO timestamp}
outcome: {success|partial|failed}
context: "{Brief description of what you were trying to do}"

strengths:
  - "{What worked well - item 1}"
  - "{What worked well - item 2}"

corrections:
  - "{Manual fix 1}"
  - "{Manual fix 2}"

suggestions:
  - "{Improvement suggestion 1}"
  - "{Improvement suggestion 2}"

# Optional: code snippets if user provides them
code_fixes: []
```

### Step 4: Update Skill Metadata

Increment the `feedback-count` in the skill's SKILL.md frontmatter:

```yaml
feedback-count: {previous + 1}
```

### Step 5: Confirm

Tell the user:
- Feedback has been recorded
- Path to the feedback file
- Remind them they can run `/evolve-skill ${$0}` when ready to evolve the skill

---

## Feedback File Schema

```yaml
# Required fields
skill: string           # Skill name (must match directory name)
timestamp: string       # ISO 8601 timestamp
outcome: enum           # "success" | "partial" | "failed"
context: string         # What the user was trying to accomplish

# Optional fields
strengths: string[]     # What worked well (empty array if none)
corrections: string[]   # Manual fixes made (empty array if none)
suggestions: string[]   # Improvement ideas (empty array if none)

# Advanced (optional)
code_fixes:             # Specific code changes
  - file: string        # File path
    description: string # What was changed
    diff: string        # Before/after or unified diff
```

---

## Example Feedback File

`.claude/skills/.feedback/add-chart/2026-02-02-a1b2c3.yaml`:

```yaml
skill: add-chart
timestamp: 2026-02-02T14:30:00Z
outcome: partial
context: "Creating a vote participation bar chart for the governance dashboard"

strengths:
  - "Theme color system was comprehensive and well-documented"
  - "Chart registry update steps were clear"
  - "The ChartSkeleton loading pattern worked perfectly"

corrections:
  - "Had to add ErrorBoundary wrapper around the chart"
  - "Fixed import order - React hooks must come first"
  - "Adjusted tooltip z-index for proper layering"

suggestions:
  - "Add ErrorBoundary as a recommended pattern in the template"
  - "Include import order linting guidance"
  - "Add z-index best practices for tooltips"

code_fixes:
  - file: "src/components/dashboards/governance/charts/VoteParticipationChart.tsx"
    description: "Added error boundary wrapper"
    diff: |
      + import { ErrorBoundary } from '@/components/ui/error-boundary';
      ...
      + <ErrorBoundary fallback={<ChartError />}>
            <ResponsiveContainer>
      +   </ErrorBoundary>
```

---

## Verification Checklist

After collecting feedback:

1. [ ] Feedback file created in `.claude/skills/.feedback/${$0}/`
2. [ ] YAML is valid and properly formatted
3. [ ] `feedback-count` incremented in skill's SKILL.md
4. [ ] User informed of next steps (evolve-skill)
