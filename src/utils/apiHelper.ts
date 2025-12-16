/**
 * Server-side API Helper
 * Handles all API calls to the backend with API key authentication
 * This runs on the server side only, keeping the API key secure
 */

import { NextApiResponse } from "next";

interface CallApiArgs {
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  isJson?: boolean;
}

/**
 * Make a server-side API call to the backend
 * The API key is kept server-side and never exposed to the browser
 */
export async function callApi(args: CallApiArgs) {
  const backendApiUrl =
    process.env.BACKEND_API_URL || "http://localhost:3001";
  const backendApiKey = process.env.BACKEND_API_KEY || "";

  const res = await fetch(backendApiUrl + args.endpoint, {
    method: args.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(backendApiKey && { "X-API-Key": backendApiKey }),
      ...args.headers,
    },
    body: args.body,
    cache: "no-cache",
  });

  if (args.isJson !== false) {
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } else {
    const text = await res.text();
    return new Response(text, { status: res.status });
  }
}

/**
 * Helper to handle API errors consistently
 */
export function handleApiError(res: NextApiResponse, error: unknown) {
  console.error("API Error:", error);
  const message = error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ error: message });
}
