# CGOV Platform Evolution

A chronological study of how cgov evolved from a mock-data prototype to a full governance tracking platform, based on 75 merged pull requests (Nov 2025 – Feb 2026).

## Contributors

| Handle | Role | Key contributions |
|--------|------|-------------------|
| **HinsonSIDAN / AnsonSIDAN** | Backend & infra | Initial scaffold, API integration, Vercel deployment, wallet provider, GA voting feature |
| **Andre-Diamond** | Frontend core | Vote progress components, VoteBreakdown refactors, rationale handling, percentage calculations, analytics API routes |
| **Technosophorso** | Frontend lead / AI tooling | Themes, dashboard system, DRep pages, i18n, MCP servers, Claude Code skills, most feature work |
| **lisicky** | API integration | Backend API client and data layer (#6) |
| **gufmar** | Product | Issue authoring, feature direction |

---

## Phase 1: Foundation (Nov 2025)

**PRs #1–#5 · Nov 5–12**

The project started as a Next.js + TypeScript scaffold with mock data. HinsonSIDAN set up the core architecture in a single PR:

- Pages Router with Redux Toolkit, Tailwind CSS, shadcn/ui components
- `GovernanceTable`, `GovernanceStats`, `VotingRecords` components
- Type system: `GovernanceAction`, `VoteRecord`, `ProposalType`
- Mock data in `src/data/mockData.ts`
- Initial docs: project description, database schema, architecture decisions

Andre-Diamond followed with early refinements (#3–#5): switching from `hash` to `proposal_id`, adding motivation/references sections, and restructuring vote record display.

**State at end of Phase 1:** Static prototype with mock data, basic governance action listing and detail pages.

---

## Phase 2: Backend Integration (Nov–Dec 2025)

**PRs #6–#8 · Nov 16 – Dec 16**

The platform connected to a real Cardano backend:

- **#6 (lisicky):** Full API integration — created `cgov-api-client.ts`, API types, factory pattern for switching between mock and real data, environment configs
- **#7 (AnsonSIDAN):** Switched frontend to Next.js API route proxy pattern (`pages/api/`) with `apiHelper.ts` for server-side auth, keeping the API key off the client
- **#8 (Andre-Diamond):** Major frontend merge — merged the frontend branch to work with the new backend. Added BubbleMap, VotingRationale modal, wallet connection (Mesh SDK), theme system, vote breakdown calculator, governance voting eligibility matrix

**State at end of Phase 2:** Live data from Cardano backend, API proxy pattern established, wallet connection, early theme support.

---

## Phase 3: Toward v1 (Dec 2025 – Jan 2026)

**PRs #10–#17 · Dec 18 – Jan 8**

Rapid iteration polishing every corner of the app:

- **#10 (Andre-Diamond):** Simplified rationale handling — backend now serves rationale directly instead of fetching from anchor URLs
- **#11 (Technosophorso):** Massive rework — three-theme system (light/dark/game), new Header layout, NerdFont, GovernanceStats redesign, VoteOnProposal component, complete styling overhaul
- **#12 (Andre-Diamond):** Raw voting power values exposed for advanced UI, VoteProgress mouse handling improvements
- **#13–#14 (Technosophorso):** v0.9.1 and v0.9.2 — incremental polish across 20+ files each
- **#15 (Technosophorso):** v0.9.9 — removed wallet connect temporarily (deferred to v2), mobile compatibility
- **#16 (Andre-Diamond):** Pending vote calculations for DRep/SPO/CC, VoteProgress enhancements
- **#17 (AnsonSIDAN):** Vercel deployment — deployment config, MeshProviderWrapper, voting eligibility matrix, vote breakdown calculator finalized

**State at end of Phase 3:** Deployed on Vercel, three themes, mobile support, accurate vote calculations matching CIP-1694 spec.

---

## Phase 4: v1 Launch & Dashboard (Jan 2026)

**PRs #20–#32 · Jan 11 – Jan 27**

v1 launch followed by the custom dashboard system:

- **#20–#23:** v1 bug fixing sprint (from issue #18) — Protocol Parameter Change exceptions, SPO eligibility, vote status highlighting, pending/constitutionality fixes
- **#24–#25:** Voting threshold indicators added to the landing page
- **#26 (Technosophorso):** MCP servers introduced — `mcp-governance` (CIP-1694 rules from Conway ledger spec) and `mcp-cgov` (project knowledge). First AI-assisted development tooling. Also added formal governance reference docs
- **#27:** Threshold visualization (3692 additions, 11 files)
- **#28:** "v1 ready" — analytics KPI table, dashboard docs, chart visibility dropdown, DashboardProvider, DashboardGrid, 6 initial charts (NCL Progress, Participation, Proposal Status/Type/Submission, Voting Power), ChartSkeleton loading states
- **#29:** Custom dashboard basics — user chart selection, drag/resize, localStorage persistence
- **#30:** Bug fixes — Protocol Param Change SPO eligibility, vote status highlighting
- **#34–#35 (Andre-Diamond):** Refactored percentage calculations to derive from real-time breakdown data instead of stored values

**State at end of Phase 4:** v1 live with custom dashboard, 6 governance charts, MCP servers for AI coding assistance.

---

## Phase 5: Dashboard Architecture & Polish (Jan 28 – Jan 30)

**PRs #36–#43**

The dashboard system was refactored from a single flat structure to a multi-dashboard architecture:

- **#36:** Dashboard architecture — introduced `dashboards/shared/` (DashboardProvider, DashboardGrid, DashboardChartCard), `dashboards/governance/charts/`, placeholder directories for DRep and Phil dashboards, chart registry pattern
- **#37–#38:** Compact view on landing, brightness regulator for light theme, relative sizing fixes
- **#39:** Mobile layout fixes
- **#40:** Multi-chart selection, text items, share dashboard feature (export/import)
- **#41:** Performance — HTTP caching, SWR client-side caching, bundle optimization
- **#42–#43:** More loading improvements, MCP updates

**State at end of Phase 5:** Multi-dashboard architecture, shared chart infrastructure, significantly improved load performance.

---

## Phase 6: AI Tooling & Skills (Feb 1–4)

**PRs #44–#55**

A unique phase where the project invested heavily in AI-assisted development tooling:

- **#44–#45:** Claude Code skills introduced — reusable task templates for adding charts, API routes, Redux thunks
- **#46:** Evolving skills experiment — skills that improve themselves through usage, journey system for capturing session learnings
- **#47:** Full skill training session — chart color customization, side panel, tooltip theming, plugin ecosystem design doc, 5 journeys documenting learnings, skill versions with changelogs
- **#48:** Multi-language support (issue #9 closed) — 7 languages (EN, DE, ES, FR, JA, PT, ZH), NextJS i18n, DeepL API integration, LanguageSelector component, TranslatedText wrapper
- **#49–#50:** DRep dashboard basics — initial DRep page structure, SWR hooks for DRep data
- **#51–#52:** DRep profile pages, backend data conflict resolution
- **#53:** Language selection fixes, i18n skill, role dropdown for voting trend chart
- **#54:** Skill improvement — evolving skills workflow refinement (499 additions, 1492 deletions — significant cleanup)
- **#55:** Custom dashboard updates

**State at end of Phase 6:** 7-language support, AI skill system with journeys and evolving skills, DRep dashboard foundations.

---

## Phase 7: ISR + Performance (Feb 5–7)

**PRs #56–#59**

Focus on real-world loading performance:

- **#56:** ISR + SWR pattern — `getStaticProps` with `revalidate: 60` + SWR hooks with `fallbackData`, dramatically improved initial page load
- **#57–#59:** Edge case fixes — newly submitted proposals with missing data, data availability timing issues

**State at end of Phase 7:** ISR + SWR hybrid rendering, sub-second page loads with 60s background revalidation.

---

## Phase 8: Analytics & Wallet (Feb 8–9)

**PRs #60–#67**

Two parallel workstreams:

- **#60 (Andre-Diamond):** Analytics API routes — 20+ new `/api/analytics/` endpoints covering voting turnout, DRep activity, CC participation, Gini coefficient, stake participation, delegation distribution, treasury rates, and more. Analytics types and service layer
- **#61:** UTF-8 encoding fixes
- **#62:** DRep dashboard updates (959 additions) — significant DRep data visualization work
- **#64 (AnsonSIDAN):** GA voting feature — governance action vote submission via wallet
- **#65–#66:** Frontend v2 sync — wallet integration fixes (Mesh SDK dynamic import pattern to avoid Web Crypto crashes), DRep voting power chart, game-dropdown component
- **#67:** "Frontend v2 ready" — consolidated release

**State at end of Phase 8:** Full analytics API layer, wallet-based vote submission, frontend-v2 branch synced.

---

## Phase 9: DRep Dashboard (Feb 10–12)

**PRs #68–#75**

The DRep dashboard came to life:

- **#68:** DRep dashboard & proposal submission date fixes — DRep overview page with SWR hooks, stats display
- **#71:** "DRep v1 review" (1832 additions) — DRep profile pages, D3 visualizations (bubble map, treemap, donut chart), chart type switcher with opacity crossfade, top-N filtering, server-side DRep data fetching
- **#72:** Game-theme button fixes (CSS specificity vs Tailwind)
- **#73:** DRep dashboard adjustments — tab navigation, Radix TabsContent remount fixes with module-level caching
- **#74:** DRep dashboard improvements — donut chart animations, hover interactions, SVG z-ordering, rationale statistics via server-side aggregation
- **#75:** DRep dashboard fixes — final polish

**State at end of Phase 9 (current):** DRep dashboard with D3 visualizations, profile pages, voting history, rationale analysis. Three chart types (bubble, treemap, donut) with animated transitions.

---

## Architecture Evolution Timeline

```
Nov 2025   Mock data + static components
     ↓
Dec 2025   Real backend → API proxy → Redux → Components
     ↓
Jan 2026   Custom dashboard (drag/resize/persist)
     ↓
Jan 2026   Multi-dashboard architecture (shared infra)
     ↓
Feb 2026   ISR + SWR (hybrid SSG/client rendering)
     ↓
Feb 2026   Analytics API layer (20+ endpoints)
     ↓
Feb 2026   DRep dashboard with D3 visualizations
```

## Key Technical Decisions

1. **Pages Router over App Router** — chosen early, stayed consistent
2. **API proxy pattern** — all backend calls go through `pages/api/` to keep API keys server-side
3. **Redux + SWR hybrid** — Redux for global state, SWR for data fetching with ISR fallback, synced via hooks
4. **Three-theme system** — light/dark/game with CSS custom properties and `data-theme` attribute
5. **MCP servers for AI coding** — domain knowledge (CIP-1694 rules + project conventions) embedded in AI tooling
6. **Evolving skills** — skills that self-improve through usage and wrap-up consolidation
7. **Module-level caching** — workaround for Radix TabsContent unmounting, preventing unnecessary re-fetches
8. **Dynamic imports for Mesh SDK** — runtime `import()` gated by Web Crypto availability to avoid SSR/HTTP crashes
9. **D3 for advanced viz, Recharts for standard charts** — D3 for bubble maps, treemaps, donuts; Recharts for bar/line/pie

## Growth by the Numbers

| Metric | Value |
|--------|-------|
| Total PRs merged | 75 |
| Total additions | ~70,000+ |
| Contributors | 5 |
| Languages supported | 7 |
| Dashboard charts | 6 governance + DRep visualizations |
| API routes | 20+ analytics + core endpoints |
| Themes | 3 (light, dark, game) |
| MCP tools | 25+ across 2 servers |
| Claude Code skills | 10+ evolving skills |
| Time span | ~3.5 months |
