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
    const queryString = new URLSearchParams(
      req.query as Record<string, string>
    ).toString();
    const endpoint = `/analytics/spo-default-stance${queryString ? `?${queryString}` : ""}`;

    const response = await callApi({
      endpoint,
      method: "GET",
    });

    const data = await response.json();
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("SPO default stance API error:", error);
    return res.status(500).json({ error: "Failed to fetch SPO default stance data" });
  }
}
