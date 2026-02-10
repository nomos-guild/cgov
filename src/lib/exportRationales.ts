import type { Vote } from "@/types/governance";

/** Labels that must be provided by the caller for localized exports. */
export interface ExportLabels {
  noRationale: string;
  voteYes: string;
  voteNo: string;
  voteAbstain: string;
  headingVotingRationales: string;
  labelExported: string;
  labelTotalVotes: string;
  labelVote: string;
  labelVotingPower: string;
  labelVotedAt: string;
  labelRationaleLink: string;
  headingRationale: string;
  csvProposal: string;
  csvVoterType: string;
  csvVoterId: string;
  csvVoterName: string;
  csvVote: string;
  csvVotingPower: string;
  csvVotedAt: string;
  csvRationale: string;
  csvAnchorUrl: string;
}

function translateVoteValue(vote: string, labels: ExportLabels): string {
  switch (vote) {
    case "Yes":
      return labels.voteYes;
    case "No":
      return labels.voteNo;
    case "Abstain":
      return labels.voteAbstain;
    default:
      return vote;
  }
}

/**
 * Extract rationale text. The backend may return:
 * - Plain text
 * - CIP-100 JSON ({ body: { comment } })
 * - CIP-136 JSON ({ body: { rationaleStatement, conclusion } })
 * - Legacy { comment }
 */
export function getRationale(
  raw: string | undefined | null,
  noRationaleFallback?: string,
): string {
  if (!raw || raw.trim().length === 0)
    return noRationaleFallback ?? "No rationale data provided.";

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as {
        body?: {
          comment?: string;
          rationaleStatement?: string;
          conclusion?: string;
        };
        comment?: string;
      };

      if (obj.body?.comment) return obj.body.comment;

      if (obj.body?.rationaleStatement) {
        const statement = obj.body.rationaleStatement;
        const conclusion = obj.body.conclusion
          ? `\n\n${obj.body.conclusion}`
          : "";
        return `${statement}${conclusion}`.trim();
      }

      if (obj.comment) return obj.comment;
    }
  } catch {
    // not JSON, fall through
  }

  return raw;
}

export function exportToJSON(
  votes: Vote[],
  proposalTitle: string,
  labels?: ExportLabels,
): string {
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
      rationale: getRationale(vote.rationale, labels?.noRationale),
      anchorUrl: vote.anchorUrl || null,
      anchorHash: vote.anchorHash || null,
      votedAt: vote.votedAt,
    })),
  };

  return JSON.stringify(data, null, 2);
}

export function exportToMarkdown(
  votes: Vote[],
  proposalTitle: string,
  labels: ExportLabels,
  locale?: string,
): string {
  const loc = locale ?? "en";
  let markdown = `# ${labels.headingVotingRationales}: ${proposalTitle}\n\n`;
  markdown += `**${labels.labelExported}:** ${new Date().toLocaleString(loc)}\n`;
  markdown += `**${labels.labelTotalVotes}:** ${votes.length}\n\n`;
  markdown += "---\n\n";

  votes.forEach((vote, index) => {
    const name = vote.voterName || vote.voterId;
    markdown += `## ${index + 1}. ${name} (${vote.voterType})\n\n`;
    markdown += `**${labels.labelVote}:** ${translateVoteValue(vote.vote, labels)}\n\n`;

    if (vote.votingPowerAda) {
      markdown += `**${labels.labelVotingPower}:** ${vote.votingPowerAda.toLocaleString(loc)} ADA\n\n`;
    }

    if (vote.votedAt) {
      markdown += `**${labels.labelVotedAt}:** ${new Date(vote.votedAt).toLocaleString(loc)}\n\n`;
    }

    if (vote.anchorUrl) {
      markdown += `**${labels.labelRationaleLink}:** [${vote.anchorUrl}](${vote.anchorUrl})\n\n`;
    }

    markdown += `### ${labels.headingRationale}\n\n`;
    markdown += `${getRationale(vote.rationale, labels.noRationale)}\n\n`;
    markdown += "---\n\n";
  });

  return markdown;
}

export function exportToCSV(
  votes: Vote[],
  proposalTitle: string,
  labels: ExportLabels,
): string {
  const headers = [
    labels.csvProposal,
    labels.csvVoterType,
    labels.csvVoterId,
    labels.csvVoterName,
    labels.csvVote,
    labels.csvVotingPower,
    labels.csvVotedAt,
    labels.csvRationale,
    labels.csvAnchorUrl,
  ];

  const escapeField = (value: unknown): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""').replace(/\r?\n/g, " ");
    return `"${str}"`;
  };

  const rows = votes.map((vote) => {
    const rationale = getRationale(vote.rationale, labels.noRationale);
    const votedAt = vote.votedAt ? new Date(vote.votedAt).toISOString() : "";
    const votingPower = vote.votingPowerAda ?? "";

    return [
      escapeField(proposalTitle),
      escapeField(vote.voterType),
      escapeField(vote.voterId),
      escapeField(vote.voterName || ""),
      escapeField(translateVoteValue(vote.vote, labels)),
      escapeField(votingPower),
      escapeField(votedAt),
      escapeField(rationale),
      escapeField(vote.anchorUrl || ""),
    ].join(",");
  });

  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
) {
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

/**
 * Translate all rationale texts in votes via the DeepL API before export.
 * Returns a new votes array with translated rationale fields.
 * Skips translation for English locale or empty rationales.
 */
export async function translateVotesForExport(
  votes: Vote[],
  locale: string,
): Promise<Vote[]> {
  if (locale === "en" || votes.length === 0) return votes;

  // Collect unique rationale texts that need translation
  const uniqueTexts = new Map<string, string>();
  for (const vote of votes) {
    const text = getRationale(vote.rationale);
    if (text && text !== "No rationale data provided." && !uniqueTexts.has(text)) {
      uniqueTexts.set(text, "");
    }
  }

  if (uniqueTexts.size === 0) return votes;

  // Translate in parallel batches of 5 to avoid overwhelming the API
  const entries = Array.from(uniqueTexts.keys());
  const batchSize = 5;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (text) => {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, targetLang: locale }),
        });
        if (!response.ok) return text;
        const data = await response.json();
        return data.translatedText as string;
      }),
    );

    results.forEach((result, idx) => {
      uniqueTexts.set(
        batch[idx],
        result.status === "fulfilled" ? result.value : batch[idx],
      );
    });
  }

  // Map translated rationales back onto votes
  return votes.map((vote) => {
    const originalText = getRationale(vote.rationale);
    const translated = uniqueTexts.get(originalText);
    if (translated && translated !== originalText) {
      return { ...vote, rationale: translated };
    }
    return vote;
  });
}
