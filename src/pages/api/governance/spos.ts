import type { NextApiRequest, NextApiResponse } from "next";

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_POOL_LIST_ENDPOINT = `${KOIOS_BASE_URL}/pool_list`;

type PoolStatus = "registered" | "retiring" | "retired";

type KoiosPoolListItem = {
  pool_id_bech32: string;
  pool_id_hex: string;
  pool_status: PoolStatus;
  ticker?: string | null;
  pool_group?: unknown;
  meta_url?: unknown;
  meta_hash?: unknown;
  [key: string]: unknown;
};

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

function parseOptionalBooleanParam(value: string | string[] | undefined): boolean | undefined {
  const raw = firstString(value);
  if (raw === undefined) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const limit = parseIntParam(req.query.limit, 50, 1, 500);
  const offset = parseIntParam(req.query.offset, 0, 0);

  const statusRaw = firstString(req.query.status);
  const tickerQuery = firstString(req.query.ticker);
  const groupQuery = firstString(req.query.pool_group);
  const hasMetadata = parseOptionalBooleanParam(req.query.has_metadata);

  let statusFilter: PoolStatus | undefined;
  if (statusRaw !== undefined) {
    const normalized = statusRaw.trim().toLowerCase();
    if (normalized === "registered" || normalized === "retiring" || normalized === "retired") {
      statusFilter = normalized;
    } else {
      return res.status(400).json({
        error: "Invalid `status` query parameter",
        allowed: ["registered", "retiring", "retired"],
      });
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const koiosResponse = await fetch(KOIOS_POOL_LIST_ENDPOINT, {
      method: "GET",
      headers: getKoiosHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!koiosResponse.ok) {
      return res.status(502).json({
        error: "Upstream error from Koios",
        status: koiosResponse.status,
      });
    }

    const json = (await koiosResponse.json()) as unknown;
    if (!Array.isArray(json)) {
      return res.status(502).json({
        error: "Unexpected response shape from Koios pool_list",
      });
    }

    let pools = json as KoiosPoolListItem[];

    if (statusFilter !== undefined) {
      pools = pools.filter((p) => p.pool_status === statusFilter);
    }

    if (tickerQuery !== undefined && tickerQuery.trim() !== "") {
      const q = tickerQuery.trim().toLowerCase();
      pools = pools.filter((p) =>
        p.ticker ? String(p.ticker).toLowerCase().includes(q) : false
      );
    }

    if (groupQuery !== undefined && groupQuery.trim() !== "") {
      const q = groupQuery.trim().toLowerCase();
      pools = pools.filter((p) =>
        p.pool_group ? String(p.pool_group).toLowerCase().includes(q) : false
      );
    }

    if (hasMetadata !== undefined) {
      pools = pools.filter((p) => {
        const hasMetaUrl = p.meta_url !== null && p.meta_url !== undefined;
        const hasMetaHash = p.meta_hash !== null && p.meta_hash !== undefined;
        const anyMeta = hasMetaUrl || hasMetaHash;
        return hasMetadata ? anyMeta : !anyMeta;
      });
    }

    const total = pools.length;
    const page = pools.slice(offset, offset + limit);

    res.setHeader("X-Total-Count", String(total));
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      total,
      count: page.length,
      offset,
      limit,
      data: page,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isAbort =
      error instanceof Error && (error.name === "AbortError" || message.includes("aborted"));
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? "Upstream request timed out" : "Internal Server Error",
      detail: message,
    });
  }
}


