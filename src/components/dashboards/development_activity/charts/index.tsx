import dynamic from "next/dynamic";
import {
  BarChart3, TrendingUp, GitPullRequest, Activity, Star, Code, Network, Rss, Building2,
} from "lucide-react";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import type { ChartDefinition } from "@/types/dashboard";
import { DEFAULT_CHART_LAYOUTS } from "@/types/dashboard";

const EcosystemKPICards = dynamic(
  () => import("./EcosystemKPICards").then((mod) => mod.EcosystemKPICards),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const EcosystemActivityChart = dynamic(
  () => import("./EcosystemActivityChart").then((mod) => mod.EcosystemActivityChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const TopReposChart = dynamic(
  () => import("./TopReposChart").then((mod) => mod.TopReposChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const PRStatusChart = dynamic(
  () => import("./PRStatusChart").then((mod) => mod.PRStatusChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const HealthRatesChart = dynamic(
  () => import("./HealthRatesChart").then((mod) => mod.HealthRatesChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const StarForkTrendsChart = dynamic(
  () => import("./StarForkTrendsChart").then((mod) => mod.StarForkTrendsChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const LanguageTrendsChart = dynamic(
  () => import("./LanguageTrendsChart").then((mod) => mod.LanguageTrendsChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const EcosystemNetworkGraph = dynamic(
  () => import("./EcosystemNetworkGraph").then((mod) => mod.EcosystemNetworkGraph),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const OrgContributionChart = dynamic(
  () => import("./OrgContributionChart").then((mod) => mod.OrgContributionChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const RecentActivityFeed = dynamic(
  () => import("./RecentActivityFeed").then((mod) => mod.RecentActivityFeed),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const CHART_REGISTRY: ChartDefinition[] = [
  {
    id: "ecosystem-kpis",
    title: "Ecosystem KPIs",
    description: "Active repos, contributors, commits, PRs, and merge time",
    component: EcosystemKPICards,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["ecosystem-kpis"]!,
    icon: BarChart3,
  },
  {
    id: "health-rates",
    title: "Ecosystem Health",
    description: "Maintenance rate, retention, and issue close rates",
    component: HealthRatesChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["health-rates"]!,
    icon: Activity,
  },
  {
    id: "ecosystem-activity",
    title: "Ecosystem Activity",
    description: "Commits, PRs, and issues over time",
    component: EcosystemActivityChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["ecosystem-activity"]!,
    icon: TrendingUp,
  },
  {
    id: "top-repos",
    title: "Top Repos",
    description: "Most active repositories by commit count",
    component: TopReposChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["top-repos"]!,
    icon: Star,
  },
{
    id: "pr-status",
    title: "PR Status",
    description: "Pull request merge status and velocity",
    component: PRStatusChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["pr-status"]!,
    icon: GitPullRequest,
  },
  {
    id: "star-fork-trends",
    title: "Star & Fork Trends",
    description: "Star velocity and fork activity over time",
    component: StarForkTrendsChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["star-fork-trends"]!,
    icon: TrendingUp,
  },
  {
    id: "org-contributions",
    title: "Org Contributions",
    description: "Organization contribution share by commits",
    component: OrgContributionChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["org-contributions"]!,
    icon: Building2,
  },
  {
    id: "language-trends",
    title: "Languages",
    description: "Language distribution across ecosystem repos",
    component: LanguageTrendsChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["language-trends"]!,
    icon: Code,
  },
  {
    id: "recent-activity",
    title: "Recent Activity",
    description: "Latest commits, PRs, issues, and releases",
    component: RecentActivityFeed,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["recent-activity"]!,
    icon: Rss,
  },
  {
    id: "ecosystem-network",
    title: "Ecosystem Network",
    description: "Force-directed graph of orgs, repos, and developers",
    component: EcosystemNetworkGraph,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["ecosystem-network"]!,
    icon: Network,
  },
];

export function getChartById(id: string): ChartDefinition | undefined {
  return CHART_REGISTRY.find((chart) => chart.id === id);
}
