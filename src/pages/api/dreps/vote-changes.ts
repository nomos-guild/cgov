import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

/**
 * Aggregated DRep vote-change statistics
 *
 * For each DRep, fetches all vote pages and computes:
 * - uniqueProposals: number of distinct proposals voted on
 * - voteChanges: total vote transactions minus unique proposals
 *
 * One client call replaces hundreds of individual vote fetches.
 * Cached for 5 minutes with stale-while-revalidate.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Fetch all DReps (paginated)
    const pageSize = 100;
    const firstRes = await callApi({
      endpoint: `/dreps?page=1&pageSize=${pageSize}&sortBy=votingPower&sortOrder=desc`,
      method: "GET",
    });
    const firstData = await firstRes.json();
    const { totalPages } = firstData.pagination;

    const allDreps: Array<{ drepId: string }> = [...firstData.dreps];

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

    // 2. For each DRep, fetch all vote pages and count unique proposals
    const batchSize = 10; // Smaller batches since each DRep may need multiple pages
    const results: Array<{
      drepId: string;
      uniqueProposals: number;
      voteChanges: number;
    }> = [];

    for (let i = 0; i < allDreps.length; i += batchSize) {
      const batch = allDreps.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (drep) => {
          try {
            return await fetchVoteChangesForDRep(drep.drepId);
          } catch {
            return { drepId: drep.drepId, uniqueProposals: 0, voteChanges: 0 };
          }
        })
      );
      results.push(...batchResults);
    }

    // Cache aggressively — this is an expensive endpoint
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return res.status(200).json({ dreps: results });
  } catch (error) {
    console.error("DRep vote-changes API error:", error);
    return res.status(500).json({ error: "Failed to fetch vote change stats" });
  }
}

/**
 * Fetch all votes for a single DRep and compute unique proposals / vote changes.
 */
async function fetchVoteChangesForDRep(drepId: string) {
  const votesPageSize = 100;
  const encodedId = encodeURIComponent(drepId);

  // First page
  const firstRes = await callApi({
    endpoint: `/dreps/${encodedId}/votes?page=1&pageSize=${votesPageSize}`,
    method: "GET",
  });
  const firstData = await firstRes.json();
  const proposalIds: string[] = firstData.votes.map((v: { proposalId: string }) => v.proposalId);
  const { totalPages, totalItems } = firstData.pagination;

  // Remaining pages
  if (totalPages > 1) {
    const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const pages = await Promise.all(
      remaining.map(async (pg) => {
        const r = await callApi({
          endpoint: `/dreps/${encodedId}/votes?page=${pg}&pageSize=${votesPageSize}`,
          method: "GET",
        });
        const d = await r.json();
        return d.votes.map((v: { proposalId: string }) => v.proposalId);
      })
    );
    for (const page of pages) proposalIds.push(...page);
  }

  const uniqueProposals = new Set(proposalIds).size;
  const voteChanges = totalItems - uniqueProposals;

  return { drepId, uniqueProposals, voteChanges };
}
