# Theming Skill Changelog

## [1.1.0] - 2026-02-02

### Added
- Draggable Handle Styling pattern with `handleColor` and `handleColorMuted` examples
- Tooltip/Popup Styling pattern for value tooltips
- Subtle Visibility Pattern with opacity values for all three themes

### Journey-driven
Based on dashboard-side-panel-and-theming journey learnings about margin handle theming.

---

## [1.0.0] - 2026-02-02

### Initial Release
- Created theming skill to document three-theme system (light, dark, game)
- Added color reference for all themes
- Added common styling patterns with code examples
- Added checklist for theme implementation
- Key insight: Game theme must be checked BEFORE isDark since both return true for `activeTheme.isDark`

### Why This Skill Exists
This skill was created after a bug where the game theme was being styled identically to the dark theme in the `DashboardSidePanel` component. The game theme has a distinct retro/pixel aesthetic with:
- Pure black background (not dark blue)
- White text (not cyan)
- Neon green accents (not cyan)
- Sharp corners (not rounded)

This skill ensures future sessions don't repeat this mistake.
