# Plugin/Modding Ecosystem Implementation Plan

## Overview

Build a community plugin/modding system for cgov that allows developers to create and share:
1. **Custom Charts** - New visualizations for governance data
2. **Themes** - Custom color schemes and styling
3. **Data Sources** - Connect to alternative APIs (Koios, Blockfrost, etc.)
4. **Dashboard Presets** - Pre-configured layouts to share

Users can browse, install, and enable plugins directly in their browser when using cgov.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Distribution** | GitHub-based | Developers host on their repos, loaded via jsDelivr CDN |
| **Security** | Trust model | Community-curated allowlist for verified plugins |
| **Capabilities** | Full access | Charts, themes, data sources, API access |
| **Sharing** | Shareable configs | Export/import includes plugin dependencies |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Plugin Ecosystem                      │
├─────────────────────────────────────────────────────────┤
│  User Flow: Install → Enable → Use                      │
│              ↓         ↓        ↓                       │
│  ┌─────────┐ ┌────────┐ ┌──────────┐                   │
│  │ Plugin  │ │ Trust  │ │ Plugin   │                   │
│  │ Manager │→│ Check  │→│ Loader   │                   │
│  └─────────┘ └────────┘ └──────────┘                   │
│         ↓                    ↓                          │
│  ┌─────────────────┐  ┌─────────────┐                   │
│  │ localStorage    │  │ jsDelivr    │                   │
│  │ (plugin list)   │  │ CDN (ESM)   │                   │
│  └─────────────────┘  └─────────────┘                   │
│                            ↓                            │
│  ┌──────────────────────────────────────────┐           │
│  │           Plugin Registry                 │           │
│  │  ┌────────┐ ┌────────┐ ┌─────────────┐   │           │
│  │  │ Charts │ │ Themes │ │ DataSources │   │           │
│  │  └────────┘ └────────┘ └─────────────┘   │           │
│  └──────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
```

---

## Plugin Manifest Format

Each plugin repository must contain a `plugin.json` at the root:

```json
{
  "id": "cardano-community/analytics-charts",
  "name": "Advanced Analytics",
  "version": "1.0.0",
  "description": "Whale tracking and voting heatmaps for governance analysis",
  "author": {
    "name": "Cardano Community",
    "github": "cardano-community"
  },
  "repository": "cardano-community/cgov-analytics",
  "license": "MIT",
  "minAppVersion": "1.0.0",
  "capabilities": {
    "charts": [
      {
        "id": "whale-tracker",
        "title": "Whale Tracker",
        "description": "Track large DRep voting patterns",
        "export": "WhaleTrackerChart",
        "icon": "Fish",
        "defaultLayout": { "x": 0, "y": 0, "width": 580, "height": 400 },
        "defaultVisible": true
      },
      {
        "id": "voting-heatmap",
        "title": "Voting Heatmap",
        "description": "Time-based voting activity visualization",
        "export": "VotingHeatmapChart",
        "icon": "Grid3X3",
        "defaultLayout": { "x": 0, "y": 420, "width": 780, "height": 320 }
      }
    ],
    "themes": [
      {
        "id": "cyberpunk",
        "label": "Cyberpunk",
        "isDark": true,
        "export": "cyberpunkTheme",
        "cssFile": "./themes/cyberpunk.css"
      }
    ]
  },
  "main": "./dist/index.js",
  "styles": "./dist/styles.css"
}
```

### TypeScript Definitions

```typescript
// src/types/plugins.ts

interface PluginManifest {
  // Metadata
  id: string;                    // "publisher/plugin-name"
  name: string;                  // Display name
  version: string;               // SemVer
  description: string;
  author: {
    name: string;
    github: string;
    url?: string;
  };
  repository: string;            // GitHub repo path
  license: string;               // SPDX identifier
  minAppVersion?: string;        // Minimum cgov version

  // Capabilities
  capabilities: {
    charts?: PluginChartCapability[];
    themes?: PluginThemeCapability[];
    dataSources?: PluginDataSourceCapability[];
  };

  // Entry points
  main: string;                  // ESM entry: "./dist/index.js"
  styles?: string;               // Optional CSS
}

interface PluginChartCapability {
  id: string;                    // Unique within plugin
  title: string;
  description: string;
  export: string;                // Named export in main
  icon?: string;                 // Lucide icon name
  defaultLayout: ChartLayout;
  defaultVisible?: boolean;
}

interface PluginThemeCapability {
  id: string;
  label: string;
  isDark: boolean;
  export: string;
  cssFile?: string;
}

interface PluginDataSourceCapability {
  id: string;
  name: string;
  description: string;
  export: string;
  provides: string[];            // Data types it provides
}
```

---

## Phase 1: Core Infrastructure (MVP)

### 1.1 Type Definitions

**New File: `src/types/plugins.ts`**
- PluginManifest interface
- PluginChartCapability, PluginThemeCapability interfaces
- InstalledPlugin, LoadedPlugin interfaces

**Modify: `src/types/dashboard.ts`**

```typescript
// Extend ChartId to support plugin charts
type BuiltInChartId =
  | "proposal-status"
  | "proposal-type"
  | "ncl-progress"
  | "voting-power"
  | "participation"
  | "proposal-submission";

// Plugin chart IDs: "plugin:{pluginId}:{chartId}"
type PluginChartId = `plugin:${string}:${string}`;

type ChartId = BuiltInChartId | PluginChartId;

// Type guard
function isPluginChartId(id: string): id is PluginChartId {
  return id.startsWith("plugin:");
}
```

### 1.2 Plugin Loader

**New File: `src/lib/plugins/PluginLoader.ts`**

```typescript
// CDN URL generation for GitHub repos
const CDN = {
  jsdelivr: {
    versioned: (repo: string, version: string, file: string) =>
      `https://cdn.jsdelivr.net/gh/${repo}@${version}/${file}`,
    latest: (repo: string, file: string) =>
      `https://cdn.jsdelivr.net/gh/${repo}/${file}`,
  },
  raw: {
    versioned: (repo: string, version: string, file: string) =>
      `https://raw.githubusercontent.com/${repo}/${version}/${file}`,
  },
};

class PluginLoader {
  private loadedPlugins: Map<string, LoadedPlugin> = new Map();

  async loadPlugin(manifest: PluginManifest, version?: string): Promise<LoadedPlugin> {
    const ver = version || manifest.version;
    const mainUrl = CDN.jsdelivr.versioned(manifest.repository, `v${ver}`, manifest.main);

    // Load CSS if specified
    if (manifest.styles) {
      await this.loadStylesheet(manifest, ver);
    }

    // Dynamic ESM import
    const module = await import(/* webpackIgnore: true */ mainUrl);

    return {
      manifest,
      module,
      status: "loaded",
    };
  }

  private async loadStylesheet(manifest: PluginManifest, version: string): Promise<void> {
    const styleId = `plugin-style-${manifest.id.replace("/", "-")}`;
    if (document.getElementById(styleId)) return;

    const styleUrl = CDN.jsdelivr.versioned(manifest.repository, `v${version}`, manifest.styles!);

    const link = document.createElement("link");
    link.id = styleId;
    link.rel = "stylesheet";
    link.href = styleUrl;
    document.head.appendChild(link);
  }

  unloadPlugin(pluginId: string): void {
    // Remove stylesheet
    const styleId = `plugin-style-${pluginId.replace("/", "-")}`;
    document.getElementById(styleId)?.remove();

    this.loadedPlugins.delete(pluginId);
  }
}

export const pluginLoader = new PluginLoader();
```

### 1.3 Plugin Registry

**New File: `src/lib/plugins/PluginRegistry.ts`**

```typescript
class PluginRegistry {
  private charts: Map<string, PluginChartDefinition> = new Map();
  private themes: Map<string, PluginThemeDefinition> = new Map();

  registerPlugin(plugin: LoadedPlugin): void {
    const { manifest, module } = plugin;

    // Register charts
    manifest.capabilities.charts?.forEach(chartCap => {
      const Component = module[chartCap.export];
      const chartDef: PluginChartDefinition = {
        id: `plugin:${manifest.id}:${chartCap.id}`,
        pluginId: manifest.id,
        title: chartCap.title,
        description: chartCap.description,
        component: Component,
        defaultLayout: chartCap.defaultLayout,
        defaultVisible: chartCap.defaultVisible ?? false,
        icon: chartCap.icon ? getLucideIcon(chartCap.icon) : undefined,
      };
      this.charts.set(chartDef.id, chartDef);
    });

    // Register themes
    manifest.capabilities.themes?.forEach(themeCap => {
      const themeExport = module[themeCap.export];
      const themeDef: PluginThemeDefinition = {
        id: `plugin:${manifest.id}:${themeCap.id}`,
        pluginId: manifest.id,
        ...themeExport,
      };
      this.themes.set(themeDef.id, themeDef);
    });
  }

  unregisterPlugin(pluginId: string): void {
    const prefix = `plugin:${pluginId}:`;
    for (const key of this.charts.keys()) {
      if (key.startsWith(prefix)) this.charts.delete(key);
    }
    for (const key of this.themes.keys()) {
      if (key.startsWith(prefix)) this.themes.delete(key);
    }
  }

  getAllCharts(): ChartDefinition[] {
    return [...CHART_REGISTRY, ...Array.from(this.charts.values())];
  }

  getAllThemes(): ThemeDefinition[] {
    return [...themes, ...Array.from(this.themes.values())];
  }
}

export const pluginRegistry = new PluginRegistry();
```

### 1.4 Plugin Context & Provider

**New File: `src/lib/plugins/PluginContext.tsx`**

```typescript
interface InstalledPlugin {
  id: string;
  manifest: PluginManifest;
  version: string;
  installedAt: number;
  enabled: boolean;
  trusted: boolean;
}

interface PluginContextValue {
  installed: InstalledPlugin[];
  loading: Set<string>;

  // Actions
  installPlugin: (repoUrl: string) => Promise<void>;
  uninstallPlugin: (pluginId: string) => void;
  enablePlugin: (pluginId: string) => Promise<void>;
  disablePlugin: (pluginId: string) => void;

  // Registry access
  getPluginCharts: () => PluginChartDefinition[];
  getPluginThemes: () => PluginThemeDefinition[];

  // Trust
  isPluginTrusted: (pluginId: string) => boolean;
}

const STORAGE_KEY = "cgov-plugins";

export function PluginProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const plugins = JSON.parse(stored) as InstalledPlugin[];
      setInstalled(plugins);

      // Auto-load enabled plugins
      plugins.filter(p => p.enabled).forEach(loadPluginModule);
    }
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(installed));
  }, [installed]);

  const installPlugin = useCallback(async (repoUrl: string) => {
    // Parse GitHub URL
    const match = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (!match) throw new Error("Invalid GitHub URL");

    const repo = match[1].replace(/\.git$/, "");

    // Fetch manifest
    const manifestUrl = CDN.jsdelivr.latest(repo, "plugin.json");
    const response = await fetch(manifestUrl);
    const manifest = await response.json() as PluginManifest;

    // Check trust
    const trusted = await checkTrustStatus(manifest.id);

    // Add to installed
    const plugin: InstalledPlugin = {
      id: manifest.id,
      manifest,
      version: manifest.version,
      installedAt: Date.now(),
      enabled: trusted,
      trusted,
    };

    setInstalled(prev => [...prev, plugin]);

    if (trusted) {
      await loadPluginModule(plugin);
    }
  }, []);

  // ... rest of context implementation
}
```

### 1.5 Basic Plugin UI

**New Page: `src/pages/plugins.tsx`**

```
+------------------------------------------+
|  Plugin Marketplace                       |
+------------------------------------------+
|  [Installed]  [Browse]  [Settings]        |
+------------------------------------------+
|  Your Plugins (3 installed)               |
|  +--------------------------------------+ |
|  | [icon] Advanced Analytics   v1.2.0  | |
|  |        2 charts, 1 theme            | |
|  |        [Verified]    [Disable] [x]  | |
|  +--------------------------------------+ |
|  | [icon] DRep Insights        v1.0.0  | |
|  |        1 chart                      | |
|  |        [!Unverified] [Enable] [x]   | |
|  +--------------------------------------+ |
+------------------------------------------+
|  Install from GitHub                      |
|  [https://github.com/user/repo    ] [+]   |
+------------------------------------------+
```

**New Components:**
- `src/components/plugins/PluginCard.tsx`
- `src/components/plugins/InstalledPluginsList.tsx`
- `src/components/plugins/InstallPluginDialog.tsx`

---

## Phase 2: Trust & Security

### 2.1 Allowlist System

**External Resource:** Create `cgov-org/plugin-allowlist` GitHub repo

```json
// allowlist.json
{
  "version": 1,
  "lastUpdated": "2026-02-02",
  "plugins": [
    {
      "id": "cardano-community/analytics-charts",
      "repository": "cardano-community/cgov-analytics",
      "verifiedVersions": ["1.0.0", "1.1.0", "1.2.0"],
      "verifiedAt": "2026-01-15",
      "verifiedBy": "maintainer-github-username",
      "badges": ["community-reviewed", "popular"]
    }
  ]
}
```

**New File: `src/lib/plugins/trustAllowlist.ts`**

```typescript
const ALLOWLIST_URL = "https://raw.githubusercontent.com/cgov-org/plugin-allowlist/main/allowlist.json";

interface TrustStatus {
  trusted: boolean;
  reason?: "not-listed" | "version-not-verified" | "verification-failed";
  badges?: string[];
  verifiedBy?: string;
}

export async function checkTrustStatus(pluginId: string, version?: string): Promise<TrustStatus> {
  try {
    const response = await fetch(ALLOWLIST_URL);
    const allowlist = await response.json();

    const entry = allowlist.plugins.find(p => p.id === pluginId);

    if (!entry) {
      return { trusted: false, reason: "not-listed" };
    }

    if (version && !entry.verifiedVersions.includes(version)) {
      return { trusted: false, reason: "version-not-verified" };
    }

    return {
      trusted: true,
      badges: entry.badges,
      verifiedBy: entry.verifiedBy,
    };
  } catch {
    return { trusted: false, reason: "verification-failed" };
  }
}
```

### 2.2 Security Warning UI

**New Component: `src/components/plugins/PluginWarningBanner.tsx`**

```
+------------------------------------------+
| ⚠️ Unverified Plugin                      |
|                                          |
| This plugin (My Plugin) is not on the    |
| verified plugins list. It has full       |
| access to your dashboard data.           |
|                                          |
| Only enable if you trust the developer   |
| and have reviewed the source code.       |
|                                          |
| [View Source]  [Enable Anyway]           |
+------------------------------------------+
```

---

## Phase 3: Full Integration

### 3.1 Dashboard Integration

**Modify: `src/components/dashboards/shared/DashboardGrid.tsx`**

```typescript
// Use merged registry instead of static CHART_REGISTRY
const allCharts = useMemo(() => {
  return pluginRegistry.getAllCharts();
}, [/* trigger on plugin load/unload */]);

const visibleCharts = useMemo(() => {
  return config.visibleCharts
    .map((id) => ({
      id,
      chart: allCharts.find(c => c.id === id),
    }))
    .filter((item) => item.chart);
}, [config.visibleCharts, allCharts]);
```

**Modify: `src/components/dashboards/shared/ChartVisibilityDropdown.tsx`**
- Show plugin charts in dropdown with plugin badge
- Group by: Built-in | Plugin Name

### 3.2 Theme Integration

**Modify: `src/lib/theme.tsx`**

```typescript
// Extend theme list with plugin themes
const getAllThemes = (): ThemeDefinition[] => {
  return [...themes, ...pluginRegistry.getAllThemes()];
};
```

### 3.3 Plugin SDK

**New File: `src/lib/plugins/PluginSDK.ts`**

What plugins can access:

```typescript
interface PluginSDK {
  // Redux store (read + dispatch)
  store: {
    getState: () => RootState;
    dispatch: AppDispatch;
    subscribe: (listener: () => void) => () => void;
  };

  // Selectors
  selectors: {
    getGovernanceActions: (state: RootState) => GovernanceAction[];
    getOverview: (state: RootState) => OverviewSummary | null;
    getFilters: (state: RootState) => GovernanceFilters;
  };

  // Theme
  theme: {
    useTheme: typeof useTheme;
    getChartColors: typeof getChartColors;
  };

  // UI Components (shadcn/ui)
  ui: {
    Button, Card, Dialog, Input, Select, Table, Badge, Progress, Tabs, ScrollArea
  };

  // Charts (Recharts)
  charts: {
    BarChart, LineChart, PieChart, ResponsiveContainer, Tooltip, Legend, XAxis, YAxis
  };

  // Utilities
  utils: {
    cn, lovelaceToAda, formatNumber, formatAda
  };
}

// Expose globally for plugins
window.cgovPluginSDK = createPluginSDK();
```

---

## Phase 4: Ecosystem Polish

### 4.1 Enhanced Config Export/Import

**Modify: `src/components/dashboards/shared/DashboardProvider.tsx`**

```typescript
interface ExportedConfig {
  config: DashboardConfig;
  plugins: {
    id: string;
    version: string;
    repository: string;
  }[];
  exportedAt: number;
  appVersion: string;
}

const exportConfig = (): string => {
  const exportData: ExportedConfig = {
    config: dashboardConfig,
    plugins: installedPlugins
      .filter(p => p.enabled)
      .map(p => ({ id: p.id, version: p.version, repository: p.manifest.repository })),
    exportedAt: Date.now(),
    appVersion: APP_VERSION,
  };
  return btoa(JSON.stringify(exportData));
};

const importConfig = async (code: string) => {
  const data = JSON.parse(atob(code)) as ExportedConfig;

  // Check for missing plugins
  const missingPlugins = data.plugins.filter(
    p => !installedPlugins.find(ip => ip.id === p.id)
  );

  if (missingPlugins.length > 0) {
    // Prompt user to install missing plugins
    return { success: false, missingPlugins };
  }

  setDashboardConfig(data.config);
  return { success: true };
};
```

### 4.2 Plugin Browser

**New Component: `src/components/plugins/PluginBrowser.tsx`**

```
+------------------------------------------+
|  Browse Plugins                           |
|  [Search plugins...]                      |
+------------------------------------------+
|  [All] [Charts] [Themes] [Data Sources]   |
+------------------------------------------+
|  +--------------------------------------+ |
|  | [icon] Advanced Analytics           | |
|  |        Whale tracking, heatmaps     | |
|  |        ⭐ 4.8  |  1.2k installs     | |
|  |        [Verified]        [Install]  | |
|  +--------------------------------------+ |
|  | [icon] DRep Leaderboard             | |
|  |        Top DRep rankings by ADA     | |
|  |        ⭐ 4.5  |  800 installs      | |
|  |        [Verified]        [Install]  | |
|  +--------------------------------------+ |
+------------------------------------------+
```

### 4.3 Developer Documentation

Create plugin developer guide:
- Plugin manifest reference
- SDK API documentation
- Building your first plugin
- Publishing and verification process
- Best practices

---

## File Structure Summary

```
src/
├── lib/
│   └── plugins/
│       ├── index.ts              # Public exports
│       ├── PluginLoader.ts       # ESM loading from CDN
│       ├── PluginRegistry.ts     # Chart/theme registration
│       ├── PluginContext.tsx     # React context & hooks
│       ├── PluginValidator.ts    # Manifest validation
│       ├── trustAllowlist.ts     # Trust verification
│       └── PluginSDK.ts          # API exposed to plugins
├── components/
│   └── plugins/
│       ├── PluginProvider.tsx    # Provider wrapper
│       ├── PluginCard.tsx        # Single plugin display
│       ├── InstalledPluginsList.tsx
│       ├── PluginBrowser.tsx     # Browse available plugins
│       ├── PluginWarningBanner.tsx
│       ├── TrustBadge.tsx
│       └── InstallPluginDialog.tsx
├── pages/
│   └── plugins.tsx               # Plugin management page
└── types/
    └── plugins.ts                # Plugin type definitions
```

---

## Modifications to Existing Files

| File | Changes |
|------|---------|
| `src/types/dashboard.ts` | Add `PluginChartId` type, extend `ChartId` union |
| `src/pages/_app.tsx` | Wrap with `PluginProvider` |
| `src/components/dashboards/shared/DashboardProvider.tsx` | Support plugin charts in config |
| `src/components/dashboards/shared/DashboardGrid.tsx` | Use merged chart registry |
| `src/components/dashboards/shared/ChartVisibilityDropdown.tsx` | Show plugin charts |
| `src/lib/theme.tsx` | Support dynamic theme registration |
| `src/themes/index.ts` | Export theme registration helper |
| `src/components/layout/Header.tsx` | Add "Plugins" navigation link |
| `next.config.ts` | Add CSP headers for jsDelivr CDN |

---

## Example Plugin Structure

```
my-cgov-plugin/
├── plugin.json           # Manifest
├── src/
│   ├── index.ts          # Main entry (exports all capabilities)
│   ├── charts/
│   │   ├── WhaleTracker.tsx
│   │   └── VotingHeatmap.tsx
│   └── themes/
│       └── cyberpunk.ts
├── dist/                 # Built output
│   ├── index.js
│   └── styles.css
├── package.json
└── tsconfig.json
```

**Example Chart Component:**

```typescript
// src/charts/WhaleTracker.tsx
import type { ChartProps } from "@cgov/plugin-types";

export function WhaleTrackerChart({ isLoading, className }: ChartProps) {
  const sdk = window.cgovPluginSDK;
  const { useTheme, getChartColors } = sdk.theme;
  const { BarChart, ResponsiveContainer, Bar, XAxis, YAxis } = sdk.charts;
  const { Card } = sdk.ui;

  const { activeTheme } = useTheme();
  const chartColors = getChartColors(activeTheme.id);

  const actions = sdk.selectors.getGovernanceActions(sdk.store.getState());

  // Transform data...

  return (
    <Card className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          {/* ... */}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
```

---

## Verification Plan

1. **Unit tests:**
   - Plugin loader (manifest fetch, ESM import, CSS injection)
   - Plugin registry (register, unregister, merge with built-in)
   - Trust verification (allowlist fetch, status checking)

2. **Integration tests:**
   - Full install → enable → use flow
   - Config export with plugins → import with missing plugin detection

3. **Manual testing:**
   - Create a test plugin repository on GitHub
   - Install via URL in UI
   - Verify chart appears in dashboard
   - Test enable/disable toggle
   - Test theme integration
   - Test config export/import with plugin

4. **Security testing:**
   - Verify untrusted plugin warning shows
   - Verify allowlist verification works
   - Test with malformed manifests

5. **Cross-browser testing:**
   - Verify dynamic ESM import works in Chrome, Firefox, Safari
   - Verify CSP headers don't block CDN

---

## Potential Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| **ESM import blocked by CSP** | Configure Next.js headers to allow jsDelivr |
| **Plugin API versioning** | Version SDK, maintain backwards compat for 2 major versions |
| **CSS conflicts** | Require plugins to scope styles with unique prefix |
| **Redux state conflicts** | Namespace plugin state under `state.plugins[pluginId]` |
| **Security with full access** | Clear docs, explicit consent, community review process |
| **Slow plugin loading** | Lazy load plugins, cache in localStorage |

---

## Open Questions

1. **Allowlist hosting:** Main cgov repo or separate `plugin-allowlist` repo?
2. **Plugin template:** Create `create-cgov-plugin` CLI tool or just a template repo?
3. **Plugin settings:** Should plugins have their own settings UI within the plugins page?
4. **Analytics:** Track plugin installations for popularity badges?
5. **Review process:** How formal should the plugin verification process be?
