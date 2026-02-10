# DRep Profile Page with Donut Charts

**Date:** 2026-02-03
**Branch:** frontend-v2

## Summary

Built the DRep (Delegated Representative) profile page with three theme-aware donut charts showing engagement metrics, vote breakdown, and rationale statistics. Developed a consistent light theme pattern using white/grey graduated slices with dark shadows, and square legend items with borders for white colors.

## What Was Done

1. Created DRep profile page (`[drepId].tsx`) with profile card and charts card side-by-side layout
2. Built three donut charts: Engagement, Vote Breakdown, and Rationales
3. Implemented light theme pattern: white slices with SVG feDropShadow shadows
4. Added graduated grey colors for "negative" metrics (Not Voted, Abstain, No, Without Rationale)
5. Created theme-aware legend with pure square indicators and borders for white items
6. Added SWR data fetching hooks (`useDRepDetail`, `useDRepVotes`) for DRep data
7. Created API routes for DRep detail and voting history
8. Updated DRep dashboard index page with stats cards and tabbed content

## Key Learnings

### Light Theme Donut Chart Pattern

For light theme, use white primary slices with grey graduated colors for negative/neutral items:
- Primary (positive): `#ffffff` (pure white)
- Neutral: `#e2e8f0` (slate-200)
- Negative: `#94a3b8` (slate-400)

### SVG Shadow Filter for Chart Slices

Apply dark shadows to white slices using SVG filters:

```tsx
<defs>
  {isLight && (
    <filter id="pieShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.25" />
    </filter>
  )}
</defs>
<Pie style={isLight ? { filter: "url(#pieShadow)" } : undefined}>
  {data.map((entry, index) => (
    <Cell
      fill={entry.color}
      stroke={isLight ? "rgba(15, 23, 42, 0.15)" : "none"}
      strokeWidth={isLight ? 2 : 0}
    />
  ))}
</Pie>
```

### Legend Square Styling Pattern

Use pure squares (not rounded) with borders for white items:

```tsx
<div
  className="w-2.5 h-2.5"
  style={{
    backgroundColor: item.color,
    border: isWhite ? "1.5px solid rgba(15, 23, 42, 0.3)" : undefined,
    boxShadow: isLight ? "0 1px 3px rgba(15,23,42,0.2)" : undefined,
  }}
/>
```

### Chart Color Organization

Define theme-specific color objects for each chart type:

```typescript
const VOTE_COLORS = {
  game: { yes: "#22c55e", no: "#ef4444", abstain: "#eab308" },
  light: { yes: "#ffffff", abstain: "#e2e8f0", no: "#94a3b8" },
};
```

## Files Changed

| File | Change |
|------|--------|
| `src/pages/drep/[drepId].tsx` | New - DRep profile page with 3 donut charts |
| `src/pages/drep/index.tsx` | Modified - Added stats cards, tabbed content |
| `src/hooks/useDRepData.ts` | Modified - Added useDRepDetail, useDRepVotes hooks |
| `src/types/drep.ts` | Modified - Added DRepDetail, VoteBreakdown types |
| `src/pages/api/dreps/[drepId]/index.ts` | New - API route for DRep detail |
| `src/pages/api/dreps/[drepId]/votes.ts` | New - API route for DRep votes |
| `src/pages/api/dreps/index.ts` | New - API route for DRep list |
| `src/components/dreps/DRepSunburstChart.tsx` | New - Sunburst chart component |
| `src/themes/game/tokens.css` | Modified - Game theme token additions |

## Patterns Discovered

### Inline Chart Component Pattern

For page-specific charts that won't be reused in the dashboard, define them inline in the page file rather than creating separate components:

```tsx
// Define color constants at top of file
const VOTE_COLORS = { game: {...}, light: {...} };

// Define chart components in same file
function VoteBreakdownChart({ yes, no, abstain, isGame, isLight }: Props) {
  const colors = isGame ? VOTE_COLORS.game : (isLight ? VOTE_COLORS.light : VOTE_COLORS.game);
  // ... render chart
}

// Use in main component
export default function DRepProfile() {
  return (
    <VoteBreakdownChart
      yes={drep.voteBreakdown.yes}
      isGame={isGame}
      isLight={isLight}
    />
  );
}
```

### Theme Detection Pattern

Always check `isLight` explicitly for light-only styling:

```typescript
const { activeTheme } = useTheme();
const isGame = activeTheme.id === "game";
const isLight = activeTheme.id === "light";
// Use isGame for game-specific, isLight for light-specific, else dark theme
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| White slices with shadows for light theme | Creates elegant, minimal aesthetic while maintaining visual distinction between segments |
| Grey colors for negative metrics | Provides clear visual hierarchy - white for positive, greys for neutral/negative |
| Square legend indicators | Cleaner, more modern look than circles; matches the angular chart aesthetic |
| Inline chart definitions | These charts are DRep-profile specific, no need to add to dashboard chart registry |
| SVG filter for shadows | More performant than CSS box-shadow on SVG elements, consistent across browsers |

## Skills Evolved

Based on learnings from this session, the following skills were updated:

| Skill | Version | Changes |
|-------|---------|---------|
| add-chart | 1.5.0 → 1.6.0 | Added light theme donut chart pattern (white/grey graduated colors), SVG feDropShadow filter pattern, custom legend with square indicators |
