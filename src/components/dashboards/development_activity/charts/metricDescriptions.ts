export interface MetricInfo {
  description: string;
  formula?: string;
}

export const METRIC_DESCRIPTIONS: Record<string, MetricInfo> = {
  // ── HealthRatesChart (9 metrics) ──────────────────────────────────────
  maintenanceRate: {
    description: "Share of tracked repos classified as actively maintained versus total repos.",
    formula: "active repos / (active + dormant repos)",
  },
  retentionRate: {
    description: "Returning contributors as a share of all contributors. Higher means the ecosystem keeps its developers.",
    formula: "returning devs / (returning + new devs)",
  },
  codeVelocity: {
    description: "Average commits per active developer per month in the selected time range.",
    formula: "total commits / active devs / months",
  },
  abandonmentRate: {
    description: "Non-archived repos with no activity in the past year.",
    formula: "inactive repos (>1yr) / total non-archived repos",
  },
  ghostingRate: {
    description: "Developers who joined over a year ago but haven't contributed in 6+ months.",
    formula: "ghosted devs (last seen >6mo) / devs (joined >1yr)",
  },
  avgMergeTime: {
    description: "Average time from PR open to merge across all repos in the selected range.",
    formula: "AVG(merge timestamp − open timestamp)",
  },
  activeTotalRepos: {
    description: "Repos with recent activity versus total tracked repos in the ecosystem.",
  },
  releases: {
    description: "Total releases published across all repos in the selected time range.",
    formula: "SUM(releases_published)",
  },
  issueResolution: {
    description: "Average time from issue open to close, weighted by issue count per repo.",
    formula: "SUM(avg_hours × closed) / SUM(closed)",
  },

  // ── EcosystemKPICards (7 metrics) ─────────────────────────────────────
  activeRepos: {
    description: "Repositories with at least one commit, PR, or issue in the selected time range.",
  },
  contributors: {
    description: "Unique developers who authored commits or opened PRs in the selected range.",
  },
  commits: {
    description: "Total commits pushed across all tracked ecosystem repositories.",
  },
  pullRequests: {
    description: "Total pull requests (opened + merged + closed) across the ecosystem.",
  },
  kpiAvgMergeTime: {
    description: "Average hours from PR creation to merge. Compared to the previous equivalent period.",
    formula: "AVG(merge − open) in hours",
  },
  kpiReleases: {
    description: "Total releases published in the selected range. Indicates release cadence health.",
  },
  growthRate: {
    description: "New repos created in the selected range as a percentage of all tracked repos.",
    formula: "new repos in period / total repos",
  },

  // ── StarForkTrendsChart ───────────────────────────────────────────────
  starConcentration: {
    description: "Shows how star popularity is distributed. A high percentage means a few repos dominate star counts.",
    formula: "stars of top N repos / total stars",
  },
};
