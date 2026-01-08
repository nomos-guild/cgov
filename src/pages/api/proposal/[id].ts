import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Proposal ID is required" });
  }

  try {
    const response = await callApi({
      endpoint: `/proposal/${encodeURIComponent(id)}`,
      method: "GET",
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Proposal detail API error:", error);
    return res.status(500).json({ error: "Failed to fetch proposal details" });
  }
}
