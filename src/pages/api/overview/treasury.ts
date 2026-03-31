import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

interface EpochEntry {
  epoch: number;
  treasury: string | null;
  startTime: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Fetch all treasury history and NCL data in parallel
    const [treasuryResponse, nclResponse, proposalsResponse] = await Promise.all([
      callApi({ endpoint: "/analytics/treasury-rate", method: "GET" }),
      callApi({ endpoint: "/overview/ncl", method: "GET" }),
      callApi({ endpoint: "/overview/proposals", method: "GET" }),
    ]);

    const treasuryData = await treasuryResponse.json();
    const nclData = await nclResponse.json();
    const proposals = await proposalsResponse.json();

    // --- Treasury history for sparkline ---
    const epochs: EpochEntry[] = treasuryData?.epochs ?? [];
    const sorted = [...epochs].sort((a, b) => a.epoch - b.epoch);
    const history = sorted.map((e) => ({
      epoch: e.epoch,
      treasuryAda: e.treasury ? Number(e.treasury) / 1_000_000 : 0,
    }));
    const latest = history[history.length - 1];

    // --- Yearly spend from NCL (2025) ---
    const ncl2025 = Array.isArray(nclData)
      ? nclData.find((n: { year: number }) => n.year === 2025)
      : null;
    const spent2025 = ncl2025?.currentValue
      ? Number(ncl2025.currentValue) / 1_000_000
      : 0;

    // --- 2026 spend: sum enacted Treasury Withdrawal proposals enacted in 2026 ---
    // Build epoch→year lookup from treasury-rate startTime
    const epochYearMap = new Map<number, number>();
    for (const e of epochs) {
      if (e.startTime) {
        epochYearMap.set(e.epoch, new Date(e.startTime).getFullYear());
      }
    }

    // Find the first epoch of 2026 for filtering
    const firstEpoch2026 = sorted.find(
      (e) => e.startTime && new Date(e.startTime).getFullYear() >= 2026
    )?.epoch ?? Infinity;

    // Sum enacted treasury withdrawals where submission epoch falls in 2026 range
    let spent2026 = 0;
    if (Array.isArray(proposals)) {
      for (const p of proposals) {
        if (
          p.type === "Treasury Withdrawals" &&
          (p.status === "Enacted" || p.status === "Ratified") &&
          p.submissionEpoch >= firstEpoch2026 &&
          p.withdrawalAmount
        ) {
          spent2026 += Number(p.withdrawalAmount) / 1_000_000;
        }
      }
    }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return res.status(200).json({
      treasuryAda: latest?.treasuryAda ?? 0,
      epoch: latest?.epoch ?? null,
      history,
      yearlySpent: {
        2025: Number.isFinite(spent2025) ? spent2025 : 0,
        2026: Number.isFinite(spent2026) ? spent2026 : 0,
      },
    });
  } catch (error) {
    console.error("Treasury API error:", error);
    return res.status(500).json({ error: "Failed to fetch treasury data" });
  }
}
