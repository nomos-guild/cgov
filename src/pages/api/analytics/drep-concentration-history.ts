import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";

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

const CONCENTRATION_SQL = `
WITH ranked AS (
  SELECT
    epoch_no,
    voting_power,
    delegator_count,
    ROW_NUMBER() OVER (PARTITION BY epoch_no ORDER BY voting_power DESC) AS vp_rank,
    ROW_NUMBER() OVER (PARTITION BY epoch_no ORDER BY delegator_count DESC) AS del_rank
  FROM drep_epoch_snapshot
),
totals AS (
  SELECT
    epoch_no,
    SUM(voting_power) AS total_vp,
    SUM(delegator_count) AS total_delegators
  FROM drep_epoch_snapshot
  GROUP BY epoch_no
),
concentration AS (
  SELECT
    r.epoch_no,
    SUM(CASE WHEN r.vp_rank <= 10 THEN r.voting_power ELSE 0 END) AS top10_vp,
    SUM(CASE WHEN r.vp_rank <= 20 THEN r.voting_power ELSE 0 END) AS top20_vp,
    SUM(CASE WHEN r.vp_rank <= 50 THEN r.voting_power ELSE 0 END) AS top50_vp,
    SUM(CASE WHEN r.del_rank <= 10 THEN r.delegator_count ELSE 0 END) AS top10_del,
    SUM(CASE WHEN r.del_rank <= 20 THEN r.delegator_count ELSE 0 END) AS top20_del,
    SUM(CASE WHEN r.del_rank <= 50 THEN r.delegator_count ELSE 0 END) AS top50_del
  FROM ranked r
  GROUP BY r.epoch_no
)
SELECT
  c.epoch_no,
  ROUND(100.0 * c.top10_vp / NULLIF(t.total_vp, 0), 2) AS top10_vp_pct,
  ROUND(100.0 * c.top20_vp / NULLIF(t.total_vp, 0), 2) AS top20_vp_pct,
  ROUND(100.0 * c.top50_vp / NULLIF(t.total_vp, 0), 2) AS top50_vp_pct,
  ROUND(100.0 * c.top10_del / NULLIF(t.total_delegators, 0), 2) AS top10_del_pct,
  ROUND(100.0 * c.top20_del / NULLIF(t.total_delegators, 0), 2) AS top20_del_pct,
  ROUND(100.0 * c.top50_del / NULLIF(t.total_delegators, 0), 2) AS top50_del_pct,
  c.top10_vp AS top10_vp_abs,
  c.top20_vp AS top20_vp_abs,
  c.top50_vp AS top50_vp_abs,
  c.top10_del AS top10_del_abs,
  c.top20_del AS top20_del_abs,
  c.top50_del AS top50_del_abs
FROM concentration c
JOIN totals t ON c.epoch_no = t.epoch_no
ORDER BY c.epoch_no;
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { rows } = await getPool().query(CONCENTRATION_SQL);
    const history = rows.map((r) => ({
      epoch: r.epoch_no,
      top10VpPct: parseFloat(r.top10_vp_pct),
      top20VpPct: parseFloat(r.top20_vp_pct),
      top50VpPct: parseFloat(r.top50_vp_pct),
      top10DelPct: parseFloat(r.top10_del_pct),
      top20DelPct: parseFloat(r.top20_del_pct),
      top50DelPct: parseFloat(r.top50_del_pct),
      top10VpAda: Number(r.top10_vp_abs) / 1_000_000,
      top20VpAda: Number(r.top20_vp_abs) / 1_000_000,
      top50VpAda: Number(r.top50_vp_abs) / 1_000_000,
      top10Del: Number(r.top10_del_abs),
      top20Del: Number(r.top20_del_abs),
      top50Del: Number(r.top50_del_abs),
    }));

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return res.status(200).json({ history });
  } catch (error) {
    console.error("DRep concentration history API error:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch DRep concentration history" });
  }
}
