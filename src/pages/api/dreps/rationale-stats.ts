import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

/**
 * Aggregated DRep rationale statistics + vote-change counts
 *
 * For each DRep with votes, fetches their detail (for rationalesProvided)
 * AND their actual votes (for accurate uniqueProposals / voteChanges).
 *
 * Computes engagement % using the same logic as the DRep profile page:
 * uniqueProposals / eligibleProposals (all statuses, filtered by DRep
 * eligibility, registration epoch, and active DRep vote existence).
 *
 * Cached for 5 minutes with stale-while-revalidate.
 */

type DRepStatResult = {
  drepId: string;
  totalVotesCast: number;
  rationalesProvided: number;
  proposalParticipationPercent: number;
  uniqueProposals: number;
  voteChanges: number;
};

const ZERO_STATS = (drepId: string): DRepStatResult => ({
  drepId,
  totalVotesCast: 0,
  rationalesProvided: 0,
  proposalParticipationPercent: 0,
  uniqueProposals: 0,
  voteChanges: 0,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Fetch first DRep page + all proposals in parallel
    const pageSize = 100;
    const [firstRes, proposalsRes] = await Promise.all([
      callApi({
        endpoint: `/dreps?page=1&pageSize=${pageSize}&sortBy=votingPower&sortOrder=desc`,
        method: "GET",
      }),
      callApi({ endpoint: "/overview/proposals", method: "GET" }),
    ]);
    const firstData = await firstRes.json();
    const { totalPages } = firstData.pagination;

    // Parse proposals for engagement calculation (same logic as DRep profile page)
    const proposalsData = await proposalsRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proposals: Array<any> = Array.isArray(proposalsData) ? proposalsData : [];

    // Determine if DReps could actually vote on a proposal (mirrors isDRepEligible on profile page)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function isDRepEligible(p: any): boolean {
      // If backend says no DRep threshold, DReps can't vote
      if (p.threshold && p.threshold.drepThreshold == null) return false;
      // For finished proposals, check if any active DRep actually voted
      if (p.status !== "Active" && p.drep?.breakdown) {
        const b = p.drep.breakdown;
        if (Number(b.activeYes || 0) === 0 && Number(b.activeNo || 0) === 0 && Number(b.activeAbstain || 0) === 0) {
          return false;
        }
      }
      return true;
    }

    // Pre-filter eligible proposals; use expiryEpoch so proposals still active
    // when a DRep registered are counted (they could vote on them).
    const eligibleProposals = proposals.filter(isDRepEligible);
    const eligibleByEpoch = (registeredEpoch: number | null) =>
      registeredEpoch != null
        ? eligibleProposals.filter((p) => (p.expiryEpoch ?? p.submissionEpoch ?? 0) >= registeredEpoch).length
        : eligibleProposals.length;

    // 2. Fetch remaining DRep pages in parallel
    const allDreps: Array<{ drepId: string; totalVotesCast?: number }> = [...firstData.dreps];

    if (totalPages > 1) {
      const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      const pages = await Promise.all(
        remaining.map(async (pg) => {
          const r = await callApi({
            endpoint: `/dreps?page=${pg}&pageSize=${pageSize}&sortBy=votingPower&sortOrder=desc`,
            method: "GET",
          });
          const d = await r.json();
          return d.dreps;
        })
      );
      for (const page of pages) allDreps.push(...page);
    }

    // 3. Split: DReps with votes need detail+votes fetch; zero-vote DReps get zeroed stats
    const withVotes = allDreps.filter((d) => (d.totalVotesCast ?? 0) > 0);
    const withoutVotes = allDreps.filter((d) => (d.totalVotesCast ?? 0) === 0);

    const zeroResults = withoutVotes.map((d) => ZERO_STATS(d.drepId));

    // 4. Fetch details AND votes for DReps with votes
    const batchSize = 25;
    const fetchedResults: DRepStatResult[] = [];

    for (let i = 0; i < withVotes.length; i += batchSize) {
      const batch = withVotes.slice(i, i + batchSize);
      const details = await Promise.all(
        batch.map(async (drep) => {
          try {
            // Fetch detail + votes in parallel per DRep
            const [detailRes, votesRes] = await Promise.all([
              callApi({
                endpoint: `/dreps/${encodeURIComponent(drep.drepId)}`,
                method: "GET",
              }),
              callApi({
                endpoint: `/dreps/${encodeURIComponent(drep.drepId)}/votes?page=1&pageSize=200`,
                method: "GET",
              }),
            ]);
            const detail = await detailRes.json();
            const votesData = await votesRes.json();
            const votes: Array<{ proposalId: string; vote: string; votedAt: string | null }> =
              votesData.votes ?? [];

            // Unique proposals = distinct proposalIds
            const votedProposalIds = new Set(votes.map((v) => v.proposalId));
            const uniqueProposals = votedProposalIds.size;

            // Vote changes = proposals where DRep actually changed vote value
            // (same logic as profile page: group by proposalId, check for 2+ distinct votes)
            const grouped = new Map<string, string[]>();
            for (const v of votes) {
              const list = grouped.get(v.proposalId) ?? [];
              list.push(v.vote);
              grouped.set(v.proposalId, list);
            }
            let voteChanges = 0;
            for (const [, voteList] of grouped) {
              if (new Set(voteList).size >= 2) voteChanges++;
            }

            // Engagement: same formula as DRep profile page
            // = uniqueProposals / eligibleProposals (filtered by registration epoch)
            const registeredEpoch = detail.registeredEpoch ?? null;
            const eligible = eligibleByEpoch(registeredEpoch);
            const correctedParticipation = eligible > 0
              ? (uniqueProposals / eligible) * 100
              : 0;

            return {
              drepId: drep.drepId,
              totalVotesCast: votes.length,
              rationalesProvided: detail.rationalesProvided ?? 0,
              proposalParticipationPercent: correctedParticipation,
              uniqueProposals,
              voteChanges,
            };
          } catch {
            return ZERO_STATS(drep.drepId);
          }
        })
      );
      fetchedResults.push(...details);
    }

    // Cache aggressively — this is an expensive endpoint
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return res.status(200).json({ dreps: [...fetchedResults, ...zeroResults] });
  } catch (error) {
    console.error("DRep rationale stats API error:", error);
    return res.status(500).json({ error: "Failed to fetch rationale stats" });
  }
}
