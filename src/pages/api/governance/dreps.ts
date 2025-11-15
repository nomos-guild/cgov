import type { NextApiRequest, NextApiResponse } from "next";

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_DREP_INFO_ENDPOINT = `${KOIOS_BASE_URL}/drep_info`;

type KoiosDrepInfo = {
  drep_id: string;
  hex: string;
  has_script: boolean;
  registered: boolean;
  deposit: unknown;
  active: boolean;
  expires_epoch_no: unknown;
  amount: string;
  meta_url: unknown;
  meta_hash: unknown;
  // Koios may include additional optional fields; keep them but don't type exhaustively here.
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

function parseBigIntParam(value: string | string[] | undefined): bigint | undefined {
  const raw = firstString(value);
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return BigInt(trimmed);
  } catch {
    return undefined;
  }
}

function parseAmountBigInt(amount: unknown): bigint | undefined {
  if (typeof amount === "bigint") return amount;
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) return undefined;
    return BigInt(Math.trunc(amount));
  }
  if (typeof amount === "string") {
    const trimmed = amount.trim();
    if (!trimmed) return undefined;
    try {
      return BigInt(trimmed);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const limit = parseIntParam(req.query.limit, 50, 1, 500);
  const offset = parseIntParam(req.query.offset, 0, 0);

  const registeredFilter = parseOptionalBooleanParam(req.query.registered);
  const activeFilter = parseOptionalBooleanParam(req.query.active);
  const hasScriptFilter = parseOptionalBooleanParam(req.query.has_script);
  const minAmount = parseBigIntParam(req.query.min_amount);
  const maxAmount = parseBigIntParam(req.query.max_amount);

  if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
    return res.status(400).json({
      error: "Invalid amount range: min_amount must be <= max_amount",
    });
  }

  const body = req.body as unknown;
  if (!body || typeof body !== "object") {
    return res.status(400).json({
      error: "Invalid request body; expected JSON object",
      hint: 'Body should be: { "_drep_ids": ["drep1...", "drep1..."] }',
    });
  }

  const drepIds = (body as { _drep_ids?: unknown })._drep_ids;
  if (!Array.isArray(drepIds) || drepIds.length === 0) {
    return res.status(400).json({
      error: "Missing or invalid `_drep_ids` in request body",
      hint: "Provide a non-empty array of DRep IDs in CIP-129 bech32 format",
    });
  }

  const cleanIds = drepIds
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.length > 0);

  if (cleanIds.length === 0) {
    return res.status(400).json({
      error: "No valid DRep IDs provided in `_drep_ids`",
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const koiosResponse = await fetch(KOIOS_DREP_INFO_ENDPOINT, {
      method: "POST",
      headers: {
        ...getKoiosHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ _drep_ids: cleanIds }),
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
        error: "Unexpected response shape from Koios drep_info",
      });
    }

    let dreps = json as KoiosDrepInfo[];

    if (registeredFilter !== undefined) {
      dreps = dreps.filter((d) => Boolean(d.registered) === registeredFilter);
    }
    if (activeFilter !== undefined) {
      dreps = dreps.filter((d) => Boolean(d.active) === activeFilter);
    }
    if (hasScriptFilter !== undefined) {
      dreps = dreps.filter((d) => Boolean(d.has_script) === hasScriptFilter);
    }
    if (minAmount !== undefined) {
      dreps = dreps.filter((d) => {
        const amt = parseAmountBigInt(d.amount);
        return amt !== undefined && amt >= minAmount;
      });
    }
    if (maxAmount !== undefined) {
      dreps = dreps.filter((d) => {
        const amt = parseAmountBigInt(d.amount);
        return amt !== undefined && amt <= maxAmount;
      });
    }

    const total = dreps.length;
    const page = dreps.slice(offset, offset + limit);

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



