# Journey: Dashboard Side Panel, Theming & Page Margins

**Date:** 2026-02-02
**Tags:** #feature #theming #ux #meta #layout

## Summary

Added UX improvements to the dashboard page (close button on charts, side panel for customization, draggable page margins) and created a theming skill to document the three-theme system after discovering that game theme was incorrectly styled like dark theme.

## What Was Done

1. **Added Close Button to Chart Cards**
   - Added `onHide` prop to `DashboardChartCard`
   - Users can hide charts directly from card (X button on hover)
   - Appears alongside drag handle

2. **Converted Customize Menu to Side Panel**
   - Replaced dropdown with slide-out panel from right
   - Features: backdrop, escape key, smooth animation, scroll lock
   - Same tabs: Charts, Elements, Share

3. **Fixed Game Theme Styling**
   - Initial panel used dark theme styling for game
   - Fixed to use proper game aesthetic (black bg, white text, neon green accents, sharp corners)

4. **Created Theming Skill**
   - Documents all three themes with color values
   - Provides common styling patterns with code examples
   - Includes checklist for theme implementation

5. **Created Journey Skill**
   - Skill for creating/updating session learning logs
   - Standardized template and guidelines

6. **Added Draggable Page Margins**
   - Created `DashboardMarginHandles` component for left/right margin adjustment
   - Vertical drag lines positioned relative to grid container (not full viewport)
   - Subtle visibility when not hovered (4-6% opacity), full on hover
   - Constraint system: min 24px, max 300px from screen edges
   - Persisted to localStorage with dashboard config
   - Added "Layout" tab to side panel with margin sliders

7. **Fixed Multi-Select Selection Box**
   - Moved selection box mousedown handler from container to document level
   - Now works when clicking outside the grid area (left/right margins)
   - Added `data-margin-handle` exclusion to prevent selection when dragging margins

8. **Added Card Position Constraints**
   - Cards automatically reposition when container width shrinks (margin increase)
   - Uses `useEffect` watching `containerWidth` to constrain cards/text elements

## Key Learnings

- **`isDark` is true for BOTH dark AND game**: Must check `isGame` first
- **Game theme is NOT dark theme**: Different colors, no rounded corners
- **Three-way pattern is essential**:
  ```typescript
  isGame ? "game" : isDark ? "dark" : "light"
  ```
- **Document-level handlers for multi-element selection**: Moving mousedown from container to document allows selection outside the grid bounds
- **Data attributes for exclusions**: Use `data-*` attributes (e.g., `data-margin-handle`) to exclude elements from selection logic via `target.closest()`
- **ResizeObserver for dynamic positioning**: Use to track container bounds for absolutely positioned elements
- **Constraint-based layouts**: Store min/max/step in a constants object for consistency across components

## Files Changed

| File | Change |
|------|--------|
| `DashboardChartCard.tsx` | Added `onHide` prop and close button |
| `DashboardGrid.tsx` | Document-level selection, card constraints on resize |
| `DashboardSidePanel.tsx` | New component with Charts, Elements, Layout, Share tabs |
| `DashboardMarginHandles.tsx` | **New** - Draggable margin handles component |
| `DashboardProvider.tsx` | Added `pageMargins` state and `updatePageMargins` |
| `dashboard.tsx` | Full-width layout with dynamic padding, gridAreaRef |
| `types/dashboard.ts` | Added `PageMargins`, constraints, context types |
| `shared/index.ts` | Export `DashboardMarginHandles` |
| `.claude/skills/theming/` | New skill for theme documentation |
| `.claude/skills/journey/` | New skill for session journeys |

## Patterns Discovered

### Theme Color Reference
| Theme | Background | Text | Accent | Corners |
|-------|-----------|------|--------|---------|
| Light | white | gray/black | black | rounded |
| Dark | `#1a1a2e` | `#0bd1a2` | cyan | rounded |
| Game | black | white | `#00ff66` | sharp |

### Three-Way Theme Conditional
```tsx
className={cn(
  "base",
  isGame
    ? "game-classes"
    : isDark
      ? "dark-classes"
      : "light-classes"
)}
```

### Draggable Handle Pattern
```tsx
// Track drag state
const [isDragging, setIsDragging] = useState(false);
const dragStartX = useRef(0);
const dragStartValue = useRef(0);

// Mouse down on handle
const handleMouseDown = (e: React.MouseEvent) => {
  e.preventDefault();
  setIsDragging(true);
  dragStartX.current = e.clientX;
  dragStartValue.current = currentValue;
};

// Document-level move/up during drag
useEffect(() => {
  if (!isDragging) return;

  const handleMouseMove = (e: MouseEvent) => {
    const delta = e.clientX - dragStartX.current;
    const newValue = clamp(dragStartValue.current + delta, min, max);
    updateValue(newValue);
  };

  const handleMouseUp = () => setIsDragging(false);

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.body.style.cursor = "ew-resize";

  return () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
  };
}, [isDragging]);
```

### Selection Exclusion Pattern
```tsx
// In document mousedown handler
const target = e.target as HTMLElement;
if (target.closest("[data-chart-card], [data-text-element], [data-margin-handle], button")) {
  return; // Don't start selection
}
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Side panel over dropdown | Better UX, more room for content |
| Create theming skill | Prevent future sessions from repeating game/dark confusion |
| Keep old dropdown component | Might be useful elsewhere, no harm |
| Margins relative to grid, not viewport | Keeps handles contextually positioned, less visual clutter |
| Very subtle default opacity (4-6%) | Discoverable but not distracting |
| Min 24px, max 300px margin | Prevents losing handles at edges, ensures usable content area |
| Default margins at 200px | Approximates centered container layout users are familiar with |
| Document-level selection handler | Enables selection clicks outside grid bounds |

## Skills Evolved

Based on learnings from this session, the following skills were updated:

| Skill | Version | Changes |
|-------|---------|---------|
| add-dashboard | 1.0.0 → 2.0.0 | Major update: side panel, text elements, page margins, multi-select, data attributes |
| add-chart | 1.2.0 → 1.3.0 | Added `data-chart-card` attribute docs, DashboardChartCard props table |
| theming | 1.0.0 → 1.1.0 | Added draggable handle styling, tooltip styling, subtle visibility pattern |
| wrap-up | — → 1.0.0 | **New skill**: Automates session wrap-up workflow (journey → evolve skills → update journey) |

## Connected To

- `add-chart` skill (should reference theming skill)
- `DashboardSidePanel.tsx` as canonical three-theme example
- `DashboardMarginHandles.tsx` as draggable handle pattern reference
- `wrap-up` skill for end-of-session automation
- Future UI work should consult theming skill
- Any draggable/resizable elements should follow the drag pattern here
