import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

/**
 * Aggregated DRep rationale statistics + vote-change counts
 *
 * Fetches all DRep pages + details for DReps with votes, and returns
 * per-DRep { drepId, totalVotesCast, rationalesProvided, uniqueProposals, voteChanges }.
 *
 * Optimization: DReps with 0 votes (typically ~half) are returned with
 * zeroed stats immediately — no detail fetch needed. This cuts the N+1
 * from ~1500 detail calls to ~700.
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
    // 1. Fetch first DRep page + proposals count in parallel
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

    const proposalsData = await proposalsRes.json();
    const totalProposals = Array.isArray(proposalsData) ? proposalsData.length : 0;

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

    // 3. Split: DReps with votes need detail fetch; zero-vote DReps get zeroed stats
    const withVotes = allDreps.filter((d) => (d.totalVotesCast ?? 0) > 0);
    const withoutVotes = allDreps.filter((d) => (d.totalVotesCast ?? 0) === 0);

    const zeroResults = withoutVotes.map((d) => ZERO_STATS(d.drepId));

    // 4. Fetch details only for DReps with votes — bigger batches for speed
    const batchSize = 50;
    const fetchedResults: DRepStatResult[] = [];

    for (let i = 0; i < withVotes.length; i += batchSize) {
      const batch = withVotes.slice(i, i + batchSize);
      const details = await Promise.all(
        batch.map(async (drep) => {
          try {
            const r = await callApi({
              endpoint: `/dreps/${encodeURIComponent(drep.drepId)}`,
              method: "GET",
            });
            const d = await r.json();
            const participationPct = d.proposalParticipationPercent ?? 0;
            const totalVotes = d.totalVotesCast ?? 0;
            const uniqueProposals = totalProposals > 0
              ? Math.round(totalProposals * participationPct / 100)
              : 0;
            return {
              drepId: drep.drepId,
              totalVotesCast: totalVotes,
              rationalesProvided: d.rationalesProvided ?? 0,
              proposalParticipationPercent: participationPct,
              uniqueProposals,
              voteChanges: Math.max(0, totalVotes - uniqueProposals),
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
