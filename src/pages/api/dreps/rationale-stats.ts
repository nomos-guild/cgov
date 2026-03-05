import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";
import { callApi } from "@/utils/apiHelper";

/**
 * Aggregated DRep rationale statistics + vote-change counts
 *
 * Two strategies:
 * 1. Direct SQL (fast path) — when DATABASE_URL is available, runs a single query
 * 2. Backend API fallback — concurrent pool of API requests (no sequential batching)
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

// ---------------------------------------------------------------------------
// Strategy 1: Direct SQL (sub-second, preferred)
// ---------------------------------------------------------------------------

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

const RATIONALE_STATS_SQL = `
WITH eligible_proposals AS (
  SELECT
    proposal_id,
    COALESCE(expiration_epoch, submission_epoch, 0) AS effective_epoch
  FROM proposal
  WHERE
    drep_total_vote_power IS NOT NULL
    AND (
      status = 'ACTIVE'
      OR COALESCE(drep_active_yes_vote_power, 0) > 0
      OR COALESCE(drep_active_no_vote_power, 0) > 0
      OR COALESCE(drep_active_abstain_vote_power, 0) > 0
    )
),
total_eligible AS (
  SELECT COUNT(*) AS total FROM eligible_proposals
),
drep_reg AS (
  SELECT drep_id, MIN(epoch_no) AS registered_epoch
  FROM drep_lifecycle_event
  WHERE action = 'registration'
  GROUP BY drep_id
),
drep_stats AS (
  SELECT
    v.drep_id,
    COUNT(*)::int AS total_votes_cast,
    COUNT(DISTINCT v.proposal_id)::int AS unique_proposals,
    COUNT(*) FILTER (
      WHERE v.rationale IS NOT NULL AND v.rationale != ''
    )::int AS rationales_provided
  FROM onchain_vote v
  WHERE v.drep_id IS NOT NULL
  GROUP BY v.drep_id
),
vote_changes AS (
  SELECT drep_id, COUNT(*)::int AS vote_changes
  FROM (
    SELECT drep_id, proposal_id
    FROM onchain_vote
    WHERE drep_id IS NOT NULL
    GROUP BY drep_id, proposal_id
    HAVING COUNT(DISTINCT vote) >= 2
  ) changed
  GROUP BY drep_id
)
SELECT
  ds.drep_id,
  ds.total_votes_cast,
  ds.unique_proposals,
  ds.rationales_provided,
  COALESCE(vc.vote_changes, 0)::int AS vote_changes,
  CASE
    WHEN dr.registered_epoch IS NULL THEN
      CASE WHEN (SELECT total FROM total_eligible) > 0
        THEN ROUND(ds.unique_proposals * 100.0 / (SELECT total FROM total_eligible), 2)
        ELSE 0
      END
    ELSE
      CASE WHEN (
        SELECT COUNT(*) FROM eligible_proposals ep
        WHERE ep.effective_epoch >= dr.registered_epoch
      ) > 0
        THEN ROUND(
          ds.unique_proposals * 100.0 / (
            SELECT COUNT(*) FROM eligible_proposals ep
            WHERE ep.effective_epoch >= dr.registered_epoch
          ), 2)
        ELSE 0
      END
  END AS participation_percent
FROM drep_stats ds
LEFT JOIN vote_changes vc ON ds.drep_id = vc.drep_id
LEFT JOIN drep_reg dr ON ds.drep_id = dr.drep_id;
`;

async function fetchViaSQL(): Promise<DRepStatResult[]> {
  const { rows } = await getPool().query(RATIONALE_STATS_SQL);
  return rows.map((r) => ({
    drepId: r.drep_id as string,
    totalVotesCast: r.total_votes_cast as number,
    rationalesProvided: r.rationales_provided as number,
    proposalParticipationPercent: parseFloat(r.participation_percent) || 0,
    uniqueProposals: r.unique_proposals as number,
    voteChanges: r.vote_changes as number,
  }));
}

// ---------------------------------------------------------------------------
// Strategy 2: Backend API with concurrent pool (fallback)
// ---------------------------------------------------------------------------

/** Run async tasks with a sliding-window concurrency limiter */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

const ZERO_STATS = (drepId: string): DRepStatResult => ({
  drepId,
  totalVotesCast: 0,
  rationalesProvided: 0,
  proposalParticipationPercent: 0,
  uniqueProposals: 0,
  voteChanges: 0,
});

async function fetchViaAPI(): Promise<DRepStatResult[]> {
  const pageSize = 100;

  // 1. Fetch first DRep page + all proposals in parallel
  const [firstRes, proposalsRes] = await Promise.all([
    callApi({
      endpoint: `/dreps?page=1&pageSize=${pageSize}&sortBy=votingPower&sortOrder=desc`,
      method: "GET",
    }),
    callApi({ endpoint: "/overview/proposals", method: "GET" }),
  ]);
  const firstData = await firstRes.json();
  const { totalPages } = firstData.pagination;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposalsData = await proposalsRes.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposals: Array<any> = Array.isArray(proposalsData) ? proposalsData : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isDRepEligible(p: any): boolean {
    if (p.threshold && p.threshold.drepThreshold == null) return false;
    if (p.status !== "Active" && p.drep?.breakdown) {
      const b = p.drep.breakdown;
      if (Number(b.activeYes || 0) === 0 && Number(b.activeNo || 0) === 0 && Number(b.activeAbstain || 0) === 0) {
        return false;
      }
    }
    return true;
  }

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

  // 3. Split by vote count
  const withVotes = allDreps.filter((d) => (d.totalVotesCast ?? 0) > 0);
  const withoutVotes = allDreps.filter((d) => (d.totalVotesCast ?? 0) === 0);

  // 4. Fetch details + votes using sliding-window concurrency (50 DReps at a time)
  //    instead of sequential batches — eliminates "blocked by slowest in batch" problem
  const fetchedResults = await mapConcurrent(withVotes, 50, async (drep): Promise<DRepStatResult> => {
    try {
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
      const votes: Array<{ proposalId: string; vote: string }> = votesData.votes ?? [];

      const votedProposalIds = new Set(votes.map((v) => v.proposalId));
      const uniqueProposals = votedProposalIds.size;

      const grouped = new Map<string, Set<string>>();
      for (const v of votes) {
        let s = grouped.get(v.proposalId);
        if (!s) { s = new Set(); grouped.set(v.proposalId, s); }
        s.add(v.vote);
      }
      let voteChanges = 0;
      for (const [, voteSet] of grouped) {
        if (voteSet.size >= 2) voteChanges++;
      }

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
  });

  return [...fetchedResults, ...withoutVotes.map((d) => ZERO_STATS(d.drepId))];
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const dreps = process.env.DATABASE_URL
      ? await fetchViaSQL()
      : await fetchViaAPI();

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return res.status(200).json({ dreps });
  } catch (error) {
    console.error("DRep rationale stats API error:", error);
    return res.status(500).json({ error: "Failed to fetch rationale stats" });
  }
}
