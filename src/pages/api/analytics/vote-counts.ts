import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

interface VoteCounts {
  drep: number;
  spo: number;
  cc: number;
}

// Simple in-memory cache to avoid refetching on every request
let cache: { data: Record<string, VoteCounts>; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchJSON(endpoint: string) {
  const response = await callApi({ endpoint, method: "GET" });
  return response.json();
}

async function buildVoteCounts(): Promise<Record<string, VoteCounts>> {
  // 1. Fetch all proposals to get their IDs
  const proposals: { hash?: string; proposalId?: string }[] =
    await fetchJSON("/overview/proposals");

  if (!Array.isArray(proposals)) return {};

  const result: Record<string, VoteCounts> = {};

  // 2. Fetch each proposal's detail in batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < proposals.length; i += BATCH_SIZE) {
    const batch = proposals.slice(i, i + BATCH_SIZE);
    const details = await Promise.all(
      batch.map(async (p) => {
        const id = p.hash || p.proposalId;
        if (!id) return null;
        try {
          const detail = await fetchJSON(
            `/proposal/${encodeURIComponent(id)}`
          );
          return { id: p.hash, proposalId: p.proposalId, detail };
        } catch {
          return null;
        }
      })
    );

    for (const item of details) {
      if (!item?.detail) continue;

      const votes: { voterType?: string; drepId?: string }[] =
        item.detail.votes || [];
      const ccVotes: unknown[] = item.detail.ccVotes || [];

      const counts: VoteCounts = {
        drep: votes.filter(
          (v) =>
            v.voterType === "DRep" ||
            (!v.voterType && v.drepId)
        ).length,
        spo: votes.filter((v) => v.voterType === "SPO").length,
        cc: ccVotes.length,
      };

      // Key by both hash and proposalId so the client can match either
      if (item.id) result[item.id] = counts;
      if (item.proposalId) result[item.proposalId] = counts;
    }
  }

  return result;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Return cached data if fresh
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=120, stale-while-revalidate=600"
      );
      return res.status(200).json(cache.data);
    }

    const data = await buildVoteCounts();
    cache = { data, ts: Date.now() };

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=120, stale-while-revalidate=600"
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error("Vote counts API error:", error);
    return res.status(500).json({ error: "Failed to fetch vote counts" });
  }
}
