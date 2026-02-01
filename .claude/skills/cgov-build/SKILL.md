---
name: cgov-build
description: Run the build and iteratively fix TypeScript errors. Use when you need to verify the build passes or fix compilation errors.
disable-model-invocation: true
allowed-tools: Bash, Read, Edit, Grep, Glob, TodoWrite
---

# CGOV Build & Fix

Run the Next.js build and iteratively fix any TypeScript errors.

## Instructions

### Step 1: Run Build

Execute the build command:

```bash
npm run build
```

### Step 2: Parse Errors

If the build fails, parse the TypeScript errors from the output. Common error patterns:

- `Type 'X' is not assignable to type 'Y'`
- `Property 'X' does not exist on type 'Y'`
- `Cannot find module 'X'`
- `Argument of type 'X' is not assignable to parameter of type 'Y'`

### Step 3: Create Todo List

Use TodoWrite to track each error:

```
- Fix type error in src/components/Foo.tsx:42
- Fix missing property in src/store/slice.ts:100
- Fix import error in src/pages/bar.tsx:5
```

### Step 4: Fix Each Error

For each error:

1. Read the file to understand context
2. Identify the root cause
3. Apply the fix using Edit tool
4. Mark the todo as completed

### Step 5: Re-run Build

After fixing all errors, run the build again:

```bash
npm run build
```

Repeat steps 2-5 until the build succeeds.

### Step 6: Verify Success

When build passes, report:
- Total errors fixed
- Files modified
- Any warnings to note

## Common Fixes

### Missing Type Export
```typescript
// Add to types file
export type { NewType } from "./source";
```

### Incorrect Prop Type
```typescript
// Update interface
interface Props {
  value: string; // was: number
}
```

### Missing Import
```typescript
// Add import
import { SomeComponent } from "@/components/SomeComponent";
```

### Null Check
```typescript
// Add optional chaining
const value = data?.property ?? defaultValue;
```

## Build Output Locations

- Type errors: stdout during `npm run build`
- Build artifacts: `.next/` directory
- Lint errors: `npm run lint` (separate command)

## Notes

- Always fix errors in the order they appear (earlier errors may cause later ones)
- If stuck on a complex type error, check if the related type definitions need updating
- After significant changes, run `npm run dev` to test hot reload works
