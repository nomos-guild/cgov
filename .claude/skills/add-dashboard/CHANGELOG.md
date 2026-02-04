# add-dashboard Changelog

All notable changes to this skill will be documented in this file.

## [2.1.0] - 2026-02-04

### Graceful Degradation for Error States

Journey-driven: locale-persistence-and-drep-resilience

#### Changed
- Page template error handling: replaced full-page blocking error card with inline warning
- Dashboard grid now renders even when some data endpoints fail (`(hasData || (!isLoading && error))`)

#### Added
- **Gotchas: Graceful Degradation** section with anti-patterns and correct patterns
- Verification checklist item: "Page degrades gracefully when backend endpoints fail"

#### Why
- DRep Dashboard was completely broken when the backend stats endpoint failed, even though the DRep list (separate endpoint) still worked
- Full-page error cards should only be used when NO content can be shown
- Individual sections should handle their own errors independently

## [2.0.0] - 2026-02-02

### Major Update - Full Feature Parity with Governance Dashboard

Based on journey learnings from dashboard-side-panel-and-theming session.

#### Added
- **Side Panel**: Replaced `ChartVisibilityDropdown` with full `DashboardSidePanel` component
  - 4 tabs: Charts, Elements, Layout, Share
  - Drag-to-reorder charts
  - Export/import config as base64
- **Text Elements**: Support for user-addable text labels
  - `textElements` array in config
  - `DashboardTextElement` component
  - Add/edit/remove via Elements tab
- **Page Margins**: Draggable margin handles for width control
  - `pageMargins` in config with left/right values
  - `DashboardMarginHandles` component
  - Slider controls in Layout tab
  - Constraints: min 24px, max 300px
- **Multi-Select**: Box selection and Ctrl+click
  - Document-level mouse handlers
  - `data-*` attributes for exclusion
- **Card Position Constraints**: Auto-reposition when margins change

#### Changed
- Page layout uses dynamic padding instead of fixed container
- Provider includes `updatePageMargins`, `addTextElement`, `updateTextElement`, `removeTextElement`
- Types include `TextElement`, `PageMargins` from shared dashboard types

#### Documentation
- Added Data Attributes Reference section
- Updated architecture diagram with all shared components
- Added document-level event handler patterns
- Updated verification checklist (10 items vs 6)

## [1.0.0] - 2026-02-02

### Initial Release
- Complete dashboard module scaffolding
- Chart registry creation
- Dashboard-specific types and config
- Provider with localStorage persistence
- Grid component for drag/resize
- Page component with loading/error states
- Barrel exports for clean imports
