import type { NextApiRequest, NextApiResponse } from "next";

// Cardano mainnet constants
// Epoch duration: 5 days = 432,000 seconds
// Genesis timestamp: 2017-09-23T21:44:51Z = 1506203091 (UNIX seconds)
const EPOCH_SECONDS = 432_000;
const MAINNET_GENESIS_UNIX = 1_506_203_091;

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_POOL_VP_HISTORY = `${KOIOS_BASE_URL}/pool_voting_power_history`;

function firstString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseStringParam(value: string | string[] | undefined): string | undefined {
  const raw = firstString(value);
  return raw?.trim() || undefined;
}

function parseNumber(value: string | string[] | undefined): number | undefined {
  const raw = firstString(value);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntParam(value: string | string[] | undefined): number | undefined {
  const n = parseNumber(value);
  if (n === undefined) return undefined;
  return Math.trunc(n);
}

function epochFromUnixSeconds(unixSeconds: number): number {
  const delta = unixSeconds - MAINNET_GENESIS_UNIX;
  return Math.floor(delta / EPOCH_SECONDS);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Accept `pool_bech32` (preferred) or `_pool_bech32` alias
  const poolBech32 =
    parseStringParam(req.query.pool_bech32) ?? parseStringParam(req.query._pool_bech32);
  // Accept either `epoch_no` or `block_time` (UNIX seconds). If both provided, `epoch_no` wins.
  const epochNoParam = parseIntParam(req.query.epoch_no) ?? parseIntParam(req.query._epoch_no);
  const blockTimeParam = parseNumber(req.query.block_time) ?? parseNumber(req.query._block_time);

  if (!poolBech32) {
    return res.status(400).json({
      error: "Missing required parameter: pool_bech32",
      hint: "Provide ?pool_bech32=pool1... (bech32). `_pool_bech32` alias is also accepted.",
    });
  }
  if (epochNoParam === undefined && blockTimeParam === undefined) {
    return res.status(400).json({
      error: "Missing time parameter",
      hint: "Provide either ?epoch_no=### or ?block_time=UNIX_SECONDS",
    });
  }

  // Resolve epoch number
  let epochNo = epochNoParam;
  if (epochNo === undefined && blockTimeParam !== undefined) {
    // Convert UNIX seconds to epoch
    const blockTime = Math.trunc(blockTimeParam);
    if (!Number.isFinite(blockTime) || blockTime <= 0) {
      return res.status(400).json({ error: "Invalid block_time; must be UNIX seconds" });
    }
    epochNo = epochFromUnixSeconds(blockTime);
  }

  if (epochNo === undefined || epochNo < 0) {
    return res.status(400).json({ error: "Unable to resolve a valid epoch for the provided input" });
  }

  try {
    const url = new URL(KOIOS_POOL_VP_HISTORY);
    url.searchParams.set("_epoch_no", String(epochNo));
    url.searchParams.set("_pool_bech32", poolBech32);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const koiosResponse = await fetch(url.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!koiosResponse.ok) {
      return res.status(502).json({
        error: "Upstream error from Koios",
        status: koiosResponse.status,
      });
    }

    const data = await koiosResponse.json();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      epoch_no: epochNo,
      pool_bech32: poolBech32,
      data,
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


