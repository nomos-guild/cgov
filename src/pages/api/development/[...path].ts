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
    const pathSegments = req.query.path as string[];
    const subPath = pathSegments.join("/");

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== "path" && typeof value === "string") {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    const endpoint = `/development/${subPath}${qs ? `?${qs}` : ""}`;

    const response = await callApi({ endpoint, method: "GET", isJson: false });
    const text = await response.text();

    if (!response.ok) {
      const isHtml = text.startsWith("<!") || text.startsWith("<html");
      const errorMsg = isHtml
        ? `Backend returned ${response.status} for ${endpoint}`
        : text;
      return res.status(response.status).json({ error: errorMsg });
    }

    const data = JSON.parse(text);

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error("Development API error:", error);
    return res.status(500).json({ error: "Failed to fetch development data" });
  }
}
