import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_DREP_INFO_ENDPOINT = `${KOIOS_BASE_URL}/drep_info`;

type KoiosDrepInfo = {
  drep_id: string;
  hex?: string | null;
  has_script?: boolean | null;
  registered?: boolean | null;
  deposit?: unknown;
  active?: boolean | null;
  expires_epoch_no?: unknown;
  amount?: unknown;
  meta_url?: unknown;
  meta_hash?: unknown;
  meta_json?: unknown;
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
    // Basic validation: ensure it parses as a number
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // limit: max number of missing DReps to process from votes
  // batch_size: max number of DRep IDs per Koios request (Koios supports up to 100 per call)
  // dry_run: if true, do not write to DB, only report counts
  const limit = parseIntParam(req.query.limit, 200, 1, 2000);
  const batchSize = parseIntParam(req.query.batch_size, 50, 1, 100);
  const dryRun = parseBooleanParam(req.query.dry_run, false);

  try {
    // 1) Get distinct drepIds referenced in votes
    const distinctVotes = await prisma.drepVote.findMany({
      select: { drepId: true },
      distinct: ["drepId"],
      take: limit,
    });
    const voteIds = distinctVotes.map((v) => v.drepId).filter((id) => id && id.length > 0);
    if (voteIds.length === 0) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        totalVoteDreps: 0,
        existingDreps: 0,
        missingDreps: 0,
        createdDreps: 0,
        dryRun,
      });
    }

    // 2) Determine which of those are already present in Drep table
    const existing = await prisma.drep.findMany({
      where: { drepId: { in: voteIds } },
      select: { drepId: true },
    });
    const existingSet = new Set(existing.map((d) => d.drepId));
    const missingIds = voteIds.filter((id) => !existingSet.has(id));

    if (missingIds.length === 0) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        totalVoteDreps: voteIds.length,
        existingDreps: existingSet.size,
        missingDreps: 0,
        createdDreps: 0,
        dryRun,
      });
    }

    let created = 0;

    if (!dryRun) {
      // 3) Fetch Koios drep_info in batches and upsert into Drep table
      for (let i = 0; i < missingIds.length; i += batchSize) {
        const batchIds = missingIds.slice(i, i + batchSize);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        const koiosResponse = await fetch(KOIOS_DREP_INFO_ENDPOINT, {
          method: "POST",
          headers: {
            ...getKoiosHeaders(),
            "content-type": "application/json",
          },
          body: JSON.stringify({ _drep_ids: batchIds }),
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

        const dreps = json as KoiosDrepInfo[];
        for (const d of dreps) {
          if (!d || typeof d.drep_id !== "string" || !d.drep_id.trim()) continue;

          const deposit = toOptionalDecimalInput(d.deposit);
          const amount = toOptionalDecimalInput(d.amount);
          const expiresEpoch = toOptionalInt(d.expires_epoch_no);
          const metaUrl = asOptionalString(d.meta_url);
          const metaHash = asOptionalString(d.meta_hash);

          await prisma.drep.upsert({
            where: { drepId: d.drep_id },
            update: {
              hex: asOptionalString(d.hex),
              hasScript: d.has_script ?? undefined,
              registered: d.registered ?? undefined,
              deposit,
              active: d.active ?? undefined,
              expiresEpochNo: expiresEpoch,
              amount,
              metaUrl,
              metaHash,
              metaJson: d.meta_json ?? undefined,
            },
            create: {
              drepId: d.drep_id,
              hex: asOptionalString(d.hex),
              hasScript: d.has_script ?? undefined,
              registered: d.registered ?? undefined,
              deposit,
              active: d.active ?? undefined,
              expiresEpochNo: expiresEpoch,
              amount,
              metaUrl,
              metaHash,
              metaJson: d.meta_json ?? undefined,
            },
          });
          created++;
        }

        // Gentle pacing between batches
        await sleep(75);
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      totalVoteDreps: voteIds.length,
      existingDreps: existingSet.size,
      missingDreps: missingIds.length,
      createdDreps: dryRun ? 0 : created,
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


