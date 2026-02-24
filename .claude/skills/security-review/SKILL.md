---
name: security-review
updated: 2026-02-20
description: Deep security audit for the cgov application. Checks secrets, input validation, XSS, API security, wallet integration, and dependency vulnerabilities.
argument-hint: [quick|full] (default: full)
allowed-tools: Bash, Read, Grep, Glob, TodoWrite
---

# Security Review

Comprehensive security audit tailored for the cgov Next.js application with Cardano wallet integration.

## Domains

Review each domain. Use Grep to scan files, Read to inspect suspicious findings.

### 1. Secrets Management

**Check for exposed secrets:**
- Grep `src/` for hardcoded strings matching: `api[_-]?key`, `secret`, `password`, `token`, `private[_-]?key` (case insensitive)
- Verify `.env` is in `.gitignore`
- Verify `BACKEND_API_KEY` is only used in `pages/api/` (server-side) and never imported in client components
- Check `next.config.js` — `publicRuntimeConfig` and `NEXT_PUBLIC_*` vars must not contain secrets

**Expected pattern:**
```typescript
// SERVER ONLY (pages/api/*.ts)
const apiKey = process.env.BACKEND_API_KEY;

// CLIENT OK
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL; // URLs are OK
```

### 2. API Route Security

**Scan all files in `src/pages/api/`:**

| Check | What to Look For |
|-------|-----------------|
| Method validation | Every handler should check `req.method` |
| Input validation | Query params and body should be validated before use |
| Error handling | All routes should have try-catch with generic error messages |
| Status codes | Appropriate codes (400 for bad input, 500 for server errors, not 200 for everything) |
| Backend proxy | Should use `callApi()` helper, not raw `fetch` with hardcoded keys |
| Rate limiting | Consider for expensive operations (not required for all routes) |

**Anti-pattern to flag:**
```typescript
// BAD — leaks internal error details
res.status(500).json({ error: error.message, stack: error.stack });

// GOOD — generic error
res.status(500).json({ error: 'Internal server error' });
```

### 3. XSS Prevention

**Scan client components for:**
- `dangerouslySetInnerHTML` — must NEVER use with user-provided data. OK for trusted static content only.
- Template literals in JSX that could contain HTML
- URL parameters rendered directly without sanitization
- `window.location` or `document.referrer` used in rendering

**Special attention to:**
- Proposal descriptions (may contain user-submitted text from on-chain metadata)
- DRep display names and bios
- Any data from the backend API that originates from on-chain transactions

### 4. Wallet Security (Mesh SDK)

**Scan `src/components/wallet/` and any Mesh SDK usage:**
- Wallet connection should only happen client-side (dynamic import with `ssr: false`)
- Never log or transmit wallet private keys or seed phrases
- Transaction signing must show clear confirmation UI to the user
- Verify wallet address format before use
- Check that `@meshsdk/web3-sdk` is loaded via runtime `import()` gated by `window.crypto?.subtle`

### 5. Dependency Security

```bash
npm audit --production 2>&1
```

- Flag any HIGH or CRITICAL vulnerabilities
- Check that `package-lock.json` is committed (prevents supply chain attacks)
- Verify no `postinstall` scripts from untrusted packages

### 6. Data Exposure

**Check for sensitive data leaks:**
- API responses should not include more data than needed (over-fetching)
- `getStaticProps` / `getServerSideProps` — data passed to page props is serialized to HTML. Ensure no server secrets leak.
- Redux store contents are visible in React DevTools — ensure no sensitive data in state
- `console.log` in production can leak data — audit and remove

### 7. CORS and Headers

**Check `next.config.js` and API routes for:**
- CORS headers — should be restrictive, not `Access-Control-Allow-Origin: *`
- Security headers — CSP, X-Frame-Options, X-Content-Type-Options
- If using `next.config.js` headers, verify they're applied

### 8. Client-Side Data Validation

**Anywhere user input is processed:**
- Form inputs (wallet amount, search queries, filters)
- URL parameters (`[hash].tsx` — the governance action hash)
- localStorage/sessionStorage reads (dashboard config, theme preference)

**Pattern:**
```typescript
// GOOD — validate before use
const hash = router.query.hash;
if (typeof hash !== 'string' || !hash.match(/^[a-f0-9]{64}$/)) {
  return <NotFound />;
}
```

## Report Format

```
SECURITY AUDIT
═══════════════════════════════════════

CRITICAL (must fix immediately)
  [S1] Description — file:line

HIGH (fix before deployment)
  [S2] Description — file:line

MEDIUM (fix when convenient)
  [S3] Description — file:line

INFO (recommendations)
  [S4] Description

═══════════════════════════════════════
Dependencies: X high, Y critical (npm audit)
Overall: [SECURE / AT RISK / CRITICAL]
```

## Quick Mode

For `quick` argument, only check:
1. Secrets management (hardcoded credentials)
2. API route security (method validation, error handling)
3. `npm audit --production`

Skip XSS deep scan, wallet audit, CORS review, and client-side validation review.
