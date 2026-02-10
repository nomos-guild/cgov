import dynamic from "next/dynamic";
import { BarChart3, PieChart, Gauge, TrendingUp, Users, FileText, Activity } from "lucide-react";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartDefinition } from "@/types/dashboard";
import { DEFAULT_CHART_LAYOUTS } from "@/types/dashboard";

// Lazy load all chart components to reduce initial bundle size
// Each chart imports Recharts (~800KB), so lazy loading significantly improves initial load
const ProposalStatusChart = dynamic(
  () => import("./ProposalStatusChart").then((mod) => mod.ProposalStatusChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const ProposalTypeChart = dynamic(
  () => import("./ProposalTypeChart").then((mod) => mod.ProposalTypeChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const NCLProgressChart = dynamic(
  () => import("./NCLProgressChart").then((mod) => mod.NCLProgressChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const ProposalSubmissionChart = dynamic(
  () => import("./ProposalSubmissionChart").then((mod) => mod.ProposalSubmissionChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const DRepVotingPowerChart = dynamic(
  () => import("./DRepVotingPowerChart").then((mod) => mod.DRepVotingPowerChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const DRepRationaleChart = dynamic(
  () => import("./DRepRationaleChart").then((mod) => mod.DRepRationaleChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const DRepMetricsCard = dynamic(
  () => import("./DRepMetricsCard").then((mod) => mod.DRepMetricsCard),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const CHART_REGISTRY: ChartDefinition[] = [
  {
    id: "proposal-status",
    title: "Proposal Status",
    description: "Overview of active, ratified, enacted, and expired proposals",
    component: ProposalStatusChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["proposal-status"]!,
    icon: BarChart3,
  },
  {
    id: "proposal-type",
    title: "Proposal Types",
    description: "Distribution of proposals by governance action type",
    component: ProposalTypeChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["proposal-type"]!,
    icon: PieChart,
  },
  {
    id: "ncl-progress",
    title: "NCL Progress",
    description: "Net Change Limit tracking for treasury withdrawals",
    component: NCLProgressChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["ncl-progress"]!,
    icon: Gauge,
  },
  {
    id: "proposal-submission",
    title: "Proposal Submission",
    description: "Number of proposals submitted per month over time",
    component: ProposalSubmissionChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["proposal-submission"]!,
    icon: TrendingUp,
  },
  {
    id: "drep-voting-power",
    title: "DRep Voting Power",
    description: "Voting power distribution among top DReps",
    component: DRepVotingPowerChart,
    defaultVisible: false,
    defaultLayout: DEFAULT_CHART_LAYOUTS["drep-voting-power"]!,
    icon: Users,
  },
  {
    id: "drep-rationale",
    title: "DRep Rationales",
    description: "DRep votes with vs without rationale provided",
    component: DRepRationaleChart,
    defaultVisible: false,
    defaultLayout: DEFAULT_CHART_LAYOUTS["drep-rationale"]!,
    icon: FileText,
  },
  {
    id: "drep-metrics",
    title: "DRep Metrics",
    description: "Key DRep statistics: total DReps and votes cast",
    component: DRepMetricsCard,
    defaultVisible: false,
    defaultLayout: DEFAULT_CHART_LAYOUTS["drep-metrics"]!,
    icon: Activity,
  },
];

export function getChartById(id: string): ChartDefinition | undefined {
  return CHART_REGISTRY.find((chart) => chart.id === id);
}

// Re-export components for direct use (these are lazy-loaded versions)
export { ChartSkeleton } from "./ChartSkeleton";
export {
  ProposalStatusChart,
  ProposalTypeChart,
  NCLProgressChart,
  ProposalSubmissionChart,
  DRepVotingPowerChart,
  DRepRationaleChart,
  DRepMetricsCard,
};
