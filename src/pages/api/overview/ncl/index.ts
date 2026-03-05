import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";
import { callApi } from "@/utils/apiHelper";

/**
 * NCL (Net Change Limit) API endpoint
 *
 * Fetches base NCL data from the backend, then augments the 2026 NCL
 * with a direct DB calculation when DATABASE_URL is available.
 *
 * 2026 NCL boundary: epoch 612 (starts 2026-02-08T21:44:51Z).
 * Treasury withdrawals enacted at epoch >= 612 count toward 2026.
 */

/** Epoch boundary: epoch 612 starts on Feb 8 2026 ~21:44 UTC */
const NCL_2026_START_EPOCH = 612;

/** Known NCL limits in lovelace */
const NCL_LIMITS: Record<number, string> = {
  2025: "350000000000000", // 350M ADA
  2026: "350000000000000", // 350M ADA
};

// ---------------------------------------------------------------------------
// Direct SQL: sum enacted treasury withdrawal amounts for a year range
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

/**
 * Calculate total enacted treasury withdrawals for a given epoch range.
 * Reads withdrawal amounts from proposal metadata JSON:
 *   metadata.body.onChain.withdrawals[].withdrawalAmount (lovelace bigint)
 */
async function calcNCLCurrentFromDB(
  fromEpoch: number,
  toEpoch?: number
): Promise<bigint> {
  const epochFilter = toEpoch
    ? `AND p.enacted_epoch >= $1 AND p.enacted_epoch < $2`
    : `AND p.enacted_epoch >= $1`;

  const sql = `
    SELECT COALESCE(SUM((w->>'withdrawalAmount')::bigint), 0) AS total
    FROM proposal p,
         jsonb_array_elements(p.metadata::jsonb->'body'->'onChain'->'withdrawals') w
    WHERE p.governance_action_type = 'TREASURY_WITHDRAWALS'
      AND p.status = 'ENACTED'
      ${epochFilter}
  `;

  const params = toEpoch ? [fromEpoch, toEpoch] : [fromEpoch];
  const { rows } = await getPool().query(sql, params);
  return BigInt(rows[0]?.total ?? 0);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

interface NCLRow {
  year: number;
  currentValue: string;
  targetValue: string;
  epoch: number;
  updatedAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await callApi({
      endpoint: "/overview/ncl",
      method: "GET",
    });

    const data: NCLRow[] = await response.json();

    // Augment 2026 NCL when the backend returns zeros
    if (process.env.DATABASE_URL) {
      const ncl2026 = data.find((r) => r.year === 2026);

      if (ncl2026) {
        // Fill in limit if backend returns 0
        if (ncl2026.targetValue === "0" && NCL_LIMITS[2026]) {
          ncl2026.targetValue = NCL_LIMITS[2026];
        }

        // Compute current from enacted treasury withdrawals at epoch >= 612
        const current2026 = await calcNCLCurrentFromDB(NCL_2026_START_EPOCH);
        ncl2026.currentValue = current2026.toString();
      } else {
        // Backend didn't return a 2026 row — synthesise one
        const current2026 = await calcNCLCurrentFromDB(NCL_2026_START_EPOCH);
        data.push({
          year: 2026,
          currentValue: current2026.toString(),
          targetValue: NCL_LIMITS[2026],
          epoch: 0,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error("NCL API error:", error);
    return res.status(500).json({ error: "Failed to fetch NCL data" });
  }
}
