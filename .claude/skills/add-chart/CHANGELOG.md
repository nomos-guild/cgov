# add-chart Changelog

All notable changes to this skill will be documented in this file.

## [1.6.0] - 2026-02-03

### Added
- **Light Theme Donut Chart Pattern** - New section documenting white/grey graduated colors for light theme
- SVG feDropShadow filter pattern for applying shadows to white chart slices
- Color pattern reference: positive (#ffffff), neutral (#e2e8f0), negative (#94a3b8)
- **Custom Legend with Square Indicators** - Pattern for pure square legend items with borders for white colors

### Journey-driven
Based on drep-profile-charts journey. Key patterns:
- White primary slices with graduated greys for negative metrics
- SVG filter approach for shadows (more reliable than CSS on SVG)
- Legend squares instead of circles for cleaner aesthetic

---

## [1.5.0] - 2026-02-02

### Added
- **Chart Element Color Customization** - New section documenting how to make chart elements clickable for color picker
- Required imports for `useChartColors` and `useDashboard`
- Setup pattern for `setColorPickerTarget` and `getColor`
- Pie/donut chart clickable Cell examples
- Table legend with clickable color swatches pattern
- Progress bar color customization pattern
- Line chart click handler configuration
- `activeDot` with onClick for line charts

### Changed
- Line/Area chart section updated with `dot={false}` and `activeDot` patterns
- Verification checklist expanded with color customization checks

### Journey-driven
Based on chart-color-customization journey. Key patterns:
- Click-to-customize pattern for all chart element types
- Donut chart with table legend structure (55%/45% split)
- Progress component indicatorStyle for custom colors

---

## [1.4.0] - 2026-02-02

### Fixed
- **Tooltip styling section completely rewritten** - Removed unreliable `contentStyle` prop approach
- Now uses `ChartTooltip` custom component which actually works

### Added
- Import for `ChartTooltip` in component template
- Examples showing `valueFormatter` and `labelFormatter` props
- Note explaining what ChartTooltip provides per theme

### Journey-driven
Based on dashboard-polish-and-tooltip-fix journey. Key learning: Recharts `contentStyle` prop doesn't reliably apply styles (especially background colors). Custom content components are the only reliable approach.

---

## [1.3.0] - 2026-02-02

### Added
- DashboardChartCard Props table documenting `isSelected`, `onHide`, `onSelect`, `onDragStart`
- Data Attributes section explaining `data-chart-card` for selection exclusion
- Hide button (X icon) mention in wrapper diagram

### Documentation
- Code example now shows `data-chart-card` attribute on wrapper
- Explains relationship between data attributes and selection system

### Journey-driven
Based on dashboard-side-panel-and-theming journey learnings about selection exclusion patterns.

---

## [1.2.0] - 2026-02-02

### Fixed
- Light theme code example now shows `border-none bg-white` instead of grey border
- Updated Theme System table to clarify light theme has pure white cards

### Added
- Key principle: "Light theme cards: pure white, NO borders, shadow only"

### Feedback-driven
Based on 2 feedback entries. Key pattern addressed:
- Light theme cards had grey borders when they should be pure white with shadow only

---

## [1.1.0] - 2026-02-02

### Fixed
- DashboardChartCard code example now shows correct 3-way theme check
- Game theme cards now correctly show `border-none` instead of cyan border

### Added
- Key principle note: "Game theme cards have NO colored borders"
- Verification checklist item: "Verify game theme has NO colored borders on cards"

### Feedback-driven
Based on 1 feedback entry. Key pattern addressed:
- Game theme incorrectly inherited dark theme's cyan borders

---

## [1.0.0] - 2026-02-02

### Initial Release
- Comprehensive chart scaffolding with theme integration
- Support for bar, pie, line, and area chart types
- Full theming guide for light/dark/game themes
- Chart registry and type definitions integration
- Dashboard integration documentation
- Verification checklist
