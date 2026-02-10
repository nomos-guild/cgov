# Proposal Detail Page: SSR to ISR + SWR

**Date**: 2026-02-05
**Branch**: frontend-v2

## Summary

Converted the proposal detail page (`/governance/[hash]`) from server-side rendering (SSR via `getServerSideProps`) to Incremental Static Regeneration (ISR via `getStaticProps` + `getStaticPaths`) with SWR client-side caching. This matches the pattern already proven on the landing page, which loads significantly faster.

The core problem: every visit to a proposal detail page triggered a full backend fetch that blocked page delivery. Now pages are cached at the ISR layer (60s revalidation) and at the SWR client layer (60s deduplication), making repeat visits instant.

## What Was Done

1. **Created `useGovernanceActionDetail` SWR hook** in `src/hooks/useGovernanceData.ts` following the exact same pattern as `useGovernanceActions`
2. **Added transform functions** (`transformVoteRecord`, `normaliseReferences`, `transformGovernanceActionDetail`) to the hooks file, mirroring `services/api.ts` logic
3. **Replaced `getServerSideProps`** with `getStaticPaths` (empty paths, `fallback: 'blocking'`) + `getStaticProps` (revalidate: 60, or 10 on error)
4. **Replaced manual hydration logic** (3 useEffects, `hydrated` state, `displayedHash` state) with the SWR hook
5. **Simplified content visibility animation** — `contentVisible` starts as `!!initialDetail`, resets on proposalId change via useRef
6. **Updated retry button** to call SWR's `refresh()` instead of dispatching Redux thunk
7. **Removed unused imports**: `useAppDispatch`, `loadGovernanceActionDetail`, `setSelectedAction`, `GetServerSideProps`

## Key Learnings

### ISR + SWR Pattern for Dynamic Routes
- Use `getStaticPaths` with `paths: []` and `fallback: 'blocking'` for routes with too many possible values to enumerate
- First visitor triggers on-demand generation (same latency as SSR), but the result is cached
- Subsequent visitors get instant loads from ISR cache
- SWR `fallbackData` from ISR provides instant hydration — `revalidateOnMount: !fallbackData` skips redundant client fetch

### SWR fallbackData and Client-Side Navigation
- SWR's `fallbackData` only seeds data for the **initial** key. When the SWR key changes (navigating between proposals), fallbackData is NOT used for the new key
- Solution: detect `fallbackData` changes via `useRef` and call `mutate(fallbackData, false)` to seed the SWR cache for the new key
- This gives instant display of ISR data even during client-side navigation

### VoteOnProposal Coexistence
- `VoteOnProposal.tsx` continues using the Redux thunk `loadGovernanceActionDetail` for polling after vote submission
- This coexists fine because both the SWR hook and the Redux thunk write to the same `selectedAction` state
- No changes needed to `VoteOnProposal.tsx`

### Build Output Change
- Page changed from `f` (Dynamic/server-rendered) to `●` (SSG/prerendered) in Next.js build output
- This confirms ISR is working — the page can now be served from CDN cache

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useGovernanceData.ts` | Added `useGovernanceActionDetail` hook, transform functions, new imports |
| `src/pages/governance/[hash].tsx` | SSR → ISR + SWR, removed hydration logic, simplified animation |

## Patterns Discovered

### ISR + SWR Hook for Dynamic Detail Pages
```typescript
// In getStaticPaths — don't enumerate, generate on-demand
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: "blocking",
});

// In getStaticProps — fetch server-side, cache via ISR
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const data = await fetchDetailServer(params.id);
  return {
    props: { initialDetail: data },
    revalidate: data ? 60 : 10, // Shorter retry on error
  };
};

// In hook — SWR with fallback seeding for navigation
const prevFallbackRef = useRef(fallbackData);
useEffect(() => {
  if (fallbackData && fallbackData !== prevFallbackRef.current) {
    mutate(fallbackData, false); // Seed cache without revalidation
    prevFallbackRef.current = fallbackData;
  }
}, [fallbackData, mutate]);
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `fallback: 'blocking'` over `'true'` | Avoids showing loading skeleton for first-time visitors; same UX as SSR but with caching |
| `revalidate: 10` on error | Faster retry when backend was down, without hammering it |
| Keep Redux sync in SWR hook | Backward compat — `VoteOnProposal` and other components read from `selectedAction` |
| Transform functions duplicated in hooks file | Matches existing pattern (landing page hooks have their own transforms); avoids exposing internal functions from `services/api.ts` |

## Skills Evolved

| Skill | Changes |
|-------|---------|
| `_patterns.md` | Added ISR + SWR section under React Hooks Gotchas |
