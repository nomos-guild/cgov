---
name: build-fix
updated: 2026-02-20
description: Run the build and intelligently fix TypeScript errors with guardrails. Stops if fixes introduce more errors or the same error persists after 3 attempts.
disable-model-invocation: true
allowed-tools: Bash, Read, Edit, Grep, Glob, TodoWrite
---

# Build Fix

Run the Next.js build, parse errors, and fix them incrementally with smart guardrails.

## Instructions

### Step 1: Detect Current State

```bash
npm run build 2>&1
```

If build succeeds, report success and exit. Otherwise continue.

### Step 2: Parse and Group Errors

Parse TypeScript errors from build output. Group by file and sort by dependency order:
1. Type definition files (`types/*.ts`) first — fixing these often resolves downstream errors
2. Utility/lib files (`lib/*.ts`, `utils/*.ts`) second
3. Store/service files (`store/*.ts`, `services/*.ts`) third
4. Component files (`components/**/*.tsx`) fourth
5. Page files (`pages/**/*.tsx`) last

Common error patterns:
- `Type 'X' is not assignable to type 'Y'`
- `Property 'X' does not exist on type 'Y'`
- `Cannot find module 'X'`
- `Argument of type 'X' is not assignable to parameter of type 'Y'`
- `Object is possibly 'undefined'`

### Step 3: Create Todo List

Use TodoWrite to track each error group (by file):

```
- Fix 3 type errors in src/types/governance.ts
- Fix 1 missing property in src/store/governanceSlice.ts
- Fix 2 import errors in src/pages/dashboard.tsx
```

### Step 4: Fix Loop (with guardrails)

For each error, follow this cycle:

1. **Read context**: Read 10-20 lines around the error (not the whole file)
2. **Diagnose**: Identify root cause — is it a type mismatch, missing import, null check, etc.?
3. **Minimal fix**: Apply the smallest edit that resolves the error. Do NOT refactor surrounding code.
4. **Mark todo complete**

#### Guardrails — STOP if any of these trigger:

| Guardrail | Condition | Action |
|-----------|-----------|--------|
| **Error loop** | Same error in same file after 3 fix attempts | STOP. Report the error and suggest manual review. |
| **Error explosion** | Re-build shows MORE errors than before | REVERT last edit. Report what happened. |
| **Architectural change needed** | Fix requires changing interfaces used by 5+ files | STOP. Report as architectural issue needing manual decision. |
| **Missing dependency** | Error requires installing a new package | STOP. Report the missing package, do not auto-install. |
| **20 error limit** | More than 20 individual errors | Fix the first 20, then re-build to see if downstream errors resolve. |

### Step 5: Re-build

After fixing all parsed errors (or hitting a guardrail), re-run:

```bash
npm run build 2>&1
```

- If clean: report success with summary
- If new errors: repeat from Step 2 (max 3 full cycles)
- If same errors persist: stop and report

### Step 6: Report

```
BUILD FIX REPORT
═══════════════════════════
Result:     [SUCCESS / PARTIAL / BLOCKED]
Errors fixed: X
Files modified: Y
Build cycles: Z
═══════════════════════════

Fixed:
  - src/types/governance.ts:42 — Added missing property 'votingPower'
  - src/components/Foo.tsx:18 — Added null check for optional data

Remaining (if any):
  - src/store/slice.ts:100 — Architectural: interface change affects 8 files
  - src/pages/bar.tsx:5 — Missing dependency: @types/foo

Warnings (pre-existing, expected):
  - [drepId].tsx uses <img> instead of <Image />
  - / page data exceeds 128 kB threshold
```

## Fix Patterns

### Missing Null Check
```typescript
// Before
const value = data.property;
// After
const value = data?.property;
```

### Type Mismatch
```typescript
// Check if the type definition needs updating, not the usage
// Prefer widening the type to adding `as X` casts
```

### Missing Import
```typescript
// Always use @/ path alias
import { Component } from "@/components/Component";
```

### Index Signature for Recharts Data
```typescript
// Recharts data arrays need this
interface ChartData {
  name: string;
  value: number;
  [key: string]: string | number; // Required for Recharts
}
```

## Notes

- Always fix errors in dependency order (types → utils → store → components → pages)
- If stuck on a complex type error, check if the related type definitions need updating first
- Never use `@ts-ignore` or `as any` as a fix — these hide real problems
- After significant changes, consider running `npm run lint` as well
