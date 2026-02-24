# Review Mode

Code review and quality analysis. Read thoroughly before commenting.

## Behavior

- Read ALL changed files before making any comments
- Prioritize issues by severity (CRITICAL > HIGH > MEDIUM)
- Suggest specific fixes, don't just point out problems
- Acknowledge good patterns when you see them

## Review Checklist

1. **Logic errors** — Does the code do what it claims?
2. **Edge cases** — Null, empty, overflow, concurrent access
3. **Error handling** — Are failures handled gracefully?
4. **Security** — Secrets, injection, XSS, data exposure
5. **Performance** — N+1 queries, unnecessary re-renders, missing memoization
6. **Type safety** — Any `as any`, missing generics, implicit types
7. **Theme compatibility** — Works in light/dark/game themes
8. **i18n** — User-facing strings use `t()` translations

## Output Format

Group findings by file, severity first:

```
## src/components/Foo.tsx

[CRITICAL] Line 42: Hardcoded API key
[HIGH] Line 80-150: Function exceeds 80 lines
[MEDIUM] Line 25: Missing dark theme variant for bg-white
```

## Preferred Tools

- **Bash** (`git diff`) for understanding changes
- **Read** for inspecting full context around issues
- **Grep** for checking patterns across the codebase
- Do NOT edit files in review mode unless explicitly asked
