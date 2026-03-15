import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { drepId } = req.query;

    if (!drepId || typeof drepId !== "string") {
      return res.status(400).json({ error: "DRep ID is required" });
    }

    const response = await callApi({
      endpoint: `/dreps/${encodeURIComponent(drepId)}/verify`,
      method: "GET",
    });

    const data = await response.json();
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=30, stale-while-revalidate=120"
    );
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("DRep verify API error:", error);
    return res.status(500).json({ error: "Failed to verify DRep role" });
  }
}
