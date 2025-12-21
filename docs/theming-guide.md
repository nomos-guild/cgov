# AI Editing Guide: Theming & Modes

Use this guide when modifying themes/modes so changes stay consistent and safe.

## Stack overview
- Tailwind + shadcn/Radix, CSS variables for tokens.
- Active theme is set on `<html data-theme="light"|"dark">` and optional `.dark` class for dark-mode helpers.
- Tokens live in `src/styles/globals.css`; Tailwind maps them in `tailwind.config.ts` (`colors`, `borderRadius`, `fontFamily`, `boxShadow`, `transitionDuration`).
- Theme logic is in `src/lib/theme.tsx`; UI switcher is `src/components/ThemeToggle.tsx`; header mounts it (`src/components/layout/Header.tsx`).

## Token contract (CSS custom properties)
- Required core vars per theme block: `--background`, `--surface`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--success`, `--success-foreground`, `--border`, `--input`, `--ring`, `--radius`.
- Optional but used: `--shadow-*` (soft/strong/card/popover), `--motion-*` (fast/normal/slow), `--font-sans`, `--font-heading`.
- Default tokens are duplicated on `:root` for initial paint; theme-specific overrides live under `[data-theme="<id>"]`.

## How themes are applied
- `ThemeProvider` sets `data-theme` on `document.documentElement`, toggles `.dark` when `isDark` is true, and writes `color-scheme`.
- Presets list is in `THEME_PRESETS` (currently `light`, `dark`). Adding a preset requires both CSS tokens and a preset entry.
- `ThemeToggle` renders a Select bound to the provider; options come from `THEME_PRESETS`.

## Editing rules
1) **Adding a new theme**
   - Add a `[data-theme="newId"]` block in `globals.css` with the full token set.
   - Add `{ id: "newId", label: "Readable", isDark: true|false }` to `THEME_PRESETS` in `theme.tsx`.
   - If you add new token names, ensure Tailwind mappings exist (edit `tailwind.config.ts`).
2) **Changing colors**
   - Edit only the relevant `[data-theme="..."]` block (and `:root` if you want initial paint to match).
   - Use `hsl(var(--token))` format expected by Tailwind mappings.
3) **Shapes/motion/fonts**
   - Radii: `--radius` (Tailwind maps to `borderRadius.lg/md/sm`).
   - Shadows: adjust `--shadow-*` values.
   - Motion: `--motion-fast|normal|slow` tie to `transitionDuration`.
   - Fonts: set `--font-sans`, `--font-heading`; Tailwind maps to `fontFamily`.
4) **Do not remove required tokens**; components expect them.

## Common touchpoints for AI edits
- Tokens: `src/styles/globals.css`
- Provider: `src/lib/theme.tsx`
- Switch UI: `src/components/ThemeToggle.tsx`
- Tailwind mapping: `tailwind.config.ts`
- Header injection: `src/components/layout/Header.tsx`

## Testing checklist
- Switch between Light/Dark via header select; verify background/foreground contrast and accent colors.
- Ensure `data-theme` updates and `.dark` toggles only for dark themes.
- Check components with Tailwind colors (buttons, cards, tables) for correct token usage.
- Run lint/type (not automated here) if code changes beyond CSS.
