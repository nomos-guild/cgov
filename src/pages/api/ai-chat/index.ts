import type { NextApiRequest, NextApiResponse } from "next";
import { callApi } from "@/utils/apiHelper";

export const config = {
  maxDuration: 300,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const upstream = await callApi({
      endpoint: "/ai/chat",
      method: "POST",
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (error) {
    console.error("ai-chat proxy error:", error);
    return res.status(502).json({ error: "Failed to reach AI assistant" });
  }
}
