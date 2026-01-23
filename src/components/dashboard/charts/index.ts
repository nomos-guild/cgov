import { BarChart3, PieChart, Gauge, Users, Vote, TrendingUp } from "lucide-react";
import { ProposalStatusChart } from "./ProposalStatusChart";
import { ProposalTypeChart } from "./ProposalTypeChart";
import { NCLProgressChart } from "./NCLProgressChart";
import { VotingPowerChart } from "./VotingPowerChart";
import { ParticipationChart } from "./ParticipationChart";
import { ProposalSubmissionChart } from "./ProposalSubmissionChart";
import type { ChartDefinition } from "@/types/dashboard";
import { DEFAULT_CHART_LAYOUTS } from "@/types/dashboard";

export const CHART_REGISTRY: ChartDefinition[] = [
  {
    id: "proposal-status",
    title: "Proposal Status",
    description: "Overview of active, ratified, enacted, and expired proposals",
    component: ProposalStatusChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["proposal-status"],
    icon: BarChart3,
  },
  {
    id: "proposal-type",
    title: "Proposal Types",
    description: "Distribution of proposals by governance action type",
    component: ProposalTypeChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["proposal-type"],
    icon: PieChart,
  },
  {
    id: "ncl-progress",
    title: "NCL Progress",
    description: "Net Change Limit tracking for treasury withdrawals",
    component: NCLProgressChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["ncl-progress"],
    icon: Gauge,
  },
  {
    id: "voting-power",
    title: "Voting Power",
    description: "DRep and SPO voting power distribution",
    component: VotingPowerChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["voting-power"],
    icon: Users,
  },
  {
    id: "participation",
    title: "Participation",
    description: "DRep participation rates across proposals",
    component: ParticipationChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["participation"],
    icon: Vote,
  },
  {
    id: "proposal-submission",
    title: "Proposal Submission",
    description: "Number of proposals submitted per month over time",
    component: ProposalSubmissionChart,
    defaultVisible: true,
    defaultLayout: DEFAULT_CHART_LAYOUTS["proposal-submission"],
    icon: TrendingUp,
  },
];

export function getChartById(id: string): ChartDefinition | undefined {
  return CHART_REGISTRY.find((chart) => chart.id === id);
}

export { ChartSkeleton } from "./ChartSkeleton";
export { ProposalStatusChart } from "./ProposalStatusChart";
export { ProposalTypeChart } from "./ProposalTypeChart";
export { NCLProgressChart } from "./NCLProgressChart";
export { VotingPowerChart } from "./VotingPowerChart";
export { ParticipationChart } from "./ParticipationChart";
export { ProposalSubmissionChart } from "./ProposalSubmissionChart";
