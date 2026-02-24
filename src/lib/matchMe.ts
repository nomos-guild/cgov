import type { GovernanceAction, GovernanceActionDetail, VoteRecord } from "@/types/governance";

export type UserVote = "Yes" | "No" | "Abstain";

export interface MatchResult {
  drepId: string;
  drepName: string | null;
  matchPercent: number; // 0–100
  matchedCount: number; // how many proposals both user and DRep voted on
  totalProposals: number; // total proposals in quiz
  votes: Map<string, UserVote>; // DRep's actual votes on quiz proposals
}

/**
 * Select the best 5 proposals for the matching quiz.
 * Prefers Active proposals with the most votes and type diversity.
 */
export function selectProposals(
  actions: GovernanceAction[],
  count = 5
): GovernanceAction[] {
  // Prefer Active, then Ratified/Enacted as backfill
  const active = actions.filter((a) => a.status === "Active");
  const backup = actions.filter(
    (a) => a.status === "Ratified" || a.status === "Enacted"
  );

  // Sort by total votes descending (most-voted = best match data)
  const byVotes = (a: GovernanceAction, b: GovernanceAction) =>
    b.totalYes + b.totalNo + b.totalAbstain - (a.totalYes + a.totalNo + a.totalAbstain);
  active.sort(byVotes);
  backup.sort(byVotes);

  // Pick with type diversity: avoid picking 5 of the same type
  const selected: GovernanceAction[] = [];
  const usedTypes = new Set<string>();
  const pool = [...active, ...backup];

  // First pass: pick one per type (most-voted within each type)
  for (const action of pool) {
    if (selected.length >= count) break;
    if (!usedTypes.has(action.type)) {
      selected.push(action);
      usedTypes.add(action.type);
    }
  }

  // Second pass: fill remaining slots from most-voted regardless of type
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((s) => s.hash));
    for (const action of pool) {
      if (selected.length >= count) break;
      if (!selectedIds.has(action.hash)) {
        selected.push(action);
      }
    }
  }

  return selected;
}

/**
 * Build a vote index from proposal details: drepId → proposalHash → vote
 */
export function buildVoteIndex(
  details: GovernanceActionDetail[]
): Map<string, Map<string, UserVote>> {
  const index = new Map<string, Map<string, UserVote>>();

  for (const detail of details) {
    const proposalHash = detail.hash;
    const allVotes: VoteRecord[] = [...(detail.votes ?? []), ...(detail.ccVotes ?? [])];

    for (const vr of allVotes) {
      // Only index DRep votes (not SPO/CC)
      if (vr.voterType && vr.voterType !== "DRep") continue;
      const id = vr.drepId;
      if (!id) continue;

      let drepMap = index.get(id);
      if (!drepMap) {
        drepMap = new Map();
        index.set(id, drepMap);
      }
      drepMap.set(proposalHash, vr.vote);
    }
  }

  return index;
}

const MIN_OVERLAP = 2;

/**
 * Calculate match between user's votes and a single DRep's votes.
 * Returns a score 0–1 or -1 if insufficient overlap.
 */
function scoreMatch(
  userVotes: Map<string, UserVote>,
  drepVotes: Map<string, UserVote>
): { score: number; matchedCount: number } {
  let matches = 0;
  let compared = 0;

  for (const [hash, userVote] of userVotes) {
    const drepVote = drepVotes.get(hash);
    if (!drepVote) continue;
    compared++;
    if (userVote === drepVote) matches++;
  }

  if (compared < MIN_OVERLAP) return { score: -1, matchedCount: matches };
  return { score: matches / userVotes.size, matchedCount: matches };
}

/**
 * Calculate matches for all DReps, sorted by match percentage descending.
 */
export function calculateMatches(
  userVotes: Map<string, UserVote>,
  voteIndex: Map<string, Map<string, UserVote>>,
  totalProposals: number,
  maxResults = 20
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const [drepId, drepVotes] of voteIndex) {
    const { score, matchedCount } = scoreMatch(userVotes, drepVotes);
    if (score < 0) continue;

    results.push({
      drepId,
      drepName: null, // Will be enriched by the component
      matchPercent: Math.round(score * 100),
      matchedCount,
      totalProposals,
      votes: drepVotes,
    });
  }

  // Sort: highest match first, then by matched count (more overlap = more reliable)
  results.sort((a, b) => {
    if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
    return b.matchedCount - a.matchedCount;
  });

  return results.slice(0, maxResults);
}
