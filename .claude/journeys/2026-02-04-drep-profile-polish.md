# DRep Profile Page Polish

**Date:** 2026-02-04
**Branch:** frontend-v2

## Summary

Polished the DRep profile page with several UX improvements: fixed donut chart clipping caused by Recharts' internal overflow handling, improved spacing, removed pagination in favor of scrollable voting history, and added a Rationale column with a "View" button that reuses the existing `VotingRationaleModal`.

## What Was Done

1. Fixed donut chart clipping (left/right cutoff) caused by Recharts `recharts-wrapper` having inline `overflow: hidden`
2. Added `overflow-visible` to all pie chart containers and SVG elements
3. Increased breathing space between donut charts and the voting activity line chart
4. Removed CartesianGrid dotted lines from the line chart for cleaner look
5. Replaced paginated voting history with a scrollable container using `useAllDRepVotes`
6. Removed unused pagination state, `useDRepVotes` import, and `useState` import
7. Added Rationale column to voting history table with "View" button opening `VotingRationaleModal`
8. Created `toVoteRecord` adapter to bridge `DRepVoteRecord` → `VoteRecord` for the modal
9. Exported `getRationale` from `exportRationales.ts` (widened param type to accept `null`)

## Key Learnings

### Recharts `recharts-wrapper` Overflow Clipping (CRITICAL)

Recharts' `ResponsiveContainer` creates a `<div class="recharts-wrapper">` with **inline `overflow: hidden`**. This clips pie charts and their drop shadows even when you set `style={{ overflow: "visible" }}` on the `PieChart` (which only affects the inner SVG).

**Fix:** Use Tailwind's arbitrary variant to override the inline style:

```tsx
<div className="h-[200px] overflow-visible [&_.recharts-wrapper]:!overflow-visible">
  <ResponsiveContainer width="100%" height="100%">
    <PieChart style={{ overflow: "visible" }}>
```

The three layers that need overflow visible:
1. **Outer div** - `overflow-visible` (Tailwind class)
2. **recharts-wrapper** - `[&_.recharts-wrapper]:!overflow-visible` (overrides inline style)
3. **SVG element** - `style={{ overflow: "visible" }}` (on PieChart component)

### Type Adapter Pattern for Reusing Modals

When reusing an existing modal component that expects a different type, create a lightweight adapter function rather than duplicating the modal:

```typescript
function toVoteRecord(vote: DRepVoteRecord, drepId: string, drepName: string): VoteRecord {
  return {
    voterType: "DRep",
    voterId: drepId,
    voterName: drepName,
    drepId,
    drepName,
    vote: vote.vote,
    votingPower: vote.votingPower ?? "0",
    votingPowerAda: vote.votingPowerAda,
    anchorUrl: vote.anchorUrl ?? undefined,
    rationale: vote.rationale ?? undefined,
    votedAt: vote.votedAt ?? "",
    txHash: vote.txHash,
  };
}
```

### Scrollable Tables vs Pagination

For profile pages where users want to scan all data at once, a scrollable container (`max-h-[500px] overflow-y-auto`) is better UX than pagination. This also simplifies the code by removing pagination state and using a single `useAllDRepVotes` hook.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/drep/[drepId].tsx` | Fixed donut overflow, added spacing, scrollable table, rationale column with modal |
| `src/lib/exportRationales.ts` | Exported `getRationale`, widened param type to accept `null` |
| `src/hooks/useDRepData.ts` | Added `useAllDReps` and `useAllDRepVotes` auto-paginating hooks |
| `src/components/dreps/DRepSunburstChart.tsx` | Switched from `useDRepList` to `useAllDReps` |

## Patterns Discovered

### Recharts Overflow Fix Pattern

Always apply this pattern when using pie/donut charts with drop shadows or any visual overflow:

```tsx
<div className="overflow-visible [&_.recharts-wrapper]:!overflow-visible">
  <ResponsiveContainer width="100%" height="100%">
    <PieChart style={{ overflow: "visible" }}>
```

### Modal Reuse via Type Adapter

```typescript
// Convert page-specific type to shared modal's expected type
function toVoteRecord(vote: DRepVoteRecord, ...): VoteRecord { ... }

// Use in table with state management
const [selectedVote, setSelectedVote] = useState<VoteRecord | null>(null);

// Button opens modal
<button onClick={() => setSelectedVote(toVoteRecord(vote, drepId, drepName))}>View</button>

// Modal at component root
<VotingRationaleModal
  vote={selectedVote}
  open={selectedVote !== null}
  onOpenChange={(open) => { if (!open) setSelectedVote(null); }}
/>
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Tailwind arbitrary variant over global CSS | Scoped fix, no risk of unintended side effects on other charts |
| Reuse VotingRationaleModal via adapter | Avoids duplicating modal code, consistent UX across pages |
| Scrollable table over pagination | Better scanning UX for profile pages, simpler code |
| Export getRationale rather than duplicate | Single source of truth for rationale parsing logic |
| Fix all 3 donut charts, not just rationale | Same root cause affects all, preventive fix |

## Skills Evolved

Based on learnings from this session, the following skills were updated:

| Skill | Version | Changes |
|-------|---------|---------|
| add-chart | 1.6.0 → 1.7.0 | Added CRITICAL Recharts overflow clipping gotcha with 3-layer fix pattern, new verification checklist item |
