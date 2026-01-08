/**
 * Server-side API Helper
 * Handles all API calls to the backend with API key authentication
 * This runs on the server side only, keeping the API key secure
 */

import { NextApiRequest, NextApiResponse } from "next";

interface CallApiArgs {
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  isJson?: boolean;
  clientIp?: string;
}

/**
 * Extract the client IP address from a Next.js API request
 * Works with Vercel's proxy headers and standard forwarding headers
 */
export function getClientIp(req: NextApiRequest): string {
  // Vercel/proxy headers (most reliable in production)
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
    // The first IP is the original client
    const ips = Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : xForwardedFor.split(",")[0];
    return ips.trim();
  }

  // Alternative headers
  const xRealIp = req.headers["x-real-ip"];
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }

  // Fallback to socket remote address (for local development)
  return req.socket?.remoteAddress || "unknown";
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
      ...(args.clientIp && { "X-Forwarded-For": args.clientIp }),
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
