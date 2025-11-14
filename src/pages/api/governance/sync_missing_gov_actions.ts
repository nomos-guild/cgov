import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Cardano mainnet constants
// Epoch duration: 5 days = 432,000 seconds
// Genesis timestamp: 2017-09-23T21:44:51Z = 1506203091 (UNIX seconds)
const EPOCH_SECONDS = 432_000;
const MAINNET_GENESIS_UNIX = 1_506_203_091;

const KOIOS_BASE_URL = "https://api.koios.rest/api/v1";
const KOIOS_PROPOSALS_ENDPOINT = `${KOIOS_BASE_URL}/proposal_list`;

type KoiosProposalType =
  | "ParameterChange"
  | "HardForkInitiation"
  | "TreasuryWithdrawals"
  | "NoConfidence"
  | "NewCommittee"
  | "NewConstitution"
  | "InfoAction";

type KoiosProposal = {
  block_time: number; // UNIX seconds
  proposal_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  proposal_type: KoiosProposalType;
  meta_url?: string | null;
  meta_hash?: string | null;
  meta_json?: unknown;
  proposal_description?: unknown;
  proposed_epoch?: number | string | null;
  ratified_epoch?: number | string | null;
  enacted_epoch?: number | string | null;
  dropped_epoch?: number | string | null;
  expired_epoch?: number | string | null;
  expiration?: number | string | null;
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

function epochFromUnixSeconds(unixSeconds: number): number {
  const delta = unixSeconds - MAINNET_GENESIS_UNIX;
  return Math.floor(delta / EPOCH_SECONDS);
}

function mapKoiosTypeToUiType(t: KoiosProposalType): string {
  switch (t) {
    case "InfoAction":
      return "Info";
    case "TreasuryWithdrawals":
      return "Treasury";
    case "NewConstitution":
      return "Constitution";
    default:
      // Keep the original for storage/visibility, UI may treat as "Info" or "All"
      return t;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts?: { retries?: number; baseDelayMs?: number; maxDelayMs?: number }
): Promise<Response> {
  const retries = opts?.retries ?? 5;
  const baseDelayMs = opts?.baseDelayMs ?? 750;
  const maxDelayMs = opts?.maxDelayMs ?? 10_000;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return res;
      // Retry on 429 or 5xx
      if ((res.status === 429 || (res.status >= 500 && res.status < 600)) && attempt < retries) {
        attempt++;
        const delay = Math.min(
          maxDelayMs,
          Math.round(baseDelayMs * 2 ** (attempt - 1) + Math.random() * 200)
        );
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      const isAbort =
        err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
      if (isAbort && attempt < retries) {
        attempt++;
        const delay = Math.min(
          maxDelayMs,
          Math.round(baseDelayMs * 2 ** (attempt - 1) + Math.random() * 200)
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return s.length > 0 ? s : undefined;
}

function extractBodyField(
  metaJson: unknown,
  key: "abstract" | "rationale" | "motivation"
): string | undefined {
  if (!metaJson || typeof metaJson !== "object") return undefined;
  const body = (metaJson as Record<string, unknown>).body;
  if (!body || typeof body !== "object") return undefined;
  return asNonEmptyString((body as Record<string, unknown>)[key]);
}

function extractReferences(metaJson: unknown): unknown | undefined {
  if (!metaJson || typeof metaJson !== "object") return undefined;
  const body = (metaJson as Record<string, unknown>).body;
  if (!body || typeof body !== "object") return undefined;
  const refs = (body as Record<string, unknown>).references;
  return refs === undefined ? undefined : refs;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function getCurrentEpoch(): number {
  const nowUnix = Math.floor(Date.now() / 1000);
  return epochFromUnixSeconds(nowUnix);
}

function deriveStatus(p: KoiosProposal): "Active" | "Ratified" | "Expired" | "Approved" | "Not approved" {
  const expiredEpoch = toOptionalNumber((p as Record<string, unknown>).expired_epoch);
  const droppedEpoch = toOptionalNumber((p as Record<string, unknown>).dropped_epoch);
  const enactedEpoch = toOptionalNumber((p as Record<string, unknown>).enacted_epoch);
  const ratifiedEpoch = toOptionalNumber((p as Record<string, unknown>).ratified_epoch);
  const expiration = toOptionalNumber((p as Record<string, unknown>).expiration);

  if (typeof expiredEpoch === "number") return "Expired";
  if (typeof droppedEpoch === "number") return "Not approved";
  if (typeof enactedEpoch === "number") return "Approved";
  if (typeof ratifiedEpoch === "number") return "Ratified";

  // Fallback: if expiration has passed, consider expired
  if (typeof expiration === "number") {
    const nowEpoch = getCurrentEpoch();
    if (nowEpoch >= expiration) return "Expired";
  }

  return "Active";
}

async function upsertProposal(p: KoiosProposal) {
  const submissionEpoch = epochFromUnixSeconds(p.block_time);
  const expiryEpoch = submissionEpoch + 6; // heuristic fallback
  const uiType = mapKoiosTypeToUiType(p.proposal_type);
  const derivedStatus = deriveStatus(p);

  // Ensure unique by proposalId
  const existing = await prisma.governanceAction.findUnique({
    where: { proposalId: p.proposal_id },
    select: { id: true, title: true },
  });
  if (existing) {
    // noop, but do a light touch update to bump updatedAt for cooldown usefulness
    await prisma.governanceAction.update({
      where: { id: existing.id },
      data: { title: existing.title }, // write same value to bump updatedAt
    });
    return { created: false, id: existing.id };
  }

  const title = `${uiType} action ${p.proposal_id.slice(0, 12)}`;
  const description = extractBodyField(p.meta_json, "abstract");
  const rationale = extractBodyField(p.meta_json, "rationale");
  const motivation = extractBodyField(p.meta_json, "motivation");
  const anchorUrl = asNonEmptyString(p.meta_url ?? undefined);
  const anchorHash = asNonEmptyString(p.meta_hash ?? undefined);
  const references = extractReferences(p.meta_json);
  const referencesJson: Prisma.InputJsonValue | undefined = references as Prisma.InputJsonValue;
  const created = await prisma.governanceAction.create({
    data: {
      proposalId: p.proposal_id,
      txHash: p.proposal_tx_hash,
      title,
      type: uiType,
      status: derivedStatus,
      submissionEpoch,
      expiryEpoch,
      description,
      rationale,
      motivation,
      anchorUrl,
      anchorHash,
      constitutionality: "Constitutional",
      references: referencesJson,
    },
    select: { id: true },
  });
  return { created: true, id: created.id };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // 1) Read all proposalIds present in DB
    const existing = await prisma.governanceAction.findMany({
      select: { proposalId: true },
    });
    const existingIds = new Set(existing.map((e) => e.proposalId));

    // 2) Fetch all proposals from Koios (filtered to known/allowed types)
    const resKoios = await fetchWithRetry(
      KOIOS_PROPOSALS_ENDPOINT,
      { method: "GET", headers: getKoiosHeaders() },
      { retries: 5 }
    );
    if (!resKoios.ok) {
      return res
        .status(502)
        .json({ error: "Bad Gateway", detail: `Koios responded ${resKoios.status}` });
    }
    const proposals = (await resKoios.json()) as KoiosProposal[];
    const allowed: ReadonlySet<KoiosProposalType> = new Set<KoiosProposalType>([
      "ParameterChange",
      "HardForkInitiation",
      "TreasuryWithdrawals",
      "NoConfidence",
      "NewCommittee",
      "NewConstitution",
      "InfoAction",
    ]);
    const filtered = proposals.filter(
      (p) =>
        typeof p.proposal_id === "string" &&
        typeof p.block_time === "number" &&
        allowed.has(p.proposal_type as KoiosProposalType)
    );

    // 3) Determine missing IDs
    const missing = filtered.filter((p) => !existingIds.has(p.proposal_id));

    // 4) Upsert all missing proposals
    let createdCount = 0;
    for (const p of missing) {
      const result = await upsertProposal(p);
      if (result.created) createdCount++;
      // gentle pacing
      await sleep(60);
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      totalKoios: proposals.length,
      filteredKoios: filtered.length,
      existingInDb: existingIds.size,
      missingCount: missing.length,
      createdProposals: createdCount,
      now: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal Server Error", detail: message });
  }
}


