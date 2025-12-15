import type { Vote } from "@/types/governance";

/**
 * Returns the rationale text coming from the backend, or a clear
 * message that no rationale data was provided.
 *
 * We intentionally do NOT generate any synthetic or template content here.
 */
function getRationale(rationale: string | undefined): string {
  if (rationale && rationale.trim().length > 0) {
    return rationale;
  }
  return "No rationale data provided.";
}

export function exportToJSON(votes: Vote[], proposalTitle: string): string {
  const data = {
    proposalTitle,
    exportedAt: new Date().toISOString(),
    totalVotes: votes.length,
    votes: votes.map((vote) => ({
      voterType: vote.voterType,
      voterId: vote.voterId,
      voterName: vote.voterName || null,
      vote: vote.vote,
      votingPower: vote.votingPower || null,
      votingPowerAda: vote.votingPowerAda || null,
      rationale: getRationale(vote.rationale),
      anchorUrl: vote.anchorUrl || null,
      anchorHash: vote.anchorHash || null,
      votedAt: vote.votedAt,
    })),
  };

  return JSON.stringify(data, null, 2);
}

export function exportToMarkdown(votes: Vote[], proposalTitle: string): string {
  let markdown = `# Voting Rationales: ${proposalTitle}\n\n`;
  markdown += `**Exported:** ${new Date().toLocaleString()}\n`;
  markdown += `**Total Votes:** ${votes.length}\n\n`;
  markdown += "---\n\n";

  votes.forEach((vote, index) => {
    const name = vote.voterName || vote.voterId;
    markdown += `## ${index + 1}. ${name} (${vote.voterType})\n\n`;
    markdown += `**Vote:** ${vote.vote}\n\n`;
    
    if (vote.votingPowerAda) {
      markdown += `**Voting Power:** ${vote.votingPowerAda.toLocaleString()} ADA\n\n`;
    }
    
    if (vote.votedAt) {
      markdown += `**Voted At:** ${new Date(vote.votedAt).toLocaleString()}\n\n`;
    }
    
    if (vote.anchorUrl) {
      markdown += `**Rationale Link:** [${vote.anchorUrl}](${vote.anchorUrl})\n\n`;
    }
    
    markdown += `### Rationale\n\n`;
    markdown += `${getRationale(vote.rationale)}\n\n`;
    markdown += "---\n\n";
  });

  return markdown;
}

export function exportToCSV(votes: Vote[], proposalTitle: string): string {
  const headers = [
    "Proposal",
    "Voter Type",
    "Voter ID",
    "Voter Name",
    "Vote",
    "Voting Power (ADA)",
    "Voted At",
    "Rationale",
    "Anchor URL",
  ];

  const rows = votes.map((vote) => {
    const rationale = getRationale(vote.rationale)
      .replace(/"/g, '""') // Escape quotes for CSV
      .replace(/\n/g, " "); // Replace newlines with spaces
    
    return [
      proposalTitle,
      vote.voterType,
      vote.voterId,
      vote.voterName || "",
      vote.vote,
      vote.votingPowerAda?.toLocaleString() || "",
      vote.votedAt ? new Date(vote.votedAt).toLocaleString() : "",
      `"${rationale}"`,
      vote.anchorUrl || "",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

