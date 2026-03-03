# Recharts Tooltip Styling - Custom Component Solution

**Date:** 2026-02-02
**Duration:** ~30 minutes
**Difficulty:** Medium (frustrating due to failed attempts)

## Problem

Needed to style chart tooltips in light theme to have:
- White background box
- Border and shadow matching chart cards
- Black text for readability

The issue was that black text on tooltips was unreadable when hovering over dark/black chart elements because there was no visible background box.

## Failed Approaches

### Attempt 1: contentStyle prop
```tsx
<Tooltip
  contentStyle={{
    backgroundColor: "#ffffff",
    border: "1px solid #e5e5e5",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
  }}
/>
```
**Result:** Styles appeared to be ignored. Tooltip still had no visible background.

### Attempt 2: Multiple style props
Created `getTooltipStyles()` returning contentStyle, wrapperStyle, itemStyle, labelStyle and spread them:
```tsx
<Tooltip {...getTooltipStyles(activeTheme.id)} />
```
**Result:** Still no visible background. Recharts wasn't applying the styles consistently.

### Attempt 3: Type error
Added explicit `React.CSSProperties` return type which caused type incompatibility with Recharts' expected types.
**Result:** Build failure due to csstype version mismatch between React and Recharts.

## Solution: Custom Content Component

The working solution was to use Recharts' `content` prop with a fully custom React component:

```tsx
// In chartTheme.tsx
export function ChartTooltip({
  active,
  payload,
  label,
  themeId,
  valueFormatter,
  labelFormatter,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const containerStyle = {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e5e5",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
    padding: "8px 12px",
    color: "#1a1a1a",
  };

  return (
    <div style={containerStyle}>
      {/* Custom tooltip content */}
    </div>
  );
}

// Usage in chart
<Tooltip content={<ChartTooltip themeId={activeTheme.id} />} />
```

## Key Learnings

1. **Recharts style props are unreliable** - The `contentStyle`, `wrapperStyle`, etc. props don't always override Recharts' internal styles, especially for critical properties like background color.

2. **Custom content gives full control** - Using the `content` prop with a custom component bypasses Recharts' internal rendering entirely.

3. **File extension matters for JSX** - When adding JSX to a `.ts` file, must rename to `.tsx` or move JSX to a separate file.

4. **Don't trust style props in third-party libs** - When inline styles don't work, check if the library provides a way to fully customize the component's rendering.

5. **Test one component first** - Updated only ProposalStatusChart initially to verify the solution worked before applying to all charts.

## Files Changed

- `src/components/dashboards/shared/chartTheme.ts` → `chartTheme.tsx` (renamed for JSX support)
- Added `ChartTooltip` component
- Updated all 5 chart components to use custom tooltip:
  - ProposalStatusChart
  - ProposalTypeChart
  - ParticipationChart
  - ProposalSubmissionChart
  - VotingPowerChart

## Future Reference

When styling Recharts tooltips:
1. **Skip** trying to use `contentStyle` and other style props
2. **Go straight to** creating a custom content component
3. The `content` prop receives `active`, `payload`, and `label` automatically from Recharts

## Related

- Recharts docs on custom tooltip: https://recharts.org/en-US/api/Tooltip#content
- This same pattern likely applies to other Recharts customizations (Legend, etc.)
