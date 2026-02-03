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
    // Build query string from request query params
    const { page, pageSize, sortBy, sortOrder, search } = req.query;
    const params = new URLSearchParams();

    if (page) params.set("page", String(page));
    if (pageSize) params.set("pageSize", String(pageSize));
    if (sortBy) params.set("sortBy", String(sortBy));
    if (sortOrder) params.set("sortOrder", String(sortOrder));
    if (search) params.set("search", String(search));

    const queryString = params.toString();
    const endpoint = `/dreps${queryString ? `?${queryString}` : ""}`;

    const response = await callApi({
      endpoint,
      method: "GET",
    });

    const data = await response.json();
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("DReps list API error:", error);
    return res.status(500).json({ error: "Failed to fetch DReps list" });
  }
}
