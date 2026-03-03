import type {
  GovernanceAction,
  ProposalType,
  ProposalStatus,
} from "@/types/governance";

export const TYPE_LABELS: Record<ProposalType, string> = {
  NoConfidence: "Motion of No-Confidence",
  UpdateCommittee: "Update Committee / Terms",
  NewConstitution: "Constitution Update",
  HardForkInitiation: "Hard Fork Initiation",
  ParameterChange: "Protocol Parameter Change",
  Treasury: "Treasury Withdrawal",
  InfoAction: "Info Action",
};

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  Active: "Active",
  Ratified: "Ratified",
  Enacted: "Enacted",
  Expired: "Expired",
  Closed: "Closed",
};

export const SHOWCASE_ORDER: ProposalType[] = [
  "NoConfidence",
  "UpdateCommittee",
  "NewConstitution",
  "HardForkInitiation",
  "ParameterChange",
  "Treasury",
  "InfoAction",
];

/**
 * Map API type labels (e.g. "Update Committee", "Info Action") to the
 * internal ProposalType keys used by filters and eligibility logic.
 */
export function mapTypeLabelToProposalType(typeLabel: string): ProposalType | null {
  const normalized = typeLabel.trim().toLowerCase();

  switch (normalized) {
    case "no confidence":
      return "NoConfidence";
    case "update committee":
      return "UpdateCommittee";
    case "new constitution":
      return "NewConstitution";
    case "hard fork initiation":
      return "HardForkInitiation";
    case "protocol parameter change":
      return "ParameterChange";
    case "treasury withdrawals":
    case "treasury withdrawal":
      return "Treasury";
    case "info action":
      return "InfoAction";
    default:
      return null;
  }
}

export function getStatusColor(status: GovernanceAction["status"]): string {
  return status === "Active" ? "text-foreground" : "text-foreground/60";
}

export function getStatusIndicatorColor(
  status: GovernanceAction["status"],
  isGame: boolean
): { color: string; animate: boolean } | null {
  switch (status) {
    case "Active":
      return { color: "bg-green-500", animate: true };
    case "Ratified":
    case "Enacted":
      return {
        color: isGame ? "bg-green-400" : "bg-green-500 dark:bg-[#0bd1a2]",
        animate: false,
      };
    case "Expired":
    case "Closed":
      return {
        color: isGame ? "bg-red-400" : "bg-red-500 dark:bg-[#8C200B]",
        animate: false,
      };
    default:
      return null;
  }
}

export function getTypeLabel(type: GovernanceAction["type"]): string {
  const mapped = mapTypeLabelToProposalType(type as string);
  if (mapped && mapped in TYPE_LABELS) return TYPE_LABELS[mapped];
  if (type in TYPE_LABELS) return TYPE_LABELS[type as ProposalType];
  return type;
}
