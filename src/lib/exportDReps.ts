import type { DRepSummary } from "@/types/drep";
import { downloadFile } from "@/lib/exportRationales";

/** Labels for localized DRep exports. */
export interface DRepExportLabels {
  headerRank: string;
  headerName: string;
  headerDRepId: string;
  headerVotingPower: string;
  headerPercentOfTotal: string;
  headerDelegators: string;
  headerVotesCast: string;
  headerVoteChanges: string;
  anonymous: string;
  title: string;
  exported: string;
  totalDReps: string;
}

interface DRepExportRow {
  rank: number;
  name: string;
  drepId: string;
  votingPowerAda: number;
  percentOfTotal: string;
  delegators: number | null;
  votesCast: number;
  voteChanges: number | string;
}

function buildRows(
  dreps: DRepSummary[],
  totalVotingPower: number,
  voteChangesMap: Map<string, number>,
  labels: DRepExportLabels,
): DRepExportRow[] {
  return dreps.map((drep, i) => ({
    rank: i + 1,
    name: drep.name || labels.anonymous,
    drepId: drep.drepId,
    votingPowerAda: drep.votingPowerAda,
    percentOfTotal: totalVotingPower > 0
      ? ((drep.votingPowerAda / totalVotingPower) * 100).toFixed(2)
      : "0.00",
    delegators: drep.delegatorCount,
    votesCast: drep.totalVotesCast,
    voteChanges: voteChangesMap.has(drep.drepId)
      ? voteChangesMap.get(drep.drepId)!
      : "--",
  }));
}

export function exportDRepsToJSON(
  dreps: DRepSummary[],
  totalVotingPower: number,
  voteChangesMap: Map<string, number>,
  labels: DRepExportLabels,
): string {
  const rows = buildRows(dreps, totalVotingPower, voteChangesMap, labels);
  const data = {
    title: labels.title,
    exportedAt: new Date().toISOString(),
    totalDReps: rows.length,
    dreps: rows.map((r) => ({
      rank: r.rank,
      name: r.name,
      drepId: r.drepId,
      votingPowerAda: r.votingPowerAda,
      percentOfTotal: `${r.percentOfTotal}%`,
      delegators: r.delegators,
      votesCast: r.votesCast,
      voteChanges: r.voteChanges,
    })),
  };
  return JSON.stringify(data, null, 2);
}

export function exportDRepsToMarkdown(
  dreps: DRepSummary[],
  totalVotingPower: number,
  voteChangesMap: Map<string, number>,
  labels: DRepExportLabels,
  locale?: string,
): string {
  const loc = locale ?? "en";
  const rows = buildRows(dreps, totalVotingPower, voteChangesMap, labels);

  let md = `# ${labels.title}\n\n`;
  md += `**${labels.exported}:** ${new Date().toLocaleString(loc)}\n`;
  md += `**${labels.totalDReps}:** ${rows.length}\n\n`;

  // Table header
  md += `| ${labels.headerRank} | ${labels.headerName} | ${labels.headerDRepId} | ${labels.headerVotingPower} | ${labels.headerPercentOfTotal} | ${labels.headerDelegators} | ${labels.headerVotesCast} | ${labels.headerVoteChanges} |\n`;
  md += `| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |\n`;

  for (const r of rows) {
    const shortId = r.drepId.length > 16
      ? `${r.drepId.slice(0, 8)}...${r.drepId.slice(-4)}`
      : r.drepId;
    md += `| ${r.rank} | ${r.name} | ${shortId} | ${r.votingPowerAda.toLocaleString(loc)} | ${r.percentOfTotal}% | ${r.delegators ?? "--"} | ${r.votesCast} | ${r.voteChanges} |\n`;
  }

  return md;
}

export function exportDRepsToCSV(
  dreps: DRepSummary[],
  totalVotingPower: number,
  voteChangesMap: Map<string, number>,
  labels: DRepExportLabels,
): string {
  const rows = buildRows(dreps, totalVotingPower, voteChangesMap, labels);

  const headers = [
    labels.headerRank,
    labels.headerName,
    labels.headerDRepId,
    labels.headerVotingPower,
    labels.headerPercentOfTotal,
    labels.headerDelegators,
    labels.headerVotesCast,
    labels.headerVoteChanges,
  ];

  const escapeField = (value: unknown): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""').replace(/\r?\n/g, " ");
    return `"${str}"`;
  };

  const csvRows = rows.map((r) =>
    [
      r.rank,
      escapeField(r.name),
      escapeField(r.drepId),
      r.votingPowerAda,
      `${r.percentOfTotal}%`,
      r.delegators ?? "",
      r.votesCast,
      r.voteChanges === "--" ? "" : r.voteChanges,
    ].join(",")
  );

  return "\uFEFF" + [headers.join(","), ...csvRows].join("\n");
}

export function handleDRepExport(
  format: "json" | "markdown" | "csv",
  dreps: DRepSummary[],
  totalVotingPower: number,
  voteChangesMap: Map<string, number>,
  labels: DRepExportLabels,
  locale?: string,
): void {
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseName = `drep-list-${timestamp}`;

  let content: string;
  let filename: string;
  let mimeType: string;

  switch (format) {
    case "json":
      content = exportDRepsToJSON(dreps, totalVotingPower, voteChangesMap, labels);
      filename = `${baseName}.json`;
      mimeType = "application/json;charset=utf-8";
      break;
    case "markdown":
      content = exportDRepsToMarkdown(dreps, totalVotingPower, voteChangesMap, labels, locale);
      filename = `${baseName}.md`;
      mimeType = "text/markdown;charset=utf-8";
      break;
    case "csv":
      content = exportDRepsToCSV(dreps, totalVotingPower, voteChangesMap, labels);
      filename = `${baseName}.csv`;
      mimeType = "text/csv;charset=utf-8";
      break;
  }

  downloadFile(content, filename, mimeType);
}
