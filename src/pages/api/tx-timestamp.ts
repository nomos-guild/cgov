import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Look up the precise block timestamp for a Cardano transaction via Koios.
 *
 * Query params:
 *   txHash – the transaction hash (hex, 64 chars)
 *
 * Returns: { timestamp: number } (unix seconds) or an error.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { txHash } = req.query;

  if (!txHash || typeof txHash !== "string" || !/^[a-f0-9]{64}$/i.test(txHash)) {
    return res.status(400).json({ error: "Valid 64-char hex txHash is required" });
  }

  const koiosKey = process.env.KOIOS_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (koiosKey) {
    headers["Authorization"] = `Bearer ${koiosKey}`;
  }

  try {
    const response = await fetch("https://api.koios.rest/api/v1/tx_info", {
      method: "POST",
      headers,
      body: JSON.stringify({ _tx_hashes: [txHash] }),
    });

    if (!response.ok) {
      return res
        .status(502)
        .json({ error: `Koios returned ${response.status}` });
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0 || !data[0].tx_timestamp) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Cache for 1 hour – tx timestamps are immutable
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    return res.status(200).json({ timestamp: data[0].tx_timestamp });
  } catch (error) {
    console.error("Koios tx_info error:", error);
    return res.status(502).json({ error: "Failed to fetch transaction info" });
  }
}
