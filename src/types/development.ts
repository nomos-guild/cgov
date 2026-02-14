// ─── Shared ────────────────────────────────────────────────────────────────

export type DevelopmentRange = "7d" | "30d" | "90d" | "1y" | "5y";

// ─── Overview KPIs ──────────────────────────────────────────────────────────

export interface DevelopmentOverviewPrevious {
  activeRepos: number;
  totalContributors: number;
  totalCommits: number;
  totalPRs: number;
  avgMergeTimeHours: number | null;
}

export interface DevelopmentOverview {
  activeRepos: number;
  totalContributors: number;
  totalCommits: number;
  totalPRs: number;
  avgMergeTimeHours: number | null;
  period: { from: string; to: string };
  previous?: DevelopmentOverviewPrevious;
}

// ─── Activity Time-Series ───────────────────────────────────────────────────

export interface ActivityDataPoint {
  date: string;
  commits: number;
  prOpened: number;
  prMerged: number;
  issuesOpened: number;
  issuesClosed: number;
}

export interface DevelopmentActivity {
  range: string;
  data: ActivityDataPoint[];
  previous?: ActivityDataPoint[];
}

// ─── Top Repos ──────────────────────────────────────────────────────────────

export interface RepoSummary {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  recentCommits: number;
  recentPRs: number;
  lastActivityAt: string | null;
  syncTier: string;
  starGain: number;
}

export interface DevelopmentRepos {
  repos: RepoSummary[];
  total: number;
}

// ─── Top Contributors ──────────────────────────────────────────────────────

export interface ContributorSummary {
  login: string;
  avatarUrl: string | null;
  totalCommits: number;
  totalPRs: number;
  repoCount: number;
  orgCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  isActive: boolean;
}

export interface DevelopmentContributors {
  contributors: ContributorSummary[];
  total: number;
  range: string;
}

// ─── Health Metrics ─────────────────────────────────────────────────────────

export interface DevelopmentHealthPrevious {
  maintenanceRate: number;
  avgMergeTimeHours: number | null;
  prCloseRate: number;
  issueCloseRate: number;
  retentionRate: number | null;
  codeVelocity: number | null;
  avgIssueResolutionHours: number | null;
  releaseCadence: number;
  ecosystemGrowthRate: number | null;
  forkActivityRate: number | null;
}

export interface DevelopmentHealth {
  range: string;
  activeRepos: number;
  dormantRepos: number;
  maintenanceRate: number;
  avgMergeTimeHours: number | null;
  prCloseRate: number;
  issueCloseRate: number;
  newContributors: number;
  returningContributors: number;
  retentionRate: number | null;
  ghostingRate: number | null;
  abandonmentRate: number | null;
  codeVelocity: number | null;
  avgIssueResolutionHours: number | null;
  releaseCadence: number;
  ecosystemGrowthRate: number | null;
  forkActivityRate: number | null;
  starConcentration: number | null;
  previous?: DevelopmentHealthPrevious;
}

// ─── Star/Fork Trends ──────────────────────────────────────────────────────

export interface StarDataPoint {
  date: string;
  totalStars: number;
  totalForks: number;
}

export interface StarRepoShare {
  id: string;
  name: string;
  stars: number;
  share: number;
}

export interface DevelopmentStars {
  range: string;
  data: StarDataPoint[];
  topReposByStars: StarRepoShare[];
}

// ─── Language Distribution ─────────────────────────────────────────────────

export interface LanguageBreakdown {
  language: string;
  repoCount: number;
  totalStars: number;
  totalCommits: number;
}

export interface DevelopmentLanguages {
  languages: LanguageBreakdown[];
  previous?: LanguageBreakdown[];
}

// ─── Network Graph ─────────────────────────────────────────────────────────

export interface RepoMeta {
  language?: string;
  stars: number;
  forks: number;
  description?: string;
  lastActivityAt?: string;
  syncTier: string;
  isArchived: boolean;
  commitCount: number;
}

export interface DevMeta {
  avatarUrl?: string;
  totalCommits: number;
  totalPRs: number;
  lastSeenAt?: string;
  isActive: boolean;
  repoCount: number;
  orgCount: number;
  isBridge: boolean;
}

export interface OrgMeta {
  repoCount: number;
  commitCount: number;
}

export interface GraphNode {
  id: string;
  type: "org" | "repo" | "developer";
  label: string;
  size: number;
  meta?: RepoMeta | DevMeta | OrgMeta;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface OrgBreakdown {
  org: string;
  repoCount: number;
  commitCount: number;
  contributorCount: number;
}

export interface NetworkGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: string;
  rangeDays: number;
  orgBreakdown: OrgBreakdown[];
}

// ─── Recent Activity Feed ──────────────────────────────────────────────────

export interface RecentActivityItem {
  id: string;
  repoId: string;
  repoName: string | null;
  eventType: string;
  eventId: string;
  title: string | null;
  authorLogin: string | null;
  eventDate: string;
}

export interface DevelopmentRecent {
  events: RecentActivityItem[];
  total: number;
}

// ─── Redux State ───────────────────────────────────────────────────────────

export interface DevelopmentLoadingState {
  overview: boolean;
  activity: boolean;
  repos: boolean;
  contributors: boolean;
  health: boolean;
  stars: boolean;
  languages: boolean;
  network: boolean;
  recent: boolean;
}

export interface DevelopmentState {
  loading: DevelopmentLoadingState;
  errors: Record<string, string | null>;
  overview: DevelopmentOverview | null;
  activity: DevelopmentActivity | null;
  repos: DevelopmentRepos | null;
  contributors: DevelopmentContributors | null;
  health: DevelopmentHealth | null;
  stars: DevelopmentStars | null;
  languages: DevelopmentLanguages | null;
  network: NetworkGraphData | null;
  recent: DevelopmentRecent | null;
  selectedRange: DevelopmentRange;
  compareEnabled: boolean;
}
