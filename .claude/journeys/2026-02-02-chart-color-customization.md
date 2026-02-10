# Chart Color Customization & Dashboard Polish

**Date**: 2026-02-02
**Duration**: ~1 hour

## Summary

Major session focused on dashboard color customization features. Added text color customization, "Apply to all charts" feature, fixed z-index and page reload bugs, converted charts to donut style, and made chart elements clickable for color customization.

## What Was Done

### Color Customization Infrastructure (New)
1. Created `ChartColorsContext` - React context for storing/retrieving custom chart colors with localStorage persistence
2. Created `ChartCard` component - Reusable wrapper with custom background and text color support
3. Created `ChartColorPicker` - HSV color wheel picker with saturation/value gradients
4. Created `SidePanelColorPicker` - Integrated picker for side panel with reset functionality
5. Added Colors tab to side panel with card background and text color customization
6. Added palette button to `DashboardChartCard` to open color picker from card hover controls
7. Added `ColorPickerTarget` type and state to `DashboardProvider`
8. Wrapped dashboard page with `ChartColorsProvider`

### "Apply to All" Feature
9. Added "Apply to All Charts" button to copy background and text colors to all other charts
10. Made the feature work with default (reset) colors too - can apply "no custom color" to all
11. Added `applyStyleToAllCharts` function to `ChartColorsContext`

### Chart Color Customization (6 charts updated)
12. ProposalTypeChart - Clickable pie slices and legend color swatches
13. ProposalStatusChart - Converted to donut chart, clickable slices and table legend
14. ProposalSubmissionChart - Clickable line and activeDot, removed permanent dots
15. NCLProgressChart - Clickable progress bars with custom indicator colors
16. ParticipationChart - Added color customization support
17. VotingPowerChart - Added color customization support

### Bug Fixes
18. Fixed z-index issue: side panel behind chart cards (z-50 → z-[100])
19. Fixed cards stacking on page reload: added `initialLoadComplete` state with 500ms delay
20. Fixed object spread truthiness bug in `applyStyleToAllCharts`

### UI/UX Improvements
21. Extended Progress component with `indicatorStyle` prop for custom bar colors
22. Added selection glow animation CSS for selected cards
23. Converted ProposalStatusChart from BarChart to donut PieChart with table legend
24. Removed dots from line chart for cleaner appearance (kept activeDot for hover)

## Key Learnings

### 1. Initial Load Detection Pattern
When you have effects that should run on resize but NOT on initial page load, use a delayed flag:
```tsx
const [initialLoadComplete, setInitialLoadComplete] = useState(false);

useEffect(() => {
  if (!mounted) return;
  const timer = setTimeout(() => {
    setInitialLoadComplete(true);
  }, 500);
  return () => clearTimeout(timer);
}, [mounted]);

useEffect(() => {
  if (!mounted || !initialLoadComplete) return;
  // This won't run on initial page load
}, [mounted, initialLoadComplete, ...deps]);
```

### 2. Z-Index Layering for Side Panels
Side panels need higher z-index than dashboard cards:
- Chart cards: z-index 1 (normal), 10 (selected), 50 (active)
- Side panel: z-index 100 (`z-[100]`)

### 3. "Apply to All" with Reset Support
When applying styles to all items, handle both custom AND default (empty) values:
```tsx
if (cardBg) {
  existingChartColors["_cardBg"] = cardBg;
} else {
  delete existingChartColors["_cardBg"];  // Remove = use default
}
```

### 4. Recharts Line onClick Support
The Recharts `Line` component supports direct `onClick` handlers on the line itself:
```tsx
<Line
  onClick={handleLineClick}
  style={{ cursor: "pointer" }}
  dot={false}
  activeDot={{ onClick: handleLineClick, cursor: "pointer" }}
/>
```

### 5. Progress Component Indicator Styling
To support custom colors on progress bars, add an `indicatorStyle` prop:
```tsx
<Progress
  indicatorClassName={cn("rounded-full", !barColor && "bg-white")}
  indicatorStyle={barColor ? { backgroundColor: barColor } : undefined}
/>
```

### 6. Object Spread Truthiness Gotcha
This is always truthy (spread creates new object):
```tsx
// WRONG - always truthy
const colors = { ...obj[key] } || {};

// CORRECT
const colors = { ...(obj[key] || {}) };
```

### 7. Color Context with No-Op Fallback
When a context might be used outside its provider, return a no-op implementation:
```tsx
export function useChartColors(): ChartColorsContextValue {
  const context = useContext(ChartColorsContext);
  if (context === undefined) {
    return {
      colors: {},
      getColor: (_, __, defaultColor) => defaultColor,
      setColor: () => {},
      // ... other no-ops
    };
  }
  return context;
}
```

### 8. HSV Color Model for Pickers
For color pickers, HSV (Hue-Saturation-Value) is more intuitive than RGB:
- Hue: 0-360° (color wheel position)
- Saturation: 0-100% (color intensity)
- Value: 0-100% (brightness)

Convert HSV → RGB for display, store as hex.

## Files Changed (24 total)

### New Files Created
| File | Purpose |
|------|---------|
| `src/components/dashboards/shared/ChartCard.tsx` | Reusable chart card wrapper with custom background/text color support |
| `src/components/dashboards/shared/ChartColorsContext.tsx` | React context for chart color customization, localStorage persistence |
| `src/components/dashboards/shared/ChartColorPicker.tsx` | HSV color wheel picker component |
| `src/components/dashboards/shared/SidePanelColorPicker.tsx` | Color picker integrated into side panel with reset button |

### Dashboard Infrastructure
| File | Change |
|------|--------|
| `src/components/dashboards/shared/DashboardSidePanel.tsx` | Added Colors tab, text color picker, "Apply to All Charts", fixed z-index |
| `src/components/dashboards/shared/DashboardProvider.tsx` | Added `colorPickerTarget`, `setColorPickerTarget` state for color panel |
| `src/components/dashboards/shared/DashboardGrid.tsx` | Added `initialLoadComplete` state to fix reload stacking bug |
| `src/components/dashboards/shared/DashboardChartCard.tsx` | Added palette button to open color picker for cards |
| `src/components/dashboards/shared/chartTheme.tsx` | Chart theming utilities |
| `src/components/dashboards/shared/index.ts` | Updated exports for new components |

### Chart Components (all got color customization)
| File | Change |
|------|--------|
| `src/components/dashboards/governance/charts/ProposalTypeChart.tsx` | Added clickable pie slices and legend for color customization |
| `src/components/dashboards/governance/charts/ProposalStatusChart.tsx` | Converted from BarChart to donut PieChart with table legend |
| `src/components/dashboards/governance/charts/ProposalSubmissionChart.tsx` | Made line clickable, removed dots, kept activeDot |
| `src/components/dashboards/governance/charts/NCLProgressChart.tsx` | Added progress bar color customization |
| `src/components/dashboards/governance/charts/ParticipationChart.tsx` | Added color customization support |
| `src/components/dashboards/governance/charts/VotingPowerChart.tsx` | Added color customization support |

### UI & Types
| File | Change |
|------|--------|
| `src/components/ui/progress.tsx` | Added `indicatorStyle` prop for custom bar colors |
| `src/types/dashboard.ts` | Added `ColorPickerTarget` type |
| `src/pages/dashboard.tsx` | Wrapped with `ChartColorsProvider` |
| `src/styles/globals.css` | Added selection glow animation for selected cards |

## Patterns Discovered

### Apply Style to All Pattern
For "apply to all" features that also support resetting to defaults:
```tsx
const applyStyleToAllCharts = useCallback((sourceChartId: string, allChartIds: string[]) => {
  setColors((prev) => {
    const sourceColors = prev[sourceChartId] || {};
    const cardBg = sourceColors["_cardBg"];
    const newColors = { ...prev };

    allChartIds.forEach((chartId) => {
      if (chartId === sourceChartId) return;
      const existing = { ...(newColors[chartId] || {}) };

      // Apply OR remove (for defaults)
      if (cardBg) {
        existing["_cardBg"] = cardBg;
      } else {
        delete existing["_cardBg"];
      }

      // Clean up empty entries
      if (Object.keys(existing).length > 0) {
        newColors[chartId] = existing;
      } else {
        delete newColors[chartId];
      }
    });
    return newColors;
  });
}, []);
```

### Chart Element Color Customization Pattern
All clickable chart elements follow the same pattern:
1. Add `useChartColors` and `useDashboard` hooks
2. Create a click handler that calls `setColorPickerTarget`
3. Use `getColor(CHART_ID, elementKey, defaultColor)` for the fill/stroke
4. Add `cursor: "pointer"` styling

```tsx
const handleElementClick = useCallback(() => {
  setColorPickerTarget({
    chartId: CHART_ID,
    chartTitle: "Chart Name",
    elementKey: "uniqueKey",
    elementLabel: "Display Label",
  });
}, [setColorPickerTarget]);

// In render
fill={getColor(CHART_ID, "uniqueKey", defaultColor)}
onClick={handleElementClick}
style={{ cursor: "pointer" }}
```

### Donut Chart Structure
Standard donut chart pattern with table legend:
```tsx
<div style={{ maxHeight: "55%" }}>
  <ResponsiveContainer>
    <PieChart>
      <Pie innerRadius="35%" outerRadius="70%" paddingAngle={3}>
        {data.map((entry) => (
          <Cell fill={getColor(...)} onClick={handleClick} />
        ))}
      </Pie>
    </PieChart>
  </ResponsiveContainer>
</div>
<div style={{ maxHeight: "45%" }}>
  <table>...</table>
</div>
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| z-[100] for side panel | Cards use z-1/10/50, so panel needs higher |
| 500ms delay for initialLoadComplete | Enough time for localStorage hydration |
| Delete key vs set empty for "reset to default" | Cleaner storage, component handles missing = default |
| Remove dots from line chart | Cleaner appearance, activeDot provides hover feedback |
| Use indicatorStyle prop | Cleaner than forcing className for dynamic colors |
| Keep activeDot with onClick | Allows color picker access even without permanent dots |
| Unique filter IDs per chart | Prevents SVG filter conflicts (e.g., `statusSliceShadow`) |

## Skills Evolved

Based on learnings from this session, the following skills were updated:

| Skill | Version | Changes |
|-------|---------|---------|
| add-chart | 1.4.0 → 1.5.0 | Added Chart Element Color Customization section with click-to-customize patterns, table legend structure, Progress component styling, Line chart activeDot configuration |
