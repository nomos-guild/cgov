import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";

/**
 * Aggregated DRep rationale statistics + vote-change counts
 *
 * Uses a single SQL query against the database instead of per-DRep API calls.
 * Computes engagement % using the same logic as the DRep profile page:
 * uniqueProposals / eligibleProposals (filtered by DRep registration epoch
 * and active DRep vote existence on non-Active proposals).
 *
 * Cached for 5 minutes with stale-while-revalidate.
 */

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

const RATIONALE_STATS_SQL = `
WITH eligible_proposals AS (
  -- Proposals that DReps can vote on (same logic as frontend isDRepEligible)
  SELECT
    proposal_id,
    COALESCE(expiration_epoch, submission_epoch, 0) AS effective_epoch
  FROM proposal
  WHERE
    -- Must have DRep vote power columns (indicates DRep threshold exists)
    drep_total_vote_power IS NOT NULL
    AND (
      -- Active proposals are always eligible
      status = 'ACTIVE'
      -- Finished proposals: at least one active DRep voted
      OR COALESCE(drep_active_yes_vote_power, 0) > 0
      OR COALESCE(drep_active_no_vote_power, 0) > 0
      OR COALESCE(drep_active_abstain_vote_power, 0) > 0
    )
),
total_eligible AS (
  SELECT COUNT(*) AS total FROM eligible_proposals
),
drep_reg AS (
  -- First registration epoch per DRep
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
  -- Proposals where DRep changed their vote (2+ distinct vote values)
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
  -- Engagement: uniqueProposals / eligible proposals (filtered by registration epoch)
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { rows } = await getPool().query(RATIONALE_STATS_SQL);

    const dreps = rows.map((r) => ({
      drepId: r.drep_id as string,
      totalVotesCast: r.total_votes_cast as number,
      rationalesProvided: r.rationales_provided as number,
      proposalParticipationPercent: parseFloat(r.participation_percent) || 0,
      uniqueProposals: r.unique_proposals as number,
      voteChanges: r.vote_changes as number,
    }));

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
