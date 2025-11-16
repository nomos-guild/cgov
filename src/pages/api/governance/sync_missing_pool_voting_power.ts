import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_POOL_VP_HISTORY = `${KOIOS_BASE_URL}/pool_voting_power_history`;

type KoiosPoolVotingPowerRow = {
  pool_id_bech32?: string;
  epoch_no?: number;
  // Koios may include various numeric stake / voting power fields; we keep this loose.
  [key: string]: unknown;
};

type KoiosErrorDetail = {
  status?: number;
  message?: string;
  bodySnippet?: string;
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

function parseBooleanParam(value: string | string[] | undefined, fallback = false): boolean {
  const raw = firstString(value);
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return fallback;
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

function parseOptionalIntParam(value: string | string[] | undefined): number | undefined {
  const raw = firstString(value);
  if (raw === undefined) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}

function parseStringParam(value: string | string[] | undefined): string | undefined {
  const raw = firstString(value);
  return raw?.trim() || undefined;
}

function toOptionalDecimalInputPrimitive(value: unknown): string | undefined {
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

function toOptionalDecimalInput(value: unknown): string | undefined {
  const primitive = toOptionalDecimalInputPrimitive(value);
  if (primitive !== undefined) return primitive;

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidateKeys = ["value", "quantity", "amount", "lovelace", "int", "decimal"];
    for (const key of candidateKeys) {
      if (key in obj) {
        const nested = toOptionalDecimalInputPrimitive(obj[key]);
        if (nested !== undefined) return nested;
      }
    }
  }

  return undefined;
}

async function fetchPoolVotingPower(
  poolBech32: string,
  epochNo: number
): Promise<{ value?: string; rawRow?: KoiosPoolVotingPowerRow; error?: KoiosErrorDetail }> {
  const url = new URL(KOIOS_POOL_VP_HISTORY);
  url.searchParams.set("_pool_bech32", poolBech32);
  url.searchParams.set("_epoch_no", String(epochNo));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getKoiosHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      let bodySnippet: string | undefined;
      try {
        const text = await res.text();
        bodySnippet = text.slice(0, 500);
      } catch {
        // ignore
      }
      return {
        error: {
          status: res.status,
          message: `Koios pool_voting_power_history returned HTTP ${res.status}`,
          bodySnippet,
        },
      };
    }

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) {
      return {
        error: {
          message: "Koios pool_voting_power_history returned non-array response",
        },
      };
    }
    if (data.length === 0) {
      // No explicit history row for this (poolBech32, epochNo); treat as zero voting power.
      return { value: "0" };
    }

    const row = data[0] as KoiosPoolVotingPowerRow;
    if (!row || typeof row !== "object") {
      return {
        error: {
          message: "Koios pool_voting_power_history returned non-object row",
        },
      };
    }

    const candidates = ["voting_power", "voting_power_lovelace", "active_stake", "amount"];
    for (const key of candidates) {
      if (key in row) {
        const val = toOptionalDecimalInput((row as Record<string, unknown>)[key]);
        if (val !== undefined) {
          // NOTE: Koios typically reports stake in lovelace. We store the raw value
          // here without scaling, even though the column is named `votingPowerAda`.
          return { value: val, rawRow: row };
        }
      }
    }

    return { rawRow: row };
  } catch (err) {
    clearTimeout(timeout);
    const message =
      err instanceof Error ? err.message : "Unexpected error calling Koios pool_voting_power_history";
    return {
      error: {
        message,
      },
    };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const limit = parseIntParam(req.query.limit, 200, 1, 1000);
  const dryRun = parseBooleanParam(req.query.dry_run, false);
  const poolIdFilter =
    parseStringParam(req.query.pool_id) ??
    parseStringParam(req.query.pool_bech32) ??
    parseStringParam(req.query._pool_bech32);
  const epochFrom = parseOptionalIntParam(req.query.epoch_from);
  const epochTo = parseOptionalIntParam(req.query.epoch_to);

  if (epochFrom !== undefined && epochTo !== undefined && epochFrom > epochTo) {
    return res.status(400).json({
      error: "Invalid epoch range: epoch_from must be <= epoch_to",
    });
  }

  try {
    // 1) Find SPO votes that are missing votingPowerAda but have an epoch number.
    const where: NonNullable<
      Parameters<(typeof prisma.spoVote)["findMany"]>[0]
    >["where"] = {
      votingPowerAda: null,
      epochNo: { not: null },
    };

    if (poolIdFilter) {
      where.poolId = poolIdFilter;
    }
    if (epochFrom !== undefined || epochTo !== undefined) {
      where.epochNo = {
        ...(epochFrom !== undefined ? { gte: epochFrom } : {}),
        ...(epochTo !== undefined ? { lte: epochTo } : {}),
      };
    }

    const candidateVotes = await prisma.spoVote.findMany({
      where,
      select: {
        id: true,
        poolId: true,
        epochNo: true,
      },
      orderBy: { id: "asc" },
      take: limit * 2, // allow some duplication across (poolId, epochNo) pairs
    });

    if (candidateVotes.length === 0) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        candidateVotes: 0,
        distinctPairs: 0,
        processedPairs: 0,
        updatedVotes: 0,
        dryRun,
      });
    }

    // 2) Build distinct (poolId, epochNo) pairs, capped by `limit`.
    const pairMap = new Map<string, { poolId: string; epochNo: number; count: number }>();
    for (const v of candidateVotes) {
      if (!v.epochNo || !v.poolId) continue;
      const key = `${v.poolId}#${v.epochNo}`;
      const existing = pairMap.get(key);
      if (existing) {
        existing.count += 1;
      } else if (pairMap.size < limit) {
        pairMap.set(key, { poolId: v.poolId, epochNo: v.epochNo, count: 1 });
      }
    }

    const pairs = Array.from(pairMap.values());

    if (pairs.length === 0) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        candidateVotes: candidateVotes.length,
        distinctPairs: 0,
        processedPairs: 0,
        updatedVotes: 0,
        dryRun,
      });
    }

    if (dryRun) {
      const totalVotesCovered = pairs.reduce((acc, p) => acc + p.count, 0);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        candidateVotes: candidateVotes.length,
        distinctPairs: pairs.length,
        votesCoveredByPairs: totalVotesCovered,
        processedPairs: 0,
        updatedVotes: 0,
        dryRun: true,
      });
    }

    // 3) For each pair, fetch Koios voting power and update matching SpoVote rows.
    let processedPairs = 0;
    let updatedVotes = 0;
    let koiosErrors = 0;
    const koiosErrorDetails: {
      poolId: string;
      epochNo: number;
      error: KoiosErrorDetail;
    }[] = [];

    for (const pair of pairs) {
      const { poolId, epochNo } = pair;
      const result = await fetchPoolVotingPower(poolId, epochNo);
      processedPairs += 1;

      if (!result.value) {
        if (result.error) {
          koiosErrors += 1;
          if (koiosErrorDetails.length < 10) {
            koiosErrorDetails.push({
              poolId,
              epochNo,
              error: result.error,
            });
          }
        }
        continue;
      }

      const updateResult = await prisma.spoVote.updateMany({
        where: {
          poolId,
          epochNo,
          votingPowerAda: null,
        },
        data: {
          votingPowerAda: result.value,
        },
      });

      updatedVotes += updateResult.count;
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      candidateVotes: candidateVotes.length,
      distinctPairs: pairs.length,
      processedPairs,
      updatedVotes,
      koiosErrors,
      koiosErrorDetails,
      dryRun: false,
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


