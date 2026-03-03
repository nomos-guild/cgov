# Dashboard Polish and Tooltip Fix

**Date:** 2026-02-02
**Focus:** Dashboard UX improvements and chart tooltip styling fix

## Summary

Polished the dashboard experience with several UX fixes and resolved a persistent issue with Recharts tooltip styling. The key learning was that Recharts' style props are unreliable and custom content components are the proper solution.

## What Was Done

1. **Fixed margin handle hover state bug** - The margin drag lines stayed visible after releasing the mouse because the hover state wasn't being cleared during drag operations. Fixed by allowing `onMouseLeave` to always clear hover state.

2. **Removed side panel overlay** - The dark backdrop when opening the customize panel was removed so users can see the dashboard while making changes.

3. **Changed light theme chart colors to monochromatic** - Updated `lightChartColors` in chartTheme to use a black/grey/white palette instead of colorful tones for a cleaner, more professional look.

4. **Fixed tooltip styling (major learning)** - Recharts tooltip `contentStyle` prop wasn't applying background colors reliably. After multiple failed attempts, discovered that using a custom `content` component is the only reliable approach.

## Key Learnings

### Recharts Tooltip Styling - Don't Trust contentStyle

**Problem:** Recharts `<Tooltip contentStyle={{...}} />` doesn't reliably override default styling, especially background colors. Black text appeared without visible background box.

**Failed approaches:**
- Using `contentStyle` prop - ignored
- Using `wrapperStyle`, `itemStyle`, `labelStyle` together - still ignored
- Type errors when using `React.CSSProperties` return type

**Solution:** Use the `content` prop with a fully custom React component:

```tsx
// In chartTheme.tsx - custom tooltip component
export function ChartTooltip({ active, payload, label, themeId, ... }) {
  if (!active || !payload?.length) return null;

  const containerStyle = {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e5e5",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
    padding: "8px 12px",
  };

  return <div style={containerStyle}>...</div>;
}

// Usage in charts
<Tooltip content={<ChartTooltip themeId={activeTheme.id} />} />
```

**Key insight:** When third-party library style props don't work, look for "render prop" or custom content alternatives that bypass internal rendering.

### Hover State During Drag Operations

When implementing drag interactions:
- Don't block `onMouseLeave` from clearing hover state during drag
- The dragging state (`isDragging`) is sufficient to keep elements visible during drag
- Blocking hover state clears causes stale state when drag ends outside the element

**Pattern:**
```tsx
// WRONG - hover gets stuck
onMouseLeave={() => !isDragging && setIsHovering(false)}

// RIGHT - let hover clear, isDragging keeps it visible
onMouseLeave={() => setIsHovering(false)}
// showElement = isHovering || isDragging
```

## Files Changed

| File | Change |
|------|--------|
| `DashboardMarginHandles.tsx` | Fixed hover state clearing on mouseLeave |
| `DashboardSidePanel.tsx` | Removed backdrop overlay div |
| `chartTheme.ts` → `chartTheme.tsx` | Renamed for JSX, added monochrome light colors, added `ChartTooltip` component |
| `ProposalStatusChart.tsx` | Use ChartTooltip |
| `ProposalTypeChart.tsx` | Use ChartTooltip |
| `ParticipationChart.tsx` | Use ChartTooltip |
| `ProposalSubmissionChart.tsx` | Use ChartTooltip |
| `VotingPowerChart.tsx` | Use ChartTooltip |

## Patterns Discovered

### Custom Recharts Tooltip Component

```tsx
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  themeId: string;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label: string) => string;
}

export function ChartTooltip({
  active, payload, label, themeId, valueFormatter, labelFormatter
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const isGame = themeId === "game";
  const isDark = themeId === "dark";

  const containerStyle = isGame
    ? { backgroundColor: "#080808", border: "1px solid rgba(255,255,255,0.15)", ... }
    : isDark
      ? { backgroundColor: "#131320", border: "1px solid #0bd1a2", ... }
      : { backgroundColor: "#ffffff", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", ... };

  return (
    <div style={containerStyle}>
      {label && <p style={{ fontWeight: 600 }}>{labelFormatter?.(label) ?? label}</p>}
      {payload.map((entry, i) => (
        <p key={i}>
          <span style={{ color: entry.color }}>●</span>
          {entry.name}: {valueFormatter?.(entry.value) ?? entry.value}
        </p>
      ))}
    </div>
  );
}
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Custom tooltip component over contentStyle | Recharts contentStyle unreliable; custom gives full control |
| Renamed chartTheme.ts to .tsx | Needed JSX support for custom component |
| Monochrome light theme palette | Cleaner professional look, reduces visual noise |
| Keep overlay removal simple | Side panel should allow seeing dashboard while customizing |

## Skills Evolved

Based on learnings from this session, the following skills were updated:

| Skill | Version | Changes |
|-------|---------|---------|
| add-chart | 1.3.0 → 1.4.0 | Updated tooltip section to use ChartTooltip component instead of contentStyle |
