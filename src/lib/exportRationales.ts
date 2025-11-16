import type { Vote } from "@/types/governance";

// Mock rationale function - matches the one in VotingRecords
function getRationale(voterName: string | undefined, voterId: string, vote: string): string {
  const name = voterName || voterId;
  
  if (name === "SIPO") {
    return `SIPO has chosen to ${vote} on this proposal.

Our decision reflects both recognition of the proposal's innovation and concern for its structural implications on fairness, governance precedent, and long-term ecosystem balance.

On the Loan-Based Treasury Model
SIPO deeply appreciates the innovation behind this proposal—the introduction of a repayable, interest-bearing treasury loan.
This marks a significant step toward treating Cardano's treasury not merely as a grant pool, but as a public revolving fund—a self-sustaining capital engine for ecosystem growth.

Such a model introduces accountability and enables the treasury to recycle its funds through investment, repayment, and reinvestment, strengthening Cardano's financial autonomy and maturity as a decentralized system.

Why SIPO ${vote}s
SIPO supports the spirit and direction of this proposal:
• Introducing a repayable, audited, legally binding treasury mechanism;
• Enhancing visibility and liquidity for Cardano Native Tokens;
• And promoting sustainable financial governance.

We believe this pilot can become an educational milestone—demonstrating how a decentralized treasury can evolve from "funding" to responsible capital management, if built with transparency and replicability in mind.`;
  }

  const templates = {
    Yes: `After careful consideration, ${name} votes YES on this proposal.

We believe this initiative aligns with Cardano's long-term vision and will contribute positively to the ecosystem's growth. The proposal demonstrates:

• Clear objectives and measurable outcomes
• Responsible use of treasury funds
• Strong community support and engagement
• Alignment with Cardano's governance principles

We support this action and look forward to seeing its positive impact on the ecosystem.`,
    No: `${name} votes NO on this proposal.

While we appreciate the effort behind this submission, we have concerns about:

• The current structure and implementation plan
• Potential risks to the treasury and ecosystem
• Lack of sufficient detail in certain areas
• Questions about long-term sustainability

We encourage the proposers to address these concerns and potentially resubmit with improvements.`,
    Abstain: `${name} chooses to ABSTAIN on this proposal.

This decision reflects our position that while the proposal has merit, we require additional information or time for proper evaluation:

• Further community discussion needed
• Awaiting clarification on specific technical details
• Observing how governance precedent develops
• Maintaining neutrality on this particular matter

We remain engaged and will continue monitoring the proposal's progress.`,
  };

  return templates[vote as keyof typeof templates] || "No rationale provided.";
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
      rationale: getRationale(vote.voterName, vote.voterId, vote.vote),
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
    markdown += `${getRationale(vote.voterName, vote.voterId, vote.vote)}\n\n`;
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
    const rationale = getRationale(vote.voterName, vote.voterId, vote.vote)
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

