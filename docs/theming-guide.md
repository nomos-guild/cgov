Theming & Modes Guide

Use this guide when modifying themes/modes so changes stay consistent and safe.

## Stack overview
- Tailwind + shadcn/Radix, CSS variables for tokens.
- Active theme is set on `<html data-theme="light"|"dark">` and optional `.dark` class for dark-mode helpers (theme ids remain `light` / `dark`; labels are Fancy / Nerd).
- Tokens live per theme in `src/themes/<theme>/tokens.css`; Tailwind maps them in `tailwind.config.ts` (`colors`, `borderRadius`, `fontFamily`, `boxShadow`, `transitionDuration`).
- Theme logic is in `src/lib/theme.tsx`; UI switcher is `src/components/ThemeToggle.tsx`; header mounts it (`src/components/layout/Header.tsx`).
- Themes are registered in `src/themes/index.ts`; per-theme component overrides live in `src/themes/<theme>/components.tsx`.

## Token contract (CSS custom properties)
- Required core vars per theme block: `--background`, `--surface`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--success`, `--success-foreground`, `--border`, `--input`, `--ring`, `--radius`.
- Optional but used: `--shadow-*` (soft/strong/card/popover), `--motion-*` (fast/normal/slow), `--font-sans`, `--font-heading`.
- Fancy (light) defaults live on `:root` in `src/themes/light/tokens.css` for initial paint; theme-specific overrides live under `[data-theme="<id>"]`.

## How themes are applied
- `ThemeProvider` sets `data-theme` on `document.documentElement`, toggles `.dark` when `isDark` is true, and writes `color-scheme`.
- Presets list is in `src/themes/index.ts` (currently Fancy → id `light`, Nerd → id `dark`). Adding a preset requires both CSS tokens and a registry entry.
- `ThemeToggle` renders a Select bound to the provider; options come from the registry.
- Optional per-theme React overrides are pulled from `components` in each theme definition and exposed via `useTheme().components`.

## Editing rules
1) **Adding a new theme**
   - Copy `src/themes/light/tokens.css` to `src/themes/<newId>/tokens.css`, change values, and ensure `:root` (for default) is present only if your theme is the new default.
   - Add `src/themes/<newId>/index.ts` exporting `{ id, label, isDark, components }` and optionally `components.tsx` for overrides.
   - Register it in `src/themes/index.ts` (`themes` array).
   - If you add new token names, ensure Tailwind mappings exist (edit `tailwind.config.ts`).
2) **Changing colors**
   - Edit only the relevant theme’s `tokens.css` block (and `:root` in light tokens if you want initial paint to match).
   - Use `hsl(var(--token))` format expected by Tailwind mappings.
3) **Shapes/motion/fonts**
   - Radii: `--radius` (Tailwind maps to `borderRadius.lg/md/sm`).
   - Shadows: adjust `--shadow-*` values.
   - Motion: `--motion-fast|normal|slow` tie to `transitionDuration`.
   - Fonts: set `--font-sans`, `--font-heading`; Tailwind maps to `fontFamily`.
4) **Per-theme React overrides**
   - Add components to `src/themes/<id>/components.tsx` (e.g., `HeaderBrand`).
   - Consume via `useTheme().components` with fallbacks to shared components.
5) **Do not remove required tokens**; components expect them.

## Common touchpoints for AI edits
- Tokens: `src/themes/*/tokens.css` (imported by `src/styles/globals.css`)
- Provider: `src/lib/theme.tsx`
- Switch UI: `src/components/ThemeToggle.tsx`
- Tailwind mapping: `tailwind.config.ts`
- Header injection / override example: `src/components/layout/Header.tsx`

## Testing checklist
- Switch between Fancy/Nerd via header select; verify background/foreground contrast and accent colors.
- Ensure `data-theme` updates and `.dark` toggles only for dark themes.
- Check components with Tailwind colors (buttons, cards, tables) for correct token usage.
- Run lint/type (not automated here) if code changes beyond CSS.
