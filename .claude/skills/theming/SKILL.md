---
version: 1.1.0
created: 2026-02-02
last-evolved: 2026-02-02
evolution-count: 1
feedback-count: 0
---

# Theming & Styling Skill

Guidelines for implementing consistent theming across the three visual themes in this project.

## Theme Overview

This project has **three distinct themes** that must be handled separately:

| Theme | Background | Primary Text | Accent Color | Border Style | Corner Style |
|-------|-----------|--------------|--------------|--------------|--------------|
| **Light** | White/Beige (`#faf9f6`) | Gray/Black | Black | Gray borders | Rounded (`rounded-lg`, `rounded-xl`) |
| **Dark** | Dark blue (`#1a1a2e`, `#131320`) | Cyan (`#0bd1a2`) | Cyan (`#0bd1a2`) | Cyan borders | Rounded (`rounded-lg`, `rounded-xl`) |
| **Game** | Pure black (`#080808`, `bg-black`) | White | Neon green (`#00ff66`) | White/gray borders | Sharp (`rounded-none`, `rounded-sm`) |

## Critical Rule

**NEVER treat dark and game themes as the same.** They have completely different visual languages:

- **Dark theme**: Cyan/teal color scheme, professional look
- **Game theme**: Retro/pixel aesthetic, white + neon green, sharp corners

## Detecting Themes

```typescript
import { useTheme } from "@/lib/theme";

const { activeTheme } = useTheme();
const isDark = activeTheme.isDark;      // true for both dark AND game
const isGame = activeTheme.id === "game"; // true ONLY for game

// CORRECT: Check isGame first, then isDark
if (isGame) {
  // Game-specific styling
} else if (isDark) {
  // Dark theme styling
} else {
  // Light theme styling
}
```

## Color Reference

### Light Theme
```
Background:     #faf9f6, bg-white, bg-gray-50
Text Primary:   #2d2926, text-gray-900
Text Secondary: #6b6259, text-gray-500, text-gray-600
Accent:         #000000, bg-black, text-black
Borders:        border-gray-200, border-gray-300
Hover:          hover:bg-gray-50, hover:bg-gray-100
```

### Dark Theme
```
Background:     #1a1a2e, #131320, bg-[#1a1a2e]
Text Primary:   #0bd1a2, text-[#0bd1a2]
Text Secondary: text-[#0bd1a2]/70, text-[#0bd1a2]/50
Accent:         #0bd1a2, bg-[#0bd1a2]
Borders:        border-[#0bd1a2], border-[#0bd1a2]/30
Hover:          hover:bg-[#0bd1a2]/10, hover:bg-[#0bd1a2]/20
```

### Game Theme
```
Background:     #080808, bg-black
Text Primary:   #ffffff, text-white
Text Secondary: text-white/70, text-white/50, text-white/60
Accent:         #00ff66 (neon green)
Borders:        border-white/20, border-white/30
Hover:          hover:bg-white/5, hover:bg-white/10
Active/Success: bg-[#00ff66], text-[#00ff66]
```

## Common Patterns

### Three-Way Theme Conditional (Recommended)

```tsx
className={cn(
  "base-classes",
  isGame
    ? "game-specific-classes"
    : isDark
      ? "dark-specific-classes"
      : "light-specific-classes"
)}
```

### Button Styling

```tsx
// Primary button
className={cn(
  "px-3 py-2 text-sm transition-colors",
  isGame
    ? "rounded-none bg-[#00ff66] text-black hover:bg-[#00ff66]/90"
    : isDark
      ? "rounded-md bg-[#0bd1a2] text-black hover:bg-[#0bd1a2]/90"
      : "rounded-md bg-black text-white hover:bg-black/90"
)}

// Secondary/outline button
className={cn(
  "px-3 py-2 text-sm border transition-colors",
  isGame
    ? "rounded-none border-white/30 text-white bg-black hover:bg-white/10"
    : isDark
      ? "rounded-lg border-[#0bd1a2] text-[#0bd1a2] hover:bg-[#0bd1a2]/10"
      : "rounded-lg border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
)}
```

### Card/Panel Styling

```tsx
className={cn(
  "p-4",
  isGame
    ? "bg-black border border-white/20"
    : isDark
      ? "bg-[#1a1a2e] border border-[#0bd1a2]/30 rounded-lg"
      : "bg-white border border-gray-200 rounded-lg shadow-sm"
)}
```

### Input Styling

```tsx
className={cn(
  "w-full px-3 py-2 text-sm",
  isGame
    ? "rounded-none bg-white/5 border border-white/20 text-white placeholder-white/30"
    : isDark
      ? "rounded-md bg-black/30 border border-[#0bd1a2]/50 text-[#0bd1a2] placeholder-[#0bd1a2]/40"
      : "rounded-md bg-gray-100 border border-gray-200 text-gray-700 placeholder-gray-400"
)}
```

### Tab/Navigation Styling

```tsx
// Active tab
className={cn(
  "px-4 py-2 text-sm font-medium border-b-2",
  isGame
    ? "text-[#00ff66] border-[#00ff66]"
    : isDark
      ? "text-[#0bd1a2] border-[#0bd1a2]"
      : "text-gray-900 border-black"
)}

// Inactive tab
className={cn(
  "px-4 py-2 text-sm font-medium",
  isGame
    ? "text-white/50 hover:text-white"
    : isDark
      ? "text-[#0bd1a2]/50 hover:text-[#0bd1a2]"
      : "text-gray-500 hover:text-gray-700"
)}
```

### Checkbox Styling

```tsx
// Checked state
className={cn(
  "w-5 h-5 border flex items-center justify-center",
  isGame ? "rounded-none" : "rounded",
  isVisible
    ? isGame
      ? "bg-[#00ff66] border-[#00ff66]"
      : isDark
        ? "bg-[#0bd1a2] border-[#0bd1a2]"
        : "bg-black border-black"
    : isGame
      ? "border-white/40 hover:border-[#00ff66]"
      : isDark
        ? "border-[#0bd1a2]/50 hover:border-[#0bd1a2]"
        : "border-gray-300 hover:border-gray-400"
)}

// Check icon color
<Check className={cn(
  "h-3 w-3",
  isGame ? "text-black" : isDark ? "text-black" : "text-white"
)} />
```

### Divider/Border Styling

```tsx
className={cn(
  "border-t",
  isGame
    ? "border-white/20"
    : isDark
      ? "border-[#0bd1a2]/30"
      : "border-gray-200"
)}
```

### Overlay/Backdrop Styling

```tsx
className={cn(
  "fixed inset-0 z-40 transition-opacity",
  isGame ? "bg-black/80" : "bg-black/50"
)}
```

### Draggable Handle Styling

For interactive handles (like margin handles, resize handles):

```tsx
// Handle colors - visible state
const handleColor = isGame ? "#00ff66" : isDark ? "#0bd1a2" : "#000000";

// Handle colors - subtle/muted state (4-6% opacity)
const handleColorMuted = isGame
  ? "rgba(0, 255, 102, 0.06)"
  : isDark
    ? "rgba(11, 209, 162, 0.06)"
    : "rgba(0, 0, 0, 0.04)";

// Usage: Show muted by default, full on hover
style={{
  backgroundColor: isHovered ? handleColor : handleColorMuted,
}}
```

### Tooltip/Popup Styling

For value tooltips that appear on hover:

```tsx
className={cn(
  "px-2 py-1 text-xs font-mono rounded whitespace-nowrap",
  isGame
    ? "bg-black border border-[#00ff66] text-[#00ff66]"
    : isDark
      ? "bg-[#1a1a2e] border border-[#0bd1a2] text-[#0bd1a2]"
      : "bg-white border border-gray-300 text-gray-700 shadow-sm"
)}
```

### Subtle Visibility Pattern

For elements that should be discoverable but not distracting:

```
Light: 4% opacity (rgba(0, 0, 0, 0.04))
Dark:  6% opacity (rgba(11, 209, 162, 0.06))
Game:  6% opacity (rgba(0, 255, 102, 0.06))
```

On hover, transition to full opacity for clear visibility.

## Chart Colors

Use the centralized chart theme from `@/components/dashboards/shared/chartTheme`:

```typescript
import { getChartColors } from "@/components/dashboards/shared/chartTheme";

const colors = getChartColors(activeTheme.id);
// colors.primary, colors.yes, colors.no, etc.
```

## Files to Reference

- `src/lib/theme.tsx` - Theme provider and hook
- `src/components/dashboards/shared/chartTheme.ts` - Chart color definitions
- `src/components/dashboards/shared/DashboardSidePanel.tsx` - Full three-theme example
- `src/components/dashboards/shared/DashboardChartCard.tsx` - Card controls example
- `src/components/GovernanceTable.tsx` - Complex three-theme component

## Checklist When Styling

- [ ] Did I check for `isGame` BEFORE `isDark`?
- [ ] Game theme: Using white text, not cyan?
- [ ] Game theme: Using `#00ff66` for accents, not `#0bd1a2`?
- [ ] Game theme: Using sharp corners (`rounded-none` or `rounded-sm`)?
- [ ] Game theme: Using `bg-black` or similar dark background?
- [ ] Dark theme: Using cyan (`#0bd1a2`) for text and accents?
- [ ] Light theme: Using appropriate grays and blacks?
