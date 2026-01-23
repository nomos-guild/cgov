/**
 * cgov Project Knowledge Base
 *
 * Comprehensive knowledge about the cgov codebase for AI coding assistants.
 * Extracted from the project's architecture, patterns, and conventions.
 */

// =============================================================================
// PROJECT OVERVIEW
// =============================================================================

export const PROJECT_OVERVIEW = {
  name: "cgov",
  description: "Cardano Governance Tracking Dashboard built with Next.js/TypeScript to monitor on-chain governance actions and voting records. Implements CIP-1694 governance visualization for the Conway era.",
  techStack: {
    framework: "Next.js 15.0.3",
    language: "TypeScript 5",
    ui: ["React 18", "Radix UI", "Tailwind CSS", "shadcn/ui"],
    state: "Redux Toolkit",
    charts: ["Recharts", "D3.js"],
    wallet: "Mesh SDK",
    router: "Next.js Pages Router",
  },
  features: [
    "Aggregate governance statistics dashboard with NCL tracking",
    "Customizable dashboard with drag-and-drop, resizable charts",
    "Filterable governance actions table (by type and status)",
    "Detailed governance action pages with voting records",
    "Three voter types: DRep (stake-weighted), SPO (stake-weighted), CC (count-based)",
    "Vote breakdown visualization with donut charts",
    "Search and filter voting records",
    "Export voting rationales (JSON, Markdown, CSV)",
    "Threshold progress indicators per voter type",
    "Dark/Light/Game theme support",
    "Wallet connection for vote submission",
  ],
};

// =============================================================================
// FILE STRUCTURE
// =============================================================================

export const FILE_STRUCTURE = {
  src: {
    components: {
      description: "React components organized by feature",
      ui: "shadcn/ui base components (button, card, table, dialog, input, etc.)",
      layout: "Layout components (Header.tsx, Footer.tsx)",
      governance: "Governance-specific components (VoteOnProposal.tsx, VoteButtons.tsx)",
      wallet: "Wallet connection components (ConnectWalletButton.tsx, ConnectWalletModal.tsx)",
      providers: "React context providers (MeshProviderWrapper.tsx)",
      dashboard: {
        description: "Customizable dashboard with draggable/resizable charts",
        files: [
          "DashboardProvider.tsx - Context + localStorage persistence",
          "DashboardGrid.tsx - Free-form canvas container",
          "DashboardChartCard.tsx - Draggable/resizable card wrapper",
          "ChartVisibilityDropdown.tsx - Show/hide chart selector",
        ],
        charts: [
          "ProposalStatusChart.tsx - Active/Ratified/Enacted counts",
          "ProposalTypeChart.tsx - Pie chart by action type",
          "NCLProgressChart.tsx - Treasury NCL gauges",
          "VotingPowerChart.tsx - DRep/SPO voting breakdown",
          "ParticipationChart.tsx - Vote participation rates",
        ],
      },
      keyFiles: [
        "GovernanceStats.tsx - Statistics cards with NCL progress",
        "GovernanceTable.tsx - Actions table with filtering",
        "VotingRecords.tsx - Votes table with search/filter/export",
        "VotingSummary.tsx - Vote count statistics",
        "BubbleMap.tsx - D3.js voter visualization",
        "ProposalContent.tsx - Markdown content renderer",
      ],
    },
    pages: {
      description: "Next.js Pages Router pages",
      routes: {
        "/": "index.tsx - Landing page with statistics",
        "/dashboard": "dashboard.tsx - Customizable charts dashboard",
        "/governance/[hash]": "governance/[hash].tsx - Proposal detail view",
        "/404": "404.tsx - Not found page",
      },
      api: {
        description: "Server-side API routes that proxy to backend",
        routes: {
          "GET /api/overview": "overview/index.ts - Summary statistics",
          "GET /api/overview/proposals": "overview/proposals.ts - All proposals",
          "GET /api/overview/ncl": "overview/ncl/index.ts - NCL data",
          "GET /api/overview/ncl/:year": "overview/ncl/[year].ts - NCL by year",
          "GET /api/proposal/:id": "proposal/[id].ts - Proposal detail",
        },
      },
    },
    store: {
      description: "Redux Toolkit state management",
      files: {
        "index.ts": "Store configuration",
        "governanceSlice.ts": "Governance state, actions, and async thunks",
        "hooks.ts": "Typed Redux hooks (useAppDispatch, useAppSelector)",
      },
    },
    services: {
      description: "API service layer",
      "api.ts": "Frontend API service with data transformations (lovelace → ADA)",
    },
    types: {
      description: "TypeScript type definitions",
      "governance.ts": "All governance-related types (~339 lines)",
      "dashboard.ts": "Dashboard types (ChartId, ChartLayout, DashboardConfig)",
    },
    lib: {
      description: "Core business logic utilities",
      files: {
        "utils.ts": "General utilities (cn for classNames)",
        "theme.tsx": "Theme provider and context",
        "voteBreakdownCalculator.ts": "Vote calculation logic by action type",
        "governanceVotingEligibility.ts": "Voter eligibility matrix per Conway spec",
        "voteMath.ts": "Numeric utilities for vote calculations",
        "exportRationales.ts": "Vote export functions (JSON, CSV, Markdown)",
      },
    },
    utils: {
      "apiHelper.ts": "Server-side API authentication (adds X-API-Key header)",
    },
    config: {
      "api.ts": "API endpoint configuration",
    },
    themes: {
      description: "Theme definitions",
      themes: ["light", "dark", "game"],
      structure: "Each theme has: index.ts, tokens.css, components.tsx",
    },
  },
};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export const TYPE_DEFINITIONS = {
  enums: {
    ProposalStatus: {
      values: ["Active", "Ratified", "Enacted", "Expired", "Closed"],
      description: "Status of a governance proposal",
    },
    ProposalType: {
      values: [
        "InfoAction",
        "HardForkInitiation",
        "ParameterChange",
        "NoConfidence",
        "UpdateCommittee",
        "NewConstitution",
        "Treasury",
      ],
      description: "Type of governance action (internal code)",
    },
    GovernanceActionType: {
      values: [
        "All",
        "Info Action",
        "Treasury Withdrawals",
        "New Constitution",
        "Hard Fork Initiation",
        "Protocol Parameter Change",
        "No Confidence",
        "Update Committee",
      ],
      description: "Human-readable governance action type labels (for filters)",
    },
    VoterType: {
      values: ["DRep", "SPO", "CC"],
      description: "Voter role types",
    },
    Vote: {
      values: ["Yes", "No", "Abstain"],
      description: "Vote options",
    },
    GovernanceActionTypeCode: {
      values: ["NO_CONFIDENCE", "HARD_FORK_INITIATION", "OTHER"],
      description: "Action type codes for vote calculation logic",
    },
  },
  interfaces: {
    GovernanceAction: {
      description: "Main governance action/proposal interface",
      keyFields: {
        hash: "txHash:certIndex format - used for routing",
        proposalId: "gov_action bech32 format - display ID",
        txHash: "Transaction hash",
        title: "Proposal title",
        type: "Human-readable type label",
        status: "ProposalStatus enum value",
        constitutionality: "Constitutional assessment",
        drepYesPercent: "DRep yes vote percentage",
        drepYesAda: "DRep yes vote ADA amount",
        spoYesPercent: "SPO yes vote percentage (optional)",
        ccYesPercent: "CC yes vote percentage (optional)",
        ccYesCount: "CC yes vote count (count-based)",
        threshold: "Object with ccThreshold, drepThreshold, spoThreshold",
        votingStatus: "Object with ccPassing, drepPassing, spoPassing booleans",
        drepBreakdown: "VoteBreakdown for DRep delegation categories",
        spoBreakdown: "VoteBreakdown for SPO delegation categories",
        rawVotingPowerValues: "Raw lovelace values by voter group",
        submissionEpoch: "Epoch when proposal was submitted",
        expiryEpoch: "Epoch when voting expires",
      },
    },
    GovernanceActionDetail: {
      description: "Extended GovernanceAction with full details",
      extendsFrom: "GovernanceAction",
      additionalFields: {
        description: "Full proposal description",
        rationale: "Proposal rationale",
        references: "Array of ProposalReferenceObject",
        votes: "Array of VoteRecord (DRep/SPO)",
        ccVotes: "Array of VoteRecord (CC only)",
      },
    },
    VoteRecord: {
      description: "Individual vote record",
      keyFields: {
        voterType: "DRep | SPO | CC",
        voterId: "Voter identifier",
        voterName: "Optional display name",
        vote: "Yes | No | Abstain",
        votingPower: "Lovelace string (for precision)",
        votingPowerAda: "Converted ADA number",
        anchorUrl: "Vote rationale URL",
        anchorHash: "Rationale content hash",
        rationale: "Resolved rationale text",
        votedAt: "ISO timestamp",
        txHash: "Vote transaction hash",
      },
    },
    VoteBreakdown: {
      description: "Vote breakdown by delegation status",
      note: "All values are lovelace strings for BigInt precision",
      fields: {
        activeYes: "Votes from active delegators who voted Yes",
        activeNo: "Votes from active delegators who voted No",
        activeAbstain: "Votes from active delegators who voted Abstain",
        alwaysAbstain: "Voting power delegated to AlwaysAbstain predefined DRep",
        alwaysNoConfidence: "Voting power delegated to AlwaysNoConfidence predefined DRep",
        inactive: "Voting power from inactive DReps (DRep only, not SPO)",
        notVoted: "Voting power that hasn't voted yet",
      },
    },
    NCLDisplayData: {
      description: "Net Change Limit data for treasury tracking",
      fields: {
        year: "Fiscal year",
        currentValueAda: "Current treasury withdrawals (ADA)",
        targetValueAda: "Annual NCL limit (ADA)",
        percentUsed: "Percentage of NCL used",
        epoch: "Last update epoch",
      },
    },
    OverviewSummary: {
      description: "Dashboard summary statistics",
      fields: {
        totalProposals: "Total proposal count",
        activeProposals: "Active proposal count",
        ratifiedProposals: "Ratified proposal count",
        enactedProposals: "Enacted proposal count",
        expiredProposals: "Expired proposal count",
        closedProposals: "Closed proposal count",
      },
    },
    ChartId: {
      description: "Identifier for dashboard charts",
      values: ["proposal-status", "proposal-type", "ncl-progress", "voting-power", "participation"],
    },
    ChartLayout: {
      description: "Pixel-based positioning for dashboard charts",
      fields: {
        x: "X position in pixels from left",
        y: "Y position in pixels from top",
        width: "Width in pixels (min: 280, max: 1200)",
        height: "Height in pixels (min: 200, max: 800)",
      },
    },
    DashboardConfig: {
      description: "Persisted dashboard configuration (localStorage)",
      fields: {
        visibleCharts: "Array of ChartId for visible charts",
        layouts: "Record<ChartId, ChartLayout> for positions",
        version: "Schema version for migrations",
      },
    },
    ChartDefinition: {
      description: "Registry entry for dashboard charts",
      fields: {
        id: "ChartId identifier",
        title: "Display title",
        description: "Description for customize dropdown",
        component: "React component type",
        defaultVisible: "Whether visible by default",
        defaultLayout: "Default ChartLayout",
        icon: "Optional Lucide icon component",
      },
    },
  },
};

// =============================================================================
// DATA CONVENTIONS
// =============================================================================

export const DATA_CONVENTIONS = {
  lovelaceToAda: {
    description: "Currency conversion between lovelace and ADA",
    formula: "1 ADA = 1,000,000 lovelace",
    pattern: "Backend stores lovelace as strings for BigInt precision, frontend converts to ADA numbers for display",
    conversionFunction: "lovelaceToAda(lovelace: string): number => Number(lovelace) / 1_000_000",
  },
  proposalIdentifiers: {
    hash: {
      format: "txHash:certIndex or txHash#certIndex",
      usage: "Used for routing and unique identification",
      example: "abc123def456:0",
    },
    proposalId: {
      format: "gov_action bech32 string",
      usage: "Human-readable display format",
      example: "gov_action1abc123...",
    },
    txHash: {
      format: "64-character hex string",
      usage: "Transaction hash for on-chain lookup",
    },
  },
  votingPower: {
    drepAndSpo: "Stake-weighted (ADA amount)",
    cc: "Count-based (number of votes)",
    storage: "Stored as lovelace strings, converted to ADA for display",
  },
  epochConstants: {
    shelleyStartEpoch: 208,
    epochDuration: "5 days",
    note: "Epoch 534+ has different SPO vote calculation formula",
  },
};

// =============================================================================
// VOTER ELIGIBILITY MATRIX
// =============================================================================

export const VOTER_ELIGIBILITY = {
  description: "Which voter types can vote on which action types (per Conway Ledger spec Fig. 42)",
  matrix: {
    NoConfidence: { SPO: true, DRep: true, CC: false },
    UpdateCommittee: { SPO: true, DRep: true, CC: false },
    NewConstitution: { SPO: false, DRep: true, CC: true },
    HardForkInitiation: { SPO: true, DRep: true, CC: true },
    ParameterChange: { SPO: false, DRep: true, CC: true },
    Treasury: { SPO: false, DRep: true, CC: true },
    InfoAction: { SPO: true, DRep: true, CC: true },
  },
  labelMapping: {
    "Info Action": "InfoAction",
    "Treasury Withdrawals": "Treasury",
    "New Constitution": "NewConstitution",
    "Hard Fork Initiation": "HardForkInitiation",
    "Protocol Parameter Change": "ParameterChange",
    "No Confidence": "NoConfidence",
    "Update Committee": "UpdateCommittee",
  },
  functions: {
    canRoleVoteOnAction: "canRoleVoteOnAction(type: ProposalType | string, role: VoterType): boolean",
    getEligibleRoles: "getEligibleRoles(type: ProposalType | string): VoterType[]",
  },
  location: "src/lib/governanceVotingEligibility.ts",
};

// =============================================================================
// VOTE CALCULATION LOGIC
// =============================================================================

export const VOTE_CALCULATION = {
  description: "Vote totals calculated differently based on action type and epoch",
  location: "src/lib/voteBreakdownCalculator.ts",
  epoch534Threshold: {
    description: "Epoch 534+ uses different SPO vote calculation formula",
    constant: "EPOCH_534_THRESHOLD = 534",
  },
  drepCalculation: {
    noConfidence: {
      yes: "activeYes + alwaysNoConfidence",
      no: "activeNo + notVoted",
      abstain: "activeAbstain + alwaysAbstain",
      inactive: "inactive (separate category)",
    },
    otherActions: {
      yes: "activeYes",
      no: "activeNo + alwaysNoConfidence + notVoted",
      abstain: "activeAbstain + alwaysAbstain",
      inactive: "inactive (separate category)",
    },
  },
  spoCalculation: {
    preEpoch534: {
      yes: "activeYes",
      no: "activeNo + alwaysNoConfidence",
      abstain: "activeAbstain + alwaysAbstain",
      notCounted: "notVoted (excluded from calculation)",
    },
    postEpoch534: {
      hardForkInitiation: {
        yes: "activeYes",
        no: "activeNo + alwaysNoConfidence + alwaysAbstain + notVoted",
        abstain: "activeAbstain (explicit only)",
      },
      noConfidence: {
        yes: "activeYes + alwaysNoConfidence",
        no: "activeNo + notVoted",
        abstain: "activeAbstain + alwaysAbstain",
      },
      other: {
        yes: "activeYes",
        no: "activeNo + alwaysNoConfidence + notVoted",
        abstain: "activeAbstain + alwaysAbstain",
      },
    },
  },
  ccCalculation: {
    description: "CC votes are count-based, not stake-weighted",
    threshold: "Typically 2/3 majority required",
  },
  functions: {
    calculateDrepLegendTotals: "calculateDrepLegendTotals(breakdown: VoteBreakdown, actionType: GovernanceActionTypeCode): CalculatedVoteTotals",
    calculateSpoLegendTotals: "calculateSpoLegendTotals(breakdown: VoteBreakdown, actionType: GovernanceActionTypeCode, submissionEpoch: number): CalculatedVoteTotals",
    getGovernanceActionTypeCode: "getGovernanceActionTypeCode(type: string | undefined): GovernanceActionTypeCode",
  },
};

// =============================================================================
// API ARCHITECTURE
// =============================================================================

export const API_ARCHITECTURE = {
  dataFlow: [
    "Backend API (Cgov API) - external service",
    "Next.js API Routes (/api/*) - adds X-API-Key header server-side",
    "Frontend Service (src/services/api.ts) - transforms lovelace → ADA",
    "Redux Store (governanceSlice.ts) - state management",
    "UI Components - display data",
  ],
  serverSideAuth: {
    description: "API keys are only used server-side in Next.js API routes",
    helper: "src/utils/apiHelper.ts - callApi() adds X-API-Key header",
    envVars: {
      BACKEND_API_URL: "Backend base URL",
      BACKEND_API_KEY: "API authentication key (server-side only)",
    },
  },
  endpoints: {
    internal: {
      "GET /api/overview": "Summary statistics",
      "GET /api/overview/proposals": "All governance actions",
      "GET /api/overview/ncl": "NCL data for all years",
      "GET /api/overview/ncl/:year": "NCL data for specific year",
      "GET /api/proposal/:id": "Single proposal with votes",
    },
  },
  serviceFunctions: {
    location: "src/services/api.ts",
    functions: {
      fetchOverviewSummary: "() => Promise<OverviewSummary>",
      fetchGovernanceActions: "() => Promise<GovernanceAction[]>",
      fetchGovernanceActionDetail: "(proposalId: string) => Promise<GovernanceActionDetail | null>",
      fetchNCLData: "() => Promise<NCLDisplayData[]>",
      fetchCurrentYearNCL: "() => Promise<NCLDisplayData | null>",
    },
  },
  transformations: {
    description: "API service transforms backend responses to frontend format",
    transformGovernanceAction: [
      "Derives txHash from hash field if not provided",
      "Converts lovelace values to ADA numbers",
      "Extracts vote breakdowns from nested objects",
      "Normalizes field names",
    ],
    transformVoteRecord: [
      "Converts votingPower (lovelace) to votingPowerAda",
      "Maps legacy field names for backwards compatibility",
    ],
    transformNCLData: [
      "Converts lovelace to ADA",
      "Calculates percentUsed",
    ],
  },
};

// =============================================================================
// COMPONENT PATTERNS
// =============================================================================

export const COMPONENT_PATTERNS = {
  uiComponents: {
    location: "src/components/ui/",
    library: "shadcn/ui with Radix UI primitives",
    styling: "Tailwind CSS with cn() utility for conditional classes",
    components: [
      "button", "card", "table", "dialog", "input", "label",
      "progress", "scroll-area", "select", "tabs", "textarea",
      "badge", "vote-progress",
    ],
  },
  customComponents: {
    GovernanceStats: {
      description: "Statistics cards with NCL progress indicator",
      props: ["summary: OverviewSummary", "nclData: NCLDisplayData | null"],
    },
    GovernanceTable: {
      description: "Sortable/filterable table of governance actions",
      features: ["Type filter", "Status filter", "Click to navigate"],
    },
    VotingRecords: {
      description: "Votes table with search, filter, and export",
      features: ["Search by voter name/ID", "Filter by vote type", "Export rationales"],
    },
    VotingSummary: {
      description: "Vote count statistics display",
      displays: ["Total votes", "Yes/No/Abstain counts", "Threshold indicators"],
    },
    BubbleMap: {
      description: "D3.js visualization of voter distribution",
      library: "D3.js",
    },
    ProposalContent: {
      description: "Markdown content renderer for proposal descriptions",
      library: "react-markdown with remark-gfm",
    },
    DashboardProvider: {
      description: "Context provider for dashboard state and localStorage persistence",
      contextValues: [
        "config - Current DashboardConfig",
        "mounted - SSR safety flag",
        "getLayout(chartId) - Get chart position/size",
        "updateLayout(chartId, partial) - Update chart position/size",
        "toggleChartVisibility(chartId) - Show/hide a chart",
        "resetToDefaults() - Reset all settings",
      ],
      storageKey: "dashboard-config",
    },
    DashboardGrid: {
      description: "Free-form canvas container for chart cards",
      features: [
        "position: relative container",
        "Cards use position: absolute with pixel coordinates",
        "No grid snapping - cards can be placed anywhere",
        "Overlapping allowed for flexible repositioning",
        "Container height auto-expands based on card positions",
      ],
    },
    DashboardChartCard: {
      description: "Draggable and resizable chart card wrapper",
      features: [
        "Drag-to-move via grip handle",
        "Resize from all 8 directions (edges + corners)",
        "Click/drag/resize brings card to front (z-index)",
        "Resize handles appear on hover",
      ],
      zIndexLayers: {
        inactive: 1,
        active: 50,
        dropdown: 100,
      },
    },
  },
  stateManagement: {
    library: "Redux Toolkit",
    slice: "governanceSlice.ts",
    asyncThunks: [
      "fetchOverview",
      "fetchProposals",
      "fetchProposalDetail",
    ],
    hooks: {
      useAppDispatch: "Typed dispatch hook",
      useAppSelector: "Typed selector hook",
    },
  },
};

// =============================================================================
// THEMING
// =============================================================================

export const THEMING = {
  themes: ["light", "dark", "game"],
  provider: "src/lib/theme.tsx",
  structure: {
    "themes/[theme]/index.ts": "Theme configuration",
    "themes/[theme]/tokens.css": "CSS custom properties",
    "themes/[theme]/components.tsx": "Theme-specific component overrides",
  },
  usage: "ThemeProvider wraps app, useTheme hook for access",
};

// =============================================================================
// DASHBOARD
// =============================================================================

export const DASHBOARD = {
  description: "Customizable dashboard with draggable/resizable charts, persisted to localStorage",
  location: "src/components/dashboard/",
  layoutSystem: {
    type: "Pure pixel-based positioning (no grid snapping)",
    container: "position: relative with auto-expanding height",
    cards: "position: absolute with pixel coordinates",
    overlapping: "Allowed for flexible repositioning",
    constraints: {
      minWidth: 280,
      minHeight: 200,
      maxWidth: 1200,
      maxHeight: 800,
    },
  },
  defaultLayouts: {
    "proposal-status": { x: 0, y: 0, width: 380, height: 320 },
    "proposal-type": { x: 396, y: 0, width: 380, height: 320 },
    "ncl-progress": { x: 792, y: 0, width: 380, height: 320 },
    "voting-power": { x: 0, y: 336, width: 580, height: 320 },
    "participation": { x: 596, y: 336, width: 580, height: 320 },
  },
  zIndexLayers: {
    inactiveCard: 1,
    activeCard: 50,
    customizeDropdown: 100,
  },
  localStorage: {
    key: "dashboard-config",
    schema: {
      visibleCharts: "ChartId[]",
      layouts: "Record<ChartId, ChartLayout>",
      version: "number (current: 6)",
    },
  },
  ssrSafety: {
    pattern: "mounted state pattern",
    description: "Uses useState(false) + useEffect to detect client-side hydration",
    reason: "Prevents hydration mismatches when localStorage differs from server defaults",
  },
  chartRegistry: {
    location: "src/components/dashboard/charts/index.ts",
    charts: [
      { id: "proposal-status", title: "Proposal Status", description: "Active/Ratified/Enacted counts" },
      { id: "proposal-type", title: "Proposal Types", description: "Pie chart by action type" },
      { id: "ncl-progress", title: "NCL Progress", description: "Treasury NCL gauges" },
      { id: "voting-power", title: "Voting Power", description: "DRep/SPO voting breakdown" },
      { id: "participation", title: "Participation", description: "Vote participation rates" },
    ],
  },
  userInteractions: {
    moveCard: "Drag grip handle icon (top-right of card)",
    resizeCard: "Drag edges or corners (8 resize handles)",
    bringToFront: "Click anywhere on card",
    showHideCharts: "Customize dropdown button",
    resetDefaults: "Reset button in customize dropdown",
  },
};

// =============================================================================
// CODING CONVENTIONS
// =============================================================================

export const CODING_CONVENTIONS = {
  typescript: {
    strictMode: true,
    preferInterfaces: "Use interface for object types, type for unions",
    nullHandling: "Use optional chaining (?.) and nullish coalescing (??)",
    enumStyle: "String literal unions preferred over TypeScript enums",
  },
  react: {
    components: "Functional components with hooks",
    props: "Destructure props in function signature",
    state: "Redux for global state, useState for local state",
    effects: "useEffect for side effects, cleanup when needed",
  },
  imports: {
    aliasPath: "@/ maps to src/",
    order: [
      "React/Next.js imports",
      "Third-party libraries",
      "Internal types",
      "Internal components",
      "Internal utilities",
      "Styles",
    ],
  },
  naming: {
    components: "PascalCase (GovernanceTable.tsx)",
    utilities: "camelCase (voteBreakdownCalculator.ts)",
    types: "PascalCase (GovernanceAction)",
    constants: "SCREAMING_SNAKE_CASE (EPOCH_534_THRESHOLD)",
    props: "Props suffix (GovernanceTableProps)",
  },
  files: {
    oneComponentPerFile: true,
    indexExports: "Use index.ts for clean imports from directories",
    testFiles: "*.test.ts or *.test.tsx",
  },
};

// =============================================================================
// COMMON TASKS
// =============================================================================

export const COMMON_TASKS = {
  addNewComponent: {
    steps: [
      "Create component file in appropriate directory",
      "Define props interface with Props suffix",
      "Use shadcn/ui primitives where applicable",
      "Style with Tailwind CSS and cn() utility",
      "Export from directory index.ts if applicable",
    ],
  },
  addNewApiEndpoint: {
    steps: [
      "Create route file in src/pages/api/",
      "Use apiHelper.callApi() to proxy to backend",
      "Handle errors appropriately",
      "Add endpoint to config/api.ts",
      "Create service function in services/api.ts",
      "Add async thunk to Redux slice if needed",
    ],
  },
  modifyVoteCalculation: {
    steps: [
      "Review Conway Ledger spec for correct formula",
      "Update voteBreakdownCalculator.ts",
      "Check if epoch-dependent logic applies",
      "Update tests",
      "Verify UI displays correctly",
    ],
  },
  addVoterEligibility: {
    steps: [
      "Update ELIGIBILITY matrix in governanceVotingEligibility.ts",
      "Update LABEL_TO_PROPOSAL_TYPE mapping if new label",
      "Verify canRoleVoteOnAction returns correct values",
    ],
  },
  addNewTheme: {
    steps: [
      "Create new directory in src/themes/",
      "Create index.ts, tokens.css, components.tsx",
      "Export from themes/index.ts",
      "Add to theme selector UI",
    ],
  },
  addNewChart: {
    steps: [
      "Create chart component in src/components/dashboard/charts/",
      "Use ChartProps interface ({ isLoading, className })",
      "Use useTheme() for dark/light styling",
      "Use Redux selectors for data",
      "Add ChartId to src/types/dashboard.ts",
      "Add default layout to DEFAULT_CHART_LAYOUTS",
      "Register in src/components/dashboard/charts/index.ts CHART_REGISTRY",
      "Export from charts/index.ts",
    ],
    pattern: `
export function MyNewChart({ isLoading, className }: ChartProps) {
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;
  const data = useSelector(selectSomeData);

  if (isLoading || !data) {
    return <ChartSkeleton className={className} />;
  }

  return (
    <div className={cn(
      "rounded-2xl p-4 h-full",
      isDark ? "bg-[#1a1a2e] border border-[#0bd1a2]" : "bg-white border shadow-sm",
      className
    )}>
      <h3 className={cn("text-lg font-semibold mb-4", isDark ? "text-[#0bd1a2]" : "text-gray-900")}>
        Chart Title
      </h3>
      {/* Chart content using Recharts */}
    </div>
  );
}`,
  },
};

// =============================================================================
// EXPORT ALL KNOWLEDGE
// =============================================================================

export const ALL_KNOWLEDGE = {
  projectOverview: PROJECT_OVERVIEW,
  fileStructure: FILE_STRUCTURE,
  typeDefinitions: TYPE_DEFINITIONS,
  dataConventions: DATA_CONVENTIONS,
  voterEligibility: VOTER_ELIGIBILITY,
  voteCalculation: VOTE_CALCULATION,
  apiArchitecture: API_ARCHITECTURE,
  componentPatterns: COMPONENT_PATTERNS,
  theming: THEMING,
  dashboard: DASHBOARD,
  codingConventions: CODING_CONVENTIONS,
  commonTasks: COMMON_TASKS,
};
