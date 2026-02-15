import type { GovernanceAction, GovernanceActionDetail } from "@/types/governance";
import { downloadFile } from "@/lib/exportRationales";

export interface MetricsExportLabels {
  title: string;
  type: string;
  ccVotes: string;
  drepVotes: string;
  spoVotes: string;
  totalVotes: string;
  yesAda: string;
  noAda: string;
  abstainAda: string;
  totalAdaVoted: string;
  alwaysNoConfidence: string;
  notVotedAda: string;
}

function lovelaceToAda(lovelace: string | undefined): number {
  if (!lovelace) return 0;
  const val = Number(lovelace) / 1_000_000;
  return Number.isFinite(val) ? val : 0;
}

interface ProposalMetrics {
  title: string;
  type: string;
  ccVoteCount: number;
  drepVoteCount: number;
  spoVoteCount: number;
  totalVotes: number;
  yesAda: number;
  noAda: number;
  abstainAda: number;
  totalAdaVoted: number;
  alwaysNoConfidenceAda: number;
  notVotedAda: number;
}

export function buildProposalMetrics(
  action: GovernanceActionDetail,
): ProposalMetrics {
  // Count votes by role from individual vote records
  const drepVotes = (action.votes || []).filter(
    (v) => v.voterType === "DRep" || (!v.voterType && !v.voterName?.startsWith("pool")),
  );
  const spoVotes = (action.votes || []).filter(
    (v) => v.voterType === "SPO",
  );
  const ccVoteCount =
    (action.cc?.yesCount ?? 0) +
    (action.cc?.noCount ?? 0) +
    (action.cc?.abstainCount ?? 0);

  // ADA values from the action's aggregate data
  const yesAda = (action.drepYesAda ?? 0) + (action.spoYesAda ?? 0);
  const noAda = (action.drepNoAda ?? 0) + (action.spoNoAda ?? 0);
  const abstainAda = (action.drepAbstainAda ?? 0) + (action.spoAbstainAda ?? 0);

  // AlwaysNoConfidence from DRep + SPO breakdowns
  const ancAda =
    lovelaceToAda(action.drepBreakdown?.alwaysNoConfidence) +
    lovelaceToAda(action.spoBreakdown?.alwaysNoConfidence);

  // Not Voted (registered but didn't vote)
  const notVotedAda =
    lovelaceToAda(action.drepBreakdown?.notVoted) +
    lovelaceToAda(action.spoBreakdown?.notVoted);

  const totalVotes = drepVotes.length + spoVotes.length + ccVoteCount;

  return {
    title: action.title,
    type: action.type,
    ccVoteCount,
    drepVoteCount: drepVotes.length,
    spoVoteCount: spoVotes.length,
    totalVotes,
    yesAda,
    noAda,
    abstainAda,
    totalAdaVoted: yesAda + noAda + abstainAda,
    alwaysNoConfidenceAda: ancAda,
    notVotedAda,
  };
}

export function exportMetricsToCSV(
  metrics: ProposalMetrics,
  labels: MetricsExportLabels,
): string {
  const headers = [
    labels.title,
    labels.type,
    labels.ccVotes,
    labels.drepVotes,
    labels.spoVotes,
    labels.totalVotes,
    labels.yesAda,
    labels.noAda,
    labels.abstainAda,
    labels.totalAdaVoted,
    labels.alwaysNoConfidence,
    labels.notVotedAda,
  ];

  const escapeField = (value: unknown): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""').replace(/\r?\n/g, " ");
    return `"${str}"`;
  };

  const row = [
    escapeField(metrics.title),
    escapeField(metrics.type),
    escapeField(metrics.ccVoteCount),
    escapeField(metrics.drepVoteCount),
    escapeField(metrics.spoVoteCount),
    escapeField(metrics.totalVotes),
    escapeField(metrics.yesAda.toFixed(6)),
    escapeField(metrics.noAda.toFixed(6)),
    escapeField(metrics.abstainAda.toFixed(6)),
    escapeField(metrics.totalAdaVoted.toFixed(6)),
    escapeField(metrics.alwaysNoConfidenceAda.toFixed(6)),
    escapeField(metrics.notVotedAda.toFixed(6)),
  ].join(",");

  return "\uFEFF" + [headers.join(","), row].join("\n");
}

export function exportMetricsToMarkdown(
  metrics: ProposalMetrics,
  labels: MetricsExportLabels,
): string {
  const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 6 });

  let md = `# ${metrics.title}\n\n`;
  md += `**${labels.type}:** ${metrics.type}\n\n`;
  md += `---\n\n`;
  md += `## Vote Counts\n\n`;
  md += `| ${labels.ccVotes} | ${labels.drepVotes} | ${labels.spoVotes} | ${labels.totalVotes} |\n`;
  md += `| --- | --- | --- | --- |\n`;
  md += `| ${metrics.ccVoteCount} | ${metrics.drepVoteCount} | ${metrics.spoVoteCount} | ${metrics.totalVotes} |\n\n`;
  md += `## ADA Values\n\n`;
  md += `| ${labels.yesAda} | ${labels.noAda} | ${labels.abstainAda} | ${labels.totalAdaVoted} |\n`;
  md += `| --- | --- | --- | --- |\n`;
  md += `| ${fmt(metrics.yesAda)} | ${fmt(metrics.noAda)} | ${fmt(metrics.abstainAda)} | ${fmt(metrics.totalAdaVoted)} |\n\n`;
  md += `| ${labels.alwaysNoConfidence} | ${labels.notVotedAda} |\n`;
  md += `| --- | --- |\n`;
  md += `| ${fmt(metrics.alwaysNoConfidenceAda)} | ${fmt(metrics.notVotedAda)} |\n`;

  return md;
}

export function exportMetricsToJSON(metrics: ProposalMetrics): string {
  return JSON.stringify(
    {
      title: metrics.title,
      type: metrics.type,
      exportedAt: new Date().toISOString(),
      voteCounts: {
        cc: metrics.ccVoteCount,
        drep: metrics.drepVoteCount,
        spo: metrics.spoVoteCount,
        total: metrics.totalVotes,
      },
      adaValues: {
        yesAda: metrics.yesAda,
        noAda: metrics.noAda,
        abstainAda: metrics.abstainAda,
        totalAdaVoted: metrics.totalAdaVoted,
        alwaysNoConfidenceAda: metrics.alwaysNoConfidenceAda,
        notVotedAda: metrics.notVotedAda,
      },
    },
    null,
    2,
  );
}

export function downloadMetrics(
  action: GovernanceActionDetail,
  format: "csv" | "json" | "markdown",
  labels: MetricsExportLabels,
) {
  const metrics = buildProposalMetrics(action);
  const sanitizedTitle = action.title
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase();
  const timestamp = new Date().toISOString().split("T")[0];

  if (format === "csv") {
    const content = exportMetricsToCSV(metrics, labels);
    downloadFile(
      content,
      `proposal-metrics-${sanitizedTitle}-${timestamp}.csv`,
      "text/csv",
    );
  } else if (format === "markdown") {
    const content = exportMetricsToMarkdown(metrics, labels);
    downloadFile(
      content,
      `proposal-metrics-${sanitizedTitle}-${timestamp}.md`,
      "text/markdown",
    );
  } else {
    const content = exportMetricsToJSON(metrics);
    downloadFile(
      content,
      `proposal-metrics-${sanitizedTitle}-${timestamp}.json`,
      "application/json",
    );
  }
}

// ---------------------------------------------------------------------------
// Bulk export — all proposals from the landing page
// ---------------------------------------------------------------------------

export interface BulkMetricsExportLabels extends MetricsExportLabels {
  status: string;
}

interface BulkProposalMetrics extends ProposalMetrics {
  status: string;
}

export interface ProposalVoteCounts {
  drep: number;
  spo: number;
  cc: number;
}

function buildBulkProposalMetrics(
  action: GovernanceAction,
  voteCounts?: ProposalVoteCounts,
): BulkProposalMetrics {
  const ccVoteCount = voteCounts?.cc ??
    (action.ccYesCount ?? 0) +
    (action.ccNoCount ?? 0) +
    (action.ccAbstainCount ?? 0);

  const totalVotesFallback = action.totalYes + action.totalNo + action.totalAbstain;
  const drepVoteCount = voteCounts?.drep ?? (totalVotesFallback - ccVoteCount);
  const spoVoteCount = voteCounts?.spo ?? 0;

  const yesAda = (action.drepYesAda ?? 0) + (action.spoYesAda ?? 0);
  const noAda = (action.drepNoAda ?? 0) + (action.spoNoAda ?? 0);
  const abstainAda = (action.drepAbstainAda ?? 0) + (action.spoAbstainAda ?? 0);

  const ancAda =
    lovelaceToAda(action.drepBreakdown?.alwaysNoConfidence) +
    lovelaceToAda(action.spoBreakdown?.alwaysNoConfidence);

  const notVotedAda =
    lovelaceToAda(action.drepBreakdown?.notVoted) +
    lovelaceToAda(action.spoBreakdown?.notVoted);

  const totalVotes = action.totalYes + action.totalNo + action.totalAbstain;

  return {
    title: action.title,
    type: action.type,
    status: action.status,
    ccVoteCount,
    drepVoteCount,
    spoVoteCount,
    totalVotes,
    yesAda,
    noAda,
    abstainAda,
    totalAdaVoted: yesAda + noAda + abstainAda,
    alwaysNoConfidenceAda: ancAda,
    notVotedAda,
  };
}

function bulkMetricsToCSV(
  rows: BulkProposalMetrics[],
  labels: BulkMetricsExportLabels,
): string {
  const headers = [
    labels.title,
    labels.type,
    labels.status,
    labels.ccVotes,
    labels.drepVotes,
    labels.spoVotes,
    labels.totalVotes,
    labels.yesAda,
    labels.noAda,
    labels.abstainAda,
    labels.totalAdaVoted,
    labels.alwaysNoConfidence,
    labels.notVotedAda,
  ];

  const escapeField = (value: unknown): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""').replace(/\r?\n/g, " ");
    return `"${str}"`;
  };

  const csvRows = rows.map((m) =>
    [
      escapeField(m.title),
      escapeField(m.type),
      escapeField(m.status),
      escapeField(m.ccVoteCount),
      escapeField(m.drepVoteCount),
      escapeField(m.spoVoteCount),
      escapeField(m.totalVotes),
      escapeField(m.yesAda.toFixed(6)),
      escapeField(m.noAda.toFixed(6)),
      escapeField(m.abstainAda.toFixed(6)),
      escapeField(m.totalAdaVoted.toFixed(6)),
      escapeField(m.alwaysNoConfidenceAda.toFixed(6)),
      escapeField(m.notVotedAda.toFixed(6)),
    ].join(","),
  );

  return "\uFEFF" + [headers.join(","), ...csvRows].join("\n");
}

function bulkMetricsToJSON(rows: BulkProposalMetrics[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      totalProposals: rows.length,
      proposals: rows.map((m) => ({
        title: m.title,
        type: m.type,
        status: m.status,
        voteCounts: {
          cc: m.ccVoteCount,
          drep: m.drepVoteCount,
          spo: m.spoVoteCount,
          total: m.totalVotes,
        },
        adaValues: {
          yesAda: m.yesAda,
          noAda: m.noAda,
          abstainAda: m.abstainAda,
          totalAdaVoted: m.totalAdaVoted,
          alwaysNoConfidenceAda: m.alwaysNoConfidenceAda,
          notVotedAda: m.notVotedAda,
        },
      })),
    },
    null,
    2,
  );
}

function bulkMetricsToMarkdown(
  rows: BulkProposalMetrics[],
  labels: BulkMetricsExportLabels,
): string {
  const fmt = (v: number) =>
    v.toLocaleString("en-US", { maximumFractionDigits: 2 });

  let md = `# Governance Proposals Metrics\n\n`;
  md += `**Exported:** ${new Date().toISOString().split("T")[0]}  \n`;
  md += `**Total Proposals:** ${rows.length}\n\n`;
  md += `---\n\n`;

  // Summary table
  md += `| ${labels.title} | ${labels.type} | ${labels.status} | ${labels.ccVotes} | ${labels.drepVotes} | ${labels.spoVotes} | ${labels.totalVotes} | ${labels.yesAda} | ${labels.noAda} | ${labels.abstainAda} |\n`;
  md += `| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;

  for (const m of rows) {
    md += `| ${m.title.replace(/\|/g, "\\|")} | ${m.type} | ${m.status} | ${m.ccVoteCount} | ${m.drepVoteCount} | ${m.spoVoteCount} | ${m.totalVotes} | ${fmt(m.yesAda)} | ${fmt(m.noAda)} | ${fmt(m.abstainAda)} |\n`;
  }

  return md;
}

export function downloadBulkMetrics(
  actions: GovernanceAction[],
  format: "csv" | "json" | "markdown",
  labels: BulkMetricsExportLabels,
  voteCountsMap?: Record<string, ProposalVoteCounts>,
) {
  const rows = actions.map((a) =>
    buildBulkProposalMetrics(
      a,
      voteCountsMap?.[a.hash] || voteCountsMap?.[a.proposalId || ""],
    ),
  );
  const timestamp = new Date().toISOString().split("T")[0];

  if (format === "csv") {
    downloadFile(
      bulkMetricsToCSV(rows, labels),
      `all-proposals-metrics-${timestamp}.csv`,
      "text/csv",
    );
  } else if (format === "markdown") {
    downloadFile(
      bulkMetricsToMarkdown(rows, labels),
      `all-proposals-metrics-${timestamp}.md`,
      "text/markdown",
    );
  } else {
    downloadFile(
      bulkMetricsToJSON(rows),
      `all-proposals-metrics-${timestamp}.json`,
      "application/json",
    );
  }
}
