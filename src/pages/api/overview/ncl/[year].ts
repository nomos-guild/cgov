import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";
import { callApi } from "@/utils/apiHelper";

/** Epoch boundary: epoch 612 starts on Feb 8 2026 ~21:44 UTC */
const NCL_2026_START_EPOCH = 612;

/** Known NCL limits in lovelace */
const NCL_LIMITS: Record<number, string> = {
  2025: "350000000000000",
  2026: "350000000000000",
};

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

async function calcNCLCurrentFromDB(fromEpoch: number): Promise<bigint> {
  const sql = `
    SELECT COALESCE(SUM((w->>'withdrawalAmount')::bigint), 0) AS total
    FROM proposal p,
         jsonb_array_elements(p.metadata::jsonb->'body'->'onChain'->'withdrawals') w
    WHERE p.governance_action_type = 'TREASURY_WITHDRAWALS'
      AND p.status = 'ENACTED'
      AND p.enacted_epoch >= $1
  `;
  const { rows } = await getPool().query(sql, [fromEpoch]);
  return BigInt(rows[0]?.total ?? 0);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { year } = req.query;

  if (!year || typeof year !== "string") {
    return res.status(400).json({ error: "Year parameter is required" });
  }

  try {
    const response = await callApi({
      endpoint: `/overview/ncl/${encodeURIComponent(year)}`,
      method: "GET",
    });

    const data = await response.json();

    // Augment 2026 NCL when backend returns zeros
    if (process.env.DATABASE_URL && parseInt(year) === 2026) {
      if (data.targetValue === "0" && NCL_LIMITS[2026]) {
        data.targetValue = NCL_LIMITS[2026];
      }
      const current2026 = await calcNCLCurrentFromDB(NCL_2026_START_EPOCH);
      data.currentValue = current2026.toString();
    }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("NCL by year API error:", error);
    return res.status(500).json({ error: "Failed to fetch NCL data for year" });
  }
}
