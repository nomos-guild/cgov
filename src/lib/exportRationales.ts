import type { Vote } from "@/types/governance";

/**
 * Extract rationale text. The backend may return:
 * - Plain text
 * - CIP-100 JSON ({ body: { comment } })
 * - CIP-136 JSON ({ body: { rationaleStatement, conclusion } })
 * - Legacy { comment }
 */
export function getRationale(raw: string | undefined | null): string {
  if (!raw || raw.trim().length === 0) return "No rationale data provided.";

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as {
        body?: { comment?: string; rationaleStatement?: string; conclusion?: string };
        comment?: string;
      };

      if (obj.body?.comment) return obj.body.comment;

      if (obj.body?.rationaleStatement) {
        const statement = obj.body.rationaleStatement;
        const conclusion = obj.body.conclusion ? `\n\n${obj.body.conclusion}` : "";
        return `${statement}${conclusion}`.trim();
      }

      if (obj.comment) return obj.comment;
    }
  } catch {
    // not JSON, fall through
  }

  return raw;
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

  const escapeField = (value: unknown): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""').replace(/\r?\n/g, " ");
    return `"${str}"`;
  };

  const rows = votes.map((vote) => {
    const rationale = getRationale(vote.rationale);
    const votedAt = vote.votedAt
      ? new Date(vote.votedAt).toISOString()
      : "";
    const votingPower = vote.votingPowerAda ?? "";

    return [
      escapeField(proposalTitle),
      escapeField(vote.voterType),
      escapeField(vote.voterId),
      escapeField(vote.voterName || ""),
      escapeField(vote.vote),
      escapeField(votingPower),
      escapeField(votedAt),
      escapeField(rationale),
      escapeField(vote.anchorUrl || ""),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
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

