import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_DREP_LIST_ENDPOINT = `${KOIOS_BASE_URL}/drep_list`;
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

type DrepInfoFetchDebug = {
  totalRequested: number;
  totalBatches: number;
  okBatches: number;
  errorBatches: number;
  lastErrorStatus?: number;
  lastErrorBodySnippet?: string;
  lastNonArrayBodySnippet?: string;
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

function toOptionalDecimalInputPrimitive(value: unknown): string | undefined {
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

function toOptionalDecimalInput(value: unknown): string | undefined {
  // Handle primitive-like values first
  const primitive = toOptionalDecimalInputPrimitive(value);
  if (primitive !== undefined) return primitive;

  // Koios sometimes encodes numeric fields as objects; try common nested keys.
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

function toOptionalInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidateKeys = ["value", "epoch", "int"];
    for (const key of candidateKeys) {
      if (key in obj) {
        const nested = toOptionalInt(obj[key]);
        if (nested !== undefined) return nested;
      }
    }
  }
  return undefined;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const s = value.trim();
    return s.length > 0 ? s : undefined;
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Common patterns for URL / hash wrapper objects
    const candidateKeys = ["url", "href", "value", "hex"];
    for (const key of candidateKeys) {
      if (key in obj && typeof obj[key] === "string") {
        const s = (obj[key] as string).trim();
        if (s.length > 0) return s;
      }
    }
  }

  return undefined;
}

async function fetchDrepInfoMap(
  drepIds: string[]
): Promise<{ infoMap: Map<string, KoiosDrepInfo>; debug: DrepInfoFetchDebug }> {
  const infoMap = new Map<string, KoiosDrepInfo>();

  const debug: DrepInfoFetchDebug = {
    totalRequested: drepIds.length,
    totalBatches: 0,
    okBatches: 0,
    errorBatches: 0,
  };

  if (drepIds.length === 0) {
    return { infoMap, debug };
  }

  // Koios has a 5KB body limit on this endpoint; keep batches small enough to stay under it.
  // With bech32 DRep IDs, 20 per batch keeps us comfortably below the limit.
  const BATCH_SIZE = 20;

  const trimmedIds = drepIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  for (let i = 0; i < trimmedIds.length; i += BATCH_SIZE) {
    const batch = trimmedIds.slice(i, i + BATCH_SIZE);
    if (batch.length === 0) continue;

    debug.totalBatches += 1;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const headers: HeadersInit = {
        ...getKoiosHeaders(),
        "content-type": "application/json",
      };

      const response = await fetch(KOIOS_DREP_INFO_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ _drep_ids: batch }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        // If drep_info fails, skip this batch but continue with others & fallback to drep_list data.
        debug.errorBatches += 1;
        debug.lastErrorStatus = response.status;
        try {
          const text = await response.text();
          debug.lastErrorBodySnippet = text.slice(0, 500);
        } catch {
          // ignore
        }
        continue;
      }

      const json = (await response.json()) as unknown;
      if (!Array.isArray(json)) {
        debug.okBatches += 1;
        try {
          debug.lastNonArrayBodySnippet = JSON.stringify(json).slice(0, 500);
        } catch {
          // ignore
        }
        continue;
      }

      debug.okBatches += 1;

      const infos = json as KoiosDrepInfo[];

      for (const info of infos) {
        if (!info || typeof info.drep_id !== "string") continue;
        const id = info.drep_id.trim();
        if (!id) continue;
        infoMap.set(id, info);
      }
    } catch {
      clearTimeout(timeout);
      // On error, just skip this batch and continue; we'll fall back to drep_list-only data.
    }
  }

  return { infoMap, debug };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // limit: max number of Koios DReps to upsert in this run (after de-dup)
  // dry_run: if true, do not write to DB, only report counts
  const limit = parseIntParam(req.query.limit, 2000, 1, 10_000);
  const dryRun = parseBooleanParam(req.query.dry_run, false);

  try {
    // 1) Fetch full DRep list from Koios (authoritative DRep set)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const koiosResponse = await fetch(KOIOS_DREP_LIST_ENDPOINT, {
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
        error: "Unexpected response shape from Koios drep_list",
      });
    }

    const dreps = json as KoiosDrepInfo[];

    // Normalize and de-duplicate DReps by drep_id
    const drepListMap = new Map<string, KoiosDrepInfo>();
    for (const d of dreps) {
      if (!d || typeof d.drep_id !== "string") continue;
      const id = d.drep_id.trim();
      if (!id) continue;
      if (!drepListMap.has(id)) {
        drepListMap.set(id, d);
      }
    }

    const allDrepIds = Array.from(drepListMap.keys());
    const totalKoiosDreps = allDrepIds.length;

    if (totalKoiosDreps === 0) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        totalKoiosDreps: 0,
        processedDreps: 0,
        existingDreps: 0,
        missingDreps: 0,
        createdDreps: 0,
        dryRun,
      });
    }

    // Restrict how many we process in this run
    const targetDrepIds = allDrepIds.slice(0, limit);

    // Fetch enriched DRep info from Koios for the target IDs
    const { infoMap: drepInfoMap, debug: drepInfoFetchDebug } = await fetchDrepInfoMap(
      targetDrepIds
    );

    // 2) Determine which of those are already present in Drep table
    const existing = await prisma.drep.findMany({
      where: { drepId: { in: targetDrepIds } },
      select: { drepId: true },
    });
    const existingSet = new Set(existing.map((d) => d.drepId));
    const missingIds = targetDrepIds.filter((id) => !existingSet.has(id));

    let created = 0;

    if (!dryRun) {
      // 3) Upsert Koios DReps into Drep table
      for (const id of targetDrepIds) {
        const trimmedId = id.trim();
        if (!trimmedId) continue;

        // Prefer detailed /drep_info data when available, fall back to /drep_list.
        const d = drepInfoMap.get(trimmedId) ?? drepListMap.get(trimmedId);
        if (!d) continue;

        const deposit = toOptionalDecimalInput(d.deposit);
        const amount = toOptionalDecimalInput(d.amount);
        const expiresEpoch = toOptionalInt(d.expires_epoch_no);
        const metaUrl = asOptionalString(d.meta_url);
        const metaHash = asOptionalString(d.meta_hash);

        const wasExisting = existingSet.has(trimmedId);

        await prisma.drep.upsert({
          where: { drepId: trimmedId },
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
            drepId: trimmedId,
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

        if (!wasExisting) {
          created++;
        }
      }
    }

    // Prepare some lightweight debug info about /drep_info usage in the response
    const drepInfoIdsSample = Array.from(drepInfoMap.keys()).slice(0, 5);
    const drepInfoMissingSample = targetDrepIds
      .filter((id) => !drepInfoMap.has(id.trim()))
      .slice(0, 5);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      totalKoiosDreps,
      processedDreps: targetDrepIds.length,
      existingDreps: targetDrepIds.length - missingIds.length,
      missingDreps: missingIds.length,
      createdDreps: dryRun ? 0 : created,
      drepInfoRequested: targetDrepIds.length,
      drepInfoReceived: drepInfoMap.size,
      drepInfoDebug: {
        receivedIdsSample: drepInfoIdsSample,
        missingIdsSample: drepInfoMissingSample,
        fetch: drepInfoFetchDebug,
      },
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


