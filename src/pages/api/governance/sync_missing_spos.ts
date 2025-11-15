import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_POOL_LIST_ENDPOINT = `${KOIOS_BASE_URL}/pool_list`;

type PoolStatus = "registered" | "retiring" | "retired";

type KoiosPoolListItem = {
  pool_id_bech32: string;
  pool_id_hex?: string | null;
  pool_status?: PoolStatus | null;
  ticker?: unknown;
  pool_group?: unknown;
  meta_url?: unknown;
  meta_hash?: unknown;
  active_epoch_no?: unknown;
  margin?: unknown;
  fixed_cost?: unknown;
  pledge?: unknown;
  deposit?: unknown;
  reward_addr?: unknown;
  owners?: unknown;
  relays?: unknown;
  active_stake?: unknown;
  retiring_epoch?: unknown;
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

function parseBooleanParam(value: string | string[] | undefined, fallback = false): boolean {
  const raw = firstString(value);
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return fallback;
}

function toOptionalDecimalInput(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return value.toString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return undefined;
    return trimmed;
  }
  try {
    if (typeof value === "bigint") {
      return value.toString();
    }
  } catch {
    // ignore
  }
  return undefined;
}

function toOptionalInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return s.length > 0 ? s : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // limit: max number of Koios pools to upsert in this run (after de-dup)
  // dry_run: if true, do not write to DB, only report counts
  const limit = parseIntParam(req.query.limit, 2000, 1, 10_000);
  const dryRun = parseBooleanParam(req.query.dry_run, false);

  try {
    // 1) Fetch Koios pool_list (authoritative SPO set)
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

    const pools = json as KoiosPoolListItem[];

    // Normalize and de-duplicate Koios pools by bech32 id
    const poolMap = new Map<string, KoiosPoolListItem>();
    for (const p of pools) {
      if (!p || typeof p.pool_id_bech32 !== "string") continue;
      const id = p.pool_id_bech32.trim();
      if (!id) continue;
      if (!poolMap.has(id)) {
        poolMap.set(id, p);
      }
    }

    const allPoolIds = Array.from(poolMap.keys());
    const totalKoiosPools = allPoolIds.length;

    if (totalKoiosPools === 0) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        totalKoiosPools: 0,
        processedPools: 0,
        existingPools: 0,
        missingPools: 0,
        createdPools: 0,
        dryRun,
      });
    }

    // Restrict how many we process in this run
    const targetPoolIds = allPoolIds.slice(0, limit);

    // 2) Determine which of those are already present in Spo table
    const existing = await prisma.spo.findMany({
      where: { poolId: { in: targetPoolIds } },
      select: { poolId: true },
    });
    const existingSet = new Set(existing.map((s) => s.poolId));
    const missingIds = targetPoolIds.filter((id) => !existingSet.has(id));

    let created = 0;

    if (!dryRun) {
      // 3) Upsert all selected Koios pools into Spo table
      for (const id of targetPoolIds) {
        const trimmedId = id.trim();
        if (!trimmedId) continue;
        const p = poolMap.get(trimmedId);
        if (!p) continue;

        const activeEpochNo = toOptionalInt(p.active_epoch_no);
        const margin = toOptionalDecimalInput(p.margin);
        const fixedCost = toOptionalDecimalInput(p.fixed_cost);
        const pledge = toOptionalDecimalInput(p.pledge);
        const deposit = toOptionalDecimalInput(p.deposit);
        const activeStake = toOptionalDecimalInput(p.active_stake);
        const retiringEpoch = toOptionalInt(p.retiring_epoch);

        const ticker = asOptionalString(p.ticker);
        const poolGroup = asOptionalString(p.pool_group);
        const metaUrl = asOptionalString(p.meta_url);
        const metaHash = asOptionalString(p.meta_hash);
        const rewardAddr = asOptionalString(p.reward_addr);

        const wasExisting = existingSet.has(trimmedId);

        await prisma.spo.upsert({
          where: { poolId: trimmedId },
          update: {
            poolIdHex: asOptionalString(p.pool_id_hex ?? undefined),
            status: p.pool_status ?? undefined,
            ticker,
            poolGroup,
            metaUrl,
            metaHash,
            activeEpochNo,
            margin,
            fixedCost,
            pledge,
            deposit,
            rewardAddr,
            owners: p.owners ?? undefined,
            relays: p.relays ?? undefined,
            activeStake,
            retiringEpoch,
          },
          create: {
            poolId: trimmedId,
            poolIdHex: asOptionalString(p.pool_id_hex ?? undefined),
            status: p.pool_status ?? undefined,
            ticker,
            poolGroup,
            metaUrl,
            metaHash,
            activeEpochNo,
            margin,
            fixedCost,
            pledge,
            deposit,
            rewardAddr,
            owners: p.owners ?? undefined,
            relays: p.relays ?? undefined,
            activeStake,
            retiringEpoch,
          },
        });

        if (!wasExisting) {
          created++;
        }
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      totalKoiosPools,
      processedPools: targetPoolIds.length,
      existingPools: targetPoolIds.length - missingIds.length,
      missingPools: missingIds.length,
      createdPools: dryRun ? 0 : created,
      dryRun,
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
