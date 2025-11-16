import type { NextApiRequest, NextApiResponse } from "next";

type KoiosBlock = {
  hash: string;
  epoch_no: number;
  abs_slot: number;
  epoch_slot: number;
  block_height: number;
  block_size: number;
  block_time: number;
  tx_count: number;
  vrf_key: string;
  pool: string | null;
  op_cert_counter: number;
  proto_major: number;
  proto_minor: number;
  [key: string]: unknown;
};

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_BLOCKS_ENDPOINT = `${KOIOS_BASE_URL}/blocks`;

function getKoiosHeaders(): HeadersInit {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.KOIOS_API_KEY;
  if (key && key.trim().length > 0) {
    headers["Authorization"] = `Bearer ${key}`;
    headers["X-API-Key"] = key;
  }
  return headers;
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseIntParam(
  value: string | string[] | undefined,
  fallback: number,
  min?: number,
  max?: number
): number {
  const raw = firstString(value);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  let v = n;
  if (typeof min === "number") v = Math.max(min, v);
  if (typeof max === "number") v = Math.min(max, v);
  return v;
}

function parseNumberParam(value: string | string[] | undefined): number | undefined {
  const raw = firstString(value);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const limit = parseIntParam(req.query.limit, 100, 1, 1000);
  const offset = parseIntParam(req.query.offset, 0, 0);
  const fromSlot = parseNumberParam(req.query.from_slot);
  const toSlot = parseNumberParam(req.query.to_slot);
  const blockHeight = parseNumberParam(req.query.block_height);
  const epochNo = parseNumberParam(req.query.epoch_no);

  if (fromSlot !== undefined && toSlot !== undefined && fromSlot > toSlot) {
    return res.status(400).json({ error: "Invalid range: from_slot must be <= to_slot" });
  }

  try {
    // Build Koios query URL with PostgREST filters
    const url = new URL(KOIOS_BLOCKS_ENDPOINT);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("order", "abs_slot.asc");

    // Apply filters using PostgREST operators
    if (fromSlot !== undefined) {
      url.searchParams.set("abs_slot", `gte.${fromSlot}`);
    }
    if (toSlot !== undefined) {
      url.searchParams.set("abs_slot", `lte.${toSlot}`);
    }
    if (blockHeight !== undefined) {
      url.searchParams.set("block_height", `eq.${blockHeight}`);
    }
    if (epochNo !== undefined) {
      url.searchParams.set("epoch_no", `eq.${epochNo}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const koiosResponse = await fetch(url.toString(), {
      method: "GET",
      headers: {
        ...getKoiosHeaders(),
        Prefer: "count=estimated",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!koiosResponse.ok) {
      return res.status(502).json({
        error: "Upstream error from Koios",
        status: koiosResponse.status,
      });
    }

    // Extract content-range header for total count
    const contentRange = koiosResponse.headers.get("content-range");
    let estimatedTotal: number | undefined;
    if (contentRange) {
      const match = contentRange.match(/\/(\d+|\*)/);
      if (match && match[1] !== "*") {
        estimatedTotal = Number.parseInt(match[1], 10);
      }
    }

    const blocks = (await koiosResponse.json()) as KoiosBlock[];

    res.setHeader("X-Total-Count", String(estimatedTotal ?? blocks.length));
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json({
      total: estimatedTotal,
      count: blocks.length,
      offset,
      limit,
      data: blocks,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isAbort = error instanceof Error && (error.name === "AbortError" || message.includes("aborted"));
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? "Upstream request timed out" : "Internal Server Error",
      detail: message,
    });
  }
}


