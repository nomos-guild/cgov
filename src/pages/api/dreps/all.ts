import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

/**
 * /api/dreps/all — Returns ALL DReps in a single response.
 * Paginates through the backend server-side so the client only makes one request.
 * This avoids N parallel serverless function cold-starts on Vercel.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sortBy = "votingPower", sortOrder = "desc", search } = req.query;
    const pageSize = 100;

    // Fetch first page to learn totalPages
    const firstParams = new URLSearchParams();
    firstParams.set("page", "1");
    firstParams.set("pageSize", String(pageSize));
    firstParams.set("sortBy", String(sortBy));
    firstParams.set("sortOrder", String(sortOrder));
    if (search) firstParams.set("search", String(search));

    const firstResponse = await callApi({
      endpoint: `/dreps?${firstParams.toString()}`,
      method: "GET",
    });
    const firstData = await firstResponse.json();

    const accumulated = [...firstData.dreps];
    const { totalPages } = firstData.pagination;

    // Fetch remaining pages in parallel (backend-to-backend, no cold starts)
    if (totalPages > 1) {
      const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      const results = await Promise.all(
        remaining.map(async (pg) => {
          const p = new URLSearchParams();
          p.set("page", String(pg));
          p.set("pageSize", String(pageSize));
          p.set("sortBy", String(sortBy));
          p.set("sortOrder", String(sortOrder));
          if (search) p.set("search", String(search));

          const r = await callApi({
            endpoint: `/dreps?${p.toString()}`,
            method: "GET",
          });
          const data = await r.json();
          return data.dreps;
        })
      );
      for (const page of results) {
        accumulated.push(...page);
      }
    }

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      dreps: accumulated,
      pagination: { total: firstData.pagination.total, page: 1, pageSize: accumulated.length, totalPages: 1 },
    });
  } catch (error) {
    console.error("DReps all API error:", error);
    return res.status(500).json({ error: "Failed to fetch all DReps" });
  }
}
