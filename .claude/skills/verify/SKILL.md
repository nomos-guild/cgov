---
name: verify
updated: 2026-02-20
description: Pre-PR verification loop. Runs build, type check, lint, security audit, and console.log scan. Use before creating PRs or merging.
argument-hint: [quick|full|pre-pr] (default: full)
allowed-tools: Bash, Grep, Glob, Read, TodoWrite
---

# Verify

Comprehensive verification before PRs. Runs all quality gates and produces a structured pass/fail report.

## Modes

- **quick**: Build + type check only (fastest)
- **full** (default): Build + types + lint + console.log audit + git status
- **pre-pr**: Full + security scan (secrets, env files, API keys)

## Instructions

### Step 1: Determine Mode

Check the argument. Default to `full` if none provided.

### Step 2: Run Checks

Run the following checks sequentially. Stop early on CRITICAL failures (build, types) since later checks depend on them.

#### 2a. Build Check

```bash
npm run build 2>&1
```

- **PASS**: Build completes without errors
- **FAIL**: Any TypeScript or build errors

If build fails, STOP. Report the errors and suggest running `/build-fix`.

#### 2b. Type Check (quick mode stops here)

The build already includes type checking. If build passed, types pass.
For explicit type check without full build:

```bash
npx tsc --noEmit 2>&1
```

#### 2c. Lint Check

```bash
npm run lint 2>&1
```

- **PASS**: No lint errors (warnings are OK)
- **FAIL**: Any lint errors

#### 2d. Console.log Audit

Search for `console.log` in all source files (excluding node_modules, .next, tests):

```bash
grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | grep -v "// eslint-disable" | grep -v "node_modules"
```

- **PASS**: No console.log statements
- **WARN**: console.log found (list file:line)

#### 2e. Security Scan (pre-pr mode only)

Search for potential secrets and sensitive data:

Use Grep tool to search for these patterns across `src/`:
- Hardcoded API keys: `api[_-]?key\s*[:=]\s*['"][^'"]+['"]` (case insensitive)
- Hardcoded secrets: `secret\s*[:=]\s*['"][^'"]+['"]` (case insensitive)
- Hardcoded passwords: `password\s*[:=]\s*['"][^'"]+['"]` (case insensitive)
- Private keys: `-----BEGIN.*PRIVATE KEY-----`
- `.env` files committed: Check `git ls-files | grep '\.env'`

Also check that `.env` is in `.gitignore`.

#### 2f. Git Status

```bash
git status
git diff --stat
```

Report uncommitted changes, untracked files.

### Step 3: Report

Output a structured verification report:

```
VERIFICATION: [PASS/FAIL]
═══════════════════════════════
Build:      [PASS/FAIL]
Types:      [PASS/FAIL] (X errors)
Lint:       [PASS/FAIL] (X issues)
Console.log:[CLEAN/X found]
Security:   [CLEAN/X issues] (pre-pr only)
Git:        [clean/X uncommitted changes]
═══════════════════════════════
Ready for PR: [YES/NO]
```

If any check fails, list the specific failures below the report with file:line references.

### Step 4: Recommendations

If verification fails:
- Build/Type errors → suggest `/build-fix`
- Lint issues → suggest `npm run lint -- --fix`
- Console.log → list files to clean
- Security issues → flag as CRITICAL, do not proceed
- Uncommitted changes → suggest committing or stashing

## Known Pre-existing Warnings

These warnings are expected and should NOT cause a FAIL:
- `[drepId].tsx` uses `<img>` instead of `<Image />` (known)
- `/` page data exceeds 128 kB threshold (known, ISR+SWR pattern)
