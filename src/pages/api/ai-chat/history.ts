import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

export const config = {
  maxDuration: 30,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const walletAddress =
    typeof req.query.walletAddress === "string"
      ? req.query.walletAddress
      : "";
  const scope =
    typeof req.query.scope === "string" && req.query.scope.length > 0
      ? req.query.scope
      : "global";
  const limit =
    typeof req.query.limit === "string" && req.query.limit.length > 0
      ? req.query.limit
      : null;

  if (!walletAddress) {
    return res.status(400).json({ error: "walletAddress is required" });
  }

  const params = new URLSearchParams({ walletAddress, scope });
  if (limit) params.set("limit", limit);

  try {
    const upstream = await callApi({
      endpoint: `/ai/chat/history?${params.toString()}`,
      method: "GET",
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (error) {
    console.error("ai-chat history proxy error:", error);
    return res.status(502).json({ error: "Failed to read AI chat history" });
  }
}
