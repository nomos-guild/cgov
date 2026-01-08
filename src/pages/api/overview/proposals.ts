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
    const response = await callApi({
      endpoint: "/overview/proposals",
      method: "GET",
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Proposals API error:", error);
    return res.status(500).json({ error: "Failed to fetch proposals data" });
  }
}
