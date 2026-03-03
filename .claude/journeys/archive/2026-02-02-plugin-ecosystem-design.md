# Journey: Plugin Ecosystem Design

**Date:** 2026-02-02
**Tags:** #architecture #community #plugins #ideation

## Summary

Designed a comprehensive plugin/modding ecosystem for cgov that would allow community developers to extend the application with custom charts, themes, and data sources. The system uses GitHub-based distribution with a trust model for security.

## What Was Done

1. **Explored Current Architecture**
   - Analyzed dashboard system (DashboardProvider, chart registries, lazy loading)
   - Reviewed theme system (extensible ThemeId, map-based lookup)
   - Examined state management (Redux + SWR hybrid, localStorage persistence)
   - Identified existing extension points

2. **Gathered Requirements via User Questions**
   - Distribution: GitHub-based (not central registry)
   - Capabilities: Full access (charts, themes, data sources)
   - Security: Trust model with community allowlist
   - Sharing: Config export includes plugin dependencies

3. **Designed Plugin Architecture**
   - Plugin manifest format (`plugin.json`)
   - ESM loading via jsDelivr CDN from GitHub repos
   - Plugin registry merging with built-in charts/themes
   - Trust verification via community-curated allowlist

4. **Created Implementation Plan**
   - 4 phases: Core → Trust → Integration → Polish
   - Detailed file structure for new components
   - Plugin SDK API design
   - Developer documentation outline

## Key Learnings

- **Current architecture is extensible**: The registry pattern, lazy loading, and localStorage persistence provide a solid foundation for plugins
- **jsDelivr CDN serves GitHub repos**: Can load ESM modules directly from GitHub repos via `cdn.jsdelivr.net/gh/{user}/{repo}@{version}/{file}`
- **Dynamic imports work for external URLs**: `import(/* webpackIgnore: true */ url)` can load modules from CDN
- **Plugin chart IDs need namespacing**: Pattern `plugin:{pluginId}:{chartId}` prevents collisions

## Architecture Patterns

### Plugin Distribution Flow
```
Developer: GitHub repo with plugin.json + dist/
     ↓
User: Installs via GitHub URL
     ↓
cgov: Fetches manifest → checks trust → loads ESM from jsDelivr
     ↓
Registry: Merges plugin charts/themes with built-in
     ↓
Dashboard: Shows plugin charts alongside built-in
```

### Trust Model
```
Community-curated allowlist (GitHub JSON file)
     ↓
On install: Check if plugin ID + version is verified
     ↓
Trusted: Auto-enable
Untrusted: Show warning, require explicit enable
```

### Plugin SDK Pattern
```typescript
// Plugins access cgov APIs via global SDK
const sdk = window.cgovPluginSDK;
const actions = sdk.selectors.getGovernanceActions(sdk.store.getState());
const { BarChart } = sdk.charts;
const { Card } = sdk.ui;
```

## Files Created

| File | Purpose |
|------|---------|
| `docs/ideas/plugin-ecosystem.md` | Comprehensive implementation plan |

## Open Questions

1. **Allowlist hosting**: Main cgov repo or separate `plugin-allowlist` repo?
2. **Plugin template**: CLI tool (`create-cgov-plugin`) or template repo?
3. **Plugin settings**: Own settings UI within plugins page?
4. **Review process**: How formal should verification be?

## Connected To

- Dashboard system (`DashboardProvider`, `DashboardGrid`, chart registries)
- Theme system (`theme.tsx`, `themes/index.ts`)
- Future: Community contributions and ecosystem growth

## Next Steps (When Implemented)

1. Create types in `src/types/plugins.ts`
2. Build PluginLoader with jsDelivr CDN integration
3. Create PluginRegistry to merge with built-in registries
4. Add PluginProvider context
5. Build plugins management page UI
6. Implement trust verification system
7. Create plugin developer documentation
