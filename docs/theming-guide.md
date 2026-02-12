# Theming & Modes Guide

Use this guide when modifying themes/modes so changes stay consistent and safe.

## Stack Overview

- Tailwind + shadcn/Radix, CSS variables for tokens
- Active theme is set on `<html data-theme="light"|"dark"|"game">` and `.dark` class for dark-mode helpers
- Tokens live per theme in `src/themes/<theme>/tokens.css`; Tailwind maps them in `tailwind.config.ts` (`colors`, `borderRadius`, `fontFamily`, `boxShadow`, `transitionDuration`)
- Theme logic is in `src/lib/theme.tsx`; UI switcher is `src/components/ThemeToggle.tsx`; header mounts it (`src/components/layout/Header.tsx`)
- Themes are registered in `src/themes/index.ts`; per-theme component overrides live in `src/themes/<theme>/components.tsx`

## Registered Themes

| ID | Label | isDark | Notes |
|----|-------|:------:|-------|
| `light` | Fancy | no | Default theme. `:root` values in `light/tokens.css` |
| `dark` | Nerd | yes | Toggles `.dark` class on `<html>` |
| `game` | Game | yes | Pixel-art aesthetic, custom nav buttons, NerdFont |

## Token Contract (CSS Custom Properties)

Required core vars per theme block:
- **Colors:** `--background`, `--surface`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--success`, `--success-foreground`, `--border`, `--input`, `--ring`
- **Layout:** `--radius`
- **Optional:** `--shadow-*` (soft/strong/card/popover), `--motion-*` (fast/normal/slow), `--font-sans`, `--font-heading`

Fancy (light) defaults live on `:root` in `src/themes/light/tokens.css` for initial paint; theme-specific overrides live under `[data-theme="<id>"]`.

## Theme File Structure

```
src/themes/
├── index.ts              # Theme registry (themes array, getThemeDefinition, getNextThemeId)
├── types.ts              # ThemeId, ThemeDefinition, ThemeComponents types
├── light/
│   ├── index.ts          # { id: "light", label: "Fancy", isDark: false }
│   ├── tokens.css        # CSS custom properties (:root + [data-theme="light"])
│   └── components.tsx    # Per-theme React overrides (e.g., HeaderBrand)
├── dark/
│   ├── index.ts          # { id: "dark", label: "Nerd", isDark: true }
│   ├── tokens.css        # CSS custom properties ([data-theme="dark"])
│   └── components.tsx    # Per-theme React overrides
└── game/
    ├── index.ts          # { id: "game", label: "Game", isDark: true, components }
    ├── tokens.css        # CSS custom properties ([data-theme="game"])
    └── components.tsx    # Game-specific components (pixel-art header, etc.)
```

## How Themes Are Applied

1. `ThemeProvider` sets `data-theme` on `document.documentElement`, toggles `.dark` when `isDark` is true, and writes `color-scheme`
2. Presets list is in `src/themes/index.ts` (Light/Dark/Game). Adding a preset requires both CSS tokens and a registry entry
3. `ThemeToggle` renders a Select bound to the provider; options come from the registry
4. Per-theme React overrides are pulled from `components` in each theme definition and exposed via `useTheme().components`

## CSS Specificity Notes (Game Theme)

The game theme uses CSS selectors like `[data-theme="game"] .game-nav-btn` which beat any Tailwind utility due to higher specificity:

- Cannot override `height: 40px` from game CSS with Tailwind `h-8` — create variant class instead (e.g., `game-nav-btn-sm` at 28px)
- `w-full` in Tailwind competes with `w-[120px]` — remove `w-full` and let caller control
- Tab styling: `data-state` attributes enable both Tailwind `data-[state=active]:` and game CSS selectors

## Editing Rules

### Adding a New Theme

1. Create `src/themes/<newId>/tokens.css` — copy from light and change values
2. Create `src/themes/<newId>/index.ts` exporting `{ id, label, isDark, components? }`
3. Optionally add `components.tsx` for per-theme React overrides
4. Register in `src/themes/index.ts` (import + add to `themes` array)
5. If you add new token names, ensure Tailwind mappings exist in `tailwind.config.ts`

### Changing Colors

Edit only the relevant theme's `tokens.css` block (and `:root` in light tokens if you want initial paint to match). Use `hsl(var(--token))` format expected by Tailwind mappings.

### Shapes/Motion/Fonts

- Radii: `--radius` (Tailwind maps to `borderRadius.lg/md/sm`)
- Shadows: `--shadow-*` values
- Motion: `--motion-fast|normal|slow` tie to `transitionDuration`
- Fonts: `--font-sans`, `--font-heading` → Tailwind `fontFamily`

### Per-Theme React Overrides

Add components to `src/themes/<id>/components.tsx` (e.g., `HeaderBrand`). Consume via `useTheme().components` with fallbacks to shared components.

### Do NOT Remove Required Tokens

Components expect all core tokens to be present. Missing tokens will break styling.

## Common Touchpoints for Edits

| What | File |
|------|------|
| Tokens | `src/themes/*/tokens.css` (imported by `src/styles/globals.css`) |
| Provider | `src/lib/theme.tsx` |
| Switch UI | `src/components/ThemeToggle.tsx` |
| Tailwind mapping | `tailwind.config.ts` |
| Theme registry | `src/themes/index.ts` |
| Per-theme overrides | `src/themes/*/components.tsx` |
| Header integration | `src/components/layout/Header.tsx` |

## Testing Checklist

- Switch between all three themes (Fancy/Nerd/Game) via header select
- Verify `data-theme` updates and `.dark` toggles only for dark themes
- Check components with Tailwind colors (buttons, cards, tables) for correct token usage
- Verify game theme pixel-art elements render correctly
- Check chart color customization works across all themes
- Run build to catch any TypeScript errors
